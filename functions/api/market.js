export const onRequestGet = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const idOnly = url.searchParams.get('idOnly') === 'true';

  try {
    if (id) {
      const row = await env.DB.prepare('SELECT * FROM files WHERE id = ?')
        .bind(id)
        .first();
      if (!row) {
        return new Response('Not Found', { status: 404 });
      }
      return Response.json(row);
    }

    if (idOnly) {
      const { results } = await env.DB.prepare(
        'SELECT id FROM files ORDER BY timestamp DESC',
      ).all();

      return Response.json(results);
    }

    const { results } = await env.DB.prepare(
      'SELECT id, name, timestamp, author, model, description FROM files ORDER BY timestamp DESC',
    ).all();

    return Response.json(results);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestPost = async (context) => {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { name, timestamp, author, model, description, data } = body;

    if (!name || !author || !model || !data) {
      return new Response('Missing required fields', { status: 400 });
    }

    const ts = timestamp || Date.now();
    const desc = description || '';

    const info = await env.DB.prepare(
      'INSERT INTO files (name, timestamp, author, model, description, data) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(name, ts, author, model, desc, data)
      .run();

    return Response.json(info, { status: 201 });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestDelete = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const name = url.searchParams.get('name');

  try {
    let info;
    if (id) {
      info = await env.DB.prepare('DELETE FROM files WHERE id = ?')
        .bind(id)
        .run();
    } else if (name) {
      info = await env.DB.prepare('DELETE FROM files WHERE name = ?')
        .bind(name)
        .run();
    } else {
      return new Response('Missing id or name parameter', { status: 400 });
    }

    return Response.json(info);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};
