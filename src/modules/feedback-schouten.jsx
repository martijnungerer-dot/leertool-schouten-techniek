// Alleen de koppeling met het leerplatform en zijn bestaande huisstijl.
const LEERPLATFORM_VERSIE = '2026.11.17-feedback.1';
const SCHOUTEN_FEEDBACK_OPSLAG = maakFeedbackOpslag(() => window.localStorage, 'schouten-leerplatform:feedback:v1');
function leerplatformFeedbackContext(element) {
  const scherm = document.querySelector('[data-feedback-scherm]');
  const vraag = element?.closest('[data-feedback-vraag-id]') || document.querySelector('[data-feedback-vraag-id]');
  const herhaling = document.querySelector('[data-feedback-herhaling]');
  return {
    schermnaam: scherm?.dataset.feedbackScherm || (herhaling ? 'Herhalen' : 'Leerplatform'),
    lesId: herhaling?.dataset.feedbackLesId || scherm?.dataset.feedbackLesId || null,
    lesnaam: herhaling?.dataset.feedbackLesnaam || scherm?.dataset.feedbackLesnaam || null,
    vraagId: vraag?.dataset.feedbackVraagId || null,
    versie: LEERPLATFORM_VERSIE,
  };
}
const FEEDBACK_SCHOUTEN_STIJL = `
  .feedback-layout { height:100dvh; display:flex; flex-direction:column; color:${ST.donker}; font-family:Calibri,Carlito,Arial,sans-serif; }
  .feedback-app-frame { order:0; flex:1; min-height:180px; position:relative; transform:translateZ(0); overflow:auto; }
  .feedback-app-frame .app-shell { height:100%; min-height:100%; }
  .feedback-app-frame .feedback-welkom { min-height:100% !important; }
  .feedback-dock { order:1; flex:none; display:grid; grid-template-columns:minmax(260px,1fr) minmax(200px,1fr); gap:6px 20px; padding:10px 26px; border-top:2px solid ${ST.oranje}; background:${UI.kaart}; }
  .feedback-acties { display:flex; flex-wrap:wrap; align-content:start; gap:6px; }
  .feedback-dock button,.feedback-dialoog button,.feedback-markeerbalk button { min-height:44px; padding:8px 12px; border:1px solid ${UI.randZacht}; border-radius:10px; background:${UI.kaart}; color:${ST.donker}; font:inherit; font-size:14px; cursor:pointer; }
  button.feedback-primair { background:${ST.oranje}; border-color:${ST.oranje}; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
  [data-feedback-ui] :focus-visible { outline:3px solid ${ST.donker}; outline-offset:3px; }
  .feedback-log { min-width:0; }
  .feedback-log h2 { font-size:15px; font-weight:700; margin:0 0 4px; }
  .feedback-lijst { max-height:88px; overflow:auto; display:flex; flex-direction:column; gap:3px; padding:3px; }
  .feedback-lijst button { text-align:left; flex:none; overflow-wrap:anywhere; }
  .feedback-lijst p { margin:0; font-size:14px; }
  .feedback-privacy { grid-column:1/-1; font-size:12px; line-height:1.35; }
  .feedback-privacy p { margin:2px 0; }
  .feedback-dialoog { width:calc(100% - 32px); max-width:520px; max-height:calc(100dvh - 32px); box-sizing:border-box; overflow:auto; padding:24px; border:1px solid ${UI.randZacht}; border-radius:18px; background:${UI.kaart}; color:${ST.donker}; font:16px Calibri,Carlito,Arial,sans-serif; }
  .feedback-dialoog::backdrop { background:rgba(29,29,29,.25); }
  .feedback-dialoog h2 { font-size:23px; font-weight:700; margin:0 0 6px; }
  .feedback-context { margin:0 0 16px; overflow-wrap:anywhere; }
  .feedback-dialoog label { display:block; font-weight:700; margin:12px 0 5px; }
  .feedback-dialoog input,.feedback-dialoog select,.feedback-dialoog textarea { width:100%; box-sizing:border-box; border:1px solid ${UI.tekstSecundair}; border-radius:8px; padding:10px; font:inherit; color:${ST.donker}; background:white; }
  .feedback-dialoog textarea { resize:vertical; }
  .feedback-formacties { display:flex; gap:8px; margin-top:12px; }
  .feedback-dialoog [role=alert] { color:#9F1B15; margin:8px 0; }
  .feedback-dialoog dt { font-weight:700; margin-top:10px; }
  .feedback-dialoog dd { margin:0; }
  .feedback-tekst { white-space:pre-wrap; overflow-wrap:anywhere; margin:18px 0; }
  .feedback-markeer { position:fixed; inset:0; z-index:10000; }
  .feedback-selectievlak { position:absolute; inset:0; cursor:crosshair; touch-action:none; }
  .feedback-markeerbalk { position:absolute; top:12px; left:50%; transform:translateX(-50%); width:max-content; max-width:calc(100% - 24px); box-sizing:border-box; background:${UI.kaart}; border:2px solid ${ST.oranje}; border-radius:12px; padding:10px; display:flex; flex-wrap:wrap; align-items:center; gap:8px; box-shadow:0 3px 15px #0002; }
  .feedback-markeerbalk p { margin:0; }
  .feedback-markering { position:fixed; z-index:10001; pointer-events:none; border:3px solid #D4A500; background:rgba(255,223,0,.32); box-sizing:border-box; }
  @media(max-width:600px) {
    .feedback-dock { padding:8px 12px; grid-template-columns:1fr 1fr; gap:6px 10px; }
    .feedback-acties { flex-direction:column; gap:4px; }
    .feedback-acties button { padding:5px 8px; font-size:13px; }
    .feedback-lijst { max-height:114px; }
    .feedback-dialoog { padding:18px; }
  }
  @media(max-height:760px) { .feedback-app-frame .app-shell { min-height:640px; } }
`;
function LeerplatformMetFeedback() {
  return <div className="feedback-layout">
    <style>{FEEDBACK_SCHOUTEN_STIJL}</style>
    <FeedbackModule opslag={SCHOUTEN_FEEDBACK_OPSLAG} getContext={leerplatformFeedbackContext}
      potlood={<span aria-hidden="true" style={{fontSize:20,lineHeight:1}}>✎</span>}
      privacytekst="Feedback wordt in deze browser op dit apparaat bewaard. Bij een gedeeld browserprofiel kunnen anderen deze feedback zien." />
    <div className="feedback-app-frame"><LeerplatformApp /></div>
  </div>;
}
