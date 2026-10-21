// ============================================================================
// SCHERMEN
// ============================================================================

// ============================================================================
// DE HONINGRAAT — vormtaal van het herontwerp
//
// Eén tegelvorm (punt boven), kolom = tier, rij = track in een zigzag rond het
// midden. Status bepaalt vulling en rand, en niets anders. Naden lopen van
// middelpunt tot middelpunt, onder de tegels. Precies één tegel is aanbevolen.
// Zie design/herontwerp/01 - vormtaal lesboom (spec).md, secties 2 t/m 4, en
// design/herontwerp/09 - onderdelen (de enige toegestane bouwstenen).md.
// ============================================================================
const RAAT_HEX_PAD =
  "M -9.7 34.4 Q 0 40 9.7 34.4 L 24.94 25.6 Q 34.64 20 34.64 7.68 L 34.64 -7.68 Q 34.64 -20 24.94 -25.6 L 9.7 -34.4 Q 0 -40 -9.7 -34.4 L -24.94 -25.6 Q -34.64 -20 -34.64 -7.68 L -34.64 7.68 Q -34.64 20 -24.94 25.6 Z";
const RAAT_DX = 69;
const RAAT_DY = 60;

// De raat leest als één honingraat: de tegels raken elkaar (RAAT_DX/DY sluiten
// precies aan) en worden gescheiden door een naad in de kleur van het paneel,
// zoals in de ontwerpschermen. De vulling draagt de status; `later` is bewust
// een warm zand en niet het bijna-witte paneelgrijs, anders oogt een lesboom
// zonder voortgang koud en leeg (afvinklijst 4). Kleur is nooit het enige
// onderscheid: elke status heeft ook een eigen merkteken en aria-woord.
const RAAT_NAAD = "#FFFCF7";
const RAAT_STATUS = {
  af: { vulling: "#E3F1E8", rand: RAAT_NAAD, randDik: 3.5, merkPad: "M -12 1 L -4 9 L 13 -9", merkKleur: "#2E7D4F", woord: "afgerond" },
  bezig: { vulling: "#FFFFFF", rand: "#F6A923", randDik: 2.5, merkPad: "", merkKleur: "#F6A923", woord: "bezig" },
  later: { vulling: "#F7EBD7", rand: RAAT_NAAD, randDik: 3.5, merkPad: "", merkKleur: "#B87B12", woord: "later" },
  leeg: { vulling: "#F1EAE0", rand: RAAT_NAAD, randDik: 3.5, merkPad: "M -10 0 L 10 0", merkKleur: "#AE9C86", woord: "nog geen lessen" },
};

// Vulling/rand van een tegel: alleen dit bepaalt de status.
function topicRaatStatus(topic, voortgang) {
  const totaal = topic.orbs.length;
  if (totaal === 0) return "leeg";
  const gedaan = voortgang[topic.id] || 0;
  if (gedaan >= totaal) return "af";
  if (gedaan > 0) return "bezig";
  return "later";
}

// Rijindex rond het midden: eerste track in het midden (0), tweede erboven
// (-1), derde eronder (+1), vierde twee erboven (-2), enz. — spec §2.
function raatRijIndexen(tracksOplopend) {
  const indexen = {};
  tracksOplopend.forEach((track, i) => {
    if (i === 0) { indexen[track] = 0; return; }
    const magnitude = Math.ceil(i / 2);
    indexen[track] = i % 2 === 1 ? -magnitude : magnitude;
  });
  return indexen;
}

