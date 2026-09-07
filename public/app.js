let isAdminLoggedIn = false;
let adminPassword = sessionStorage.getItem("adminPassword") || "";
let awardsCache = [];
let editingAwardId = null;

// Converts common Google Drive "share" link formats into a direct-image
// link that actually renders in an <img> tag. Leaves non-Drive URLs untouched.
function normalizePhotoUrl(url) {
  if (!url) return url;
  const trimmed = url.trim();
  let fileId = null;

  let m = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) fileId = m[1];

  if (!fileId) {
    m = trimmed.match(/[?&]id=([^&]+)/);
    if (m && trimmed.includes("drive.google.com")) fileId = m[1];
  }

  if (!fileId) {
    m = trimmed.match(/drive\.google\.com\/uc\?id=([^&]+)/);
    if (m) fileId = m[1];
  }

  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return trimmed;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// ---------- API helpers ----------
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}
async function apiSend(path, method, body, admin = false) {
  const headers = { "Content-Type": "application/json" };
  if (admin) headers["x-admin-password"] = adminPassword;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Request failed: " + res.status);
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Navigation ----------
function showView(view) {
  ["home", "detail", "contact", "admin"].forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("hidden", v !== view);
  });
  document.getElementById("nav-home").classList.toggle("active", view === "home");
  document.getElementById("nav-contact").classList.toggle("active", view === "contact");
  window.scrollTo({ top: 0 });
  if (view === "contact") loadSiteInfo();
  if (view === "admin" && isAdminLoggedIn) refreshAdminData();
}

// ---------- Home: Awards ----------
async function loadAwards() {
  try {
    awardsCache = await apiGet("/api/awards");
  } catch (e) {
    awardsCache = [];
  }
  renderAwardGrid();
}
function renderAwardGrid() {
  const grid = document.getElementById("award-grid");
  const empty = document.getElementById("award-empty");
  const loading = document.getElementById("awards-loading");
  loading.classList.add("hidden");
  if (!awardsCache.length) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  grid.classList.remove("hidden");
  grid.innerHTML = awardsCache
    .map((a) => {
      const cover =
        a.photos && a.photos[0]
          ? `<img class="tile-cover" src="${escapeHtml(normalizePhotoUrl(a.photos[0]))}" alt="${escapeHtml(a.title)}">`
          : `<div class="tile-cover-fallback">
             <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#B8873B" stroke-width="1.5">
               <path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2.4 4.8 6 4.4c2.1-.2 3.7 1 6 3.3 2.3-2.3 3.9-3.5 6-3.3 3.6.4 5.5 3.8 4 7.3-2.5 4.7-10 9.3-10 9.3z"/>
             </svg>
           </div>`;
      const meta = [a.year, a.org].filter(Boolean).join(" · ");
      return `
        <button class="award-card-btn" onclick="openDetail('${a.id}')">
          <div class="award-tile">
            ${cover}
            <div class="tile-body">
              <div class="tile-title">${escapeHtml(a.title)}</div>
              <div class="tile-meta en">${escapeHtml(meta)}</div>
              <div>${escapeHtml(a.shortDesc || "")}</div>
              <span class="tile-link en">View Details →</span>
            </div>
          </div>
        </button>`;
    })
    .join("");
}
function renderDescription(text) {
  const container = document.getElementById("d-desc");
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    container.innerHTML = "";
    return;
  }
  // Paragraphs are separated by a blank line. Within a paragraph, single
  // line breaks are treated as soft wraps and joined into flowing text
  // so it fills the full width instead of breaking at every line.
  const blocks = normalized
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((s) => s.trim()).filter(Boolean).join(" "))
    .filter(Boolean);
  container.innerHTML = blocks.map((b) => `<p>${escapeHtml(b)}</p>`).join("");
}

