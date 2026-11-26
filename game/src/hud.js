// The lit instruments: HUD numbers, a compass strip, an attitude ball, an
// airspeed dial, throttle and fuel bars, and the mission card. All DOM + one
// small canvas each, so the numbers are crisp in every screenshot.
import { formatTime, headingDegrees } from './flight.js';

export function createHud() {
  const alt = document.getElementById('alt');
  const spd = document.getElementById('spd');
  const hdg = document.getElementById('hdg');
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

  function drawAttitude(state) {
    const w = 120; const h = 120; const cx = 60; const cy = 60;
    attCtx.clearRect(0, 0, w, h);
    attCtx.save();
    attCtx.beginPath(); attCtx.arc(cx, cy, 56, 0, Math.PI * 2); attCtx.clip();
    attCtx.translate(cx, cy);
    attCtx.rotate(-state.bank);
    attCtx.translate(0, state.pitch * 90);
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

  function drawDial(state) {
    const w = 120; const h = 120; const cx = 60; const cy = 60;
    dialCtx.clearRect(0, 0, w, h);
    dialCtx.strokeStyle = 'rgba(255,255,255,.7)'; dialCtx.lineWidth = 1;
    dialCtx.beginPath(); dialCtx.arc(cx, cy, 52, 0, Math.PI * 2); dialCtx.stroke();
    dialCtx.fillStyle = '#bfe9ff'; dialCtx.font = '10px system-ui'; dialCtx.textAlign = 'center';
    for (let kt = 0; kt <= 120; kt += 20) {
      const a = -Math.PI * 0.75 + (kt / 120) * Math.PI * 1.5;
      const x = cx + Math.cos(a) * 44; const y = cy + Math.sin(a) * 44 + 3;
      dialCtx.fillText(String(kt), x, y);
    }
    const speedKt = state.speed * 1.94;
    const a = -Math.PI * 0.75 + (Math.min(120, speedKt) / 120) * Math.PI * 1.5;
    dialCtx.strokeStyle = '#ff7a59'; dialCtx.lineWidth = 3;
    dialCtx.beginPath(); dialCtx.moveTo(cx, cy);
    dialCtx.lineTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46); dialCtx.stroke();
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

  function update(state) {
    alt.textContent = String(Math.max(0, Math.round(state.y * 3.28)));
    spd.textContent = String(Math.round(state.speed * 1.94));
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
    drawAttitude(state);
    drawDial(state);
    announce(`Altitude ${alt.textContent} feet, speed ${spd.textContent} knots, heading ${hdg.textContent}. Score ${state.score}.`);
  }

  function showBanner(text, sub) {
    banner.innerHTML = `${text}<small>${sub || ''}</small>`;
    banner.style.display = 'block';
  }
  function hideBanner() { banner.style.display = 'none'; }

  return { update, showBanner, hideBanner };
}
