export async function onRequestGet({ env }) {
  const row = await env.DB
    .prepare("SELECT phone, email, address FROM site_info WHERE id=1")
    .first();
  return Response.json(row || { phone: "", email: "", address: "" });
}

export async function onRequestPut({ request, env }) {
  if (request.headers.get("x-admin-password") !== env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await request.json();
  await env.DB.prepare(
    "UPDATE site_info SET phone=?, email=?, address=? WHERE id=1"
  )
    .bind(body.phone || "", body.email || "", body.address || "")
    .run();
  return Response.json({ ok: true });
}
