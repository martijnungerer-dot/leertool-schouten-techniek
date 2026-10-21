// ---------------------------------------------------------------------------
// STAP 1 — bronnen deterministisch opknippen in passages (puur, geen LLM)
//
// Passages zijn offsets in de brontekst, geen kopieën. De bron blijft leidend.
// Een kop (korte regel zonder punt) begint altijd een nieuwe passage; een
// alinea wordt nooit doorgeknipt.
// ---------------------------------------------------------------------------
const PASSAGE_MAX = 2500;

function splitsInPassages(bron) {
  const tekst = bron.tekst;

  // alinea's mét hun offsets in de brontekst
  const alineas = [];
  const scheider = /\n\s*\n/g;
  let vorige = 0;
  let m;
  while ((m = scheider.exec(tekst)) !== null) {
    if (m.index > vorige) alineas.push({ van: vorige, tot: m.index });
    vorige = m.index + m[0].length;
  }
  if (vorige < tekst.length) alineas.push({ van: vorige, tot: tekst.length });

  const isKop = (a) => {
    const t = tekst.slice(a.van, a.tot).trim();
    return t.length > 0 && t.length <= 60 && !t.includes("\n") && !/[.!?]$/.test(t);
  };

  const passages = [];
  let huidige = null;
  let laatsteKop = "";

  const sluitAf = () => {
    if (!huidige) return;
    passages.push({
      id: `p-${bron.id}-${passages.length + 1}`,
      bronId: bron.id,
      van: huidige.van,
      tot: huidige.tot,
      kop: huidige.kop,
    });
    huidige = null;
  };

  alineas.forEach((a) => {
    const lengte = a.tot - a.van;
    if (isKop(a)) {
      laatsteKop = tekst.slice(a.van, a.tot).trim();
      sluitAf();
    }
    if (huidige && huidige.tot - huidige.van + lengte > PASSAGE_MAX) sluitAf();
    if (!huidige) {
      huidige = { van: a.van, tot: a.tot, kop: laatsteKop };
    } else {
      huidige.tot = a.tot;
    }
  });
  sluitAf();

  return passages;
}

// ---------------------------------------------------------------------------
// DE DOCUMENTSPLITSER — puur rekenwerk, geen AI, geen netwerk.
//
// Eén groot document (een handboek, een compleet curriculum) omzetten in losse
// hoofdstukbronnen met opmaak die splitsInPassages hierboven aankan. Zonder
// witregels wordt een heel document namelijk één reuzenpassage; dat is de
// meest voorkomende oorzaak van een mislukte leerpad-run.
//
// Deterministisch: hetzelfde document geeft altijd hetzelfde resultaat.
// ---------------------------------------------------------------------------

function isOpsommingsregel(regel) {
  return /^\s*([*\-•·]|\d+[.)])\s+/.test(regel);
}

// Een regel die zich als kop gedraagt: kort, op zichzelf staand, geen hele zin.
function lijktOpKop(regel) {
  const t = regel.trim();
  if (!t || t.length > 60) return false;
  if (isOpsommingsregel(regel)) return false;
  if (/[.!]$/.test(t)) return false;
  return true;
}

function hoofdstukGrens(regel) {
  const m = regel.trim().match(/^hoofdstuk\s+(\d+)\s*[—–\-:]?\s*(.*)$/i);
  return m ? { nummer: parseInt(m[1], 10), titelOpZelfdeRegel: m[2].trim() } : null;
}

