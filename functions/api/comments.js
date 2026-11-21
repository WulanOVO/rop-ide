let tableReady = false;

const ensureCommentsTable = async (env) => {
  if (tableReady) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )`,
  ).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_comments_file ON comments (file_id)',
  ).run();
  tableReady = true;
};

const MAX_AUTHOR_LENGTH = 50;
const MAX_CONTENT_LENGTH = 1000;

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const fileId = Number(url.searchParams.get('fileId'));

  if (!Number.isInteger(fileId) || fileId <= 0) {
    return new Response('Invalid fileId', { status: 400 });
  }

  try {
    await ensureCommentsTable(env);
    const { results } = await env.DB.prepare(
      'SELECT * FROM comments WHERE file_id = ? ORDER BY timestamp DESC',
    )
      .bind(fileId)
      .all();

    return Response.json(results);
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestPost = async ({ request, env }) => {
  try {
    const body = await request.json();
    const fileId = Number(body?.fileId);
    const author = String(body?.author || '').trim();
    const content = String(body?.content || '').trim();

    if (!Number.isInteger(fileId) || fileId <= 0) {
      return new Response('Invalid fileId', { status: 400 });
    }
    if (!author || !content) {
      return new Response('Missing required fields', { status: 400 });
    }
    if (author.length > MAX_AUTHOR_LENGTH || content.length > MAX_CONTENT_LENGTH) {
      return new Response('Content too long', { status: 400 });
    }

    await ensureCommentsTable(env);

    const file = await env.DB.prepare('SELECT id FROM files WHERE id = ?')
      .bind(fileId)
      .first();
    if (!file) {
      return new Response('File not found', { status: 404 });
    }

    const timestamp = Date.now();
    const info = await env.DB.prepare(
      'INSERT INTO comments (file_id, author, content, timestamp) VALUES (?, ?, ?, ?)',
    )
      .bind(fileId, author, content, timestamp)
      .run();

    return Response.json(
      {
        id: info.meta?.last_row_id,
        file_id: fileId,
        author,
        content,
        timestamp,
      },
      { status: 201 },
    );
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
};
