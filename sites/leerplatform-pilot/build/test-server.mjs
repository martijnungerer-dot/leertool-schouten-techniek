import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleAPI } from '../server/api.mjs';
import { runAI, validateLessons } from '../server/openai.mjs';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  return { prepare(query) { return { bind(...args) { const stmt = sql.prepare(query); return {
    async first() { return stmt.get(...args) || null; },
    async all() { return { results: stmt.all(...args) }; },
    async run() { return stmt.run(...args); },
  }; } }; } };
}
const key = 'leerplatform-persoonlijk-concept-v1';
const path = '/opslag/' + key;
async function request(db, owner, route, method = 'GET', body, headers = {}) {
  return handleAPI(new Request('https://pilot.test/api/leerplatform' + route, {
    method, headers: { Origin: 'https://pilot.test', 'Content-Type': 'application/json', 'X-Leerplatform': '1', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), { db, user: owner ? { userId: owner } : null });
}
test('documents stay isolated, including export and attempted owner override', async () => {
  const db = database();
  assert.equal((await request(db, 'alice', path, 'PUT', {value: '{"naam":"privé"}', revision: 0})).status, 200);
  assert.equal((await (await request(db, 'bob', path + '?owner=alice')).json()).value, null);
  assert.deepEqual((await (await request(db, 'bob', '/export')).json()).documenten, []);
  assert.equal((await request(db, 'bob', path, 'PUT', {value: '{}', revision: 0, owner: 'alice'})).status, 400);
  assert.equal((await request(db, null, path)).status, 401);
});
test('stale writes and restores after deletion cannot overwrite newer content', async () => {
  const db = database(); const put = revision => request(db, 'alice', path, 'PUT', {value: '{}', revision});
  assert.equal((await put(0)).status, 200);
  assert.equal((await put(0)).status, 409);
  assert.equal((await put(1)).status, 200);
  assert.equal((await request(db, 'alice', path, 'DELETE', {revision: 2})).status, 200);
  assert.equal((await put(2)).status, 409);
  assert.equal((await put(0)).status, 409);
  assert.equal((await put(3)).status, 200);
});
test('cross-origin writes, unknown storage keys and malformed values are rejected', async () => {
  const db = database();
  assert.equal((await request(db, 'alice', path, 'PUT', {value:'{}',revision:0}, {Origin:'https://evil.test'})).status, 403);
  assert.equal((await request(db, 'alice', '/opslag/arbitrary')).status, 400);
  assert.equal((await request(db, 'alice', path, 'PUT', {value:'[]',revision:0})).status, 400);
  assert.equal((await request(db, 'alice', path, 'PUT', {value:'x'.repeat(2100001),revision:0})).status, 413);
});
const env = { AI_ENABLED: 'true', OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model' };
const input = { vraag: 'Leg dit uit', citaat: 'Voorbeeld' };
function answer(text = 'Een uitleg') { return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:{input_tokens:7,output_tokens:3}}); }
const args = db => ({db,owner:'alice',mode:'hulp',input,requestId:crypto.randomUUID(),env});
test('AI disabled makes no external request', async () => {
  let calls = 0;
  await assert.rejects(runAI({...args(database()),env:{},fetchImpl:async()=>{calls++;return answer();}}), {status:503});
  assert.equal(calls, 0);
});
test('completed request is cached; repeated ID with changed input is rejected', async () => {
  const db = database(); let calls = 0;
  const a = {...args(db), fetchImpl:async(url, options)=>{calls++; assert.equal(url,'https://api.openai.com/v1/responses'); assert.equal(JSON.parse(options.body).store,false); return answer();}};
  assert.deepEqual(await runAI(a), await runAI(a));
  assert.equal(calls,1);
  await assert.rejects(runAI({...a,input:{...input,vraag:'Andere vraag'}}), {status:409});
  const usage = (await (await request(db,'alice','/gebruik')).json()).dagen[0];
  assert.equal(usage.requests,1); assert.equal(usage.input_tokens,7); assert.equal(usage.output_tokens,3);
});
test('durable personal quota prevents the eleventh provider request', async () => {
  const db = database(); let calls = 0;
  const fetchImpl = async()=>{calls++;return answer();};
  for(let i=0;i<10;i++) await runAI({...args(db),fetchImpl});
  await assert.rejects(runAI({...args(db),fetchImpl}),{status:429});
  assert.equal(calls,10);
});
test('durable site quota caps combined usage across users', async () => {
  const db = database(); let calls = 0;
  const fetchImpl = async()=>{calls++;return answer();};
  for(let i=0;i<50;i++) await runAI({...args(db),owner:'user-'+i,fetchImpl});
  await assert.rejects(runAI({...args(db),owner:'new-user',fetchImpl}),{status:429});
  assert.equal(calls,50);
});
test('provider error does not leak credentials and is not retried under same ID', async () => {
  let calls=0; const a={...args(database()),fetchImpl:async()=>{calls++;return new Response('test-only',{status:401});}};
  await assert.rejects(runAI(a),e=>e.status===502&&!e.message.includes('test-only'));
  await assert.rejects(runAI(a),{status:409}); assert.equal(calls,1);
});
test('lesson generation validates literal source and four distinct answers', async () => {
  const source='Dit bronmateriaal is uitsluitend een test voor het leerplatform.';
  const proposal={lessen:[{titel:'Voorbeeld',tekst:source,bronCitaat:'Dit bronmateriaal',vraag:{vraag:'Wat is dit?',opties:['Een test','Een plan','Een brief','Een wet'],juisteIndex:0,uitleg:'De bron noemt dit een test.'}}]};
  const a={...args(database()),mode:'programma',input:{naam:'Test',doel:'Bron begrijpen',tekst:source},fetchImpl:async()=>answer(JSON.stringify(proposal))};
  assert.equal((await runAI(a)).lessen.length,1);
  const bad=structuredClone(proposal); bad.lessen[0].bronCitaat='Een verzonnen broncitaat';
  assert.throws(()=>validateLessons(bad,source),{status:502});
  bad.lessen[0]=structuredClone(proposal.lessen[0]);bad.lessen[0].vraag.opties[1]='Een test';
  assert.throws(()=>validateLessons(bad,source),{status:502});
});
