// ============================================================================
// BEHEER — honingraat-vormtaal (herontwerp §10, checklist §8)
//
// "Lesboom" op de beheerkant = domein: dat is de eenheid die het datamodel al
// kent en waar de leerkant ook rond bouwt. De raat toont contentvolledigheid
// (heeft dit onderwerp al lessen), geen leerling-voortgang — vandaar de
// synthetische "voortgang" hieronder in plaats van een echte gebruiker s'n.
// ============================================================================
function beheerLesboomInfo(domein, alleTopics) {
  const domeinTopics = alleTopics.filter((t) => t.domeinId === domein.id);
  const inhoudVoortgang = {};
  domeinTopics.forEach((t) => {
    if (t.orbs.length > 0 && t.orbs.every(o => !o.concept)) inhoudVoortgang[t.id] = t.orbs.map((o) => o.id);
  });
  const raat = bouwRaat(domeinTopics, alleTopics, inhoudVoortgang, domein.kleur);
  const totaal = domeinTopics.length;
  const metInhoud = domeinTopics.filter((t) => t.orbs.length > 0 && t.orbs.every(o => !o.concept)).length;
  const aantalLessen = domeinTopics.reduce((s, t) => s + t.orbs.length, 0);
  const pil = totaal === 0 ? "leeg" : metInhoud === totaal ? "gepubliceerd" : "concept";
  return { domein, domeinTopics, raat, totaal, metInhoud, aantalLessen, pil };
}

// Checklist §8 noemt vijf sorteringen (laatst gewijzigd, naam, domein, niveau,
// status); dit datamodel houdt geen wijzigingsdatum, niveau of los domeinveld
// per lesboom bij (een lesboom ís hier al één domein), dus alleen wat echt
// bestaat: naam, status, aantal onderwerpen.
const BEHEER_SORTERINGEN = [
  { id: "eigen", label: "Eigen volgorde" },
  { id: "naam", label: "Naam A–Z" },
  { id: "status", label: "Status" },
  { id: "onderwerpen", label: "Aantal onderwerpen" },
];
const BEHEER_STATUSORDE = ["concept", "gepubliceerd", "leeg"];
function sorteerBeheerLesbomen(lijst, hoe, vastgezet = []) {
  return zetVastVooraan(sorteerBeheerOpKeuze(lijst, hoe), vastgezet);
}

function sorteerBeheerOpKeuze(lijst, hoe) {
  const l = [...lijst];
  if (hoe === "eigen") return l; // de volgorde die de aanroeper al meegaf
  if (hoe === "status") {
    return l.sort(
      (a, b) =>
        BEHEER_STATUSORDE.indexOf(a.pil) - BEHEER_STATUSORDE.indexOf(b.pil) ||
        a.domein.naam.localeCompare(b.domein.naam, "nl")
    );
  }
  if (hoe === "onderwerpen") {
    return l.sort((a, b) => b.totaal - a.totaal || a.domein.naam.localeCompare(b.domein.naam, "nl"));
  }
  return l.sort((a, b) => a.domein.naam.localeCompare(b.domein.naam, "nl"));
}

function BEHEER_PIL_STIJL(pil) {
  const basis = { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, flex: "none", whiteSpace: "nowrap" };
  if (pil === "gepubliceerd") return { ...basis, background: "#E8F4EC", border: "1px solid #9CCBAD", color: "#2E7D4F" };
  return { ...basis, background: "#FFFCF7", border: `1px solid ${UI.randZacht}`, color: UI.tekstSecundair };
}
const BEHEER_PIL_LABEL = { leeg: "leeg", concept: "concept", gepubliceerd: "gepubliceerd" };


