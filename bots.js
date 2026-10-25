// Globtrop – bots. Their 10 levels differ only in geographic knowledge, never in the map they play.
(function (root) {
  const W = root.GTWorld;
  const LEVELS = [
    { name: 'Turysta', desc: 'Myli kontynenty. Klika gdzieś w świat.' },
    { name: 'Wczasowicz', desc: 'Zna kilka krajów z wakacji.' },
    { name: 'Podróżnik', desc: 'Często trafia w dobry region świata.' },
    { name: 'Obieżyświat', desc: 'Rozpoznaje stronę ruchu i pismo.' },
    { name: 'Kartograf', desc: 'Co drugi kraj trafia bezbłędnie.' },
    { name: 'Nawigator', desc: 'Zna słupki, linie i znaki większości krajów.' },
    { name: 'Ekspert', desc: 'Kraj prawie zawsze, region często.' },
    { name: 'Mistrz', desc: 'Trafia region i potrafi zgadnąć okolicę.' },
    { name: 'Legenda', desc: 'Czyta znaki i trafia w miasto obok.' },
    { name: 'Wszechwiedzący', desc: 'Wie prawie wszystko. Pudła rzadko.' },
  ];
  const PC = [0.03, 0.1, 0.2, 0.32, 0.46, 0.58, 0.69, 0.8, 0.89, 0.95];   // knows the country
  const PR = [0.15, 0.3, 0.45, 0.56, 0.66, 0.74, 0.82, 0.88, 0.94, 0.98]; // else knows the region
  const SIG = [700, 520, 380, 280, 200, 140, 95, 60, 34, 16];             // km error inside the right country
  const TIME = [[18, 45], [16, 42], [14, 38], [12, 34], [11, 30], [9, 26], [8, 22], [7, 18], [6, 15], [5, 12]]; // seconds to guess
  const NAMES = ['Ola', 'Kuba', 'Zosia', 'Bartek', 'Maja', 'Igor', 'Lena', 'Tymek', 'Hania', 'Wiktor', 'Nela', 'Szymon', 'Ada', 'Filip', 'Iga', 'Kacper'];

  function townsWeighted(rng, cc) { const list = W.towns[cc]; return rng.weighted(list, t => Math.pow(t.pop, 0.5)); }
  function guess(level, loc, seed) {
    const L = Math.max(1, Math.min(10, level)) - 1;
    const rng = GT.makeRng(seed);
    const meta = W.META[loc.cc];
    if (rng() < PC[L]) {
      const c = W.byCode[loc.cc];
      for (let i = 0; i < 12; i++) {
        const km = Math.abs(rng.gauss()) * SIG[L], p = GT.offsetPoint(loc.lat, loc.lon, km, rng() * 360);
        if (W.inCountry(c, p[0], p[1])) return p;
      }
      const t = townsWeighted(rng, loc.cc); return [t.lat, t.lon];
    }
    let pool;
    if (rng() < PR[L]) pool = W.playable.filter(cc => W.META[cc].r === meta.r && cc !== loc.cc);
    else if (rng() < 0.5) { const near = W.NEAR_REGIONS[meta.r] || []; pool = W.playable.filter(cc => near.includes(W.META[cc].r)); }
    if (!pool || !pool.length) pool = W.playable.filter(cc => cc !== loc.cc);
    const cc = rng.weighted(pool, c => W.META[c].w);
    const t = townsWeighted(rng, cc);
    const p = GT.offsetPoint(t.lat, t.lon, rng() * 30, rng() * 360);
    return p;
  }
  function delay(level, seed) { const L = Math.max(1, Math.min(10, level)) - 1; const r = GT.makeRng(seed ^ 0x5151); return (TIME[L][0] + r() * (TIME[L][1] - TIME[L][0])) * 1000; }
  root.GTBots = { LEVELS, guess, delay, NAMES };
})(this);
