function isAdmin(request, env) {
  return request.headers.get("x-admin-password") === env.ADMIN_PASSWORD;
}

export async function onRequestGet({ env }) {
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
  return Response.json(awards);
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await request.json();
  if (!body.title) {
    return new Response("Title is required", { status: 400 });
  }
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
  return Response.json({ id });
}
