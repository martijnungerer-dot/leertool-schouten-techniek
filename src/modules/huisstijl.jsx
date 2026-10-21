// ============================================================================
// VISUELE TOKENS — huisstijl Schouten Techniek + ondersteunende interfacekleuren
//
// Officiële merkkleuren volgens de huisstijlgids. Rood en blauw zeer
// terughoudend gebruiken; de hoofdinterface is oranje, donker, wit en warm
// neutraal. De ondersteunende kleuren zijn interfacekleuren, geen merkkleuren.
// Geen designsysteem — alleen deze ene kleine verzameling.
// ============================================================================
const ST = {
  oranje: "#F6A923",
  donker: "#1D1D1D",
  blauw: "#0098D4",
  rood: "#E32118",
  zilver: "#B1B2B4",
};

// De zichtbare naam van de beheerkant. Overal via deze constante, zodat de
// naam op één plek staat (afvinklijst 10).
const BEHEER_NAAM = "Lesvoorbereiding";
// Er zijn nog geen accounts. Zet op false voor iemand zonder recht om lessen voor
// te bereiden: het keuzescherm wordt dan overgeslagen.
const MAG_VOORBEREIDEN = true;

const UI = {
  achtergrond: "#FBF8F2",
  kaart: "#FFFFFF",
  kaartZacht: "#FFFCF7",
  randZacht: "#E9DED0",
  tekstSecundair: "#667085",
  padNeutraal: "#D8CDBF",
  succes: "#2E7D4F",
  succesZacht: "#E8F4EC",
  succesRand: "#9CCBAD",
};