function openDetail(id) {
  const a = awardsCache.find((x) => x.id === id);
  if (!a) return;
  document.getElementById("d-title").textContent = a.title;
  const meta = [];
  if (a.year) meta.push("वर्ष: " + a.year);
  if (a.org) meta.push("संस्था: " + a.org);
  document.getElementById("d-meta").textContent = meta.join("   |   ");
  renderDescription(a.description || "");
  renderSlider(a.photos || [], a.title);
  currentDetailAwardId = a.id;
  document.getElementById("detail-comment-form").reset();
  document.getElementById("detail-comment-error").classList.add("hidden");
  loadDetailComments(a.id);
  showView("detail");
}

// ---------- Image slider (award detail gallery, one photo at a time) ----------
let sliderPhotos = [];
let sliderIndex = 0;

function renderSlider(photos, altText) {
  sliderPhotos = photos || [];
  sliderIndex = 0;
  const wrap = document.getElementById("gallery-slider");
  const track = document.getElementById("slider-track");
  const dots = document.getElementById("slider-dots");
  if (!sliderPhotos.length) {
    wrap.classList.add("hidden");
    track.innerHTML = "";
    dots.innerHTML = "";
    return;
  }
  wrap.classList.remove("hidden");
  wrap.classList.toggle("single-photo", sliderPhotos.length === 1);
  track.innerHTML = sliderPhotos
    .map((p) => `<img src="${escapeHtml(normalizePhotoUrl(p))}" alt="${escapeHtml(altText || "")}">`)
    .join("");
  dots.innerHTML = sliderPhotos
    .map(
      (_, i) =>
        `<button type="button" class="slider-dot${i === 0 ? " active" : ""}" onclick="slideTo(${i})" aria-label="Go to photo ${i + 1}"></button>`
    )
    .join("");
  updateSliderPosition();
}
function updateSliderPosition() {
  const track = document.getElementById("slider-track");
  track.style.transform = `translateX(-${sliderIndex * 100}%)`;
  document
    .querySelectorAll("#slider-dots .slider-dot")
    .forEach((d, i) => d.classList.toggle("active", i === sliderIndex));
}
function slideNext() {
  if (!sliderPhotos.length) return;
  sliderIndex = (sliderIndex + 1) % sliderPhotos.length;
  updateSliderPosition();
}
function slidePrev() {
  if (!sliderPhotos.length) return;
  sliderIndex = (sliderIndex - 1 + sliderPhotos.length) % sliderPhotos.length;
  updateSliderPosition();
}
function slideTo(i) {
  sliderIndex = i;
  updateSliderPosition();
}
function initSliderTouch() {
  const vp = document.getElementById("slider-viewport");
  let touchStartX = null;
  vp.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  vp.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        dx > 0 ? slidePrev() : slideNext();
      }
      touchStartX = null;
    },
    { passive: true }
  );
}

// ---------- Comments (shared logic for home/general and per-award) ----------
let currentDetailAwardId = null;

function buildCommentTree(comments) {
  const byId = {};
  comments.forEach((c) => (byId[c.id] = { ...c, children: [] }));
  const roots = [];
  comments.forEach((c) => {
    if (c.parent_id && byId[c.parent_id]) {
      byId[c.parent_id].children.push(byId[c.id]);
    } else {
      roots.push(byId[c.id]);
    }
  });
  roots.sort((a, b) => b.created_at - a.created_at);
  const sortChildren = (node) => {
    node.children.sort((a, b) => a.created_at - b.created_at);
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);
  return roots;
}

