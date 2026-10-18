export const SOUND_KEY = "awalogo-v2-sound";
export function initialSound() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}
let context: AudioContext | undefined;
let last = -Infinity;
let generation = 0;
export function cancelActionSounds() { generation++; }
export function playActionSound(kind: "click" | "pack" | "drop") {
  try {
    if (performance.now() - last < 90) return;
    last = performance.now();
    context ??= new AudioContext();
    const audio = context;
    const ticket = ++generation;
    void audio.resume().then(() => {
      if (audio.state !== "running" || ticket !== generation) return;
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const now = audio.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(kind === "pack" ? 460 : kind === "drop" ? 330 : 700, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "pack" ? 780 : kind === "drop" ? 170 : 500, now + .065);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.025, now + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .08);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(now); oscillator.stop(now + .09);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }).catch(() => {});
  } catch { /* Audio must never interrupt an action. */ }
}