// Bouwt de tegels en naden van één lesboom (domein). Levert ook op welke tegel
// aanbevolen is: de eerste ontgrendelde, niet-afgeronde in tier-volgorde.
//
// Aanname: elk onderwerp heeft hoogstens één voorganger (`prerequisites[0]`),
// zoals de beheer-wizard ze ook aanmaakt; de spec-uitzondering "twee
// voorgangers op één topic" komt in het datamodel niet voor en wordt hier niet
// apart afgehandeld.
function bouwRaat(domeinTopics, alleTopics, voortgang, domeinKleur) {
  if (domeinTopics.length === 0) {
    return { tegels: [], naden: [], viewBox: "0 0 100 100", viewBoxKrap: "0 0 100 100", aanbevolenId: null };
  }

  const gesorteerd = [...domeinTopics].sort((a, b) => {
    const tierA = topicTier(a), tierB = topicTier(b);
    if (tierA !== tierB) return tierA - tierB;
    const trackA = a.gridPos ? a.gridPos.track : 1;
    const trackB = b.gridPos ? b.gridPos.track : 1;
    return trackA - trackB;
  });

  const tracksAanwezig = [...new Set(gesorteerd.map((t) => (t.gridPos ? t.gridPos.track : 1)))];
  const rijIndexen = raatRijIndexen(tracksAanwezig);

  let aanbevolenId = null;
  const tegels = gesorteerd.map((topic) => {
    const kolom = topicTier(topic) - 1;
    const track = topic.gridPos ? topic.gridPos.track : 1;
    const rij = rijIndexen[track] || 0;
    const rijOneven = ((rij % 2) + 2) % 2 === 1;
    const x = 40 + kolom * RAAT_DX + (rijOneven ? RAAT_DX / 2 : 0);
    const y = 100 + rij * RAAT_DY;

    const status = topicRaatStatus(topic, voortgang);
    const ontgrendeld = isTopicUnlocked(topic, alleTopics, voortgang);
    if (!aanbevolenId && ontgrendeld && status !== "af" && status !== "leeg") aanbevolenId = topic.id;
    const deel = topic.orbs.length > 0 ? Math.min(1, (voortgang[topic.id] || 0) / topic.orbs.length) : 0;

    return { topic, x, y, status, ontgrendeld, deel };
  });
  tegels.forEach((t) => { t.aanbevolen = t.topic.id === aanbevolenId; });

  const naden = [];
  tegels.forEach((tegel) => {
    (tegel.topic.prerequisites || []).forEach((voorgangerId) => {
    const bron = tegels.find((t) => t.topic.id === voorgangerId);
    if (!bron) return;
    let kleur = domeinKleur, dekking = 0.4;
    if (!tegel.ontgrendeld) { kleur = UI.padNeutraal; dekking = 0.55; }
    else if (bron.status === "af" && tegel.status === "bezig") { dekking = 0.75; }
    // Een korte brug rond het midden van de twee tegels in plaats van een lijn
    // van middelpunt tot middelpunt: die laatste steekt onder een doorzichtig
    // gemaakte tegel vandaan en leest dan als een losse streep.
    const mx = (bron.x + tegel.x) / 2, my = (bron.y + tegel.y) / 2;
    const lengte = Math.hypot(tegel.x - bron.x, tegel.y - bron.y) || 1;
    const halve = 13 / lengte;
    naden.push({
      x1: mx - (tegel.x - bron.x) * halve, y1: my - (tegel.y - bron.y) * halve,
      x2: mx + (tegel.x - bron.x) * halve, y2: my + (tegel.y - bron.y) * halve,
      kleur, dekking, van: bron.topic.id, naar: tegel.topic.id,
    });
    });
  });

  // Marge onderin is ruimer: de hover/gekozen-naamlabel (spec §5) hangt tot
  // ~67 eenheden onder een tegelmiddelpunt en moet altijd in beeld blijven,
  // ook als de onderste tegel toevallig de gehoverde is.
  const xs = tegels.map((t) => t.x), ys = tegels.map((t) => t.y);
  const margeX = 58, margeBovenY = 58, margeOnderY = 80;
  const x0 = Math.min(...xs) - margeX, y0 = Math.min(...ys) - margeBovenY;
  const breedte = Math.max(...xs) + margeX - x0, hoogte = Math.max(...ys) + margeOnderY - y0;

  // De miniatuur toont geen naamlabels en heeft die ruime marge dus niet nodig;
  // met een krappe uitsnede blijven de tegels op een kaartje herkenbaar in
  // plaats van een grijs vlekje.
  const kx0 = Math.min(...xs) - 38, ky0 = Math.min(...ys) - 43;
  const kBreedte = Math.max(...xs) + 38 - kx0, kHoogte = Math.max(...ys) + 43 - ky0;

  return {
    tegels, naden, aanbevolenId,
    viewBox: `${x0} ${y0} ${breedte} ${hoogte}`,
    viewBoxKrap: `${kx0} ${ky0} ${kBreedte} ${kHoogte}`,
  };
}