// Word- en PDF-tekst is vaak hard afgebroken op ~80 tekens. Zonder deze stap
// zou iedere afgebroken regel als losse alinea worden gelezen.
function voegAfgebrokenRegelsSamen(regels) {
  const uit = [];
  for (const regel of regels) {
    const vorige = uit[uit.length - 1];
    const t = regel.trim();
    const looptDoor =
      vorige !== undefined &&
      vorige.trim() !== "" &&
      t !== "" &&
      !isOpsommingsregel(regel) &&
      !isOpsommingsregel(vorige) &&
      !lijktOpKop(vorige) &&
      !/[.!?:;]$/.test(vorige.trim()) &&
      /^[a-zà-ÿ(]/.test(t);
    if (looptDoor) uit[uit.length - 1] = vorige + " " + t;
    else uit.push(regel);
  }
  return uit;
}

// De app knipt uitsluitend op witregels. Hier wordt bepaald waar er één hoort.
function herstelWitregels(regels) {
  const uit = [];
  for (const regel of regels) {
    const t = regel.trim();
    if (t === "") {
      if (uit.length && uit[uit.length - 1] !== "") uit.push("");
      continue;
    }
    const vorige = uit.length ? uit[uit.length - 1] : "";
    if (vorige !== "") {
      const beideOpsomming = isOpsommingsregel(regel) && isOpsommingsregel(vorige);
      const wisselOpsomming = isOpsommingsregel(regel) !== isOpsommingsregel(vorige);
      if (
        !beideOpsomming &&
        (wisselOpsomming ||
          lijktOpKop(vorige) ||
          lijktOpKop(regel) ||
          /[.!?]$/.test(vorige.trim()))
      ) {
        uit.push("");
      }
    }
    uit.push(regel);
  }
  return uit;
}

// splitsInPassages ziet een regel niet als kop wanneer die op een leesteken
// eindigt. "1.2 Wat is gezondheid?" telt dus niet mee. Het vraagteken gaat
// eraf zodat de kop wél een passage afdwingt. Dit is de ENIGE plek waar de
// splitser tekens weghaalt — het aantal wordt geteld en getoond.
function maakKoppenHerkenbaar(regels) {
  let aangepast = 0;
  const uit = regels.map((regel, i) => {
    const t = regel.trim();
    if (!t || t.length > 60 || isOpsommingsregel(regel)) return regel;
    if (!/[?:]$/.test(t)) return regel;
    const vorigeLeeg = i === 0 || regels[i - 1].trim() === "";
    const volgendeLeeg = i === regels.length - 1 || regels[i + 1].trim() === "";
    if (!vorigeLeeg || !volgendeLeeg) return regel;
    aangepast++;
    return regel.replace(/[?:]\s*$/, "");
  });
  return { regels: uit, aangepast };
}

function maakOpmaakGoed(tekst) {
  let regels = tekst.split(/\r?\n/).map((r) => r.replace(/[ \t]+$/, ""));
  regels = voegAfgebrokenRegelsSamen(regels);
  regels = herstelWitregels(regels);
  const kop = maakKoppenHerkenbaar(regels);
  return {
    tekst: kop.regels.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    koppenAangepast: kop.aangepast,
  };
}

function splitsInHoofdstukken(document) {
  const regels = document.split(/\r?\n/);
  const hoofdstukken = [];
  const voorwerk = [];
  let huidig = null;

  regels.forEach((regel, i) => {
    const grens = hoofdstukGrens(regel);
    if (grens) {
      if (huidig) hoofdstukken.push(huidig);
      let titel = grens.titelOpZelfdeRegel;
      if (!titel) {
        for (let j = i + 1; j < regels.length; j++) {
          const t = regels[j].trim();
          if (!t) continue;
          if (t.length <= 90) titel = t;
          break;
        }
      }
      huidig = { nummer: grens.nummer, titel, regels: [regel] };
      return;
    }
    if (huidig) huidig.regels.push(regel);
    else voorwerk.push(regel);
  });
  if (huidig) hoofdstukken.push(huidig);

  return { hoofdstukken, voorwerk: voorwerk.join("\n").trim() };
}

// Het eindresultaat: per hoofdstuk een kant-en-klare bron mét de cijfers die
// de app straks werkelijk zal meten.
function bereidBronnenVoor(document) {
  const { hoofdstukken, voorwerk } = splitsInHoofdstukken(document);
  const delen = hoofdstukken.length
    ? hoofdstukken
    : [{ nummer: null, titel: "", regels: document.split(/\r?\n/) }];

  return {
    voorwerkTekens: voorwerk.length,
    delen: delen.map((d) => {
      const opgemaakt = maakOpmaakGoed(d.regels.join("\n"));
      const passages = splitsInPassages({ id: "meting", tekst: opgemaakt.tekst });
      const lengtes = passages.map((p) => p.tot - p.van);
      const grootste = lengtes.length ? Math.max(...lengtes) : 0;
      return {
        naam: d.nummer
          ? `Hoofdstuk ${d.nummer}${d.titel ? " — " + d.titel : ""}`
          : "Volledig document",
        tekst: opgemaakt.tekst,
        tekens: opgemaakt.tekst.length,
        aantalPassages: passages.length,
        grootstePassage: grootste,
        koppenAangepast: opgemaakt.koppenAangepast,
        waarschuwing:
          passages.length === 0
            ? "Geen passages — controleer de opmaak."
            : passages.length < 4
            ? "Weinig passages; dit levert een dun leerpad."
            : grootste > 2500
            ? "Een passage is groter dan 2.500 tekens en kan bij het schrijven vastlopen."
            : opgemaakt.tekst.length > 12000
            ? "Meer dan 12.000 tekens; splits dit hoofdstuk voor een stabielere run."
            : null,
      };
    }),
  };
}