function renderCommentNode(node, awardId) {
  const awardArg = awardId ? `'${awardId}'` : "null";
  const childrenHtml = node.children.map((ch) => renderCommentNode(ch, awardId)).join("");
  return `
    <li class="comment-item">
      <div class="c-head">
        <span class="c-name">${escapeHtml(node.name)}</span>
        <span class="en">${new Date(node.created_at).toLocaleDateString()}</span>
      </div>
      <div class="c-text">${escapeHtml(node.text)}</div>
      <button type="button" class="reply-btn en" onclick="toggleReplyForm('${node.id}')">Reply</button>
      <div class="reply-form-wrap hidden" id="reply-form-${node.id}">
        <div class="field">
          <label class="en">Name</label>
          <input type="text" id="reply-name-${node.id}" maxlength="60">
        </div>
        <div class="field">
          <label class="en">Reply</label>
          <textarea id="reply-text-${node.id}" rows="2" maxlength="600"></textarea>
        </div>
        <div class="admin-row-actions">
          <button type="button" class="btn btn-primary btn-small en" onclick="submitReply('${node.id}', ${awardArg})">Post Reply</button>
          <button type="button" class="btn btn-ghost btn-small en" onclick="toggleReplyForm('${node.id}')">Cancel</button>
        </div>
        <div class="error-text hidden" id="reply-error-${node.id}"></div>
      </div>
      ${childrenHtml ? `<ul class="reply-list">${childrenHtml}</ul>` : ""}
    </li>`;
}

function renderCommentsInto(comments, listId, emptyId, loadingId, awardId) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  const loading = document.getElementById(loadingId);
  if (loading) loading.classList.add("hidden");
  if (!comments.length) {
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  const tree = buildCommentTree(comments);
  list.innerHTML = tree.map((node) => renderCommentNode(node, awardId)).join("");
}

function toggleReplyForm(commentId) {
  document.getElementById("reply-form-" + commentId).classList.toggle("hidden");
}

async function submitReply(parentId, awardId) {
  const nameEl = document.getElementById("reply-name-" + parentId);
  const textEl = document.getElementById("reply-text-" + parentId);
  const errEl = document.getElementById("reply-error-" + parentId);
  const name = nameEl.value.trim();
  const replyText = textEl.value.trim();
  errEl.classList.add("hidden");
  if (!name || !replyText) {
    errEl.textContent = "कृपया नाव आणि उत्तर दोन्ही भरा.";
    errEl.classList.remove("hidden");
    return;
  }
  try {
    await apiSend("/api/comments", "POST", {
      name,
      text: replyText,
      awardId: awardId || undefined,
      parentId,
    });
    nameEl.value = "";
    textEl.value = "";
    document.getElementById("reply-form-" + parentId).classList.add("hidden");
    if (awardId) {
      loadDetailComments(awardId);
    } else {
      loadComments();
    }
  } catch (err) {
    errEl.textContent = "उत्तर पाठवताना अडचण आली, पुन्हा प्रयत्न करा.";
    errEl.classList.remove("hidden");
  }
}

// ---------- Home: general comments ----------
async function loadComments() {
  let comments = [];
  try {
    comments = await apiGet("/api/comments?scope=general");
  } catch (e) {
    comments = [];
  }
  renderCommentsInto(comments, "comment-list", "comment-empty", "comments-loading", null);
}
async function submitComment(e) {
  e.preventDefault();
  const name = document.getElementById("c-name").value.trim();
  const commentText = document.getElementById("c-text").value.trim();
  const errEl = document.getElementById("comment-error");
  errEl.classList.add("hidden");
  if (!name || !commentText) {
    errEl.textContent = "कृपया नाव आणि अभिप्राय दोन्ही भरा.";
    errEl.classList.remove("hidden");
    return;
  }
  try {
    await apiSend("/api/comments", "POST", { name, text: commentText });
    document.getElementById("comment-form").reset();
    loadComments();
  } catch (err) {
    errEl.textContent = "अभिप्राय जतन करताना अडचण आली, पुन्हा प्रयत्न करा.";
    errEl.classList.remove("hidden");
  }
}

