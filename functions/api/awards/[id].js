function isAdmin(request, env) {
  return request.headers.get("x-admin-password") === env.ADMIN_PASSWORD;
}

export async function onRequestPut({ request, env, params }) {
  if (!isAdmin(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await request.json();
  if (!body.title) {
    return new Response("Title is required", { status: 400 });
  }
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
      params.id
    )
    .run();
  return Response.json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }
  await env.DB.prepare("DELETE FROM awards WHERE id=?").bind(params.id).run();
  return Response.json({ ok: true });
}
