const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const compiler = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/babel.js'),'utf8'),compiler);
const source = fs.readFileSync(path.join(root,'src/technische-startinhoud.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(root,'src/leerplatform.jsx'),'utf8').replace(/^import React[^\n]+\n/,'const {useState,useEffect,useRef}=React;\n').replace('export default function Leerplatform','function Leerplatform');
const expose = '\nglobalThis.testAPI={START_DOMEINEN,START_TOPICS,verwerkAntwoord,vragenDieAanDeBeurtZijn,vraagIsHeel,berekenPlaatsing,isTopicUnlocked,beheerLesboomInfo,bewaren};';
const app = vm.createContext({React:{Component:class{}},window:{storage:{set:async()=>true}},console});
vm.runInContext(compiler.Babel.transform(source+expose,{presets:['react'],comments:false}).code,app);
const a=app.testAPI;
let total=0;
async function test(name,fn){await fn();total++;console.log('OK '+name);}
(async()=>{
 await test('De app start zonder lesinhoud',()=>{
   assert.equal(a.START_DOMEINEN.length,0);
   assert.equal(a.START_TOPICS.length,0);
 });
 // Een onderwerp om de leerlogica mee te toetsen. Dit staat bewust hier en niet
 // in de startinhoud: de app levert geen inhoud meer mee, maar de regels die
 // over inhoud gaan moeten nog steeds kloppen.
 const proefVraag = {id:'v1',vraag:'Waarmee stel je vast dat iets spanningsloos is?',opties:['Een multimeter','Een tweepolige spanningstester'],juisteIndex:1,uitleg:'Alleen een tweepolige tester meet tussen twee punten.'};
 const proefTopics = [
   {id:'t1',domeinId:'d1',prerequisites:[],gridPos:{tier:1,track:1},titel:'Eerste onderwerp',orbs:[{id:'o1',titel:'Eerste les',blokken:[{type:'tekst',tekst:'Tekst.'}],vragen:[proefVraag]}]},
   {id:'t2',domeinId:'d1',prerequisites:['t1'],gridPos:{tier:2,track:1},titel:'Tweede onderwerp',orbs:[{id:'o2',titel:'Tweede les',blokken:[{type:'tekst',tekst:'Tekst.'}],vragen:[]}]},
 ];
 await test('Een onderwerp met een voorganger blijft dicht tot die af is',()=>{
   assert.equal(a.isTopicUnlocked(proefTopics[0],proefTopics,{}),true);
   assert.equal(a.isTopicUnlocked(proefTopics[1],proefTopics,{}),false);
   assert.equal(a.isTopicUnlocked(proefTopics[1],proefTopics,{t1:1}),true);
 });
 await test('Een lesboom zonder onderwerpen is leeg, met onderwerpen zonder inhoud concept',()=>{
   assert.equal(a.beheerLesboomInfo({id:'d1',naam:'Leeg'},[]).pil,'leeg');
   assert.equal(a.beheerLesboomInfo({id:'d1',naam:'Proef'},proefTopics).pil,'gepubliceerd');
   const metOpzet = [{...proefTopics[0],orbs:[{...proefTopics[0].orbs[0],concept:true}]}];
   assert.equal(a.beheerLesboomInfo({id:'d1',naam:'Proef'},metOpzet).pil,'concept');
 });
 await test('Een nieuw onderwerp krijgt een plek achter zijn voorganger',()=>{
   const plek = a.berekenPlaatsing(proefTopics,'d1','t1');
   // Niet met deepEqual: waarden uit de vm hebben een eigen Array-prototype.
   assert.equal(plek.prerequisites.length,1);
   assert.equal(plek.prerequisites[0],'t1');
   assert.ok(plek.gridPos.tier>1);
 });
 await test('Herhaalintervallen en fout antwoord',()=>{
   let k=a.verwerkAntwoord({},'q',true,0);assert.equal(k.q.doos,1);assert.equal(k.q.volgende,86400000);
   k=a.verwerkAntwoord(k,'q',true,0);assert.equal(k.q.doos,2);assert.equal(k.q.volgende,259200000);
   k=a.verwerkAntwoord(k,'q',false,0);assert.equal(k.q.doos,1);assert.equal(k.q.fouten,1);
 });
 await test('Alleen beantwoorde vragen komen terug in het herhaalschema',()=>{
   const nu = Date.now();
   assert.equal(a.vragenDieAanDeBeurtZijn(proefTopics,{},nu).length,0);
   const kennis = a.verwerkAntwoord({},'v1',true,nu);
   assert.equal(a.vragenDieAanDeBeurtZijn(proefTopics,kennis,nu).length,0);
   assert.equal(a.vragenDieAanDeBeurtZijn(proefTopics,kennis,nu+86400001).length,1);
 });
 await test('Ongeldige vragen worden geweigerd',()=>{
   assert.equal(a.vraagIsHeel({vraag:'Welke?',opties:['a','b'],juisteIndex:9}),false);
   assert.equal(a.vraagIsHeel({vraag:'Welke?',opties:['a','b'],juisteIndex:1}),true);
   assert.equal(a.vraagIsHeel({vraag:'Volgorde?',type:'sorteren',items:['a','b'],juisteVolgorde:[0,0]}),false);
   assert.equal(a.vraagIsHeel({vraag:'Volgorde?',type:'sorteren',items:['a','b'],juisteVolgorde:[1,0]}),true);
   assert.equal(a.vraagIsHeel({vraag:'Koppel?',type:'matchen',paren:[{links:'a',rechts:'b'},{links:'c',rechts:'d'}]}),true);
 });
 await test('Opslagfouten worden niet als succes gemeld',async()=>{
   assert.equal(await a.bewaren({}),true);
   app.window.storage.set=async()=>{throw Error('QuotaExceededError');};
   assert.equal(await a.bewaren({}),false);
 });
 await test('Eindbestand zonder Babel-runtime, AI-aanroepen of lesinhoud',()=>{
   const html=fs.readFileSync(path.join(root,'Leerplatform.html'),'utf8');
   assert.ok(!html.includes('api.anthropic.com'));
   assert.ok(!html.includes('type="text/babel"'));
   assert.ok(!html.includes('naam:"Eten"'));
   assert.ok(html.includes('leerplatform-techniek-content-v1'));
   // De app wordt leeg geleverd: geen enkele les mag nog meegebakken zijn.
   for (const zin of ['Spanning, stroom en weerstand','Basiselektra','Hydrauliek','wet van Ohm']) {
     assert.ok(!html.includes(zin), 'lesinhoud zit nog in het eindbestand: '+zin);
   }
 });
 console.log(`${total} controles geslaagd.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
