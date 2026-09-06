export async function onRequestGet({ request, env }) {
  if (request.headers.get("x-admin-password") !== env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { results } = await env.DB
    .prepare("SELECT * FROM messages ORDER BY created_at DESC")
    .all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const name = (body.name || "").trim().slice(0, 60);
  const message = (body.message || "").trim().slice(0, 1000);
  const email = (body.email || "").trim().slice(0, 100);
  const phone = (body.phone || "").trim().slice(0, 20);
  if (!name || !message) {
    return new Response("Name and message are required", { status: 400 });
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO messages (id, name, email, phone, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, name, email, phone, message, Date.now())
    .run();
  return Response.json({ id });
}