// Eén tegel. `groot`=false is de stille miniatuur op een lesboomkaartje;
// `groot`=true is de echte raat (nu: het geopende lesboompaneel op het
// overzicht), met hover-schaal, focus en — op de aanbevolen tegel — de
// ademende gloed. Klikken op een tegel volgt in het volgende scherm (de
// lesboom als eigen route met lesdetail); hier staat de tegel al wel
// focusbaar met het juiste aria-label klaar.
// `sterkte` (0 tot 1, of null) tekent binnen de rand een blauwe ring die zo ver
// rond loopt als het onderwerp erin zit (sterkteVanOnderwerp).
function RaatTegelSvg({ tegel, groot, sterkte = null }) {
  const s = RAAT_STATUS[tegel.status];
  return (
    <g
      className={groot ? "lb-tegel-groep" : undefined}
      transform={`translate(${tegel.x},${tegel.y})`}
      tabIndex={groot ? 0 : undefined}
      role={groot ? "button" : undefined}
      aria-label={groot ? `${tegel.topic.titel}, ${s.woord}` : undefined}
    >
      {groot && tegel.aanbevolen && (
        <circle className="lb-gloed" r="62" fill="url(#lb-gloedverloop)" style={{ pointerEvents: "none" }} />
      )}
      <g className={groot && tegel.aanbevolen ? "lb-adem" : undefined}>
        <path className={groot ? "lb-tegel" : undefined} d={RAAT_HEX_PAD} fill={s.vulling} stroke={tegel.aanbevolen ? ST.oranje : s.rand} strokeWidth={tegel.aanbevolen ? 2.5 : s.randDik} />
        {sterkte !== null && (
          <g transform="scale(.8)" style={{ pointerEvents: "none" }}>
            <path d={RAAT_HEX_PAD} fill="none" stroke={UI.randZacht} strokeWidth="3.5" />
            <path className="lb-sterkte" d={RAAT_HEX_PAD} pathLength="100" fill="none" stroke={ST.blauw} strokeWidth="3.5"
              strokeLinecap="round" strokeDasharray={`${Math.round(sterkte * 100)} 100`} />
          </g>
        )}
        {s.merkPad && (
          <path d={s.merkPad} fill="none" stroke={s.merkKleur} strokeWidth={groot ? 5 : 6} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {tegel.status === "bezig" && (
          <>
            <rect x="-16" y="-3" width="32" height="6" rx="3" fill={UI.randZacht} />
            <rect x="-16" y="-3" width={Math.max(4, 32 * (tegel.deel || 0))} height="6" rx="3" fill={ST.oranje} />
          </>
        )}
      </g>
    </g>
  );
}

// De miniatuurraat op een lesboomkaartje: puur het voortgangssignaal, geen
// voortgangsbalk ernaast (spec §8).
function MiniRaat({ raat }) {
  return (
    <svg viewBox={raat.viewBoxKrap} width="100%" height="62" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ display: "block", marginTop: "auto" }}>
      {raat.naden.map((n, i) => (
        <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={n.kleur} strokeOpacity={n.dekking} strokeLinecap="round" strokeWidth="4" />
      ))}
      {raat.tegels.map((t) => (
        <RaatTegelSvg key={t.topic.id} tegel={t} groot={false} />
      ))}
    </svg>
  );
}

