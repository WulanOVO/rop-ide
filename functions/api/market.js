import { ROM_B64, CHALLENGE_SECRET } from './romData.js';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

let romCache = null;
const getRom = () => {
  if (!romCache) {
    const bin = atob(ROM_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    romCache = bytes;
  }
  return romCache;
};

let hmacKeyPromise = null;
const getHmacKey = () => {
  if (!hmacKeyPromise) {
    hmacKeyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(CHALLENGE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  }
  return hmacKeyPromise;
};

const hmacHex = async (message) => {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// 内行验证：随机派发一个偶数偏移，用户须答出 challenge.bin 该位置起的两字节（十六进制）
const createChallenge = async () => {
  const rom = getRom();
  const rand = new Uint32Array(1);
  crypto.getRandomValues(rand);
  const offset = 2 * (rand[0] % (rom.length / 2));
  const expires = Date.now() + CHALLENGE_TTL_MS;
  const payload = `${offset}.${expires}`;
  return { offset, token: `${payload}.${await hmacHex(payload)}` };
};

const verifyChallenge = async (token, answer) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    return { ok: false, status: 400, message: 'Invalid challenge' };
  }
  const [offsetStr, expiresStr, sig] = parts;
  const offset = Number(offsetStr);
  const expires = Number(expiresStr);
  const rom = getRom();
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset % 2 !== 0 ||
    offset > rom.length - 2 ||
    !Number.isInteger(expires) ||
    sig !== (await hmacHex(`${offsetStr}.${expiresStr}`))
  ) {
    return { ok: false, status: 400, message: 'Invalid challenge' };
  }
  if (Date.now() > expires) {
    return { ok: false, status: 410, message: 'Challenge expired' };
  }
  const normalized = String(answer || '')
    .replace(/[^0-9a-fA-F]/g, '')
    .toLowerCase();
  if (!/^[0-9a-f]{4}$/.test(normalized)) {
    return { ok: false, status: 400, message: 'Invalid answer format' };
  }
  const expected = [rom[offset], rom[offset + 1]]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (normalized !== expected) {
    return { ok: false, status: 403, message: 'Challenge failed' };
  }
  return { ok: true };
};

export const onRequestGet = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const idOnly = url.searchParams.get('idOnly') === 'true';

  try {
    if (url.searchParams.get('challenge') === 'true') {
      if (getRom().length < 2) {
        return new Response('ROM data not configured', { status: 500 });
      }
      return Response.json(await createChallenge());
    }

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
        'SELECT id FROM files ORDER BY featured DESC, timestamp DESC',
      ).all();

      return Response.json(results);
    }

    const { results } = await env.DB.prepare(
      `SELECT f.id, f.name, f.timestamp, f.author, f.model, f.description, f.featured,
        (SELECT COUNT(*) FROM comments c WHERE c.file_id = f.id) AS commentCount
       FROM files f ORDER BY f.featured DESC, f.timestamp DESC`,
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
    const {
      name,
      timestamp,
      author,
      model,
      description,
      data,
      challengeToken,
      challengeAnswer,
    } = body;

    if (!name || !author || !model || !data) {
      return new Response('Missing required fields', { status: 400 });
    }

    const check = await verifyChallenge(challengeToken, challengeAnswer);
    if (!check.ok) {
      return new Response(check.message, { status: check.status });
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
