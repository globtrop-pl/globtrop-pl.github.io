// Globtrop – world model: countries, towns, random locations and the environment of a spot.
(function (root) {
  const { META, NEAR_REGIONS } = root.GT_META;
  const D = root.GT_DATA;
  const Q = D.Q;
  let plNames = null;
  try { plNames = new Intl.DisplayNames(['pl'], { type: 'region' }); } catch (e) { plNames = null; }

  function decodeLine(a) {
    const out = new Float32Array(a.length); let x = 0, y = 0;
    for (let i = 0; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out[i] = x / Q; out[i + 1] = y / Q; }
    return out; // lon,lat interleaved
  }
  const countries = [];
  const byCode = {};
  for (const c of D.countries) {
    const rings = [];
    let minX = 999, minY = 999, maxX = -999, maxY = -999;
    for (let i = 0; i < c.r.length; i += 2) {
      const pts = decodeLine(c.r[i + 1]);
      const bb = [999, 999, -999, -999];
      for (let k = 0; k < pts.length; k += 2) { const x = pts[k], y = pts[k + 1]; if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y; }
      rings.push({ outer: c.r[i] === 'o', pts, bb });
      minX = Math.min(minX, bb[0]); minY = Math.min(minY, bb[1]); maxX = Math.max(maxX, bb[2]); maxY = Math.max(maxY, bb[3]);
    }
    const code = c.c.length === 2 ? c.c : null;
    let name = c.n;
    if (code && plNames) { try { const n = plNames.of(code); if (n && n !== code) name = n; } catch (e) { } }
    const obj = { code, name, rings, bb: [minX, minY, maxX, maxY], lx: c.lx, ly: c.ly, minLabel: c.mr, area: c.a };
    countries.push(obj); if (code) byCode[code] = obj;
  }
  function inRing(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inCountry(c, lat, lon) {
    if (lon < c.bb[0] || lon > c.bb[2] || lat < c.bb[1] || lat > c.bb[3]) return false;
    let inside = false;
    for (const r of c.rings) { if (lon < r.bb[0] || lon > r.bb[2] || lat < r.bb[1] || lat > r.bb[3]) continue; if (inRing(r.pts, lon, lat)) inside = !inside; }
    return inside;
  }
  function countryAt(lat, lon) { for (const c of countries) if (inCountry(c, lat, lon)) return c; return null; }

  // Towns
  const towns = {};
  for (const cc in D.towns) {
    towns[cc] = D.towns[cc].split(';').filter(Boolean).map(s => { const p = s.split('|'); return { n: p[0], lat: +p[1] / Q, lon: +p[2] / Q, pop: +p[3] * 100, cc }; });
  }
  const labels = D.labels.split(';').map(s => { const p = s.split('|'); return { n: p[0], lat: +p[1] / Q, lon: +p[2] / Q, pop: +p[3] * 1000 }; });
  const playable = Object.keys(META).filter(cc => towns[cc] && towns[cc].length && byCode[cc]);

  function nearbyTowns(cc, lat, lon, n, minKm = 0.5) {
    const list = (towns[cc] || []).map(t => ({ t, d: GT.haversine(lat, lon, t.lat, t.lon) })).filter(o => o.d > minKm);
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, n).map(o => ({ name: o.t.n, km: o.d, pop: o.t.pop, brg: GT.bearing(lat, lon, o.t.lat, o.t.lon) }));
  }

  function pickLocation(seed) {
    const rng = GT.makeRng(seed);
    const cc = rng.weighted(playable, c => META[c].w);
    const list = towns[cc];
    const town = rng.weighted(list, t => Math.pow(t.pop, 0.42));
    const c = byCode[cc];
    let urban = 0, lat = town.lat, lon = town.lon;
    const roll = rng();
    const urbanP = town.pop > 40000 ? 0.32 : town.pop > 8000 ? 0.22 : 0.12;
    const suburbP = 0.25;
    let ok = false;
    for (let i = 0; i < 14 && !ok; i++) {
      let km, kind;
      if (roll < urbanP) { kind = 2; km = rng.range(0.05, Math.min(2.5, 0.3 + Math.sqrt(town.pop) / 120)); }
      else if (roll < urbanP + suburbP) { kind = 1; km = rng.range(0.6, 3.5); }
      else { kind = 0; km = rng.range(2, 14); }
      const p = GT.offsetPoint(town.lat, town.lon, km, rng.range(0, 360));
      if (inCountry(c, p[0], p[1])) { lat = p[0]; lon = p[1]; urban = kind; ok = true; }
    }
    if (!ok) urban = 1;
    return { seed: seed >>> 0, cc, lat: +lat.toFixed(5), lon: +lon.toFixed(5), town: town.n, urban };
  }

  // ---------- environment of a location (deterministic) ----------
  function inBox(b, lat, lon) { return lat >= b[0] && lat <= b[1] && lon >= b[2] && lon <= b[3]; }
  function sunPos(lat, doy, hour) {
    const t = Math.PI / 180;
    const dec = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365) * t;
    const H = (hour - 12) * 15 * t, la = lat * t;
    const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
    let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) / t + 180;
    return { el: el / t, az: (az + 360) % 360 };
  }
  function envFor(loc) {
    const m = META[loc.cc];
    const rng = GT.makeRng(loc.seed ^ 0x9e3779b9);
    let biome = m.bi;
    for (const r of (m.br || [])) if (inBox(r, loc.lat, loc.lon)) { biome = r[4]; break; }
    let terrain = m.te;
    for (const r of (m.tr || [])) if (inBox(r, loc.lat, loc.lon)) { terrain = r[4]; break; }
    // vary terrain a bit
    const tr = rng();
    if (terrain === 'mount' && tr < 0.3) terrain = 'hilly';
    else if (terrain === 'hilly' && tr < 0.25) terrain = 'flat';
    else if (terrain === 'flat' && tr < 0.15) terrain = 'hilly';
    const south = loc.lat < 0;
    const doy = south ? (rng() < 0.5 ? rng.int(290, 365) : rng.int(1, 80)) : rng.int(110, 265);
    let hour = rng.range(8.5, 16.5);
    let sun = sunPos(loc.lat, doy, hour);
    if (sun.el < 12) { hour = 12 + (hour - 12) * 0.4; sun = sunPos(loc.lat, doy, hour); }
    const cloudy = ['neu', 'weu'].includes(m.r) || biome === 'tropical' || biome === 'pnw' ? 0.32 : biome === 'desert' || biome === 'outback' ? 0.04 : 0.15;
    const w = rng();
    const weather = w < cloudy ? 'overcast' : w < cloudy + 0.4 ? 'partly' : 'clear';
    const dirt = rng() < m.dirt * (loc.urban === 2 ? 0.15 : loc.urban === 1 ? 0.5 : 1.3);
    const heading = rng.range(0, 360); // bearing of the road ahead (camera forward)
    const near = nearbyTowns(loc.cc, loc.lat, loc.lon, 6);
    return { meta: m, cc: loc.cc, biome, terrain, sun, doy, hour, weather, dirt, heading, near, urban: loc.urban, town: loc.town, lat: loc.lat, lon: loc.lon, seed: loc.seed };
  }

  function setLang(l) {
    let dn = null; try { dn = new Intl.DisplayNames([l], { type: 'region' }); } catch (e) { return; }
    for (const c of countries) if (c.code) { try { const n = dn.of(c.code); if (n && n !== c.code) c.name = n; } catch (e) { } }
  }
  root.GTWorld = { setLang, countries, byCode, countryAt, inCountry, towns, labels, playable, nearbyTowns, pickLocation, envFor, decodeLine, META, NEAR_REGIONS };
})(this);