// Klein tegeltje voor een zoektreffer in de chromerij (22×24 viewBox, spec §8).
function TrefferTegelSvg({ status }) {
  const s = RAAT_STATUS[status];
  return (
    <svg width="19" height="21" viewBox="-40 -42 80 84" aria-hidden="true" style={{ flex: "none" }}>
      <path d={RAAT_HEX_PAD} fill={s.vulling} stroke={s.rand} strokeWidth="5.5" />
      {s.merkPad && <path d={s.merkPad} fill="none" stroke={s.merkKleur} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const LESBOOM_SORTERINGEN = [
  { id: "gebruik", label: "Waar je mee bezig bent" },
  { id: "naam", label: "Naam A–Z" },
  { id: "voortgang", label: "Voortgang" },
  { id: "nieuw", label: "Nog niet begonnen" },
];

function sorteerLesbomen(lijst, hoe, vastgezet = []) {
  return zetVastVooraan(sorteerOpKeuze(lijst, hoe), vastgezet);
}

function sorteerOpKeuze(lijst, hoe) {
  const l = [...lijst];
  if (hoe === "naam") return l.sort((a, b) => a.domein.naam.localeCompare(b.domein.naam, "nl"));
  if (hoe === "voortgang") return l.sort((a, b) => b.pct - a.pct || a.domein.naam.localeCompare(b.domein.naam, "nl"));
  if (hoe === "nieuw") return l.sort((a, b) => a.pct - b.pct || a.domein.naam.localeCompare(b.domein.naam, "nl"));
  return l; // "gebruik": de volgorde die de aanroeper al meegaf (bepaalGeordendeDomeinen)
}

// Vastgezette lesbomen staan altijd vooraan, in de volgorde waarin ze zijn
// vastgezet. De rest houdt de volgorde die de sortering opleverde (sort is
// stabiel, dus die blijft staan).
function zetVastVooraan(lijst, vastgezet) {
  if (!vastgezet || vastgezet.length === 0) return lijst;
  const rang = (id) => {
    const i = vastgezet.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...lijst].sort((a, b) => rang(a.domein.id) - rang(b.domein.id));
}

function verrijkLesboom(domein, alleTopics, voortgang) {
  const domeinTopics = alleTopics.filter((t) => t.domeinId === domein.id);
  const raat = bouwRaat(domeinTopics, alleTopics, voortgang, domein.kleur);
  const totaal = domeinTopics.length;
  const klaar = domeinTopics.filter((t) => topicRaatStatus(t, voortgang) === "af").length;
  const pct = totaal > 0 ? Math.round((klaar / totaal) * 100) : 0;
  return { domein, domeinTopics, raat, totaal, klaar, pct };
}

// Aantal leerroutes: onderwerpen die zelf nergens voorganger van zijn — elk
// zo'n blad is het einde van één pad vanaf de wortel(s).
function aantalLeerroutes(domeinTopics) {
  const gebruikt = new Set();
  domeinTopics.forEach((t) => (t.prerequisites || []).forEach((id) => gebruikt.add(id)));
  const bladeren = domeinTopics.filter((t) => !gebruikt.has(t.id));
  return bladeren.length || (domeinTopics.length ? 1 : 0);
}

function routeTekst(topic, domeinTopics, isAanbevolen) {
  const keten = voorgangers(topic, domeinTopics).reverse();
  const basis = keten.length === 0 ? "Startpunt van dit leerpad." : `Na ${keten.map((t) => t.titel).join(" → ")}.`;
  return isAanbevolen ? `${basis} Dit is nu je aanbevolen stap.` : basis;
}

const LEGENDA_ITEMS = [
  { label: "aanbevolen", vulling: "#FFFFFF", rand: ST.oranje, randDik: 2, gloed: true },
  { label: "afgerond", vulling: RAAT_STATUS.af.vulling, rand: "#9CCBAD" },
  { label: "bezig", vulling: RAAT_STATUS.bezig.vulling, rand: ST.oranje },
  { label: "later", vulling: RAAT_STATUS.later.vulling, rand: "#E4D2B4" },
  { label: "nog geen lessen", vulling: RAAT_STATUS.leeg.vulling, rand: "#DDD0BE" },
];

const BLOK_SOORT_LABEL = {
  tekst: "tekstblok", vergelijking: "vergelijking", tijdlijn: "tijdlijn", verhouding: "verhoudingsblok",
  stappen: "stappenblok", mythe: "mythe-blok", pictogram: "pictogram", afbeelding: "afbeelding",
};

const LESRIJ_PIL_STIJL = {
  af: { display: "inline-flex", alignItems: "center", height: 19, padding: "0 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", background: "#E8F4EC", color: "#2E7D4F" },
  bezig: { display: "inline-flex", alignItems: "center", height: 19, padding: "0 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", background: "#FDEED3", color: "#1D1D1D" },
  nieuw: { display: "inline-flex", alignItems: "center", height: 19, padding: "0 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", background: "#FFFCF7", color: UI.tekstSecundair, border: `1px solid ${UI.randZacht}` },
};
const LESRIJ_PIL_LABEL = { af: "af", bezig: "bezig", nieuw: "nieuw" };

// ============================================================================
// LESBOOMDETAIL — de raat zelf, met contextpaneel en lesdetail (herontwerp §3-5)
//
// Klik op een tegel kiest het onderwerp: het contextpaneel (rechts, 288px)
// toont de lessen van dat onderwerp. Klik op een les schuift een lesdetail
// over de raat (nooit over het contextpaneel) met een korte samenvatting en
// de knop om de les echt te starten — die stapt over naar de bestaande
// TopicDetail/LesScherm-navigatie. Die schermen zelf herstijlen is opdracht 3.
// ============================================================================
// `sterkteVoorheen`: de sterkte per onderwerp van vóór een herhaling. Is die er,
// dan begint de raat daar en groeit hij naar de huidige stand.
function LesboomDetail({ domein, domeinTopics, raat, klaar, totaal, pct, voortgang, kennis, sterkteVoorheen = null, opSluiten, opOrbStarten }) {
  const [toonVoorheen, setToonVoorheen] = useState(sterkteVoorheen !== null);
  useEffect(() => {
    if (!toonVoorheen) return;
    // Eerst de oude stand tekenen, dan de nieuwe; de overgang doet de rest.
    let binnen;
    const buiten = requestAnimationFrame(() => { binnen = requestAnimationFrame(() => setToonVoorheen(false)); });
    return () => { cancelAnimationFrame(buiten); cancelAnimationFrame(binnen); };
  }, [toonVoorheen]);
  // Bij het openen gaat de focus naar de naam van de lesboom, zodat toetsenbord en
  // schermlezer weten waar ze zijn (ook na de herhaalpopup).
  const kopRef = useRef(null);
  useEffect(() => { if (kopRef.current) kopRef.current.focus({ preventScroll: true }); }, []);
  const [gekozenId, setGekozenId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [legendaOpen, setLegendaOpen] = useState(false);

  useEffect(() => {
    function bijToets(e) {
      if (e.key !== "Escape") return;
      if (legendaOpen) { setLegendaOpen(false); return; }
      if (gekozenId) { setGekozenId(null); return; }
      opSluiten();
    }
    window.addEventListener("keydown", bijToets);
    return () => window.removeEventListener("keydown", bijToets);
  }, [legendaOpen, gekozenId, opSluiten]);

  function kiesTopic(topicId) {
    if (!raat.tegels.find(t => t.topic.id === topicId)?.ontgrendeld) return;
    setGekozenId(topicId);
    setLegendaOpen(false);
  }

  const padTopic = (hoverId || gekozenId) ? domeinTopics.find((t) => t.id === (hoverId || gekozenId)) : null;
  const padSet = padTopic ? new Set([padTopic.id, ...voorgangers(padTopic, domeinTopics).map((t) => t.id)]) : null;

  const maxTier = domeinTopics.length ? Math.max(...domeinTopics.map(topicTier)) : 1;
  const gekozenTopic = gekozenId ? domeinTopics.find((t) => t.id === gekozenId) : null;
  const aanbevolenTopic = raat.aanbevolenId ? domeinTopics.find((t) => t.id === raat.aanbevolenId) : null;
  const [vbX0, , vbW] = raat.viewBox.split(" ").map(Number);

  return (
    <>
      <div style={{ flex: "none", padding: "18px 22px 0", display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "10px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: ST.zilver }}>
            Lesbomen › {domein.naam}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "nowrap", minWidth: 0 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", flex: "none", background: domein.kleur }} />
            <h1 ref={kopRef} tabIndex={-1} style={{ fontSize: 23, margin: 0, letterSpacing: "-.02em", lineHeight: 1.15, whiteSpace: "nowrap", outline: "none" }}>{domein.naam}</h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 1 auto", minWidth: 0, paddingRight: 34 }}>
          <div style={{ flex: "1 1 150px", minWidth: 148, maxWidth: 210, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair, whiteSpace: "nowrap" }}>
              <span>{klaar} van {totaal} afgerond</span>
              <span style={{ color: "#1D1D1D" }}>{pct}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: "#F1E7D8", overflow: "hidden" }}>
              <div style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: 999, background: "#F6A923" }} />
            </div>
          </div>
          <div style={{ position: "relative", flex: "none" }}>
            <button type="button" className="lb-legknop" aria-expanded={legendaOpen} onClick={() => setLegendaOpen((v) => !v)}>
              Legenda
            </button>
            {legendaOpen && (
              <div style={{ position: "absolute", top: 34, right: 0, zIndex: 55, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, borderRadius: 16, padding: "12px 14px", boxShadow: "0 8px 24px rgba(29,29,29,.09)", display: "flex", flexDirection: "column", gap: 7, width: 186 }}>
                {LEGENDA_ITEMS.map((it) => (
                  <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, color: UI.tekstSecundair }}>
                    <i style={{ width: 11, height: 11, borderRadius: 3, flex: "none", background: it.vulling, border: it.rand ? `${it.randDik || 1}px solid ${it.rand}` : "none", boxSizing: "border-box" }} />
                    {it.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="button" className="lb-sluit kaart-sluit" aria-label="Terug naar de lesbomen" onClick={opSluiten}>✕</button>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, padding: "14px 22px 22px", display: "flex", gap: 16, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0, minHeight: 0, position: "relative", background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, display: "flex", overflow: "hidden" }}>
          {totaal > 0 ? (
            <svg
              viewBox={raat.viewBox}
              preserveAspectRatio="xMidYMid meet"
              role="group"
              aria-label={`Lesboom ${domein.naam}, ${totaal} onderwerpen`}
              style={{ display: "block", margin: "auto", width: "100%", height: "100%", minWidth: 0, minHeight: 0, maxWidth: "min(100%, 620px)", maxHeight: "min(100%, 340px)", overflow: "hidden" }}
            >
              <defs>
                <radialGradient id="lb-gloedverloop" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#F6A923" stopOpacity=".42" />
                  <stop offset="58%" stopColor="#F6A923" stopOpacity=".12" />
                  <stop offset="100%" stopColor="#F6A923" stopOpacity="0" />
                </radialGradient>
              </defs>
              {raat.naden.map((n, i) => {
                const buitenPad = padSet && !(padSet.has(n.van) && padSet.has(n.naar));
                return (
                  <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={n.kleur} strokeLinecap="round"
                    strokeOpacity={buitenPad ? n.dekking * 0.4 : n.dekking} strokeWidth="3.5" />
                );
              })}
              {raat.tegels.map((t) => {
                const gedimd = padSet ? !padSet.has(t.topic.id) : false;
                const naamZichtbaar = t.aanbevolen || hoverId === t.topic.id || gekozenId === t.topic.id;
                const naamBreedte = Math.min(t.topic.titel.length * 6.6 + 28, vbW - 8);
                const naamX = Math.min(Math.max(t.x, vbX0 + naamBreedte / 2 + 4), vbX0 + vbW - naamBreedte / 2 - 4);
                return (
                  <g
                    key={t.topic.id}
                    style={{ opacity: gedimd ? 0.45 : 1, transition: "opacity .22s ease" }}
                    onMouseEnter={() => setHoverId(t.topic.id)}
                    onMouseLeave={() => setHoverId((h) => (h === t.topic.id ? null : h))}
                  >
                    <g onFocus={() => setHoverId(t.topic.id)} onBlur={() => setHoverId((h) => (h === t.topic.id ? null : h))} onClick={() => kiesTopic(t.topic.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); kiesTopic(t.topic.id); } }}>
                      <RaatTegelSvg tegel={t} groot sterkte={toonVoorheen
                        ? (sterkteVoorheen[t.topic.id] ?? null)
                        : sterkteVanOnderwerp(t.topic, kennis)} />
                    </g>
                    {naamZichtbaar && (
                      <g transform={`translate(${naamX},${t.y + 44})`} style={{ pointerEvents: "none" }}>
                        <rect x={-naamBreedte / 2} y="0" width={naamBreedte} height="23" rx="11.5"
                          fill="#FFFFFF" stroke={gekozenId === t.topic.id ? "#F6A923" : "#E9DED0"} />
                        <text x="0" y="15.5" textAnchor="middle" fontSize="11.5" fontWeight={gekozenId === t.topic.id ? 700 : 600} fill="#1D1D1D">
                          {t.aanbevolen && !hoverId && !gekozenId ? "Start hier" : t.topic.titel}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div style={{ margin: "auto", fontSize: 13, color: UI.tekstSecundair }}>Nog geen onderwerpen in dit domein.</div>
          )}

        </div>

        <div style={{ flex: "0 0 288px", minWidth: 0, minHeight: 0, position: "relative", display: "flex" }}>
          {gekozenTopic ? (
            <TopicZijpaneel
              topic={gekozenTopic}
              tier={topicTier(gekozenTopic)}
              maxTier={maxTier}
              route={routeTekst(gekozenTopic, domeinTopics, gekozenTopic.id === raat.aanbevolenId)}
              voortgang={voortgang}
              opSluiten={() => setGekozenId(null)}
              opLesStarten={(orbIndex) => opOrbStarten(gekozenTopic.id, orbIndex)}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, border: "1px dashed #D8CDBF", borderRadius: 18, padding: 18, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: ST.zilver }}>Aanbevolen volgende stap</span>
              {aanbevolenTopic ? (
                <>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.25 }}>{aanbevolenTopic.titel}</span>
                  <button type="button" className="knop" style={{ alignSelf: "flex-start" }} onClick={() => kiesTopic(aanbevolenTopic.id)}>
                    Start hier
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 12, lineHeight: 1.55, color: UI.tekstSecundair }}>
                  {totaal === 0
                    ? "Nog geen onderwerpen in deze lesboom."
                    : "Alle onderwerpen in deze lesboom zijn afgerond."}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TopicZijpaneel({ topic, tier, maxTier, route, voortgang, opSluiten, opLesStarten }) {
  const gedaan = voortgang[topic.id] || 0;
  const totaal = topic.orbs.length;
  const pct = totaal > 0 ? Math.round((gedaan / totaal) * 100) : 0;

  return (
    <div style={{ position: "absolute", inset: 0, background: UI.kaartZacht, border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: ST.zilver }}>
            Stap {tier} van {maxTier}
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.25 }}>{topic.titel}</span>
        </div>
        <button type="button" className="lb-sluit" aria-label="Paneel sluiten" onClick={opSluiten}>✕</button>
      </div>

      {totaal > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, color: UI.tekstSecundair }}>
            <span>{gedaan} van {totaal} {totaal === 1 ? "les" : "lessen"} af</span>
            <span style={{ color: "#1D1D1D" }}>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#F1E7D8", overflow: "hidden" }}>
            <div style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: 999, background: "#F6A923" }} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, lineHeight: 1.55, color: UI.tekstSecundair }}>{route}</div>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 9, paddingRight: 2 }}>
        {totaal === 0 ? (
          <div style={{ fontSize: 12.5, color: UI.tekstSecundair }}>Nog geen lessen in dit onderwerp.</div>
        ) : (
          topic.orbs.map((orb, i) => {
            const status = i < gedaan ? "af" : i === gedaan ? "bezig" : "nieuw";
            const orbBlokken = Array.isArray(orb.blokken) ? orb.blokken : [];
            const orbVragen = Array.isArray(orb.vragen) ? orb.vragen : [];
            return (
              <div
                key={orb.id}
                className="lb-lesrij"
                tabIndex={0}
                role="button"
                onClick={() => opLesStarten(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opLesStarten(i); } }}
                style={{ border: `1px solid ${UI.randZacht}`, borderRadius: 15, padding: "11px 12px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6, background: "#FFFFFF" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{orb.titel}</span>
                  <span style={LESRIJ_PIL_STIJL[status]}>{orb.concept ? "lesopzet" : LESRIJ_PIL_LABEL[status]}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: UI.tekstSecundair }}>
                  {orbBlokken.length} {orbBlokken.length === 1 ? "blok" : "blokken"} · {orbVragen.length} {orbVragen.length === 1 ? "vraag" : "vragen"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Slepen en met het toetsenbord verschuiven van een rij lesboomkaarten. Zowel
// het lesbomenoverzicht als de lesvoorbereiding gebruikt dit, zodat de kaarten
// zich aan beide kanten hetzelfde gedragen.
function useSleepVolgorde(lijst, magSlepen, opVolgorde) {
  const [sleepId, setSleepId] = useState(null);

  function verplaats(van, naar) {
    if (van < 0 || naar < 0 || van === naar) return;
    const nieuw = [...lijst];
    nieuw.splice(naar, 0, nieuw.splice(van, 1)[0]);
    opVolgorde(nieuw.map((x) => x.domein.id));
  }

  return {
    sleepId,
    // Tijdens het slepen neemt de gesleepte kaart de plaats in van de kaart
    // waar hij overheen komt, zodat de rij live meebeweegt.
    kaartProps: (id) => ({
      draggable: magSlepen,
      "data-sleept": sleepId === id ? "ja" : "nee",
      onDragStart: (e) => { setSleepId(id); e.dataTransfer.effectAllowed = "move"; },
      onDragEnd: () => setSleepId(null),
      onDragOver: (e) => { if (magSlepen && sleepId) e.preventDefault(); },
      onDragEnter: () => {
        if (!magSlepen || !sleepId || sleepId === id) return;
        verplaats(lijst.findIndex((x) => x.domein.id === sleepId), lijst.findIndex((x) => x.domein.id === id));
      },
    }),
    verschuif: (index, richting) => { if (magSlepen) verplaats(index, index + richting); },
  };
}

// De speld op een kaart: vastzetten haalt een lesboom naar voren en houdt hem
// daar, ook onder een andere sortering.
function KaartSpeld({ naam, vast, opWisselen }) {
  return (
    <button
      type="button"
      className="lb-kaart-pin"
      data-vast={vast ? "ja" : "nee"}
      aria-pressed={vast}
      aria-label={vast ? `${naam} losmaken` : `${naam} vastzetten`}
      title={vast ? "Losmaken" : "Vastzetten"}
      onClick={opWisselen}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={vast ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.5 3h5l-.8 5.2 3.3 3.3v1.8h-5.5v6.2L12 21l-.5-1.5v-6.2H6v-1.8l3.3-3.3z" />
      </svg>
    </button>
  );
}

