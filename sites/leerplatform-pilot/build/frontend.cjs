const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, ['build/build.cjs'], { cwd: path.join(root, 'source'), stdio: 'inherit' });
const html = fs.readFileSync(path.join(root, 'source/Leerplatform.html'), 'utf8');
fs.writeFileSync(path.join(root, 'server/generated-ui.mjs'), 'export default ' + JSON.stringify(html) + ';\n');
