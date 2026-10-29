const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { leesBron } = require('./bron.cjs');
const root = path.resolve(__dirname, '..');
const compiler = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/babel.js'),'utf8'),compiler);
const source = fs.readFileSync(path.join(root,'src/technische-startinhoud.js'),'utf8')+'\n'+
  leesBron().replace(/^import React[^\n]+\n/,'const {useState,useEffect,useRef}=React;\n').replace('export default function Leerplatform','function Leerplatform');
const expose = '\nglobalThis.testAPI={START_DOMEINEN,START_TOPICS,verwerkAntwoord,vragenDieAanDeBeurtZijn,vraagIsHeel,vragenAanDeBeurtInLesboom,herhaalsessieVoorLesboom,dagSleutel,normaliseerOpeningsdagen,openingsdagenBijLaden,antwoordTeltMee,zonderLegeOpties,aantalGoed,noteerGoedBuitenSchema,kiesGewogen,voegOpeningsdagToe,dagenAanDeBeurt,moetPulseren,sterkteVanOnderwerp,maakLokaleLesopzet,programmaNaarInhoud,berekenPlaatsing,isTopicUnlocked,beheerLesboomInfo,bewaren};';
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
 const proefVraag = {id:'v1',vraag:'Hoeveel dagen heeft een week?',opties:['Vijf','Zeven'],juisteIndex:1,uitleg:'Een week heeft zeven dagen.'};
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
 // Testdata voor de herhaalsessie per lesboom: staat alleen hier, nooit in src/.
 const nu = 1e12;
 const aanDeBeurt = doos => ({doos,volgende:nu-1,fouten:0});
 const nietAanDeBeurt = doos => ({doos,volgende:nu+1e6,fouten:0});
 const lesboomTopic = (domeinId,ids) => ({id:'top-'+domeinId,domeinId,prerequisites:[],gridPos:{tier:1,track:1},titel:domeinId,
   orbs:[{id:'orb-'+domeinId,titel:'Les',blokken:[],vragen:ids.map(id=>({id,vraag:id,opties:['a','b'],juisteIndex:0}))}]});
 const idsVan = sessie => Array.from({length:sessie.length},(_,i)=>sessie[i].vraag.id);
 // Strikt afwisselend, beginnend en eindigend met een bekende vraag.
 const wisseltAf = sessie => Array.from({length:sessie.length},(_,i)=>sessie[i].soort)
   .every((soort,i)=>soort===(i%2===0?'bekend':'werk')) && sessie[sessie.length-1].soort==='bekend';
 await test('Een herhaalsessie bevat alleen vragen uit de gevraagde lesboom, wisselt af en blijft onder de tien',()=>{
   const werkIds = Array.from({length:12},(_,i)=>'w'+i);
   const kennis = {};
   werkIds.forEach((id,i)=>{kennis[id]=aanDeBeurt(1+(i%3));});
   ['k0','k1','k2'].forEach(id=>{kennis[id]=aanDeBeurt(4);});
   ['r0','r1','r2','r3'].forEach(id=>{kennis[id]=nietAanDeBeurt(5);});
   kennis.x0=aanDeBeurt(1);
   const topics=[lesboomTopic('d2',['x0']),lesboomTopic('d1',[...werkIds,'k0','k1','k2','r0','r1','r2','r3'])];
   assert.equal(a.vragenAanDeBeurtInLesboom(topics,kennis,nu,'d1').length,15);
   const sessie = a.herhaalsessieVoorLesboom(topics,kennis,nu,'d1');
   assert.equal(sessie.length,9);
   assert.ok(!idsVan(sessie).includes('x0'));
   assert.ok(wisseltAf(sessie));
   // Bekende vragen die aan de beurt zijn, gaan voor bekende vragen die dat niet zijn.
   const bekendIds = idsVan(Array.from(sessie).filter(v=>v.soort==='bekend'));
   for (const id of ['k0','k1','k2']) assert.ok(bekendIds.includes(id), id+' hoort in de sessie');
   assert.equal(Array.from(sessie).filter(v=>!v.meetelt).length,2);
   // Het werk is het zwakst: de laagste dozen eerst, en nooit doos 4 of 5.
   assert.ok(Array.from(sessie).filter(v=>v.soort==='werk').every(v=>v.doos===1));
 });
 await test('Bij weinig werk komen er niet meer bekende vragen in dan de afwisseling nodig heeft',()=>{
   const kennis = {w0:aanDeBeurt(1)};
   ['r0','r1','r2','r3','r4'].forEach(id=>{kennis[id]=nietAanDeBeurt(5);});
   const sessie = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0','r0','r1','r2','r3','r4'])],kennis,nu,'d1');
   assert.equal(sessie.length,3);
   assert.ok(wisseltAf(sessie));
   for (const v of Array.from(sessie)) assert.equal(v.meetelt, v.soort==='werk');
   // Eén bekende vraag: bekend, werk.
   const een = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0','w1','r0'])],{w0:aanDeBeurt(1),w1:aanDeBeurt(2),r0:nietAanDeBeurt(4)},nu,'d1');
   assert.equal(een.length,2);
   assert.equal(een[0].soort,'bekend');
   assert.equal(een[1].soort,'werk');
 });
 await test('Bekende vragen uit doos 4-5 komen nooit als werk in de sessie',()=>{
   const ids = Array.from({length:7},(_,i)=>'b'+i);
   const kennis = {}; ids.forEach(id=>{kennis[id]=aanDeBeurt(4);});
   const sessie = a.herhaalsessieVoorLesboom([lesboomTopic('d1',ids)],kennis,nu,'d1');
   assert.equal(sessie.length,5);
   assert.ok(Array.from(sessie).every(v=>v.soort==='bekend' && v.meetelt));
 });
 await test('Zonder bekende vragen hoogstens vijf werkvragen, laagste doos eerst',()=>{
   const ids = Array.from({length:7},(_,i)=>'w'+i);
   const kennis = {}; ids.forEach((id,i)=>{kennis[id]=aanDeBeurt(3-(i%3));});
   const sessie = a.herhaalsessieVoorLesboom([lesboomTopic('d1',ids)],kennis,nu,'d1');
   assert.equal(sessie.length,5);
   assert.ok(Array.from(sessie).every(v=>v.soort==='werk'));
   for (let i=1;i<sessie.length;i++) assert.ok(sessie[i-1].doos<=sessie[i].doos);
 });
 await test('Vragen uit conceptlessen en kapotte vragen komen niet in de herhaling',()=>{
   const topic = {id:'tc',domeinId:'d1',orbs:[
     {id:'oc',titel:'Concept',concept:true,blokken:[],vragen:[{id:'c1',vraag:'c1',opties:['a','b'],juisteIndex:0}]},
     {id:'ok',titel:'Kapot',blokken:[],vragen:[{id:'k1',vraag:'k1',opties:[],juisteIndex:0},{id:'k2',vraag:'k2'}]},
     {id:'og',titel:'Goed',blokken:[],vragen:[{id:'g1',vraag:'g1',opties:['a','b'],juisteIndex:0},{id:'r1',vraag:'r1',opties:['a','b'],juisteIndex:0}]},
   ]};
   const kennis = {c1:aanDeBeurt(1),k1:aanDeBeurt(1),k2:aanDeBeurt(2),g1:aanDeBeurt(1),r1:nietAanDeBeurt(5)};
   kennis.c2 = aanDeBeurt(5);
   assert.equal(a.vragenDieAanDeBeurtZijn([topic],kennis,nu).length,1);
   const sessie = a.herhaalsessieVoorLesboom([topic],kennis,nu,'d1');
   assert.equal(idsVan(sessie).join(','),'r1,g1');
   // Kapotte vragen in rust (doos 4-5) evenmin.
   const rustKapot = {...kennis, k1:nietAanDeBeurt(5), r1:undefined};
   delete rustKapot.r1;
   assert.equal(idsVan(a.herhaalsessieVoorLesboom([topic],rustKapot,nu,'d1')).join(','),'g1');
 });
 await test('Per vraag telt de app hoe vaak hij goed is beantwoord; oude voortgang schat dat uit de doos',()=>{
   let k = a.verwerkAntwoord({},'q',true,nu);
   assert.equal(k.q.goed,1);
   k = a.verwerkAntwoord(k,'q',false,nu);
   assert.equal(k.q.goed,1);
   assert.equal(a.aantalGoed({doos:4,volgende:0,fouten:0}),4);
   assert.equal(a.aantalGoed({doos:4,volgende:0,fouten:0,goed:7}),7);
   assert.equal(a.aantalGoed(undefined),0);
   const oud = {doos:5,volgende:nu+1e6,fouten:1};
   const na = a.noteerGoedBuitenSchema({r:oud},'r',true);
   assert.equal(na.r.goed,6);
   assert.equal(na.r.doos,5);
   assert.equal(na.r.volgende,oud.volgende);
   const fout = {r:oud};
   assert.equal(a.noteerGoedBuitenSchema(fout,'r',false),fout);
   assert.equal(a.noteerGoedBuitenSchema(fout,'onbekend',true),fout);
 });
 await test('Bekende vragen in rust rouleren; vaker goed beantwoord betekent minder kans',()=>{
   // Kans evenredig met 1/(1+goed): goed 0 -> 1, goed 3 -> 0,25, dus 80% tegen 20%.
   const lijst = ['vaak-fout','vaak-goed'];
   const gewicht = id => id==='vaak-fout' ? 1 : 0.25;
   let vaakFout = 0;
   const N = 1000;
   for (let i=0;i<N;i++) if (a.kiesGewogen(lijst,1,gewicht,()=> (i+0.5)/N)[0]==='vaak-fout') vaakFout++;
   assert.equal(vaakFout,800);
   // In de sessie: alle rustende vragen komen eens langs als het lot anders valt.
   const kennis = {w0:aanDeBeurt(1)};
   ['r0','r1','r2','r3'].forEach(id=>{kennis[id]={...nietAanDeBeurt(5),goed:0};});
   const topics = [lesboomTopic('d1',['w0','r0','r1','r2','r3'])];
   const gezien = new Set();
   for (const lot of [0.05,0.3,0.55,0.8,0.95]) {
     for (const v of Array.from(a.herhaalsessieVoorLesboom(topics,kennis,nu,'d1',()=>lot))) if (v.soort==='bekend') gezien.add(v.vraag.id);
   }
   assert.equal(gezien.size,4);
   // Het gewicht in de sessie: een rustende vraag die 3 keer goed is, komt vier keer zo weinig.
   const k2 = {w0:aanDeBeurt(1),kd:aanDeBeurt(4),'r-fout':{...nietAanDeBeurt(5),goed:0},'r-goed':{...nietAanDeBeurt(5),goed:3}};
   const t2 = [lesboomTopic('d1',['w0','kd','r-fout','r-goed'])];
   let fout = 0;
   for (let i=0;i<N;i++) if (idsVan(a.herhaalsessieVoorLesboom(t2,k2,nu,'d1',()=>(i+0.5)/N)).includes('r-fout')) fout++;
   assert.equal(fout,800);
 });
 await test('Een antwoord op een bekende vraag die niet aan de beurt was, telt niet mee',()=>{
   assert.equal(a.antwoordTeltMee({meetelt:false},false),false);
   assert.equal(a.antwoordTeltMee({meetelt:true},false),true);
   assert.equal(a.antwoordTeltMee({},false),true);
   assert.equal(a.antwoordTeltMee({meetelt:true},true),false);
 });
 await test('Een herhaalsessie wordt korter bij te weinig vragen en is leeg als niets aan de beurt is',()=>{
   const alleenWerk = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0','w1'])],{w0:aanDeBeurt(1),w1:aanDeBeurt(2)},nu,'d1');
   assert.equal(alleenWerk.length,2);
   assert.equal(alleenWerk[0].vraag.id,'w0'); // laagste doos eerst
   const leeg = a.herhaalsessieVoorLesboom([lesboomTopic('d1',['r0','w0'])],{r0:nietAanDeBeurt(5),w0:nietAanDeBeurt(1)},nu,'d1');
   assert.equal(leeg.length,0);
   assert.equal(a.herhaalsessieVoorLesboom([lesboomTopic('d1',['w0'])],{},nu,'d1').length,0);
 });
 await test('Opgeslagen voortgang zonder openingsdagen laadt met vandaag als eerste dag',()=>{
   const vandaag = new Date(2026,9,21,9,0).getTime();
   for (const vg of [null, undefined, {}, {voortgang:{},kennis:{}}, {openingsdagen:'kapot'}]) {
     const dagen = a.openingsdagenBijLaden(vg,vandaag);
     assert.equal(dagen.length,1);
     assert.equal(dagen[0],'2026-10-21');
   }
   const bestaand = a.openingsdagenBijLaden({openingsdagen:['2026-10-20',7]},vandaag);
   assert.equal(bestaand.length,2);
   assert.equal(bestaand[0],'2026-10-20');
 });
 await test('Twee keer openen op één dag is één openingsdag; oude opslag zonder openingsdagen laadt',()=>{
   const ochtend = new Date(2026,9,20,8,0).getTime();
   const avond = new Date(2026,9,20,22,0).getTime();
   let dagen = a.voegOpeningsdagToe(a.normaliseerOpeningsdagen(undefined),ochtend);
   const zelfde = a.voegOpeningsdagToe(dagen,avond);
   assert.equal(zelfde,dagen);
   assert.equal(dagen.length,1);
   assert.equal(dagen[0],'2026-10-20');
   assert.equal(a.normaliseerOpeningsdagen({}).length,0);
   assert.equal(a.normaliseerOpeningsdagen(['2026-10-20',3,'onzin']).length,1);
   for (let i=0;i<70;i++) dagen = a.voegOpeningsdagToe(dagen,new Date(2026,0,1+i,12).getTime());
   assert.equal(dagen.length,60);
   assert.equal(dagen[59],'2026-10-20');
 });
 await test('Een vraag telt de openingsdagen waarop hij al aan de beurt was',()=>{
   const staat = {doos:2,volgende:new Date(2026,9,10,15,0).getTime(),fouten:0};
   assert.equal(a.dagenAanDeBeurt(staat,[]),0);
   assert.equal(a.dagenAanDeBeurt(undefined,['2026-10-12']),0);
   assert.equal(a.dagenAanDeBeurt(staat,['2026-10-01','2026-10-09','2026-10-10','2026-10-14']),2);
 });
 await test('Pulseren bij tien vragen aan de beurt of een vraag die drie openingsdagen blijft liggen',()=>{
   const volgende = new Date(2026,9,10,9,0).getTime();
   const kennis = {};
   const due = Array.from({length:10},(_,i)=>{kennis['p'+i]={doos:1,volgende,fouten:0};return {vraag:{id:'p'+i},doos:1};});
   assert.equal(a.moetPulseren(due,kennis,[]),true);
   assert.equal(a.moetPulseren(due.slice(0,9),kennis,[]),false);
   const een = due.slice(0,1);
   assert.equal(a.moetPulseren(een,kennis,['2026-10-10','2026-10-11']),false);
   assert.equal(a.moetPulseren(een,kennis,['2026-10-10','2026-10-11','2026-10-15']),true);
   assert.equal(a.moetPulseren([],kennis,['2026-10-10','2026-10-11','2026-10-15']),false);
 });
 await test('Sterkte van een onderwerp is het gemiddelde van zijn lessen, en leeg zonder antwoorden',()=>{
   const vraag = id => ({id,vraag:id,opties:['a','b'],juisteIndex:0});
   const topic = {id:'s1',domeinId:'d1',orbs:[
     {id:'l1',titel:'Les 1',blokken:[],vragen:[vraag('s-a'),vraag('s-b')]},
     {id:'l2',titel:'Les 2',blokken:[],vragen:[vraag('s-c')]},
     {id:'l3',titel:'Zonder vragen',blokken:[],vragen:[]},
   ]};
   assert.equal(a.sterkteVanOnderwerp(topic,{}),null);
   // Les 1: (5+0)/2 = 2,5; les 2: 5; gemiddeld 3,75 van 5 = 0,75. Les 3 telt niet mee.
   const kennis = {'s-a':{doos:5,volgende:0,fouten:0},'s-c':{doos:5,volgende:0,fouten:0}};
   assert.equal(a.sterkteVanOnderwerp(topic,kennis),0.75);
 });
 await test('Les toevoegen bewaart het gekozen juiste antwoord, ook met lege antwoordvakken',()=>{
   const r = a.zonderLegeOpties(['','Zeven','Vijf','Acht'],1);
   assert.equal(r.opties.length,3);
   assert.equal(r.opties[r.juisteIndex],'Zeven');
   const achteraan = a.zonderLegeOpties(['x','','y','z'],3);
   assert.equal(achteraan.opties[achteraan.juisteIndex],'z');
   const vol = a.zonderLegeOpties(['a','b','c','d'],2);
   assert.equal(vol.opties[vol.juisteIndex],'c');
   assert.equal(a.vraagIsHeel({vraag:'Hoeveel?',...achteraan}),true);
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
 await test('Eindbestand zonder Babel-runtime, providersleutel of lesinhoud',()=>{
   const html=fs.readFileSync(path.join(root,'Leerplatform.html'),'utf8');
   assert.ok(!html.includes('api.anthropic.com'));
   assert.ok(!html.includes('api.openai.com'));
   assert.ok(!html.includes('OPENAI_API_KEY'));
   assert.ok(!html.includes('type="text/babel"'));
   assert.ok(!html.includes('naam:"Eten"'));
   assert.ok(html.includes('leerplatform-techniek-content-v1'));
   // De app wordt leeg geleverd: geen enkele les mag nog meegebakken zijn.
   for (const zin of ['Spanning, stroom en weerstand','Basiselektra','Hydrauliek','wet van Ohm']) {
     assert.ok(!html.includes(zin), 'lesinhoud zit nog in het eindbestand: '+zin);
   }
 });

 await test('Een persoonlijke opzet bewaart alle alinea’s en begrenst de invoer',()=>{
   const bron = Array.from({length:25},(_,i)=>'Alinea '+i+' met eigen tekst voor de proef.').join('\n\n');
   const lessen = a.maakLokaleLesopzet(bron);
   assert.ok(lessen.length<=8);
   assert.equal(Array.from(lessen,l=>l.tekst).join('\n\n'),bron);
   assert.throws(()=>a.maakLokaleLesopzet('te kort'));
   assert.throws(()=>a.maakLokaleLesopzet('a'.repeat(40001)));
 });
 await test('Eigen leerprogramma bewaart bestaande inhoud en maakt unieke bronverwijzingen en lesvolgorde',()=>{
   const lessen = [{titel:'De eerste proef',tekst:'Eigen tekst voor de eerste proef.'},{titel:'De tweede proef',tekst:'Eigen tekst voor de tweede proef.'}];
   const bestaand = {domeinen:[{id:'bestaat'}],topics:[{id:'oud'}],bronnen:{bestaat:[{id:'oude-bron'}]}};
   let id=0;
   const uit = a.programmaNaarInhoud({naam:'Proef',doel:'Eigen tekst leren',tekst:'De originele bron',lessen},bestaand,()=>String(++id));
   assert.equal(bestaand.topics.length,1);
   assert.equal(uit.topics[0].id,'oud');
   assert.equal(uit.domeinen.length,2);
   assert.equal(uit.topics[1].prerequisites.length,0);
   assert.equal(uit.topics[2].prerequisites[0],uit.topics[1].id);
   assert.equal(uit.topics[1].orbs[0].vragen.length,0);
   const domein=uit.domeinen[1];
   assert.equal(uit.bronnen[domein.id][0].tekst,'De originele bron');
   assert.equal(uit.topics[1].orbs[0].bronVerwijzingen[0].bronId,uit.bronnen[domein.id][0].id);
   assert.throws(()=>a.programmaNaarInhoud({naam:'',doel:'x',tekst:'x',lessen},bestaand));
 });
 const {vraagOpenAI,controleerVraag}=require('../server/openai.cjs');
 const {maakServer}=require('../server/lokaal.cjs');
 const compleet={status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',role:'assistant',content:[{type:'output_text',text:'Een korte proefuitleg.'}]}]};
 const antwoord=()=>new Response(JSON.stringify(compleet),{status:200,headers:{'Content-Type':'application/json'}});
 await test('OpenAI ontvangt alleen vraag en citaat, met servermodel en opslag uit',async()=>{
   let request;
   const r=await vraagOpenAI({vraag:'Leg dit uit',citaat:'De gekozen tekst.'},{apiKey:'test-geen-echte-sleutel',model:'test-model',fetchImpl:async(url,options)=>{request={url,options};return antwoord();}});
   assert.equal(r.antwoord,'Een korte proefuitleg.');
   assert.equal(request.url,'https://api.openai.com/v1/responses');
   assert.equal(request.options.headers.Authorization,'Bearer test-geen-echte-sleutel');
   const body=JSON.parse(request.options.body);
   assert.equal(body.store,false);
   assert.equal(body.model,'test-model');
   assert.ok(body.max_output_tokens<=1600);
   assert.deepEqual(JSON.parse(body.input[0].content),{vraag:'Leg dit uit',citaat:'De gekozen tekst.'});
   assert.ok(!request.options.body.includes('test-geen-echte-sleutel'));
 });
 await test('Persoonsvelden, ongeldige invoer en ontbrekende configuratie worden voor netwerkgebruik geweigerd',async()=>{
   assert.throws(()=>controleerVraag({vraag:'Leg dit uit',naam:'Persoon'}));
   assert.throws(()=>controleerVraag({vraag:'Leg dit uit',voortgang:{}}));
   assert.throws(()=>controleerVraag({vraag:'x'.repeat(2001)}));
   assert.throws(()=>controleerVraag({vraag:'Leg dit uit',citaat:'x'.repeat(6001)}));
   assert.throws(()=>controleerVraag(null));
   await assert.rejects(vraagOpenAI({vraag:'Leg dit uit'},{fetchImpl:()=>{throw Error('mag niet worden aangeroepen');}}),e=>e.status===503);
 });
 await test('OpenAI-weigeringen, onvolledige antwoorden, storingen en time-outs krijgen een veilige fout',async()=>{
   for(const [status,verwacht] of [[401,503],[403,503],[404,503],[429,429],[500,502]]) {
     await assert.rejects(vraagOpenAI({vraag:'Leg dit uit'},{apiKey:'test',model:'test',fetchImpl:async()=>new Response('provider-secret',{status})}),e=>e.status===verwacht&&!e.message.includes('provider-secret'));
   }
   for(const body of [{status:'incomplete',output:compleet.output},{status:'completed',output:[]},{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'nee'}]}]}]) {
     await assert.rejects(vraagOpenAI({vraag:'Leg dit uit'},{apiKey:'test',model:'test',fetchImpl:async()=>new Response(JSON.stringify(body))}));
   }
   const controller=new AbortController();controller.abort();
   await assert.rejects(vraagOpenAI({vraag:'Leg dit uit'},{apiKey:'test',model:'test',signal:controller.signal,fetchImpl:async(_,o)=>{o.signal.throwIfAborted();}}),e=>e.status===504);
 });
 async function metServer(opts,fn) {
   const server=maakServer(opts);
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   const base='http://127.0.0.1:'+server.address().port;
   try { await fn(base); }
   finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 }
 await test('Lokale server zonder sleutel blijft bruikbaar en stuurt niets naar OpenAI',async()=>{
   await metServer({apiKey:'',model:'',fetchImpl:()=>{throw Error('geen netwerk');}},async base=>{
     const page=await fetch(base);assert.equal(page.status,200);assert.ok((await page.text()).includes('window.LEERPLATFORM_AI=true'));
     const status=await (await fetch(base+'/api/ai/status')).json();assert.equal(status.beschikbaar,false);
     const r=await fetch(base+'/api/ai/hulp',{method:'POST',headers:{Origin:base,'X-Leerplatform':'1','Content-Type':'application/json'},body:JSON.stringify({vraag:'Leg dit uit'})});
     assert.equal(r.status,503);
   });
 });
 await test('Lokale proxy weigert andere websites, extra gegevens en te veel aanvragen',async()=>{
   let calls=0;
   await metServer({apiKey:'test',model:'test',maxAanvragen:1,fetchImpl:async()=>{calls++;return antwoord();}},async base=>{
     const post=(body,origin=base)=>fetch(base+'/api/ai/hulp',{method:'POST',headers:{Origin:origin,'X-Leerplatform':'1','Content-Type':'application/json'},body:JSON.stringify(body)});
     assert.equal((await post({vraag:'Leg dit uit'},'https://andere-site.example')).status,403);
     assert.equal((await post({vraag:'Leg dit uit',voortgang:{}})).status,400);
     assert.equal((await post({vraag:'x'.repeat(41000)})).status,413);
     assert.equal(calls,0);
     const r=await post({vraag:'Leg dit uit'});assert.equal(r.status,200);assert.equal((await r.json()).antwoord,'Een korte proefuitleg.');
     assert.equal((await post({vraag:'Nog een vraag'})).status,429);
     assert.equal(calls,1);
   });
 });

 console.log(`${total} controles geslaagd.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
