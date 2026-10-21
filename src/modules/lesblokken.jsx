// ============================================================================
// BLOKKEN RENDEREN
// ============================================================================

function TekstBlok({ blok }) {
  return <p className="text-gray-900 leading-relaxed">{blok.tekst}</p>;
}

function OnvolledigBlok({ wat }) {
  return (
    <p className="text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg p-3">
      Dit {wat} is onvolledig en wordt overgeslagen.
    </p>
  );
}

function VergelijkingBlok({ blok, kleur }) {
  if (!Array.isArray(blok.items) || blok.items.length === 0) {
    return <OnvolledigBlok wat="grafiekblok" />;
  }
  const max = Math.max(...blok.items.map((i) => i.waarde || 0)) || 1;
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900">{blok.titel}</p>
      <div className="mt-3 space-y-2">
        {blok.items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
              <span>{item.label}</span>
              <span className="font-semibold text-gray-900">
                {item.waarde} {blok.eenheid}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.waarde / max) * 100}%`,
                  backgroundColor: kleur,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {blok.toelichting && (
        <p className="text-xs text-gray-500 mt-3 italic">{blok.toelichting}</p>
      )}
    </div>
  );
}

function TijdlijnBlok({ blok, kleur }) {
  if (!Array.isArray(blok.punten) || blok.punten.length === 0) {
    return <OnvolledigBlok wat="tijdlijnblok" />;
  }
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>
      <div className="space-y-3">
        {blok.punten.map((punt, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5"
                style={{ backgroundColor: kleur }}
              />
              {i < blok.punten.length - 1 && (
                <span className="w-px flex-1 bg-gray-300 mt-1" />
              )}
            </div>
            <div className="pb-1">
              <p className="text-sm font-semibold text-gray-900">{punt.label}</p>
              <p className="text-sm text-gray-600">{punt.beschrijving}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Verhouding: hoe iets zich verdeelt. Denk bordverdeling, tijdsbesteding. ---
function VerhoudingBlok({ blok, kleur }) {
  if (!Array.isArray(blok.delen) || blok.delen.length === 0) {
    return <OnvolledigBlok wat="verhoudingsblok" />;
  }
  const som = blok.delen.reduce((s, d) => s + (d.deel || 0), 0) || 1;
  const tinten = [1, 0.72, 0.5, 0.34, 0.22];

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>

      <div className="flex h-8 w-full rounded-md overflow-hidden">
        {blok.delen.map((d, i) => (
          <div
            key={i}
            className="h-full"
            style={{
              width: `${((d.deel || 0) / som) * 100}%`,
              backgroundColor: kleur,
              opacity: tinten[i % tinten.length],
            }}
          />
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {blok.delen.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: kleur, opacity: tinten[i % tinten.length] }}
            />
            <span className="text-gray-700 flex-1">{d.label}</span>
            <span className="font-semibold text-gray-900">
              {Math.round(((d.deel || 0) / som) * 100)}%
            </span>
          </div>
        ))}
      </div>

      {blok.toelichting && (
        <p className="text-xs text-gray-500 mt-3 italic">{blok.toelichting}</p>
      )}
    </div>
  );
}

// --- Stappen: een handeling in volgorde. Sterk voor BHV en werkinstructies. ---
function StappenBlok({ blok, kleur }) {
  if (!Array.isArray(blok.stappen) || blok.stappen.length === 0) {
    return <OnvolledigBlok wat="stappenblok" />;
  }
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>
      <div className="space-y-2">
        {blok.stappen.map((stap, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span
              className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: kleur }}
            >
              {i + 1}
            </span>
            <div className="pt-0.5">
              <p className="text-sm font-semibold text-gray-900">{stap.label}</p>
              {stap.beschrijving && (
                <p className="text-sm text-gray-600">{stap.beschrijving}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Mythe vs. wat klopt: de "X > Y"-vorm. Zet een hype naast de nuance. ---
function MytheBlok({ blok }) {
  if (!blok.mythe || !blok.klopt) return <OnvolledigBlok wat="mytheblok" />;
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <div className="border border-red-200 bg-red-50 rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-red-500 font-semibold mb-1">
          Wat je vaak hoort
        </p>
        <p className="text-sm text-gray-900 leading-relaxed">{blok.mythe}</p>
      </div>
      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide text-green-700 font-semibold mb-1">
          Wat er klopt
        </p>
        <p className="text-sm text-gray-900 leading-relaxed">{blok.klopt}</p>
      </div>
    </div>
  );
}

// --- Pictogram: "1 op de 3". Maakt een verhouding meteen invoelbaar. ---
function PictogramBlok({ blok, kleur }) {
  const totaal = blok.totaal || 0;
  const geraakt = blok.geraakt || 0;
  if (totaal < 2 || geraakt < 0 || geraakt > totaal) {
    return <OnvolledigBlok wat="pictogramblok" />;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm font-semibold text-gray-900 mb-3">{blok.titel}</p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: totaal }).map((_, i) => (
          <svg key={i} width="18" height="26" viewBox="0 0 18 26" aria-hidden="true">
            <circle
              cx="9"
              cy="5"
              r="4"
              fill={i < geraakt ? kleur : "#D5D3CC"}
            />
            <path
              d="M9 10c-3.3 0-5 2-5 5v8h10v-8c0-3-1.7-5-5-5z"
              fill={i < geraakt ? kleur : "#D5D3CC"}
            />
          </svg>
        ))}
      </div>
      <p className="text-sm text-gray-700 mt-3">
        <span className="font-bold text-gray-900">
          {geraakt} van de {totaal}
        </span>{" "}
        {blok.bijschrift}
      </p>
    </div>
  );
}

function AfbeeldingBlok({ blok }) {
  return (
    <figure className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      {blok.url ? (
        <img src={blok.url} alt={blok.alt || ""} className="w-full block" />
      ) : (
        <div className="h-32 flex items-center justify-center text-sm text-gray-400">
          Nog geen afbeelding gekoppeld
        </div>
      )}
      {blok.bijschrift && (
        <figcaption className="text-xs text-gray-500 px-4 py-2 border-t border-gray-200">
          {blok.bijschrift}
        </figcaption>
      )}
    </figure>
  );
}

function Blok({ blok, kleur }) {
  if (blok.type === "vergelijking") return <VergelijkingBlok blok={blok} kleur={kleur} />;
  if (blok.type === "tijdlijn") return <TijdlijnBlok blok={blok} kleur={kleur} />;
  if (blok.type === "verhouding") return <VerhoudingBlok blok={blok} kleur={kleur} />;
  if (blok.type === "stappen") return <StappenBlok blok={blok} kleur={kleur} />;
  if (blok.type === "mythe") return <MytheBlok blok={blok} />;
  if (blok.type === "pictogram") return <PictogramBlok blok={blok} kleur={kleur} />;
  if (blok.type === "afbeelding") return <AfbeeldingBlok blok={blok} />;
  return <TekstBlok blok={blok} />;
}

