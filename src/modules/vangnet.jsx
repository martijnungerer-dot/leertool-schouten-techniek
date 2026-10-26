// ============================================================================
// VANGNET
// Als er ergens toch iets misgaat, zie je een nette melding in plaats van een
// leeg wit scherm — en je content blijft bewaard. Staat er iets kapots in de
// opslag, dan helpt verversen niet; daarom kun je hier ook zonder de rest van
// de app bij je gegevens: alles downloaden, of een goede back-up terugzetten.
// ============================================================================

// Het vangnet staat buiten de app, dus ook buiten haar stijlblad: alleen
// Tailwind-klassen.
const VANGNET_KNOP = "border border-red-300 bg-white rounded-md px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100";

class Vangnet extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: null, melding: "" };
    this.downloaden = this.downloaden.bind(this);
    this.terugzetten = this.terugzetten.bind(this);
    this.bestandRef = React.createRef();
  }
  static getDerivedStateFromError(fout) {
    return { fout };
  }
  async downloaden() {
    downloadJson(await noodBackup(), "leerplatform-noodbackup.json");
  }
  async terugzetten(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { data = null; }
    const fout = controleerBackup(data);
    if (fout) { this.setState({ melding: fout }); return; }
    const uitkomst = await schrijfBackup(data, Date.now());
    if (uitkomst === "gelukt") { window.location.reload(); return; }
    this.setState({ melding: "De back-up is niet teruggezet: er was niet genoeg ruimte in deze browser." });
  }
  render() {
    if (this.state.fout) {
      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-3xl mx-auto">
            <div className="border border-red-500 bg-red-50 rounded-lg p-5">
              <p className="font-semibold text-red-800">Er ging iets mis</p>
              <p className="text-sm text-red-700 mt-1">
                Er zat iets onverwachts in de lesstof. Je opgeslagen gegevens zijn niet
                kwijt. Ververs de pagina om verder te gaan. Zie je deze melding daarna
                weer, download dan eerst wat er nu in deze browser staat en zet een
                eerdere back-up terug.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <button type="button" className={VANGNET_KNOP} onClick={() => window.location.reload()}>Pagina verversen</button>
                <button type="button" className={VANGNET_KNOP} onClick={this.downloaden}>Download wat er nu staat</button>
                <button type="button" className={VANGNET_KNOP} onClick={() => this.bestandRef.current && this.bestandRef.current.click()}>Zet een back-up terug</button>
                <input ref={this.bestandRef} type="file" accept="application/json,.json" aria-hidden="true" tabIndex={-1} onChange={this.terugzetten} style={{ display: "none" }} />
              </div>
              {this.state.melding && (
                <p role="alert" className="text-sm text-red-800 mt-3">{this.state.melding}</p>
              )}
              <p className="text-xs text-red-600 mt-3 font-mono">
                {String(this.state.fout && this.state.fout.message)}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
