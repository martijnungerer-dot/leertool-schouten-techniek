import { AppError, requireObject } from './errors.mjs';
export const KEYS = new Set(['leerplatform-techniek-content-v1', 'leerplatform-techniek-voortgang-v1', 'leerplatform-persoonlijk-concept-v1']);
export function checkKey(key) { if (!KEYS.has(key)) throw new AppError(400, 'Onbekend document.'); }
function checkValue(key, value) {
  if (typeof value !== 'string' || new TextEncoder().encode(value).length > 2000000) throw new AppError(413, 'Dit document is te groot.');
  let data;
  try { data = JSON.parse(value); } catch { throw new AppError(400, 'Het document bevat geen geldige JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError(400, 'Ongeldig document.');
  if (key === 'leerplatform-techniek-content-v1' && (!Array.isArray(data.domeinen) || !Array.isArray(data.topics) || !data.bronnen || typeof data.bronnen !== 'object' || Array.isArray(data.bronnen))) {
    throw new AppError(400, 'Lesbomen, onderwerpen en bronnen ontbreken.');
  }
}
export async function readDocument(db, owner, key) {
  checkKey(key);
  return await db.prepare('SELECT value, revision, updated_at FROM user_documents WHERE owner_id = ? AND document_key = ?').bind(owner, key).first()
    || { value: null, revision: 0, updated_at: null };
}
export async function writeDocument(db, owner, key, body) {
  checkKey(key); requireObject(body, ['value', 'revision']); checkValue(key, body.value);
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new AppError(400, 'Ongeldige documentversie.');
  const now = new Date().toISOString();
  const row = body.revision === 0
    ? await db.prepare('INSERT INTO user_documents (owner_id, document_key, value, revision, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_id, document_key) DO NOTHING RETURNING revision, updated_at').bind(owner, key, body.value, now).first()
    : await db.prepare('UPDATE user_documents SET value = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND document_key = ? AND revision = ? RETURNING revision, updated_at').bind(body.value, now, owner, key, body.revision).first();
  if (!row) throw new AppError(409, 'Dit document is elders gewijzigd. Bewaar je invoer en laad de app opnieuw voordat je verdergaat.');
  return row;
}
export async function deleteDocument(db, owner, key, body) {
  checkKey(key); requireObject(body, ['revision']);
  if (!Number.isSafeInteger(body.revision) || body.revision < 1) throw new AppError(400, 'Ongeldige documentversie.');
  // Een tombstone voorkomt dat een oud tabblad een verwijderd concept overschrijft.
  const row = await db.prepare('UPDATE user_documents SET value = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND document_key = ? AND revision = ? RETURNING revision').bind('null', new Date().toISOString(), owner, key, body.revision).first();
  if (!row) throw new AppError(409, 'Het document is inmiddels gewijzigd. Laad opnieuw.');
  return row;
}
