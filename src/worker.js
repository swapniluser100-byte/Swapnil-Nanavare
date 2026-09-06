function isAdmin(request, env) {
  return request.headers.get("x-admin-password") === env.ADMIN_PASSWORD;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function text(msg, status) {
  return new Response(msg, { status });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path.startsWith("/api/")) {
      try {
        return await handleApi(path, method, request, env);
      } catch (err) {
        return text("Server error: " + err.message, 500);
      }
    }

    // Everything else is a static file (index.html, style.css, app.js, ...)
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(path, method, request, env) {
  // ---------- /api/awards ----------
  if (path === "/api/awards" && method === "GET") {
    const { results } = await env.DB
      .prepare("SELECT * FROM awards ORDER BY created_at DESC")
      .all();
    const awards = results.map((r) => ({
      id: r.id,
      title: r.title,
      year: r.year,
      org: r.org,
      shortDesc: r.short_desc,
      description: r.description,
      photos: JSON.parse(r.photos || "[]"),
    }));
    return json(awards);
  }

  if (path === "/api/awards" && method === "POST") {
    if (!isAdmin(request, env)) return text("Unauthorized", 401);
    const body = await request.json();
    if (!body.title) return text("Title is required", 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO awards (id, title, year, org, short_desc, description, photos, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        body.title,
        body.year || "",
        body.org || "",
        body.shortDesc || "",
        body.description || "",
        JSON.stringify(body.photos || []),
        Date.now()
      )
      .run();
    return json({ id });
  }

  // ---------- /api/awards/:id ----------
  const awardIdMatch = path.match(/^\/api\/awards\/([^/]+)$/);
  if (awardIdMatch && method === "PUT") {
    if (!isAdmin(request, env)) return text("Unauthorized", 401);
    const id = awardIdMatch[1];
    const body = await request.json();
    if (!body.title) return text("Title is required", 400);
    await env.DB.prepare(
      `UPDATE awards SET title=?, year=?, org=?, short_desc=?, description=?, photos=? WHERE id=?`
    )
      .bind(
        body.title,
        body.year || "",
        body.org || "",
        body.shortDesc || "",
        body.description || "",
        JSON.stringify(body.photos || []),
        id
      )
      .run();
    return json({ ok: true });
  }
  if (awardIdMatch && method === "DELETE") {
    if (!isAdmin(request, env)) return text("Unauthorized", 401);
    const id = awardIdMatch[1];
    await env.DB.prepare("DELETE FROM awards WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  // ---------- /api/comments ----------
  if (path === "/api/comments" && method === "GET") {
    const { results } = await env.DB
      .prepare("SELECT * FROM comments ORDER BY created_at DESC")
      .all();
    return json(results);
  }
  if (path === "/api/comments" && method === "POST") {
    const body = await request.json();
    const name = (body.name || "").trim().slice(0, 60);
    const commentText = (body.text || "").trim().slice(0, 600);
    if (!name || !commentText) return text("Name and comment are required", 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO comments (id, name, text, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(id, name, commentText, Date.now())
      .run();
    return json({ id });
  }

  // ---------- /api/comments/:id ----------
  const commentIdMatch = path.match(/^\/api\/comments\/([^/]+)$/);
  if (commentIdMatch && method === "DELETE") {
    if (!isAdmin(request, env)) return text("Unauthorized", 401);
    const id = commentIdMatch[1];
    await env.DB.prepare("DELETE FROM comments WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  // ---------- /api/messages ----------
  if (path === "/api/messages" && method === "GET") {
    if (!isAdmin(request, env)) return text("Unauthorized", 401);
    const { results } = await env.DB
      .prepare("SELECT * FROM messages ORDER BY created_at DESC")
      .all();
    return json(results);
  }
  if (path === "/api/messages" && method === "POST") {
    const body = await request.json();
    const name = (body.name || "").trim().slice(0, 60);
    const message = (body.message || "").trim().slice(0, 1000);
    const email = (body.email || "").trim().slice(0, 100);
    const phone = (body.phone || "").trim().slice(0, 20);
    if (!name || !message) return text("Name and message are required", 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO messages (id, name, email, phone, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, name, email, phone, message, Date.now())
      .run();
    return json({ id });
  }

  // ---------- /api/messages/:id ----------
  const messageIdMatch = path.match(/^\/api\/messages\/([^/]+)$/);
  if (messageIdMatch && method === "DELETE") {
    if (!isAdmin(request, env)) return text("Unauthorized", 401);
    const id = messageIdMatch[1];
    await env.DB.prepare("DELETE FROM messages WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  // ---------- /api/site-info ----------
  if (path === "/api/site-info" && method === "GET") {
    const row = await env.DB
      .prepare("SELECT phone, email, address, hero_photo FROM site_info WHERE id=1")
      .first();
    return json(
      row || { phone: "", email: "", address: "", hero_photo: "" }
    );
  }
  if (path === "/api/site-info" && method === "PUT") {
    if (!isAdmin(request, env)) return text("Unauthorized", 401);
    const body = await request.json();
    await env.DB.prepare(
      "UPDATE site_info SET phone=?, email=?, address=?, hero_photo=? WHERE id=1"
    )
      .bind(
        body.phone || "",
        body.email || "",
        body.address || "",
        body.heroPhoto || ""
      )
      .run();
    return json({ ok: true });
  }

  // ---------- /api/admin-login ----------
  if (path === "/api/admin-login" && method === "POST") {
    const body = await request.json();
    if (body.password && body.password === env.ADMIN_PASSWORD) {
      return json({ ok: true });
    }
    return text("Unauthorized", 401);
  }

  return text("Not found", 404);
}
