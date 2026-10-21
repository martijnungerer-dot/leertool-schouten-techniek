// ============================================================================
// VRAAGTYPES
// Elk vraagtype meldt via opAntwoord(juist) of het goed was.
// De les-flow blokkeert doorgang tot het juist is — ongeacht het type.
// ============================================================================

// Antwoordoptie + letterrondje uit 09 — goed groen, fout rood, verder neutraal.
const VRAAG_LETTERS = ["A", "B", "C", "D", "E", "F"];

function vraagLetterStijl(status) {
  const grond = status === "goed" ? "#E8F4EC" : status === "fout" ? "#FBF1F0" : "#FFFCF7";
  const rand = status === "goed" ? "#9CCBAD" : status === "fout" ? "#E8A9A5" : UI.randZacht;
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
    borderRadius: 999, flex: "none", background: grond, border: `1px solid ${rand}`,
    fontSize: 11.5, fontWeight: 700, boxSizing: "border-box",
  };
}

function antwoordStijl(status) {
  const basis = {
    display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 14px", borderRadius: 14,
    border: `1px solid ${UI.randZacht}`, background: "#FFFFFF", width: "100%", boxSizing: "border-box",
    textAlign: "left", fontFamily: "inherit",
  };
  if (status === "goed") return { ...basis, background: "#E8F4EC", border: "1px solid #9CCBAD" };
  if (status === "fout") return { ...basis, background: "#FBF1F0", border: "1px solid #E8A9A5" };
  return basis;
}

function MeerkeuzeVraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {vraag.opties.map((optie, i) => {
        const isGekozen = gekozen === i;
        const isJuist = i === vraag.juisteIndex;
        const status = gekozen === null ? null : isJuist ? "goed" : isGekozen ? "fout" : null;

        return (
          <button
            key={i}
            type="button"
            disabled={gekozen !== null}
            onClick={() => {
              setGekozen(i);
              opAntwoord(i === vraag.juisteIndex);
            }}
            className="lb-lesrij"
            style={{ ...antwoordStijl(status), opacity: gekozen !== null && status === null ? 0.5 : 1 }}
          >
            <span style={vraagLetterStijl(status)}>{VRAAG_LETTERS[i] || i + 1}</span>
            <span style={{ flex: "1 1 0%", minWidth: 0, fontSize: 13.5, lineHeight: 1.45, color: "#1D1D1D" }}>{optie}</span>
          </button>
        );
      })}
    </div>
  );
}

// Een sorteervraag begint altijd door elkaar. De Fisher-Yates-husseling kan
// toevallig de juiste volgorde opleveren; in dat geval wisselen we de eerste
// twee items om. Zo hoeft de gebruiker altijd daadwerkelijk te sorteren.
function maakStartvolgorde(vraag) {
  const volgorde = vraag.items.map((_, i) => i);

  for (let i = volgorde.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }

  const alJuist = volgorde.every((v, i) => v === vraag.juisteVolgorde[i]);
  if (alJuist && volgorde.length > 1) {
    [volgorde[0], volgorde[1]] = [volgorde[1], volgorde[0]];
  }

  return volgorde;
}

function SORTEER_PIJL_STIJL(uit) {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26,
    borderRadius: 999, flex: "none", background: "#FFFFFF", border: `1px solid ${UI.randZacht}`,
    fontSize: 12, fontFamily: "inherit", cursor: uit ? "default" : "pointer", opacity: uit ? 0.35 : 1,
  };
}

function SorteerVraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  // volgorde = lijst met item-indexen zoals de gebruiker ze heeft neergezet
  const [volgorde, setVolgorde] = useState(() => maakStartvolgorde(vraag));
  const beantwoord = gekozen !== null;

  function verplaats(pos, richting) {
    const nieuw = [...volgorde];
    const doel = pos + richting;
    if (doel < 0 || doel >= nieuw.length) return;
    [nieuw[pos], nieuw[doel]] = [nieuw[doel], nieuw[pos]];
    setVolgorde(nieuw);
  }

  function controleer() {
    const juist = volgorde.every((v, i) => v === vraag.juisteVolgorde[i]);
    setGekozen(juist ? "juist" : "fout");
    opAntwoord(juist);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {volgorde.map((itemIndex, pos) => {
        const opJuistePlek = itemIndex === vraag.juisteVolgorde[pos];
        const status = beantwoord ? (opJuistePlek ? "goed" : "fout") : null;

        return (
          <div key={itemIndex} style={antwoordStijl(status)}>
            <span style={vraagLetterStijl(status)}>{pos + 1}</span>
            <span style={{ flex: "1 1 0%", minWidth: 0, fontSize: 13.5, lineHeight: 1.45, color: "#1D1D1D" }}>
              {vraag.items[itemIndex]}
            </span>
            {!beantwoord && (
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <button type="button" onClick={() => verplaats(pos, -1)} disabled={pos === 0} aria-label="Omhoog" style={SORTEER_PIJL_STIJL(pos === 0)}>↑</button>
                <button type="button" onClick={() => verplaats(pos, 1)} disabled={pos === volgorde.length - 1} aria-label="Omlaag" style={SORTEER_PIJL_STIJL(pos === volgorde.length - 1)}>↓</button>
              </div>
            )}
          </div>
        );
      })}

      {!beantwoord && (
        <button type="button" className="knop2" style={{ width: "100%", marginTop: 2 }} onClick={controleer}>
          Controleer volgorde
        </button>
      )}
    </div>
  );
}

function MatchVraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  const [koppels, setKoppels] = useState({}); // linksIndex -> rechtsIndex
  const [actiefLinks, setActiefLinks] = useState(null);
  const beantwoord = gekozen !== null;

  // rechterkolom door elkaar, maar stabiel binnen deze vraag
  const [rechtsVolgorde] = useState(() => {
    const idx = vraag.paren.map((_, i) => i);
    return idx.slice().reverse(); // simpele deterministische husseling
  });

  function kiesRechts(rechtsIndex) {
    if (actiefLinks === null || beantwoord) return;
    const nieuw = { ...koppels };
    // een rechts-item kan maar aan één links-item hangen
    Object.keys(nieuw).forEach((k) => {
      if (nieuw[k] === rechtsIndex) delete nieuw[k];
    });
    nieuw[actiefLinks] = rechtsIndex;
    setKoppels(nieuw);
    setActiefLinks(null);
  }

  const allesGekoppeld = Object.keys(koppels).length === vraag.paren.length;

  function controleer() {
    const juist = vraag.paren.every((_, i) => koppels[i] === i);
    setGekozen(juist ? "juist" : "fout");
    opAntwoord(juist);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          {vraag.paren.map((paar, i) => {
            const gekoppeldAan = koppels[i];
            const isActief = actiefLinks === i;
            const isJuist = gekoppeldAan === i;
            const status = beantwoord ? (isJuist ? "goed" : "fout") : null;

            const stijl = { ...antwoordStijl(status), flexDirection: "column", alignItems: "stretch", gap: 2, cursor: beantwoord ? "default" : "pointer" };
            if (!beantwoord && isActief) { stijl.borderColor = "#F6A923"; stijl.borderWidth = 2; stijl.background = "#FDEED3"; }
            else if (!beantwoord && gekoppeldAan !== undefined) { stijl.borderColor = "#1D1D1D"; }

            return (
              <button key={i} type="button" disabled={beantwoord} onClick={() => setActiefLinks(isActief ? null : i)} style={stijl}>
                <span style={{ fontSize: 13.5, color: "#1D1D1D" }}>{paar.links}</span>
                {gekoppeldAan !== undefined && (
                  <span style={{ fontSize: 12, color: UI.tekstSecundair }}>→ {vraag.paren[gekoppeldAan].rechts}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          {rechtsVolgorde.map((rechtsIndex) => {
            const alGebruikt = Object.values(koppels).includes(rechtsIndex);
            const stijl = { ...antwoordStijl(null), cursor: beantwoord || actiefLinks === null ? "default" : "pointer" };
            if (beantwoord) { stijl.background = "#FFFCF7"; stijl.opacity = 0.6; }
            else if (alGebruikt) { stijl.background = "#FFFCF7"; stijl.opacity = 0.5; }
            else if (actiefLinks !== null) { stijl.borderColor = "#1D1D1D"; }

            return (
              <button key={rechtsIndex} type="button" disabled={beantwoord || actiefLinks === null} onClick={() => kiesRechts(rechtsIndex)} style={stijl}>
                <span style={{ fontSize: 13.5, color: "#1D1D1D" }}>{vraag.paren[rechtsIndex].rechts}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!beantwoord && (
        <>
          <p style={{ margin: "10px 0 0", fontSize: 11.5, color: ST.zilver }}>
            {actiefLinks === null
              ? "Klik links op een item, daarna rechts op de match."
              : "Kies nu rechts de bijbehorende waarde."}
          </p>
          <button type="button" className="knop2" style={{ width: "100%", marginTop: 8, opacity: allesGekoppeld ? 1 : 0.4, cursor: allesGekoppeld ? "pointer" : "not-allowed" }} disabled={!allesGekoppeld} onClick={controleer}>
            Controleer koppelingen
          </button>
        </>
      )}
    </div>
  );
}

function Vraag({ vraag, gekozen, setGekozen, opAntwoord }) {
  const props = { vraag, gekozen, setGekozen, opAntwoord };
  if (vraag.type === "sorteren") return <SorteerVraag key={vraag.id} {...props} />;
  if (vraag.type === "matchen") return <MatchVraag key={vraag.id} {...props} />;
  return <MeerkeuzeVraag {...props} />;
}

