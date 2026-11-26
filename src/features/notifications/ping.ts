/**
 * The short two-note sound for a new notification, made in the browser (no file). Browsers only let a page make sound after the person has used it once, so the sound is
 * made ready on the first click or key press; until then (or where sound is blocked) it is silently skipped.
 */
let context: AudioContext | null = null;

function ready(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Called once for the whole app: the first click or key press makes the sound available. */
export function unlockPing(): () => void {
  const unlock = () => ready();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

let lastAt = 0;

export function playPing() {
  // Two parts of the app can notice the same message at nearly the same moment: it chimes once.
  if (Date.now() - lastAt < 1500) return;
  const ctx = ready();
  if (!ctx || ctx.state !== "running") return;
  lastAt = Date.now();
  const now = ctx.currentTime;
  [[880, 0], [1175, 0.12]].forEach(([freq, at]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // A soft attack and a quick fade, so it is a gentle chime and not a beep.
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.09, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.25);
  });
}
