// All sound is synthesised with WebAudio — no audio files, no network.
// The engine is two detuned oscillators whose pitch follows the throttle.
export function createSound() {
  let context = null;
  let engineOsc = null; let engineOsc2 = null; let engineGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (context) return;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
      engineGain = context.createGain(); engineGain.gain.value = 0;
      engineOsc = context.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineOsc2 = context.createOscillator(); engineOsc2.type = 'triangle'; engineOsc2.frequency.value = 82;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
      engineOsc.connect(filter); engineOsc2.connect(filter);
      filter.connect(engineGain); engineGain.connect(context.destination);
      engineOsc.start(); engineOsc2.start();
    } catch { context = null; }
  }

  function unlock() {
    ensure();
    if (context && context.state === 'suspended') context.resume().catch(() => {});
    started = true;
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!context || muted) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator(); const gain = context.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(context.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function setEngine(throttle, speed, airborne) {
    if (!context || !engineGain) return;
    const target = muted || !started ? 0 : 0.045 + throttle * 0.05;
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
    const freq = 48 + throttle * 55 + speed * 0.35;
    engineOsc.frequency.setTargetAtTime(freq, context.currentTime, 0.1);
    engineOsc2.frequency.setTargetAtTime(freq * 1.5, context.currentTime, 0.1);
    void airborne;
  }

  function ring() { tone(880, 0.35, 'sine', 0.18); tone(1318, 0.5, 'sine', 0.14, 0.09); }
  function thud() { tone(70, 0.3, 'sine', 0.3); tone(45, 0.4, 'triangle', 0.25, 0.02); }
  function win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, i * 0.12)); }
  function crash() { tone(160, 0.5, 'sawtooth', 0.2); tone(60, 0.8, 'sawtooth', 0.22, 0.1); }
  function toggleMute() { muted = !muted; return muted; }

  return { unlock, setEngine, ring, thud, win, crash, toggleMute };
}
