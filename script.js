function parseDuration(input) {
  const s = String(input).trim().toLowerCase();
  if (!s) return 0;
  if (/^\d{1,3}:\d{1,2}$/.test(s)) {
    const [m, sec] = s.split(":").map((n) => parseInt(n, 10));
    return m * 60 + sec;
  }
  const re = /^(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/;
  const m = s.match(re);
  if (m && (m[1] || m[2])) {
    const mins = parseInt(m[1] || "0", 10);
    const secs = parseInt(m[2] || "0", 10);
    return mins * 60 + secs;
  }
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return 0;
}
function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
const els = {
  workInput: workInput,
  restExInput: restExInput,
  exCountInput: exCountInput,
  roundsInput: roundsInput,
  restRoundInput: restRoundInput,
  startBtn: startBtn,
  pauseBtn: pauseBtn,
  resetBtn: resetBtn,
  bigTime: bigTime,
  phaseBadge: phaseBadge,
  progressBar: progressBar,
  roundNow: roundNow,
  roundTotal: roundTotal,
  exNow: exNow,
  exTotal: exTotal,
  nextUp: nextUp,
  fields: {
    work: document.querySelector('.field[data-field="work"]'),
    restEx: document.querySelector('.field[data-field="restEx"]'),
    restRound: document.querySelector('.field[data-field="restRound"]'),
  },
  beepToggle: beepToggle,
};
let timer = null,
  state = null,
  remaining = 0,
  phase = "idle",
  startedAt = 0,
  paused = false,
  totalPhase = 0,
  audioCtx = null;
function setPhase(p) {
  phase = p;
  els.fields.work.classList.toggle("active", phase === "work");
  els.fields.restEx.classList.toggle("active", phase === "restEx");
  els.fields.restRound.classList.toggle("active", phase === "restRound");
  if (p === "work") document.body.style.backgroundColor = "var(--green)";
  else if (p === "restEx") document.body.style.backgroundColor = "var(--red)";
  else if (p === "restRound")
    document.body.style.backgroundColor = "var(--orange)";
  else document.body.style.backgroundColor = "var(--bg)";
  let label = "Připraveno";
  if (phase === "work") label = "CVIČÍM";
  else if (phase === "restEx") label = "PAUZA MEZI CVIČENÍMI";
  else if (phase === "restRound") label = "PAUZA MEZI KOLY";
  else if (phase === "finished") label = "HOTOVO ✔";
  els.phaseBadge.textContent = label;
}
function beep(type = "tick") {
  if (!els.beepToggle || !els.beepToggle.checked) return;
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    const f = type === "start" ? 880 : type === "end" ? 440 : 660;
    o.frequency.setValueAtTime(f, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.start(now);
    o.stop(now + 0.2);
  } catch (e) {}
}
function updateUI() {
  els.bigTime.textContent = fmt(remaining);
  const pct = totalPhase > 0 ? (1 - remaining / totalPhase) * 100 : 0;
  els.progressBar.style.width = `${pct}%`;
  let next = "–";
  if (state) {
    const last = state.exNow >= state.exTotal;
    if (phase === "work")
      next = last
        ? state.roundNow < state.roundTotal
          ? `Poté: Pauza mezi koly ${fmt(state.restRound)}`
          : "Poté: Konec"
        : `Poté: Pauza ${fmt(state.restEx)}`;
    else if (phase === "restEx") next = `Poté: Cvičení ${fmt(state.work)}`;
    else if (phase === "restRound") next = "Poté: Cvičení";
    els.nextUp.textContent = next;
  }
}
function step() {
  if (paused) return;
  const now = Date.now();
  const elapsed = Math.floor((now - startedAt) / 1000);
  const newRem = Math.max(0, totalPhase - elapsed);
  if (newRem !== remaining) {
    remaining = newRem;
    updateUI();
  }
  if (remaining <= 0) {
    advance();
  } else {
    timer = setTimeout(step, 250);
  }
}
function startPhase(p, sec) {
  setPhase(p);
  totalPhase = Math.max(0, sec | 0);
  remaining = totalPhase;
  startedAt = Date.now();
  updateUI();
  if (totalPhase === 0) {
    advance();
    return;
  }
  timer = setTimeout(step, 250);
}
function advance() {
  if (!state) return;
  if (phase === "work") {
    beep("end");
    if (state.exNow < state.exTotal) {
      startPhase("restEx", state.restEx);
    } else {
      if (state.roundNow < state.roundTotal) {
        startPhase("restRound", state.restRound);
      } else {
        finish();
      }
    }
  } else if (phase === "restEx") {
    state.exNow += 1;
    els.exNow.textContent = state.exNow;
    beep("start");
    startPhase("work", state.work);
  } else if (phase === "restRound") {
    state.roundNow += 1;
    els.roundNow.textContent = state.roundNow;
    state.exNow = 1;
    els.exNow.textContent = state.exNow;
    beep("start");
    startPhase("work", state.work);
  }
}
function finish() {
  setPhase("finished");
  els.bigTime.textContent = "00:00";
  els.nextUp.textContent = "Hotovo! Dobrá práce.";
  els.progressBar.style.width = "100%";
  els.pauseBtn.disabled = true;
  els.startBtn.disabled = false;
}
function start() {
  const work = parseDuration(els.workInput.value);
  const restEx = parseDuration(els.restExInput.value);
  const exTotal = Math.max(1, parseInt(els.exCountInput.value, 10) || 1);
  const roundTotal = Math.max(1, parseInt(els.roundsInput.value, 10) || 1);
  const restRound = parseDuration(els.restRoundInput.value);
  state = {
    work,
    restEx,
    exTotal,
    roundTotal,
    restRound,
    roundNow: 1,
    exNow: 1,
  };
  els.roundTotal.textContent = roundTotal;
  els.exTotal.textContent = exTotal;
  els.roundNow.textContent = 1;
  els.exNow.textContent = 1;
  els.startBtn.disabled = true;
  els.pauseBtn.disabled = false;
  els.resetBtn.disabled = false;
  paused = false;
  beep("start");
  startPhase("work", work);
}
function pause() {
  if (!state || phase === "finished") return;
  paused = !paused;
  els.pauseBtn.textContent = paused ? "Pokračovat" : "Pauza";
  if (!paused) {
    startedAt = Date.now() - (totalPhase - remaining) * 1000;
    timer = setTimeout(step, 250);
  } else {
    if (timer) clearTimeout(timer);
  }
}
function reset() {
  if (timer) clearTimeout(timer);
  state = null;
  phase = "idle";
  remaining = 0;
  totalPhase = 0;
  paused = false;
  setPhase("idle");
  els.bigTime.textContent = "00:00";
  els.progressBar.style.width = "0%";
  els.nextUp.textContent = "–";
  els.roundNow.textContent = "0";
  els.roundTotal.textContent = "0";
  els.exNow.textContent = "0";
  els.exTotal.textContent = "0";
  els.startBtn.disabled = false;
  els.pauseBtn.disabled = true;
  els.resetBtn.disabled = true;
  els.pauseBtn.textContent = "Pauza";
}
startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", pause);
resetBtn.addEventListener("click", reset);
window.addEventListener("keydown", (e) => {
  if (e.key === " ") {
    e.preventDefault();
    if (!els.pauseBtn.disabled) pause();
  }
  if (e.key.toLowerCase() === "r") {
    reset();
  }
});
document
  .getElementById("configForm")
  .addEventListener("submit", (e) => e.preventDefault());
