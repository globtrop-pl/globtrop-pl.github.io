// Globtrop – shared helpers: seeded randomness, noise, geo maths.
(function (root) {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const r = mulberry32(seed >>> 0);
    const api = () => r();
    api.range = (a, b) => a + (b - a) * r();
    api.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    api.pick = arr => arr[Math.floor(r() * arr.length)];
    api.chance = p => r() < p;
    api.gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    api.weighted = (items, wf) => { let s = 0; for (const it of items) s += wf(it); let x = r() * s; for (const it of items) { x -= wf(it); if (x <= 0) return it; } return items[items.length - 1]; };
    return api;
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // 2D value noise with smooth interpolation, seeded
  function makeNoise(seed) {
    const rng = mulberry32(seed);
    const P = new Uint16Array(512), V = new Float32Array(256);
    for (let i = 0; i < 256; i++) { P[i] = i; V[i] = rng() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    const s = t => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = V[P[P[X] + Y]], b = V[P[P[X + 1] + Y]], c = V[P[P[X] + Y + 1]], d = V[P[P[X + 1] + Y + 1]];
      const u = s(xf), v = s(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
      let sum = 0, amp = 1, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) { sum += n2(x * f, y * f) * amp; norm += amp; amp *= gain; f *= lac; }
      return sum / norm;
    }
    function ridge(x, y, oct = 5) {
      let sum = 0, amp = 1, f = 1, norm = 0;
      for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(n2(x * f, y * f)); sum += v * v * amp; norm += amp; amp *= 0.5; f *= 2.03; }
      return sum / norm;
    }
    return { n2, fbm, ridge };
  }

  const R = 6371;
  function haversine(la1, lo1, la2, lo2) {
    const t = Math.PI / 180, dla = (la2 - la1) * t, dlo = (lo2 - lo1) * t;
    const a = Math.sin(dla / 2) ** 2 + Math.cos(la1 * t) * Math.cos(la2 * t) * Math.sin(dlo / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function bearing(la1, lo1, la2, lo2) {
    const t = Math.PI / 180, y = Math.sin((lo2 - lo1) * t) * Math.cos(la2 * t);
    const x = Math.cos(la1 * t) * Math.sin(la2 * t) - Math.sin(la1 * t) * Math.cos(la2 * t) * Math.cos((lo2 - lo1) * t);
    return (Math.atan2(y, x) / t + 360) % 360;
  }
  function offsetPoint(lat, lon, km, brg) {
    const t = Math.PI / 180, d = km / R, b = brg * t, la = lat * t, lo = lon * t;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return [la2 / t, ((lo2 / t + 540) % 360) - 180];
  }
  // GeoGuessr-like scoring for the world map
  function score(km) { return Math.round(5000 * Math.exp(-km / 1492.7)); }
  function fmtKm(km) { return km < 1 ? Math.round(km * 1000) + ' m' : km < 100 ? km.toFixed(1).replace('.', ',') + ' km' : Math.round(km).toLocaleString('pl-PL') + ' km'; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  root.GT = { makeRng, mulberry32, hashStr, makeNoise, haversine, bearing, offsetPoint, score, fmtKm, clamp, smooth, lerp };
})(this);
