const verifyPassword = (request, ADMIN_PASSWORD) => {
  const auth = request.headers.get('Authorization');
  if (!auth) return false;
  const password = auth.replace('Bearer ', '');
  return password === ADMIN_PASSWORD;
};

export const onRequestGet = async (context) => {
  const { request, env } = context;

  if (!verifyPassword(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const url = new URL(request.url);

    if (url.searchParams.get('comments') === 'true') {
      const { results } = await env.DB.prepare(
        `SELECT c.id, c.file_id, c.content, c.author, c.timestamp, f.name AS fileName
         FROM comments c LEFT JOIN files f ON f.id = c.file_id
         ORDER BY c.timestamp DESC`,
      ).all();
      return Response.json(results);
    }

    const { results } = await env.DB.prepare(
      'SELECT * FROM files ORDER BY timestamp DESC',
    ).all();

    return Response.json(results);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestPost = async (context) => {
  const { request, env } = context;

  if (!verifyPassword(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, timestamp, author, model, description, data, featured } = body;

    if (!name || !author || !model || !data) {
      return new Response('Missing required fields', { status: 400 });
    }

    const ts = timestamp || Date.now();
    const desc = description || '';
    const feat = featured ? 1 : 0;

    const info = await env.DB.prepare(
      'INSERT INTO files (name, timestamp, author, model, description, data, featured) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(name, ts, author, model, desc, data, feat)
      .run();

    return Response.json(info, { status: 201 });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestPut = async (context) => {
  const { request, env } = context;

  if (!verifyPassword(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, timestamp, author, model, description, data, featured } = body;

    if (!id) {
      return new Response('Missing id', { status: 400 });
    }

    const feat = featured ? 1 : 0;

    const info = await env.DB.prepare(
      'UPDATE files SET name = ?, timestamp = ?, author = ?, model = ?, description = ?, data = ?, featured = ? WHERE id = ?',
    )
      .bind(name, timestamp, author, model, description, data, feat, id)
      .run();

    return Response.json(info);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestDelete = async (context) => {
  const { request, env } = context;

  if (!verifyPassword(request, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const commentId = url.searchParams.get('commentId');

  if (!id && !commentId) {
    return new Response('Missing id', { status: 400 });
  }

  try {
    const info = commentId
      ? await env.DB.prepare('DELETE FROM comments WHERE id = ?')
          .bind(commentId)
          .run()
      : await env.DB.prepare('DELETE FROM files WHERE id = ?')
          .bind(id)
          .run();

    return Response.json(info);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};
