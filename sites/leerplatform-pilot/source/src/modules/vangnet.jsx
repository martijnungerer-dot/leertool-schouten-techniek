// ============================================================================
// VANGNET
// Als er ergens toch iets misgaat, zie je een nette melding in plaats van een
// leeg wit scherm — en je content blijft bewaard.
// ============================================================================

class Vangnet extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: null };
  }
  static getDerivedStateFromError(fout) {
    return { fout };
  }
  render() {
    if (this.state.fout) {
      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-3xl mx-auto">
            <div className="border border-red-500 bg-red-50 rounded-lg p-5">
              <p className="font-semibold text-red-800">Er ging iets mis</p>
              <p className="text-sm text-red-700 mt-1">
                Er zat iets onverwachts in de lesstof. Je opgeslagen content is niet
                kwijt. Ververs de pagina om verder te gaan.
              </p>
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

