export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare("SELECT * FROM comments ORDER BY created_at DESC")
    .all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const name = (body.name || "").trim().slice(0, 60);
  const text = (body.text || "").trim().slice(0, 600);
  if (!name || !text) {
    return new Response("Name and comment are required", { status: 400 });
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO comments (id, name, text, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(id, name, text, Date.now())
    .run();
  return Response.json({ id });
}