// ---------- Detail page: per-award comments ----------
async function loadDetailComments(awardId) {
  const loading = document.getElementById("detail-comments-loading");
  loading.classList.remove("hidden");
  let comments = [];
  try {
    comments = await apiGet("/api/comments?awardId=" + encodeURIComponent(awardId));
  } catch (e) {
    comments = [];
  }
  renderCommentsInto(
    comments,
    "detail-comment-list",
    "detail-comment-empty",
    "detail-comments-loading",
    awardId
  );
}
async function submitDetailComment(e) {
  e.preventDefault();
  const name = document.getElementById("dc-name").value.trim();
  const commentText = document.getElementById("dc-text").value.trim();
  const errEl = document.getElementById("detail-comment-error");
  errEl.classList.add("hidden");
  if (!name || !commentText) {
    errEl.textContent = "कृपया नाव आणि अभिप्राय दोन्ही भरा.";
    errEl.classList.remove("hidden");
    return;
  }
  try {
    await apiSend("/api/comments", "POST", {
      name,
      text: commentText,
      awardId: currentDetailAwardId,
    });
    document.getElementById("detail-comment-form").reset();
    loadDetailComments(currentDetailAwardId);
  } catch (err) {
    errEl.textContent = "अभिप्राय जतन करताना अडचण आली, पुन्हा प्रयत्न करा.";
    errEl.classList.remove("hidden");
  }
}

