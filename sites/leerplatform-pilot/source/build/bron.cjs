// De broncode staat in losse bestanden in src/modules/. Ze delen één scope en
// worden in deze vaste volgorde achter elkaar gezet tot één tekst; een
// bestandsvolgorde op schijf telt dus niet mee. Voeg een nieuwe module hier
// toe op de plek waar hij hoort.
const fs = require('node:fs');
const path = require('node:path');
const MODULES = [
  'opslag-en-herhaalschema',
  'bronnen-voorbereiden',
  'lesboomlogica',
  'huisstijl',
  'lesblokken',
  'vragen',
  'herhalen',
  'lesboom-raat',
  'overzicht',
  'onderwerp',
  'beheer-bestaande-lesstof',
  'beheer-lesbomen-en-bronnen',
  'vangnet',
  'merkteken-en-zoeken',
  'chromerij-aanmelden-instellingen',
  'app',
  'persoonlijk-programma',
  'beheer-lokaal',
  'les-toevoegen',
];
const leesBron = () => MODULES.map(naam =>
  fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', naam + '.jsx'), 'utf8')).join('');
module.exports = { MODULES, leesBron };
