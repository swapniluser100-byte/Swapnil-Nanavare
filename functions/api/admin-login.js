export async function onRequestPost({ request, env }) {
  const body = await request.json();
  if (body.password && body.password === env.ADMIN_PASSWORD) {
    return Response.json({ ok: true });
  }
  return new Response("Unauthorized", { status: 401 });
}
