import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../source/build/runtime.js',import.meta.url),'utf8');
const key='leerplatform-persoonlijk-concept-v1';
function runtime(fetch) {
  const events=[]; const nodes=[];
  const window={dispatchEvent:e=>events.push(e.type)};
  const document={getElementById:()=>({replaceChildren(){nodes.length=0;},append(...items){nodes.push(...items);}}),createElement:()=>({})};
  vm.runInNewContext(code,{window,document,fetch,AbortSignal,CustomEvent:class{constructor(type){this.type=type;}},location:{reload(){}}});
  return {window,events,nodes};
}
test('failed initial load never renders an empty app or permits writes', async()=>{
  let renders=0, calls=0;
  const r=runtime(async()=>{calls++;return Response.json({fout:'Geen toegang'},{status:401});});
  await r.window.startLeerplatform(()=>renders++);
  assert.equal(renders,0); assert.match(r.nodes[0].textContent,/Geen toegang/);
  const before=calls;
  await assert.rejects(r.window.storage.set(key,'{}'));
  assert.equal(calls,before);
});
test('queued edits use successive server revisions and failed edit locks further writes',async()=>{
  const revisions=[];let fail=false;
  const r=runtime(async(path,options)=>{
    if(!options.method) return Response.json(path.endsWith('/status')?{user:{naam:'Test'}}:{value:null,revision:0});
    revisions.push(JSON.parse(options.body).revision);
    return fail?Response.json({fout:'Conflict'},{status:409}):Response.json({revision:revisions.length});
  });
  let renders=0; await r.window.startLeerplatform(()=>renders++);assert.equal(renders,1);
  await Promise.all([r.window.storage.set(key,'{"n":1}'),r.window.storage.set(key,'{"n":2}')]);
  assert.deepEqual(revisions,[0,1]);assert.equal((await r.window.storage.get(key)).value,'{"n":2}');
  fail=true; await assert.rejects(r.window.storage.set(key,'{"n":3}'));
  await assert.rejects(r.window.storage.set(key,'{"n":4}'));
  assert.deepEqual(revisions,[0,1,2]);assert.equal((await r.window.storage.get(key)).value,'{"n":2}');
  assert.deepEqual(r.events,['leerplatform-opslagfout']);
});
