import confetti from 'canvas-confetti';

/** Fuochi d'artificio a tutto schermo al completamento di una task (~2.5s). */
export function launchFireworks() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const end = Date.now() + 2500;
  const base = { startVelocity: 32, spread: 360, ticks: 70, zIndex: 9999, scalar: 1.1 };
  const rand = (a: number, b: number) => Math.random() * (b - a) + a;
  const iv = window.setInterval(() => {
    const left = end - Date.now();
    if (left <= 0) return window.clearInterval(iv);
    const n = Math.round(60 * (left / 2500));
    confetti({ ...base, particleCount: n, origin: { x: rand(0.1, 0.35), y: rand(0.1, 0.5) } });
    confetti({ ...base, particleCount: n, origin: { x: rand(0.65, 0.9), y: rand(0.1, 0.5) } });
  }, 250);
}