// ---------------------------------------------------------------------------
// BRONNENBEHEER
// Per domein lever je de documenten aan die als waarheid gelden. Wat er niet in
// staat, komt niet in de les. Dit is wat het platform dummyproof maakt: de
// KAM-coördinator kan niets toevoegen dat niet in het handboek staat.
// ---------------------------------------------------------------------------
// Vak-stijl (het "zacht vak" onderdeel, #09): witte kaartranden binnen de kaart.
function BRON_VAK_STIJL(extra) {
  return { background: "#FFFCF7", border: `1px solid ${UI.randZacht}`, borderRadius: 18, padding: 16, boxSizing: "border-box", ...extra };
}
const BRON_VELD_STIJL = { height: 34, borderRadius: 999, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, padding: "0 14px", fontSize: 12.5, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
function BRON_SOORT_PIL_STIJL() {
  return { display: "inline-flex", alignItems: "center", height: 20, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flex: "none", background: "#FFFCF7", border: `1px solid ${UI.randZacht}`, color: UI.tekstSecundair };
}
const BRON_SOORT_LABEL = { tekst: "Tekst", hoofdstuk: "Hoofdstuk", hergebruik: "Hergebruik" };

// Alle bronnen in dit datamodel zijn tekst — er is geen PDF-parser of
// link-ophaler achter de knoppen. "PDF uploaden" en "Link toevoegen" staan er
// zoals de vormtaal vraagt, maar wijzen eerlijk door naar "Tekst typen" in
// plaats van iets te doen alsof — zelfde aanpak als "Vraag het de AI" in de les.
// Een bron kan een heel hoofdstuk zijn: de tekst komt pas in de pagina als je hem openklapt.
function BronBekijken({ tekst, leeg = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Bron bekijken</summary>
      {open && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{tekst || leeg}</p>}
    </details>
  );
}

function BronBeheer({ domeinen, topics, bronnen, opOpslaan, startDomeinId }) {
  const [domeinId, setDomeinId] = useState(
    startDomeinId || (domeinen[0] ? domeinen[0].id : "bibliotheek")
  );
  const [vorm, setVorm] = useState(null); // "tekst" | "hergebruik" | "komt-eraan" | null
  const [komtEraanTekst, setKomtEraanTekst] = useState("");
  const [naam, setNaam] = useState("");
  const [tekst, setTekst] = useState("");
  const [hergebruikDomeinId, setHergebruikDomeinId] = useState("");
  const [hergebruikBronId, setHergebruikBronId] = useState("");

  const huidige = bronnen[domeinId] || [];
  const bronGroepen = [...domeinen, {id:"bibliotheek", naam:"Gedeelde bibliotheek"}];
  const andereDomeinen = bronGroepen.filter((d) => d.id !== domeinId && (bronnen[d.id] || []).length > 0);

  // De invoer blijft staan tot opslaan echt gelukt is.
  async function voegToe() {
    if (naam.trim().length < 2 || tekst.trim().length < 100) return;
    const nieuw = {
      ...bronnen,
      [domeinId]: [
        ...huidige,
        { id: `bron-${Date.now()}`, naam: naam.trim(), tekst: tekst.trim(), soort: "tekst" },
      ],
    };
    if ((await opOpslaan({ domeinen, topics, bronnen: nieuw })) === false) return;
    setNaam("");
    setTekst("");
    setVorm(null);
  }

  function neemOver() {
    const bronDomein = bronnen[hergebruikDomeinId] || [];
    const bron = bronDomein.find((b) => b.id === hergebruikBronId);
    if (!bron) return;
    opOpslaan({
      domeinen,
      topics,
      bronnen: {
        ...bronnen,
        [domeinId]: [
          ...huidige,
          { id: `bron-${Date.now()}`, naam: bron.naam, tekst: bron.tekst, soort: "hergebruik" },
        ],
      },
    });
    setHergebruikDomeinId("");
    setHergebruikBronId("");
    setVorm(null);
  }

  function verwijder(id) {
    opOpslaan({
      domeinen,
      topics,
      bronnen: { ...bronnen, [domeinId]: huidige.filter((b) => b.id !== id) },
    });
  }

  const totaalTekens = huidige.reduce((s, b) => s + b.tekst.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: UI.tekstSecundair, maxWidth: "64ch", textWrap: "pretty" }}>
        Per domein lever je de documenten aan die als waarheid gelden — het KAM-handboek,
        een richtlijn, een Gezondheidsraad-advies. Alles wat de omzetter schrijft wordt
        hiertegen getoetst. <strong style={{ color: "#1D1D1D" }}>Wat niet in de bron staat, wordt gemarkeerd.</strong>
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select aria-label="Brongroep" value={domeinId} onChange={(e) => setDomeinId(e.target.value)} style={{ ...BRON_VELD_STIJL, width: "auto", minWidth: 220 }}>
          {bronGroepen.map((d) => (
            <option key={d.id} value={d.id}>
              {d.naam} ({(bronnen[d.id] || []).length} bron(nen))
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="knop2" onClick={() => setVorm(vorm === "komt-eraan" ? null : "komt-eraan")}>PDF uploaden</button>
        <button type="button" className="knop2" onClick={() => setVorm(vorm === "komt-eraan" ? null : "komt-eraan")}>Link toevoegen</button>
        <button type="button" className="knop2" onClick={() => setVorm(vorm === "tekst" ? null : "tekst")}>Tekst typen</button>
        {andereDomeinen.length > 0 && (
          <button type="button" className="knop2" onClick={() => setVorm(vorm === "hergebruik" ? null : "hergebruik")}>Uit andere lesboom</button>
        )}
      </div>

      {vorm === "komt-eraan" && (
        <div style={BRON_VAK_STIJL()}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: UI.tekstSecundair }}>
            Automatisch overnemen uit een PDF of link komt nog niet — plak de tekst voor nu.
          </p>
          <button type="button" className="knop2" style={{ marginTop: 10 }} onClick={() => setVorm("tekst")}>Tekst typen</button>
        </div>
      )}

      {vorm === "hergebruik" && (
        <div style={{ ...BRON_VAK_STIJL(), display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={hergebruikDomeinId}
              onChange={(e) => { setHergebruikDomeinId(e.target.value); setHergebruikBronId(""); }}
              style={{ ...BRON_VELD_STIJL, width: "auto", minWidth: 180 }}
            >
              <option value="">Kies een lesboom…</option>
              {andereDomeinen.map((d) => (
                <option key={d.id} value={d.id}>{d.naam}</option>
              ))}
            </select>
            <select
              value={hergebruikBronId}
              onChange={(e) => setHergebruikBronId(e.target.value)}
              disabled={!hergebruikDomeinId}
              style={{ ...BRON_VELD_STIJL, width: "auto", minWidth: 220, opacity: hergebruikDomeinId ? 1 : 0.5 }}
            >
              <option value="">Kies een bron…</option>
              {(bronnen[hergebruikDomeinId] || []).map((b) => (
                <option key={b.id} value={b.id}>{b.naam}</option>
              ))}
            </select>
          </div>
          <button type="button" className="knop2" style={{ alignSelf: "flex-start", opacity: hergebruikBronId ? 1 : 0.4 }} disabled={!hergebruikBronId} onClick={neemOver}>
            Overnemen
          </button>
        </div>
      )}

      {vorm === "tekst" && (
        <div style={BRON_VAK_STIJL()}>
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam, bijv. KAM-handboek hoofdstuk 4 — Gereedschap"
            style={{ ...BRON_VELD_STIJL, marginBottom: 8 }}
          />
          <textarea
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            rows={8}
            placeholder="Plak hier de tekst van het document. Dit wordt de waarheid waaraan getoetst wordt — dus plak de echte tekst, geen samenvatting."
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, padding: "11px 14px", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: ST.zilver }}>{tekst.trim().length} tekens</span>
            <button type="button" className="knop" disabled={naam.trim().length < 2 || tekst.trim().length < 100} style={{ opacity: naam.trim().length < 2 || tekst.trim().length < 100 ? 0.4 : 1 }} onClick={voegToe}>
              Bron opslaan
            </button>
          </div>
        </div>
      )}

      <DocumentSplitser
        domeinNaam={(domeinen.find((d) => d.id === domeinId) || {}).naam || ""}
        opToevoegen={(nieuweBronnen) =>
          opOpslaan({
            domeinen,
            topics,
            bronnen: {
              ...bronnen,
              [domeinId]: [
                ...huidige,
                ...nieuweBronnen.map((b, i) => ({
                  id: `bron-${Date.now()}-${i}`,
                  naam: b.naam,
                  tekst: b.tekst,
                  soort: "hoofdstuk",
                })),
              ],
            },
          })
        }
      />

      {huidige.length === 0 ? (
        <div style={{ ...BRON_VAK_STIJL(), display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Nog geen bronnen voor dit domein</p>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: UI.tekstSecundair }}>
            Zonder bronnen kan er niet op waarheid getoetst worden. De redacteur kijkt dan
            alleen naar kwaliteit, niet naar juistheid.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {huidige.map((b) => (
            <div key={b.id} style={ORB_RIJ_STIJL(null)}>
              <span style={BRON_SOORT_PIL_STIJL()}>{BRON_SOORT_LABEL[b.soort] || "Tekst"}</span>
              <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.naam}</p>
                <p style={{ margin: "1px 0 0", fontSize: 11.5, color: ST.zilver }}>{b.tekst.length.toLocaleString("nl-NL")} tekens</p>
                <BronBekijken tekst={b.tekst} />
              </div>
              <button type="button" onClick={() => verwijder(b.id)} style={{ flex: "none", fontSize: 11.5, fontWeight: 600, color: ST.zilver, background: "none", border: 0, cursor: "pointer", fontFamily: "inherit" }}>
                Verwijder
              </button>
            </div>
          ))}
          <p style={{ margin: 0, fontSize: 11.5, color: ST.zilver }}>
            Samen {totaalTekens.toLocaleString("nl-NL")} tekens.
            {totaalTekens > 12000 &&
              " Let op: bij toetsing wordt het eerste deel gebruikt. Splits erg grote handboeken per onderwerp."}
          </p>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// GROOT DOCUMENT OPSPLITSEN
//
// Voor wie een compleet handboek of curriculum heeft: plak het in zijn geheel,
// bekijk wat eruit komt, en voeg het in één keer toe als losse hoofdstukbronnen.
// Er komt geen AI aan te pas — het blijft dus altijd bij jouw eigen tekst.
// ---------------------------------------------------------------------------

function DocumentSplitser({ domeinNaam, opToevoegen }) {
  const [open, setOpen] = useState(false);
  const [docTekst, setDocTekst] = useState("");
  const [analyse, setAnalyse] = useState(null);
  const [toegevoegd, setToegevoegd] = useState(0);

  function analyseer() {
    setAnalyse(bereidBronnenVoor(docTekst));
    setToegevoegd(0);
  }

  // Pas na geslaagd opslaan verdwijnt het geplakte document.
  async function voegAlleToe() {
    if (!analyse) return;
    if ((await opToevoegen(analyse.delen.map((d) => ({ naam: d.naam, tekst: d.tekst })))) === false) return;
    setToegevoegd(analyse.delen.length);
    setAnalyse(null);
    setDocTekst("");
    setOpen(false); // sluit af, zodat de bevestiging en de nieuwe bronnen in beeld komen
  }

  if (!open) {
    return (
      <div style={BRON_VAK_STIJL()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Groot document opsplitsen</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.5, color: UI.tekstSecundair, maxWidth: "60ch" }}>
              Heb je een compleet handboek of curriculum? Plak het in één keer; het
              wordt per hoofdstuk als aparte bron klaargezet, met de opmaak die de
              omzetter nodig heeft.
            </p>
          </div>
          <button type="button" className="knop2" style={{ flex: "none" }} onClick={() => setOpen(true)}>Openen</button>
        </div>
        {toegevoegd > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 11.5, fontWeight: 700, color: "#2E7D4F" }}>
            {toegevoegd} hoofdstuk{toegevoegd === 1 ? "" : "ken"} toegevoegd als bron
            {toegevoegd === 1 ? "" : "nen"}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...BRON_VAK_STIJL(), border: "2px solid #F6A923" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>Groot document opsplitsen</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.5, color: UI.tekstSecundair }}>
            Komt terecht in domein <strong style={{ color: "#1D1D1D" }}>{domeinNaam}</strong>.
            Er wordt niets herschreven — alleen de indeling wordt hersteld.
          </p>
        </div>
        <button type="button" className="lb-sluit" style={{ flex: "none" }} aria-label="Opsplitsen sluiten" onClick={() => { setOpen(false); setAnalyse(null); }}>✕</button>
      </div>

      <textarea
        value={docTekst}
        onChange={(e) => {
          setDocTekst(e.target.value);
          setAnalyse(null);
        }}
        rows={8}
        placeholder="Plak hier het volledige document, met alle hoofdstukken achter elkaar. Hoofdstukken worden herkend aan regels als 'Hoofdstuk 1'."
        style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, background: "#FFFFFF", border: `1px solid ${UI.randZacht}`, padding: "11px 14px", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: ST.zilver }}>
          {docTekst.trim().length.toLocaleString("nl-NL")} tekens
        </span>
        <button type="button" className="knop" disabled={docTekst.trim().length < 200} style={{ opacity: docTekst.trim().length < 200 ? 0.4 : 1 }} onClick={analyseer}>
          Bekijk de indeling
        </button>
      </div>

      {analyse && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${UI.randZacht}`, display: "flex", flexDirection: "column", gap: 10 }}>
          {analyse.delen.length === 1 && analyse.delen[0].naam === "Volledig document" && (
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#1D1D1D", background: "#FDEED3", border: "1px solid #F6A923", borderRadius: 14, padding: 11 }}>
              Geen hoofdstukken herkend. Het document wordt als één bron toegevoegd.
              Begint elk hoofdstuk met een regel als "Hoofdstuk 1"? Dan wordt er wel
              per hoofdstuk gesplitst.
            </p>
          )}
          {analyse.voorwerkTekens > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: UI.tekstSecundair }}>
              De {analyse.voorwerkTekens.toLocaleString("nl-NL")} tekens vóór het eerste
              hoofdstuk (voorwoord, inhoudsopgave) worden niet meegenomen.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analyse.delen.map((d, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: `1px solid ${d.waarschuwing ? "#F6A923" : UI.randZacht}`, borderRadius: 14, padding: 11 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{d.naam}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: UI.tekstSecundair, flex: "none" }}>
                    {d.tekens.toLocaleString("nl-NL")} tekens · {d.aantalPassages} passages ·
                    grootste {d.grootstePassage.toLocaleString("nl-NL")}
                    {d.waarschuwing ? "" : " ✓"}
                  </p>
                </div>
                {d.koppenAangepast > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: ST.zilver }}>
                    {d.koppenAangepast} kopregel{d.koppenAangepast === 1 ? "" : "s"} zonder
                    slotleesteken gezet, zodat de indeling meetelt.
                  </p>
                )}
                {d.waarschuwing && (
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#1D1D1D" }}>{d.waarschuwing}</p>
                )}
              </div>
            ))}
          </div>

          <button type="button" className="knop" style={{ width: "100%" }} onClick={voegAlleToe}>
            Voeg toe als {analyse.delen.length} bron{analyse.delen.length === 1 ? "" : "nen"}
          </button>
        </div>
      )}
    </div>
  );
}