function renderSlogan(info) {
  const el = document.getElementById("hero-slogan");
  if (info && info.slogan) {
    el.textContent = info.slogan;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

function renderSiteLogo(info) {
  const logo = document.getElementById("site-logo");
  if (info && info.logo_url) {
    logo.src = normalizePhotoUrl(info.logo_url);
    logo.classList.remove("hidden");
  } else {
    logo.classList.add("hidden");
  }
}

// ---------- Hero photo ----------
function renderHeroVisual(info) {
  const img = document.getElementById("hero-photo");
  const pulse = document.getElementById("hero-pulse");
  if (info && info.hero_photo) {
    img.src = normalizePhotoUrl(info.hero_photo);
    img.classList.remove("hidden");
    pulse.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    pulse.classList.remove("hidden");
  }
}

// ---------- Contact ----------
async function loadSiteInfo() {
  let info = { phone: "", email: "", address: "", hero_photo: "", logo_url: "", slogan: "" };
  try {
    info = await apiGet("/api/site-info");
  } catch (e) {}
  document.getElementById("ci-phone").textContent = info.phone || "—";
  document.getElementById("ci-email").textContent = info.email || "—";
  document.getElementById("ci-address").textContent = info.address || "—";
  renderHeroVisual(info);
  renderSiteLogo(info);
  renderSlogan(info);
  return info;
}
async function submitContact(e) {
  e.preventDefault();
  const name = document.getElementById("k-name").value.trim();
  const email = document.getElementById("k-email").value.trim();
  const phone = document.getElementById("k-phone").value.trim();
  const message = document.getElementById("k-message").value.trim();
  const errEl = document.getElementById("contact-error");
  const okEl = document.getElementById("contact-confirm");
  errEl.classList.add("hidden");
  okEl.classList.add("hidden");
  if (!name || !message) {
    errEl.textContent = "कृपया नाव आणि संदेश भरा.";
    errEl.classList.remove("hidden");
    return;
  }
  try {
    await apiSend("/api/messages", "POST", { name, email, phone, message });
    document.getElementById("contact-form").reset();
    okEl.classList.remove("hidden");
  } catch (err) {
    errEl.textContent = "संदेश पाठवताना अडचण आली, पुन्हा प्रयत्न करा.";
    errEl.classList.remove("hidden");
  }
}

// ---------- Admin: auth ----------
async function adminLogin() {
  const val = document.getElementById("admin-pass").value;
  const errEl = document.getElementById("admin-login-error");
  errEl.classList.add("hidden");
  try {
    await apiSend("/api/admin-login", "POST", { password: val });
    adminPassword = val;
    sessionStorage.setItem("adminPassword", val);
    isAdminLoggedIn = true;
    document.getElementById("admin-login-wrap").classList.add("hidden");
    document.getElementById("admin-dashboard").classList.remove("hidden");
    refreshAdminData();
  } catch (e) {
    errEl.classList.remove("hidden");
  }
}
function adminLogout() {
  isAdminLoggedIn = false;
  adminPassword = "";
  sessionStorage.removeItem("adminPassword");
  document.getElementById("admin-pass").value = "";
  document.getElementById("admin-login-error").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.add("hidden");
  document.getElementById("admin-login-wrap").classList.remove("hidden");
}
function switchAdminTab(tab) {
  document.querySelectorAll(".admin-tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  ["awards", "comments", "messages", "siteinfo"].forEach((t) => {
    document.getElementById("admin-panel-" + t).classList.toggle("active", t === tab);
  });
}
async function refreshAdminData() {
  await loadAwards();
  renderAdminAwardsTable();
  try {
    const comments = await apiGet("/api/comments");
    renderAdminCommentsTable(comments);
  } catch (e) {}
  try {
    const messages = await apiSend("/api/messages", "GET", undefined, true);
    renderAdminMessagesTable(messages);
  } catch (e) {}
  try {
    const info = await apiGet("/api/site-info");
    document.getElementById("si-phone").value = info.phone || "";
    document.getElementById("si-email").value = info.email || "";
    document.getElementById("si-address").value = info.address || "";
    document.getElementById("si-hero-photo").value = info.hero_photo || "";
    document.getElementById("si-logo-url").value = info.logo_url || "";
    document.getElementById("si-slogan").value = info.slogan || "";
  } catch (e) {}
}

// ---------- Admin: Awards CRUD ----------
function renderAdminAwardsTable() {
  const body = document.getElementById("admin-awards-body");
  if (!awardsCache.length) {
    body.innerHTML = `<tr><td colspan="4" class="hint">No awards yet.</td></tr>`;
    return;
  }
  body.innerHTML = awardsCache
    .map(
      (a) => `
      <tr>
        <td>${escapeHtml(a.title)}</td>
        <td>${escapeHtml(a.year || "")}</td>
        <td>${escapeHtml(a.org || "")}</td>
        <td>
          <div class="admin-row-actions">
            <button class="btn btn-ghost btn-small en" onclick="editAward('${a.id}')">Edit</button>
            <button class="btn btn-danger btn-small en" onclick="deleteAward('${a.id}')">Delete</button>
          </div>
        </td>
      </tr>`
    )
    .join("");
}
function resetAwardForm() {
  editingAwardId = null;
  document.getElementById("award-form-title").textContent = "Add Award";
  document.getElementById("a-id").value = "";
  document.getElementById("a-title").value = "";
  document.getElementById("a-year").value = "";
  document.getElementById("a-org").value = "";
  document.getElementById("a-photos").value = "";
  document.getElementById("a-short").value = "";
  document.getElementById("a-desc").value = "";
  document.getElementById("award-error").classList.add("hidden");
}
function editAward(id) {
  const a = awardsCache.find((x) => x.id === id);
  if (!a) return;
  editingAwardId = id;
  document.getElementById("award-form-title").textContent = "Edit Award";
  document.getElementById("a-id").value = a.id;
  document.getElementById("a-title").value = a.title || "";
  document.getElementById("a-year").value = a.year || "";
  document.getElementById("a-org").value = a.org || "";
  document.getElementById("a-photos").value = (a.photos || []).join(", ");
  document.getElementById("a-short").value = a.shortDesc || "";
  document.getElementById("a-desc").value = a.description || "";
  window.scrollTo({ top: 0 });
}
async function saveAward(e) {
  e.preventDefault();
  const errEl = document.getElementById("award-error");
  errEl.classList.add("hidden");
  const title = document.getElementById("a-title").value.trim();
  if (!title) return;
  const photos = document
    .getElementById("a-photos")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizePhotoUrl);
  const record = {
    title,
    year: document.getElementById("a-year").value.trim(),
    org: document.getElementById("a-org").value.trim(),
    photos,
    shortDesc: document.getElementById("a-short").value.trim(),
    description: document.getElementById("a-desc").value.trim(),
  };
  try {
    if (editingAwardId) {
      await apiSend("/api/awards/" + editingAwardId, "PUT", record, true);
    } else {
      await apiSend("/api/awards", "POST", record, true);
    }
    await loadAwards();
    renderAdminAwardsTable();
    resetAwardForm();
  } catch (err) {
    errEl.textContent = "Could not save the award. Check your admin session and try again.";
    errEl.classList.remove("hidden");
  }
}
async function deleteAward(id) {
  try {
    await apiSend("/api/awards/" + id, "DELETE", undefined, true);
    await loadAwards();
    renderAdminAwardsTable();
    if (editingAwardId === id) resetAwardForm();
  } catch (e) {}
}

