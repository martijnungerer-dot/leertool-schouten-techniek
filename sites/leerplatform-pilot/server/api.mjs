import { AppError, requireObject } from './errors.mjs';
import { readDocument, writeDocument, deleteDocument } from './documents.mjs';
import { aiReady, runAI } from './openai.mjs';
async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw new AppError(415, 'JSON verwacht.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Invoer ontbreekt.');
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 2100000) { await reader.cancel(); throw new AppError(413, 'De invoer is te groot.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError(400, 'Ongeldige JSON.'); }
}
// user moet UITSLUITEND uit de Sites server-only auth-helper komen, nooit uit body/query.
export async function handleAPI(request, { user, db, env = {}, fetchImpl = fetch }) {
  const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  try {
    if (!user?.userId) throw new AppError(401, 'Meld je aan om je leerprogramma te openen.');
    if (!db) throw new AppError(503, 'De online opslag is nog niet beschikbaar.');
    const url = new URL(request.url);
    const route = url.pathname.replace(/^\/api\/leerplatform/, '');
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) throw new AppError(405, 'Deze actie wordt niet ondersteund.');
    if (request.method !== 'GET' && (request.headers.get('origin') !== url.origin || request.headers.get('x-leerplatform') !== '1')) throw new AppError(403, 'Deze aanvraag komt niet uit de app.');
    const owner = user.userId;
    if (route === '/status' && request.method === 'GET') return reply({ beschikbaar: aiReady(env), online: true, user: { userId: owner, naam: user.name || user.email || 'Gebruiker' }, limieten: { perPersoonPerDag: 10, pilotPerDag: 50 } });
    if (route === '/export' && request.method === 'GET') {
      const { results } = await db.prepare('SELECT document_key, value, revision, updated_at FROM user_documents WHERE owner_id = ?').bind(owner).all();
      return reply({ versie: 1, gemaaktOp: new Date().toISOString(), documenten: results });
    }
    if (route === '/gebruik' && request.method === 'GET') {
      const { results } = await db.prepare('SELECT day, requests, input_tokens, output_tokens FROM ai_usage WHERE owner_id = ? ORDER BY day DESC LIMIT 31').bind(owner).all();
      return reply({ dagen: results });
    }
    if (route.startsWith('/opslag/')) {
      const key = decodeURIComponent(route.slice('/opslag/'.length));
      if (request.method === 'GET') return reply(await readDocument(db, owner, key));
      if (request.method === 'PUT') return reply(await writeDocument(db, owner, key, await readJson(request)));
      if (request.method === 'DELETE') return reply(await deleteDocument(db, owner, key, await readJson(request)));
    }
    if (route.startsWith('/ai/') && request.method === 'POST') {
      const body = await readJson(request); requireObject(body, ['invoer', 'aanvraagId']);
      return reply(await runAI({ db, owner, mode: route.slice(4), input: body.invoer, requestId: body.aanvraagId, env, fetchImpl, signal: request.signal }));
    }
    throw new AppError(404, 'Niet gevonden.');
  } catch (e) { return reply({ fout: e instanceof AppError ? e.message : 'De server kon de aanvraag niet verwerken.' }, e instanceof AppError ? e.status : 500); }
}
