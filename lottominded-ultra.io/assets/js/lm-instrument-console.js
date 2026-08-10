(function () {
  const hosts = Array.from(document.querySelectorAll("[data-lm-instrument-console-host]"));
  if (!hosts.length) return;

  const consoleMarkup = `
    <section class="instrument-console ultra-page-instrument-console neon-panel" aria-label="Compact studio instrument console">
      <div class="console-pill"><small>Signal Route</small><strong>Ultra Mode</strong></div>
      <div class="console-keyboard">
        <div class="mode-tabs" aria-label="Instrument modes">
          <button class="is-active" type="button">Piano</button>
          <button type="button">Synth</button>
          <button type="button">Pad</button>
          <button type="button">Bass</button>
          <button type="button">Lead</button>
          <button type="button">FX</button>
        </div>
        <div class="playable-piano" data-playable-piano aria-label="Playable C minor blues piano">
          <button class="piano-key is-root" type="button" data-note="C3" data-frequency="130.81"><span>C</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Eb3" data-frequency="155.56"><span>Eb</span></button>
          <button class="piano-key" type="button" data-note="F3" data-frequency="174.61"><span>F</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Gb3" data-frequency="185"><span>Gb</span></button>
          <button class="piano-key" type="button" data-note="G3" data-frequency="196"><span>G</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Bb3" data-frequency="233.08"><span>Bb</span></button>
          <button class="piano-key is-root" type="button" data-note="C4" data-frequency="261.63"><span>C</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Eb4" data-frequency="311.13"><span>Eb</span></button>
          <button class="piano-key" type="button" data-note="F4" data-frequency="349.23"><span>F</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Gb4" data-frequency="369.99"><span>Gb</span></button>
          <button class="piano-key" type="button" data-note="G4" data-frequency="392"><span>G</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Bb4" data-frequency="466.16"><span>Bb</span></button>
          <button class="piano-key is-root" type="button" data-note="C5" data-frequency="523.25"><span>C</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Eb5" data-frequency="622.25"><span>Eb</span></button>
          <button class="piano-key" type="button" data-note="F5" data-frequency="698.46"><span>F</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Gb5" data-frequency="739.99"><span>Gb</span></button>
          <button class="piano-key" type="button" data-note="G5" data-frequency="783.99"><span>G</span></button>
          <button class="piano-key is-accidental" type="button" data-note="Bb5" data-frequency="932.33"><span>Bb</span></button>
        </div>
      </div>
      <section class="console-frequency" data-console-frequency-generator aria-label="Healing frequency generator">
        <div class="console-frequency__header">
          <span><small>Frequency Generator</small><strong><b data-healing-frequency>528 Hz</b> <i data-healing-name>Love</i></strong></span>
          <span class="console-frequency__signal" aria-hidden="true"></span>
        </div>
        <div class="console-frequency__presets" aria-label="Frequency presets">
          <button type="button" data-healing-preset="174" aria-pressed="false"><b>174</b><span>Deep</span></button>
          <button type="button" data-healing-preset="220" aria-pressed="false"><b>220</b><span>Ground</span></button>
          <button type="button" data-healing-preset="432" aria-pressed="false"><b>432</b><span>Calm</span></button>
          <button type="button" data-healing-preset="528" aria-pressed="true"><b>528</b><span>Love</span></button>
          <button type="button" data-healing-preset="741" aria-pressed="false"><b>741</b><span>Clear</span></button>
          <button type="button" data-healing-preset="963" aria-pressed="false"><b>963</b><span>Align</span></button>
        </div>
        <div class="console-frequency__controls">
          <label><span>Level</span><input type="range" min="0" max="0.12" step="0.01" value="0.04" data-healing-volume aria-label="Tone volume" /></label>
          <button type="button" data-healing-toggle aria-pressed="false">Play tone</button>
        </div>
        <p data-healing-status aria-live="polite">Audio starts only when you press Play.</p>
      </section>
      <div class="console-eq" data-live-eq aria-label="Live signal equalizer">
        <small>Signal EQ</small>
        <div class="live-eq-meter" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </div>
        <span class="eq-source-status" data-eq-status>Listening</span>
      </div>
      <div class="console-knobs" aria-label="Studio effect controls">
        <button type="button" data-fx-control="drive" aria-label="Adjust drive effect" aria-pressed="false"><i></i><span>Drive</span></button>
        <button type="button" data-fx-control="reverb" aria-label="Adjust reverb effect" aria-pressed="false"><i></i><span>Reverb</span></button>
        <button type="button" data-fx-control="delay" aria-label="Adjust delay effect" aria-pressed="false"><i></i><span>Delay</span></button>
        <button type="button" class="master" data-fx-control="master" aria-label="Adjust master volume" aria-pressed="true"><i></i><span>Master</span></button>
      </div>
      <div class="console-status"><small>Studio Status</small><strong>Online</strong><div class="status-wave" aria-hidden="true"></div></div>
    </section>`;

  hosts.forEach((host) => {
    if (host.querySelector(".instrument-console")) return;
    host.innerHTML = consoleMarkup;
  });
})();
