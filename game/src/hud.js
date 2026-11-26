// The lit instruments: HUD numbers, a compass strip, an attitude ball, an
// airspeed dial, throttle and fuel bars, and the mission card. All DOM + one
// small canvas each, so the numbers are crisp in every screenshot.
import { formatTime, headingDegrees } from './flight.js';

export function createHud() {
  const alt = document.getElementById('alt');
  const spd = document.getElementById('spd');
  const hdg = document.getElementById('hdg');
  const vsiEl = document.getElementById('vsi');
  const warn = document.getElementById('warn');
  const strip = document.getElementById('compassStrip');
  const missionTitle = document.getElementById('missionTitle');
  const missionSub = document.getElementById('missionSub');
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const ringProg = document.getElementById('ringProg');
  const thrFill = document.getElementById('thrFill');
  const thrPct = document.getElementById('thrPct');
  const fuelFill = document.getElementById('fuelFill');
  const fuelPct = document.getElementById('fuelPct');
  const banner = document.getElementById('banner');
  const status = document.getElementById('status');
  const attitude = document.getElementById('attitude');
  const dial = document.getElementById('dial');
  const attCtx = attitude.getContext('2d');
  const dialCtx = dial.getContext('2d');
  let lastAnnounce = '';

  function announce(message) {
    if (message !== lastAnnounce) { lastAnnounce = message; status.textContent = message; }
  }

  // Instrument layer: no display ever reads the physics state raw. Each
  // gauge is a first-order lag filter over the true value, the way a real
  // pitot-static or gyro instrument behaves — ASI is quick (0.15 s), the
  // altimeter slow (1.5 s), the VSI the slowest of all (7 s), and the
  // attitude ball follows the gyro with a short lag. Deterministic: the
  // filter is a pure function of value and dt, no noise, so the staged
  // screenshots stay reproducible.
  const lag = (current, target, tau, dt) => current + (target - current) * (1 - Math.exp(-dt / tau));
  let indAlt = 0; let indSpd = 0; let indPitch = 0; let indRoll = 0; let indVs = 0;
  let prevAlt = null;

  function drawAttitude(pitch, bank) {
    const w = 120; const h = 120; const cx = 60; const cy = 60;
    attCtx.clearRect(0, 0, w, h);
    attCtx.save();
    attCtx.beginPath(); attCtx.arc(cx, cy, 56, 0, Math.PI * 2); attCtx.clip();
    attCtx.translate(cx, cy);
    attCtx.rotate(-bank);
    attCtx.translate(0, pitch * 90);
    attCtx.fillStyle = '#2f6fb8'; attCtx.fillRect(-70, -90, 140, 90);
    attCtx.fillStyle = '#8a6a3f'; attCtx.fillRect(-70, 0, 140, 90);
    attCtx.strokeStyle = '#fff'; attCtx.lineWidth = 2;
    attCtx.beginPath(); attCtx.moveTo(-70, 0); attCtx.lineTo(70, 0); attCtx.stroke();
    attCtx.restore();
    // Fixed wings: the aircraft symbol never moves, the world does.
    attCtx.strokeStyle = '#ffd27f'; attCtx.lineWidth = 3;
    attCtx.beginPath(); attCtx.moveTo(28, 60); attCtx.lineTo(52, 60); attCtx.moveTo(68, 60); attCtx.lineTo(92, 60); attCtx.stroke();
    attCtx.fillStyle = '#ffd27f';
    attCtx.beginPath(); attCtx.arc(60, 60, 4, 0, Math.PI * 2); attCtx.fill();
    attCtx.strokeStyle = 'rgba(255,255,255,.6)'; attCtx.lineWidth = 1;
    attCtx.beginPath(); attCtx.arc(60, 60, 56, 0, Math.PI * 2); attCtx.stroke();
    attCtx.fillStyle = '#fff'; attCtx.font = 'bold 10px system-ui';
    attCtx.textAlign = 'center'; attCtx.fillText('ATT', 60, 14);
  }

  // Kitefin-9 V-speeds (knots): stall 24 m/s clean = 47 kt, flaps down
  // 20.4 m/s = 40 kt, cruise 62 m/s = 120 kt, max 95 m/s = 184 kt.
  const DIAL_MAX = 160;
  const VSO = 40; const VS1 = 47; const VFE = 85; const VNO = 129; const VNE = 163;
  function dialAngle(kt) { return -Math.PI * 0.75 + (Math.max(0, Math.min(DIAL_MAX, kt)) / DIAL_MAX) * Math.PI * 1.5; }
  function drawDial(speedKt) {
    const w = 120; const h = 120; const cx = 60; const cy = 60;
    dialCtx.clearRect(0, 0, w, h);
    dialCtx.strokeStyle = 'rgba(255,255,255,.7)'; dialCtx.lineWidth = 1;
    dialCtx.beginPath(); dialCtx.arc(cx, cy, 52, 0, Math.PI * 2); dialCtx.stroke();
    // Colour arcs, the signature of a real airspeed indicator: white is the
    // flap range, green normal operation, yellow caution, red line at Vne.
    const arc = (from, to, color) => {
      dialCtx.strokeStyle = color; dialCtx.lineWidth = 5;
      dialCtx.beginPath(); dialCtx.arc(cx, cy, 50, dialAngle(from), dialAngle(to)); dialCtx.stroke();
    };
    arc(VSO, VFE, '#ffffff');
    arc(VS1, VNO, '#00cc44');
    arc(VNO, DIAL_MAX, '#ffcc00');
    const redA = dialAngle(DIAL_MAX);
    dialCtx.strokeStyle = '#ff2200'; dialCtx.lineWidth = 3;
    dialCtx.beginPath();
    dialCtx.moveTo(cx + Math.cos(redA) * 44, cy + Math.sin(redA) * 44);
    dialCtx.lineTo(cx + Math.cos(redA) * 52, cy + Math.sin(redA) * 52);
    dialCtx.stroke();
    dialCtx.fillStyle = '#bfe9ff'; dialCtx.font = '10px system-ui'; dialCtx.textAlign = 'center';
    for (let kt = 0; kt <= DIAL_MAX; kt += 20) {
      const a = dialAngle(kt);
      const x = cx + Math.cos(a) * 40; const y = cy + Math.sin(a) * 40 + 3;
      dialCtx.fillText(String(kt), x, y);
    }
    const a = dialAngle(speedKt);
    dialCtx.strokeStyle = '#ff7a59'; dialCtx.lineWidth = 3;
    dialCtx.beginPath(); dialCtx.moveTo(cx, cy);
    dialCtx.lineTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); dialCtx.stroke();
    dialCtx.fillStyle = '#fff'; dialCtx.font = 'bold 15px system-ui';
    dialCtx.fillText(`${Math.round(speedKt)}`, cx, cy + 26);
    dialCtx.font = '9px system-ui'; dialCtx.fillStyle = '#9fd8ff';
    dialCtx.fillText('KNOTS', cx, cy + 40);
  }

  function compassText(headingDeg) {
    const marks = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
    const idx = Math.round(headingDeg / 30) % 12;
    return marks.map((m, i) => (i === idx ? `▶ ${m} ◀` : m)).join('  ');
  }

  // Snap every indicated value to the truth at once: staged screenshots
  // paint only six frames, far too few for the lag filters to settle, so
  // the shot staging calls this before painting.
  function snap(state) {
    indAlt = state.y * 3.28;
    indSpd = state.speed * 1.94;
    indPitch = state.pitch;
    indRoll = state.bank;
    indVs = 0;
    prevAlt = state.y;
  }

  function update(state, dt = 1 / 60) {
    const safeDt = dt > 0 ? dt : 1 / 60;
    indAlt = lag(indAlt, state.y * 3.28, 1.5, safeDt);
    indSpd = lag(indSpd, state.speed * 1.94, 0.15, safeDt);
    indPitch = lag(indPitch, state.pitch, 0.15, safeDt);
    indRoll = lag(indRoll, state.bank, 0.15, safeDt);
    const trueVs = prevAlt === null ? 0 : ((state.y - prevAlt) / safeDt) * 196.85;
    indVs = lag(indVs, trueVs, 7, safeDt);
    // A real VSI pegs at its dial limit (±2000 fpm); it never reads 7000.
    indVs = Math.max(-2000, Math.min(2000, indVs));
    prevAlt = state.y;
    alt.textContent = String(Math.max(0, Math.round(indAlt)));
    spd.textContent = String(Math.round(indSpd));
    const vsRounded = Math.round(indVs);
    vsiEl.textContent = `${vsRounded >= 0 ? '+' : ''}${vsRounded}`;
    const deg = headingDegrees(state.heading);
    hdg.textContent = String(deg).padStart(3, '0');
    strip.textContent = compassText(deg);
    missionTitle.textContent = state.missionTitle;
    missionSub.textContent = state.messageTime > 0 ? state.message : (state.ring ? `Next: ${state.ring.name}` : 'Fly home to Runway 09');
    scoreEl.textContent = String(state.score);
    timerEl.textContent = formatTime(state.time);
    ringProg.textContent = `Ring ${state.ringsDone} / ${state.course.length}${state.fuel < 25 ? '  ·  LOW FUEL' : ''}`;
    thrFill.style.width = `${Math.round(state.throttle * 100)}%`;
    thrPct.textContent = `${Math.round(state.throttle * 100)}%`;
    fuelFill.style.width = `${Math.round(state.fuel)}%`;
    fuelPct.textContent = `${Math.round(state.fuel)}%`;
    fuelFill.style.background = state.fuel < 25 ? '#ff7a59' : '#4fc3ff';
    const warnings = [];
    if (state.stalled) warnings.push('STALL — NOSE DOWN, FULL THROTTLE');
    if (state.fuel < 25 && state.fuel > 0) warnings.push('LOW FUEL');
    if (state.fuel <= 0) warnings.push('FUEL EMPTY — GLIDING');
    if (state.crashed) warnings.push(state.crashReason);
    warn.textContent = warnings.join('  ·  ');
    drawAttitude(indPitch, indRoll);
    drawDial(indSpd);
    announce(`Altitude ${alt.textContent} feet, speed ${spd.textContent} knots, heading ${hdg.textContent}. Score ${state.score}.`);
  }

  function showBanner(text, sub) {
    banner.innerHTML = `${text}<small>${sub || ''}</small>`;
    banner.style.display = 'block';
  }
  function hideBanner() { banner.style.display = 'none'; }

  return { update, snap, showBanner, hideBanner };
}
