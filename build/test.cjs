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
 await test('Twaalf technische lesbomen, geen oude demo-onderwerpen',()=>{
   assert.equal(a.START_DOMEINEN.length,12);
   assert.equal(new Set(a.START_DOMEINEN.map(d=>d.id)).size,12);
   assert.equal(a.START_DOMEINEN.some(d=>/^(Eten|Bewegen|Slaap)$/.test(d.naam)),false);
 });
 await test('Twaalf Elektra-onderwerpen en 24 expliciete lesopzetten',()=>{
   assert.equal(a.START_TOPICS.length,12);
   assert.ok(a.START_TOPICS.every(t=>t.domeinId==='elektra'&&t.ontwerpopzet));
   const lessons=a.START_TOPICS.flatMap(t=>t.orbs);
   assert.equal(lessons.length,24); assert.ok(lessons.every(o=>o.concept&&o.vragen.length===0));
   assert.equal(a.beheerLesboomInfo(a.START_DOMEINEN[0],a.START_TOPICS).pil,'concept');
 });
 await test('Ontwerpopzetten zijn toegankelijk zonder verzonnen voortgang',()=>{
   assert.ok(a.START_TOPICS.every(t=>a.isTopicUnlocked(t,a.START_TOPICS,{})));
 });
 await test('Herhaalintervallen en fout antwoord',()=>{
   let k=a.verwerkAntwoord({},'q',true,0);assert.equal(k.q.doos,1);assert.equal(k.q.volgende,86400000);
   k=a.verwerkAntwoord(k,'q',true,0);assert.equal(k.q.doos,2);assert.equal(k.q.volgende,259200000);
   k=a.verwerkAntwoord(k,'q',false,0);assert.equal(k.q.doos,1);assert.equal(k.q.fouten,1);
 });
 await test('Geen herhaling van nooit beantwoorde vragen',()=>assert.equal(a.vragenDieAanDeBeurtZijn(a.START_TOPICS,{},Date.now()).length,0));
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
 await test('Eindbestand zonder Babel-runtime en Anthropic-aanroepen',()=>{
   const html=fs.readFileSync(path.join(root,'Leerplatform.html'),'utf8');
   assert.ok(!html.includes('api.anthropic.com'));
   assert.ok(!html.includes('type="text/babel"'));
   assert.ok(!html.includes('naam:"Eten"'));
   assert.ok(html.includes('leerplatform-techniek-content-v1'));
 });
 console.log(`${total} controles geslaagd.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
