/** Gerador pseudoaleatório determinístico (Mulberry32) — demos reprodutíveis. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Variação aleatória de ±pct (ex.: jitter(10, 0.08) => 9.2 a 10.8). */
export const jitter = (valor, pct = 0.08) => valor * (1 - pct + Math.random() * pct * 2);
