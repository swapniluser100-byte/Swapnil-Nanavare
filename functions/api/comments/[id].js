export async function onRequestDelete({ request, env, params }) {
  if (request.headers.get("x-admin-password") !== env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }
  await env.DB.prepare("DELETE FROM comments WHERE id=?").bind(params.id).run();
  return Response.json({ ok: true });
}