// ---------- Admin: Comments moderation ----------
function renderAdminCommentsTable(comments) {
  const body = document.getElementById("admin-comments-body");
  if (!comments.length) {
    body.innerHTML = `<tr><td colspan="5" class="hint">No comments yet.</td></tr>`;
    return;
  }
  const byId = {};
  comments.forEach((c) => (byId[c.id] = c));
  body.innerHTML = comments
    .map((c) => {
      const award = c.award_id ? awardsCache.find((a) => a.id === c.award_id) : null;
      const articleLabel = c.award_id ? escapeHtml(award ? award.title : "(deleted award)") : "Home";
      const parent = c.parent_id ? byId[c.parent_id] : null;
      const nameLabel = parent
        ? `${escapeHtml(c.name)} <span class="hint">(reply to ${escapeHtml(parent.name)})</span>`
        : escapeHtml(c.name);
      return `
      <tr>
        <td>${nameLabel}</td>
        <td>${escapeHtml(c.text)}</td>
        <td class="en">${articleLabel}</td>
        <td class="en">${new Date(c.created_at).toLocaleString()}</td>
        <td><button class="btn btn-danger btn-small en" onclick="deleteComment('${c.id}')">Delete</button></td>
      </tr>`;
    })
    .join("");
}
async function deleteComment(id) {
  try {
    await apiSend("/api/comments/" + id, "DELETE", undefined, true);
    const comments = await apiGet("/api/comments");
    renderAdminCommentsTable(comments);
    loadComments();
    if (currentDetailAwardId) loadDetailComments(currentDetailAwardId);
  } catch (e) {}
}

// ---------- Admin: Messages ----------
function renderAdminMessagesTable(messages) {
  const body = document.getElementById("admin-messages-body");
  if (!messages.length) {
    body.innerHTML = `<tr><td colspan="6" class="hint">No messages yet.</td></tr>`;
    return;
  }
  body.innerHTML = messages
    .map(
      (m) => `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.email)}</td>
        <td>${escapeHtml(m.phone)}</td>
        <td>${escapeHtml(m.message)}</td>
        <td class="en">${new Date(m.created_at).toLocaleString()}</td>
        <td><button class="btn btn-danger btn-small en" onclick="deleteMessage('${m.id}')">Delete</button></td>
      </tr>`
    )
    .join("");
}
async function deleteMessage(id) {
  try {
    await apiSend("/api/messages/" + id, "DELETE", undefined, true);
    const messages = await apiSend("/api/messages", "GET", undefined, true);
    renderAdminMessagesTable(messages);
  } catch (e) {}
}

// ---------- Admin: Site Info ----------
async function saveSiteInfo(e) {
  e.preventDefault();
  const info = {
    phone: document.getElementById("si-phone").value.trim(),
    email: document.getElementById("si-email").value.trim(),
    address: document.getElementById("si-address").value.trim(),
    heroPhoto: normalizePhotoUrl(document.getElementById("si-hero-photo").value.trim()),
    logoUrl: normalizePhotoUrl(document.getElementById("si-logo-url").value.trim()),
    slogan: document.getElementById("si-slogan").value.trim(),
  };
  try {
    await apiSend("/api/site-info", "PUT", info, true);
    const saved = document.getElementById("siteinfo-saved");
    saved.classList.remove("hidden");
    setTimeout(() => saved.classList.add("hidden"), 1800);
    loadSiteInfo();
  } catch (e) {}
}

// ---------- Init ----------
(async function init() {
  document.getElementById("nav-home").classList.add("active");
  if (adminPassword) isAdminLoggedIn = true;
  initSliderTouch();
  await loadAwards();
  await loadComments();
  await loadSiteInfo();
})();