// Als CSS-variabelen + globale typografie, één keer geïnjecteerd in de app-root.
const APP_STIJL = `
  html, body, #root { height: 100%; }
  body { margin: 0; overflow: hidden; }
  .app-shell { height: 100dvh; padding: 22px 26px 24px; box-sizing: border-box; }
  .app-layout { height: 100%; display:flex; flex-direction:column; min-height:0; }
  .app-content { position:relative; flex:1 1 0%; min-height:0; }
  .app-header { display:flex; align-items:center; gap:10px; flex:none; margin-bottom:16px; position:relative; z-index:65; }
  .app-nav { display:flex; align-items:center; gap:7px; margin-left:auto; flex-wrap:wrap; }
  .app-columns { display:flex; flex:1 1 0%; min-height:0; gap:16px; overflow:hidden; }
  .app-sidebar { flex:0 0 288px; min-width:0; min-height:0; }
  .app-actions { display:flex; flex:none; flex-wrap:wrap; gap:10px; padding-top:14px; }
  .app-alert { background:#FBF1F0; border:1px solid #E8A9A5; border-radius:14px; padding:10px 14px; margin-bottom:12px; font-size:13px; }
  .app-shell button:disabled { cursor:not-allowed; opacity:.45; }
  .app-shell p { text-wrap:pretty; }
  .app-shell [role="alert"] { overflow-wrap:anywhere; }
  .app-high-contrast { --tekst-secundair:#1D1D1D; --rand-zacht:#667085; }
  .app-high-contrast [style*="color: rgb(177, 178, 180)"] { color:#667085!important; }
  .app-high-contrast input, .app-high-contrast button { border-color:#667085!important; }
  /* De kopregel blijft één regel tot ver onder 766px breed: eerst verliezen de
     icoonknoppen hun label, daarna maakt het volledige logo plaats voor het
     beeldmerk. Pas als ook dat niet meer past breekt de navigatie af — anders
     staat het logo op een eigen regel boven de navigatie (afvinklijst 1, 2, 9). */
  .app-logo-vol { display:block; }
  .app-logo-merk { display:none; }
  @media(max-width:1000px) {
    .app-nav { gap:6px; }
    .app-nav .lb-chrome { padding:0 10px; gap:6px; }
    .lb-chrome-bijschrift { display:none; }
  }
  @media(max-width:700px) {
    .app-logo-vol { display:none; }
    .app-logo-merk { display:block; }
  }
  @media(max-width:850px) {
    .app-shell { padding:12px; }
    .app-columns { flex-direction:column; overflow:auto; }
    .app-columns > div { flex:none!important; min-height:220px; }
    .app-columns > .app-sidebar { width:100%; max-width:none!important; min-height:170px; }
    .lb-zoekveld { max-width:calc(100vw - 48px); }
    .app-search-results { max-width:calc(100vw - 32px); left:0; right:auto!important; }
    .app-card-head { flex-wrap:wrap!important; }
    .app-card-head > div { min-width:0!important; }
  }
  @media(max-width:620px) {
    .app-header { flex-wrap:wrap; }
    .app-nav { flex:1 1 100%; margin-left:0; }
  }
  @media(prefers-reduced-motion:reduce) {
    *,*::before,*::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; }
  }
  .lb-rustig *, .lb-rustig *::before, .lb-rustig *::after { animation:none!important; transition:none!important; }
  :root {
    --st-oranje: ${ST.oranje};
    --st-donker: ${ST.donker};
    --st-blauw: ${ST.blauw};
    --st-rood: ${ST.rood};
    --st-zilver: ${ST.zilver};
    --app-achtergrond: ${UI.achtergrond};
    --kaart: ${UI.kaart};
    --kaart-zacht: ${UI.kaartZacht};
    --rand-zacht: ${UI.randZacht};
    --tekst-secundair: ${UI.tekstSecundair};
    --pad-neutraal: ${UI.padNeutraal};
    --succes: ${UI.succes};
  }

  /* Zachte, natuurlijke schermwissel: nieuwe inhoud komt rustig omhoog en fade-in,
     verankerd waar de vorige stond. Zo voelt de overgang van boom naar les vloeiend
     in plaats van hard. Reduced motion: alleen een korte cross-fade, geen beweging. */
  @keyframes scherm-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scherm-in-zacht {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .scherm-in { animation: scherm-in 0.34s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) {
    .scherm-in { animation: scherm-in-zacht 0.2s ease both; transform: none; }
  }
  /* "Beweging beperken" in het instellingenpaneel: dezelfde regels als
     prefers-reduced-motion, maar handmatig aan te zetten. */
  .lb-rustig .scherm-in { animation: scherm-in-zacht 0.2s ease both; transform: none; }

  /* De app is bewust een licht ontwerp. Wordt hij in een donker-thema omgeving
     getoond (bijv. ingebed in een host in dark mode), dan zouden invoervelden
     zonder eigen kleur zwart worden en onleesbaar zijn. We pinnen daarom de
     lichte modus vast en geven alle formuliervelden een expliciete lichte kleur. */
  :root { color-scheme: light; }
  input, textarea, select {
    color-scheme: light;
    background-color: #FFFFFF;
    color: var(--st-donker);
    border-color: var(--rand-zacht);
  }
  input::placeholder, textarea::placeholder { color: #9AA0A6; opacity: 1; }

  /* Focus overal in het oranje, nooit de blauwe browserring (herontwerp §Focus). */
  *:focus-visible { outline: 2px solid var(--st-oranje); outline-offset: 2px; }

  /* Primaire/secundaire knop uit design/herontwerp/09 — de enige twee knelknoppen
     buiten de chromepills en de lesboomkaarten om (o.a. het aanmeldscherm). */
  .knop, .knop2 {
    display: inline-flex; align-items: center; justify-content: center;
    height: 36px; padding: 0 18px; border-radius: 999px;
    font-family: inherit; font-size: 13px; cursor: pointer; white-space: nowrap;
    flex: none; transition: background .18s ease;
  }
  .knop { border: 0; font-weight: 700; background: var(--st-donker); color: #FFFFFF; }
  .knop:hover { background: #333030; }
  .knop2 { font-weight: 600; background: #FFFFFF; color: var(--st-donker); border: 1px solid var(--rand-zacht); }
  .knop2:hover { background: #FDEED3; }

  /* Honingraat-vormtaal (herontwerp): chromepills, lesboomkaartjes, tegel-hover,
     het inschuivende lesboompaneel en het zoekveld in de chromerij. Waarden uit
     design/herontwerp/09 - onderdelen (de enige toegestane bouwstenen).md. */
  .lb-chrome {
    height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px;
    border-radius: 999px; background: #FFFFFF; border: 1px solid var(--rand-zacht);
    font-size: 12px; font-weight: 600; color: var(--st-donker); cursor: pointer;
    transition: background .18s ease; white-space: nowrap; font-family: inherit;
  }
  .lb-chrome:hover { background: #FDEED3; }
  .lb-chrome[data-actief="ja"] { background: var(--st-donker); color: #FFFFFF; border-color: var(--st-donker); }
  .lb-kaartje {
    position: relative; text-align: left; font-family: inherit; color: inherit; background: var(--kaart-zacht);
    border: 1px solid var(--rand-zacht); border-radius: 18px; padding: 14px 15px 12px; cursor: pointer;
    display: flex; flex-direction: column; gap: 9px;
    box-shadow: 0 1px 2px rgba(29,29,29,.04);
    transition: transform .2s cubic-bezier(.32,.9,.3,1), box-shadow .2s ease, background .2s ease, opacity .2s ease;
  }
  .lb-kaartje:hover, .lb-kaartje:focus-within { background: #FFFFFF; transform: translateY(-2px); box-shadow: 0 4px 14px rgba(29,29,29,.09); }
  /* Een lesboom zonder onderwerpen is wél te openen — je ziet dan een lege raat.
     De onderbroken rand zegt dat er nog niets in zit. */
  .lb-kaartje[data-leeg="ja"] { border-style: dashed; border-color: var(--pad-neutraal); }
  .lb-kaartje[data-sleept="ja"] { opacity: .5; transform: none; }
  /* De kaart op het lesbomenoverzicht bestaat uit een knop die hem helemaal
     vult, met de speld eroverheen; daar zit de padding in de knop zelf. */
  .lb-kaartje[data-vullend="ja"] { padding: 0; gap: 0; }
  /* De hele kaart is de knop; de speld ligt er als tweede knop overheen. */
  .lb-kaart-hoofd {
    flex: 1 1 auto; display: flex; flex-direction: column; gap: 9px;
    padding: 14px 15px 12px; border: 0; border-radius: 18px; background: transparent;
    font-family: inherit; color: inherit; text-align: left; cursor: inherit;
  }
  .lb-kaart-pin {
    position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid transparent; border-radius: 999px; background: transparent;
    color: var(--pad-neutraal); cursor: pointer; font-family: inherit;
    transition: color .16s ease, background .16s ease, border-color .16s ease;
  }
  .lb-kaartje:hover .lb-kaart-pin { color: var(--tekst-secundair); }
  .lb-kaart-pin:hover { background: #FDEED3; border-color: var(--rand-zacht); color: var(--st-donker); }
  .lb-kaart-pin[data-vast="ja"] { color: var(--st-oranje); border-color: var(--rand-zacht); background: #FFFFFF; }
  .lb-tegel { transition: scale .25s cubic-bezier(.34,1.3,.64,1); transform-box: fill-box; transform-origin: center; }
  .lb-tegel-groep:hover .lb-tegel, .lb-tegel-groep:focus-visible .lb-tegel { scale: 1.06; }
  /* De aanbevolen tegel: een zachte radiale gloed die langzaam op- en afzwelt en
     een tegel die nauwelijks merkbaar ademt. Samen maakt dat de raat levend in
     plaats van een stilstaand schema. */
  .lb-gloed { animation: lb-gloedpuls 4s ease-in-out infinite; }
  @keyframes lb-gloedpuls { 0%, 100% { opacity: .4; } 50% { opacity: .75; } }
  .lb-adem { animation: lb-adem 4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes lb-adem { 0%, 100% { scale: 1; } 50% { scale: 1.035; } }
  /* Teller van vragen die aan de beurt zijn (HerhaalTeller). Pulseren stopt met
     "Beweging beperken" of prefers-reduced-motion; het oranje blijft. */
  .lb-teller {
    display: inline-flex; align-items: center; justify-content: center; flex: none;
    min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px;
    background: var(--kaart-zacht); border: 1px solid var(--rand-zacht); color: var(--st-donker);
    font-size: 10.5px; font-weight: 700; line-height: 1;
  }
  .lb-teller[data-puls="ja"] { background: var(--st-oranje); border-color: var(--st-oranje); animation: lb-tellerpuls 1.8s ease-out infinite; }
  @keyframes lb-tellerpuls { 0% { box-shadow: 0 0 0 0 rgba(246,169,35,.6); } 70%, 100% { box-shadow: 0 0 0 7px rgba(246,169,35,0); } }
  /* Met de muis klikken mag geen ring geven; toetsenbordfocus wel, in het oranje. */
  .lb-tegel-groep:focus { outline: none; }
  .lb-tegel-groep:focus-visible { outline: 2px solid var(--st-oranje); outline-offset: 3px; border-radius: 10px; }
  .lb-paneel {
    position: absolute; inset: 0; z-index: 40; background: #FFFFFF;
    border: 1px solid var(--rand-zacht); border-radius: 22px; box-shadow: 0 1px 3px rgba(29,29,29,.06);
    visibility: hidden; pointer-events: none; overflow: hidden; display: flex; flex-direction: column;
  }
  .lb-paneel[data-open="ja"] { visibility: visible; pointer-events: auto; animation: lb-inschuif .3s cubic-bezier(.22,.9,.3,1) forwards; }
  @keyframes lb-inschuif { from { transform: translateY(14px); opacity: .4; } to { transform: translateY(0); opacity: 1; } }
  .lb-sluit {
    width: 29px; height: 29px; border-radius: 999px; border: 1px solid var(--rand-zacht);
    background: #FFFFFF; color: var(--st-donker); font-size: 14px; line-height: 1;
    cursor: pointer; flex: none; font-family: inherit;
  }
  .lb-sluit:hover { background: #FDEED3; }
  /* Het sluitkruis staat overal op dezelfde plek: vast rechtsboven in de kaart
     of het paneel, niet los naast voortgang of legenda (afvinklijst 5). */
  .kaart-sluit { position: absolute; top: 16px; right: 18px; z-index: 45; }
  .lb-sortopt, .lb-trefrij {
    display: flex; align-items: center; width: 100%; cursor: pointer; font-family: inherit;
    text-align: left; border: 0; background: transparent; color: var(--st-donker);
    border-radius: 12px; transition: background .14s ease;
  }
  .lb-sortopt { justify-content: space-between; gap: 14px; font-size: 12.5px; font-weight: 600; padding: 8px 12px; }
  .lb-trefrij { padding: 9px 11px; border-radius: 14px; gap: 11px; }
  .lb-sortopt:hover, .lb-trefrij:hover { background: #FDEED3; }
  .lb-legknop {
    border: 1px solid var(--rand-zacht); background: #FFFFFF; color: var(--tekst-secundair);
    cursor: pointer; font-family: inherit; font-size: 11.5px; font-weight: 700;
    padding: 5px 11px; border-radius: 999px; transition: background .16s ease, color .16s ease;
  }
  .lb-legknop:hover { background: #FDEED3; color: var(--st-donker); }
  .lb-lesrij { cursor: pointer; transition: border-color .16s ease, background .16s ease, transform .16s ease; }
  .lb-lesrij:hover, .lb-lesrij:focus-visible { border-color: var(--st-oranje); background: #FFFFFF; transform: translateY(-1px); }
  .lb-zoekveld {
    display: flex; align-items: center; gap: 8px; box-sizing: border-box; width: 294px; height: 34px;
    padding: 0 8px 0 13px; border-radius: 999px; background: #FFFFFF; border: 1px solid var(--st-oranje);
    animation: lb-zoekop .2s cubic-bezier(.32,.9,.3,1);
  }
  @keyframes lb-zoekop { from { width: 104px; opacity: .4; } }
  /* De zwevende "Vraag het de AI"-pill bij een tekstselectie (herontwerp §9/Les). */
  .lb-selpil {
    position: absolute; z-index: 30; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
    border-radius: 999px; background: #FFFFFF; border: 1px solid var(--st-oranje); box-shadow: 0 4px 14px rgba(29,29,29,.14);
    font-family: inherit; font-size: 12px; font-weight: 700; color: var(--st-donker); cursor: pointer; white-space: nowrap;
    transform: translateX(-50%); animation: lb-pilop .16s ease-out;
  }
  .lb-selpil:hover { background: #FDEED3; }
  @keyframes lb-pilop { from { opacity: 0; transform: translateX(-50%) translateY(4px); } }
  #leesgebied ::selection { background: #FDEED3; }
  @media (prefers-reduced-motion: reduce) {
    .lb-kaartje, .lb-tegel, .lb-paneel { transition: none; }
    .lb-kaartje:hover, .lb-kaartje:focus-within { transform: none; }
    .lb-tegel-groep:hover .lb-tegel, .lb-tegel-groep:focus-visible .lb-tegel { scale: 1; }
    .lb-gloed { animation: none; opacity: .55; }
    .lb-adem { animation: none; }
    .lb-paneel[data-open="ja"] { animation: none; }
    .lb-zoekveld { animation: none; }
    .lb-selpil { animation: none; }
  }
  .lb-rustig .lb-kaartje, .lb-rustig .lb-tegel, .lb-rustig .lb-paneel, .lb-rustig .instellingen-paneel { transition: none; }
  .lb-rustig .lb-kaartje:hover, .lb-rustig .lb-kaartje:focus-within { transform: none; }
  .lb-rustig .lb-tegel-groep:hover .lb-tegel, .lb-rustig .lb-tegel-groep:focus-visible .lb-tegel { scale: 1; }
  .lb-rustig .lb-gloed { animation: none; opacity: .55; }
  .lb-rustig .lb-adem { animation: none; }
  .lb-rustig .lb-paneel[data-open="ja"] { animation: none; }
  .lb-rustig .lb-zoekveld { animation: none; }
  .lb-rustig .lb-selpil { animation: none; }
  .lb-rustig .instellingen-paneel[data-open="ja"] { animation: none; }

  /* Instellingenpaneel: dezelfde inschuifbeweging als het lesdetail (lb-inschuif),
     maar als vast rechterpaneel boven de hele app. */
  .instellingen-paneel {
    position: fixed; top: 16px; right: 16px; bottom: 16px; width: 320px; max-width: calc(100vw - 32px);
    z-index: 70; background: #FFFFFF; border: 1px solid var(--rand-zacht); border-radius: 22px;
    box-shadow: 0 8px 24px rgba(29,29,29,.14); padding: 20px; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 16px; overflow: hidden;
    visibility: hidden; pointer-events: none;
  }
  .instellingen-paneel[data-open="ja"] { visibility: visible; pointer-events: auto; animation: lb-inschuif .3s cubic-bezier(.22,.9,.3,1) forwards; }
  @media (prefers-reduced-motion: reduce) { .instellingen-paneel[data-open="ja"] { animation: none; } }
`;


