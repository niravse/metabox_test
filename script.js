(() => {
  const ALARM_FILE = "alarm.wav"; // must sit in the same folder as index.html

  const MODES = {
    focus: { label: "Focus", minutes: 25 },
    short: { label: "Short break", minutes: 5 },
    long:  { label: "Long break", minutes: 15 },
  };
  const ROUNDS_BEFORE_LONG = 4;
  const CIRCUMFERENCE = 2 * Math.PI * 92;

  const els = {
    body: document.body,
    mm: document.getElementById("mm"),
    ss: document.getElementById("ss"),
    counts: {
      focus: document.getElementById("count-focus"),
      short: document.getElementById("count-short"),
      long: document.getElementById("count-long"),
    },
    progress: document.getElementById("progress"),
    dots: document.querySelectorAll("#rounds span"),
    dial: document.getElementById("dial"),
    status: document.getElementById("status-text"),
    tabs: document.querySelectorAll(".tab"),
    start: document.getElementById("start"),
    startIcon: document.getElementById("start-icon"),
    startLabel: document.getElementById("start-label"),
    skip: document.getElementById("skip"),
    reset: document.getElementById("reset"),
  };

  // Small SVG icons for the main button
  const ICONS = {
    play:  '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    bell:  '<svg viewBox="0 0 24 24"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-4-5.7V4a2 2 0 1 0-4 0v1.3A6 6 0 0 0 6 11v5l-2 2v1h16v-1z"/></svg>',
  };

  const alarm = new Audio(ALARM_FILE);
  alarm.loop = true;
  alarm.preload = "auto";
  alarm.addEventListener("error", () => {
    console.warn(`Could not load "${ALARM_FILE}". Check the file name and that it is next to index.html.`);
  });

  let mode = "focus";
  let completedFocus = 0;      // focus rounds finished in the current set of 4
  let remainingMs = MODES.focus.minutes * 60 * 1000;
  let endTime = 0;
  let intervalId = null;
  let ringing = false;
  const counts = { focus: 0, short: 0, long: 0 };   // rounds finished per type

  const totalMs = () => MODES[mode].minutes * 60 * 1000;
  const isRunning = () => intervalId !== null;

  function format(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function statusText() {
    if (ringing) return "Time's up!";
    if (mode === "focus") return `Focus session ${completedFocus + 1} of ${ROUNDS_BEFORE_LONG}`;
    return MODES[mode].label;
  }

  function render() {
    const text = format(remainingMs);
    els.mm.textContent = text.slice(0, 2);
    els.ss.textContent = text.slice(3);
    document.title = `${ringing ? "🔔 " : ""}${text} · ${MODES[mode].label}`;
    els.body.dataset.mode = mode;
    els.progress.style.strokeDashoffset = CIRCUMFERENCE * (1 - remainingMs / totalMs());
    els.dots.forEach((dot, i) => dot.classList.toggle("done", i < completedFocus));
    els.tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.mode === mode)));
    els.dial.classList.toggle("ringing", ringing);
    els.status.textContent = statusText();
    for (const key in counts) els.counts[key].textContent = counts[key];

    // Main button: Stop alarm / Pause / Start
    const state = ringing ? "bell" : isRunning() ? "pause" : "play";
    els.startIcon.innerHTML = ICONS[state];
    els.startLabel.textContent = ringing ? "Stop alarm" : isRunning() ? "Pause" : "Start";
  }

  function startAlarm() {
    ringing = true;
    alarm.currentTime = 0;
    alarm.play().catch((err) => console.warn("Alarm could not play:", err));
  }

  function stopAlarm() {
    if (!ringing) return;
    ringing = false;
    alarm.pause();
    alarm.currentTime = 0;
  }

  // Browsers only allow sound after a click, so "unlock" the audio silently on Start.
  function unlockAudio() {
    alarm.muted = true;
    alarm.play()
      .then(() => {
        if (!ringing) { alarm.pause(); alarm.currentTime = 0; }
      })
      .catch(() => {})
      .finally(() => { alarm.muted = false; });
  }

  function tick() {
    remainingMs = Math.max(0, endTime - Date.now());
    if (remainingMs === 0) {
      advance();
      startAlarm();
      render();
      return;
    }
    render();
  }

  function start() {
    if (isRunning()) return;
    unlockAudio();
    endTime = Date.now() + remainingMs;
    intervalId = setInterval(tick, 250);
    render();
  }

  function pause() {
    if (!isRunning()) return;
    remainingMs = Math.max(0, endTime - Date.now());
    clearInterval(intervalId);
    intervalId = null;
    render();
  }

  function setMode(next) {
    mode = next;
    remainingMs = totalMs();
  }

  // Move to the next round (used when a round ends and by Skip). Leaves the timer paused.
  function advance() {
    pause();
    counts[mode] += 1;
    if (mode === "focus") {
      completedFocus += 1;
      setMode(completedFocus >= ROUNDS_BEFORE_LONG ? "long" : "short");
    } else {
      if (mode === "long") completedFocus = 0;
      setMode("focus");
    }
    render();
  }

  function reset() {
    stopAlarm();
    pause();
    remainingMs = totalMs();
    render();
  }

  els.start.addEventListener("click", () => {
    if (ringing) { stopAlarm(); render(); return; }
    isRunning() ? pause() : start();
  });
  els.skip.addEventListener("click", () => { stopAlarm(); advance(); });
  els.reset.addEventListener("click", reset);

  // Tabs: jump to a round type (stops the alarm and pauses the timer)
  els.tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      stopAlarm();
      pause();
      setMode(tab.dataset.mode);
      render();
    })
  );

  // Space bar acts like the main button (unless a button already has focus)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      els.start.click();
    }
  });

  render();
})();