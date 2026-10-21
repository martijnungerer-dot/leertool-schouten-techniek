// Bouw zonder npm-installatie: de bestaande compiler blijft een bouwgereedschap.
// Het eindproduct bevat React en Tailwind, maar geen Babel of demo-fetchschil.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { leesBron } = require('./bron.cjs');
const root = path.resolve(__dirname, '..');
const vendor = path.join(__dirname, 'vendor');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(vendor,'babel.js'),'utf8'), context);
let src = leesBron();
src = src.replace(/^import React[^\n]+\n/, 'const {useState,useEffect,useRef} = React;\n')
  .replace('export default function Leerplatform', 'function Leerplatform');
src = fs.readFileSync(path.join(root,'src/technische-startinhoud.js'),'utf8') + '\n' + src;
const code = context.Babel.transform(src, {presets:['react'], comments:false, compact:true}).code;
const safeScript = text => text.replace(/<\/script/gi, '<\\/script');
const scripts = ['react.js','react-dom.js','tailwind.js'].map(name=>
  '<script>'+safeScript(fs.readFileSync(path.join(vendor,name),'utf8'))+'</script>').join('\n');
const runtime = fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8');
const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><title>Schouten Techniek · Leerplatform</title>
<style>html,body,#root{margin:0;min-height:100%;background:#FBF8F2;color:#1D1D1D;font-family:Calibri,Carlito,Arial,sans-serif}#startstatus{padding:30px}</style>
${scripts}<script>${safeScript(runtime)}</script></head><body>
<noscript>Schakel JavaScript in om de leertool te openen.</noscript><div id="root"><p id="startstatus">Leerplatform wordt geopend…</p></div>
<script>${safeScript(code)}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Leerplatform));
</script></body></html>`;
fs.writeFileSync(path.join(root,'Leerplatform.html'), html, 'utf8');
console.log(`Gebouwd: Leerplatform.html (${Buffer.byteLength(html).toLocaleString('nl-NL')} bytes)`);
