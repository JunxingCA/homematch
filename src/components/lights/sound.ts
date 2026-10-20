/**
 * All HomeMatch sounds are synthesised with the Web Audio API, so there are no audio assets to ship.
 * Browsers only allow audio after a user gesture, so every entry point here is called from a click.
 */

// Session-only, like the intro flag: HomeMatch keeps only the theme in localStorage.
const SOUND_KEY = "homematch-sound";
let ctx: AudioContext | null = null;
let introBus: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function soundEnabled(): boolean {
  try {
    return window.sessionStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.sessionStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  if (!on) stopIntroScore();
}

function envelope(
  g: GainNode,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/**
 * The intro score: a warm pad, one soft pluck per window as it lights, a chord when the logo
 * window lights, and a whoosh as the curtain lifts. `windowDelays` are the CSS delays in seconds.
 */
export function playIntroScore(windowDelays: number[]): void {
  const ac = audio();
  if (!ac) return;
  stopIntroScore();
  const bus = ac.createGain();
  bus.gain.value = 0.85;
  bus.connect(ac.destination);
  introBus = bus;
  const t0 = ac.currentTime + 0.05;

  const lowpass = ac.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 900;
  lowpass.connect(bus);
  [110, 164.81, 220, 277.18].forEach((f, i) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = f;
    o.detune.value = i % 2 ? 6 : -6;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.035, t0 + 1.8);
    g.gain.setValueAtTime(0.035, t0 + 5.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 7.4);
    o.connect(g).connect(lowpass);
    o.start(t0);
    o.stop(t0 + 7.5);
  });

  const notes = [659.25, 739.99, 880, 987.77, 1108.73, 1318.51];
  const sorted = [...windowDelays].sort((a, b) => a - b);
  const step = Math.max(1, Math.floor(sorted.length / 36));
  for (let i = 0; i < sorted.length; i += step) {
    const t = t0 + sorted[i] + 0.15;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.value = notes[i % notes.length];
    envelope(g, t, 0.02 + ((i * 7) % 10) / 400, 0.006, 0.7);
    o.connect(g);
    if (typeof ac.createStereoPanner === "function") {
      const p = ac.createStereoPanner();
      p.pan.value = (((i * 37) % 17) / 17) * 1.6 - 0.8;
      g.connect(p).connect(bus);
    } else {
      g.connect(bus);
    }
    o.start(t);
    o.stop(t + 0.75);
  }

  const tc = t0 + 4.7;
  [220, 277.18, 329.63, 440, 554.37].forEach((f) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = f;
    envelope(g, tc, 0.05, 0.08, 3.1);
    o.connect(g).connect(bus);
    o.start(tc);
    o.stop(tc + 3.3);
  });
  const ting = ac.createOscillator();
  const tg = ac.createGain();
  ting.type = "triangle";
  ting.frequency.value = 1760;
  envelope(tg, tc + 0.05, 0.04, 0.01, 1.5);
  ting.connect(tg).connect(bus);
  ting.start(tc);
  ting.stop(tc + 1.7);

  const tw = t0 + 6.15;
  const len = 1;
  const buffer = ac.createBuffer(
    1,
    Math.floor(ac.sampleRate * len),
    ac.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(300, tw);
  band.frequency.exponentialRampToValueAtTime(2400, tw + len);
  const ng = ac.createGain();
  envelope(ng, tw, 0.06, 0.35, 0.65);
  noise.connect(band).connect(ng).connect(bus);
  noise.start(tw);
  noise.stop(tw + len);
}

export function stopIntroScore(): void {
  if (!ctx || !introBus) return;
  const t = ctx.currentTime;
  introBus.gain.cancelScheduledValues(t);
  introBus.gain.setTargetAtTime(0, t, 0.15);
  introBus = null;
}

export type TickKind = "must" | "nice" | "skip" | "default";

/** Short click for toggles; each priority has its own pitch. Also fires a light haptic on phones. */
export function tick(kind: TickKind = "default"): void {
  haptic(kind === "must" ? [12, 40, 12] : 8);
  if (!soundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const f =
    kind === "must" ? 440 : kind === "nice" ? 660 : kind === "skip" ? 330 : 587;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.09);
  envelope(g, t, 0.11, 0.004, 0.125);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + 0.15);
}

/** Rising chime as each matching town lights on the reveal map; the last note is the best match. */
export function revealChime(delays: number[]): void {
  if (!soundEnabled() || !ctx || ctx.state !== "running") return;
  const ac = ctx;
  const t0 = ac.currentTime;
  const notes = [659.25, 739.99, 880, 987.77, 1108.73, 1318.51];
  delays.forEach((d, i) => {
    const last = i === delays.length - 1;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.value = last ? 1108.73 : notes[i % notes.length];
    envelope(g, t0 + d, last ? 0.07 : 0.04, 0.01, last ? 2 : 0.8);
    o.connect(g).connect(ac.destination);
    o.start(t0 + d);
    o.stop(t0 + d + 2.1);
  });
}

export function haptic(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate(pattern);
  } catch {
    /* vibration is optional */
  }
}
