// Globtrop – fast canvas world map (Web Mercator) with pan/zoom, guess pins and result lines.
(function (root) {
  const W = root.GTWorld;
  const MAXLAT = 85;
  function mx(lon) { return (lon + 180) / 360; }
  function my(lat) { const l = Math.max(-MAXLAT, Math.min(MAXLAT, lat)) * Math.PI / 180; return (1 - Math.log(Math.tan(Math.PI / 4 + l / 2)) / Math.PI) / 2; }
  function unproj(x, y) { const lon = x * 360 - 180; const n = Math.PI - 2 * Math.PI * y; const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); return [lat, ((lon + 540) % 360) - 180]; }

  // Shared projected paths (built once)
  let PATHS = null;
  function buildPaths() {
    if (PATHS) return PATHS;
    const land = new Path2D(), borders = new Path2D(), lakes = new Path2D(), rivers = new Path2D(), admin = new Path2D();
    const ring = (path, pts, close) => {
      let px = null;
      for (let i = 0; i < pts.length; i += 2) {
        let x = mx(pts[i]); const y = my(pts[i + 1]);
        if (px !== null && Math.abs(x - px) > 0.5) x += x > px ? -1 : 1; // keep rings continuous across the antimeridian
        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y); px = x;
      }
      if (close) path.closePath();
    };
    for (const c of W.countries) for (const r of c.rings) { ring(land, r.pts, true); ring(borders, r.pts, true); }
    const D = root.GT_DATA;
    for (const l of D.lakes) ring(lakes, W.decodeLine(l), true);
    for (const l of D.rivers) ring(rivers, W.decodeLine(l), false);
    for (const l of D.admin) ring(admin, W.decodeLine(l), false);
    const labels = W.countries.filter(c => c.code).map(c => ({ name: c.name, x: mx(c.lx), y: my(c.ly), minK: c.area > 400 ? 0 : c.area > 60 ? 900 : c.area > 8 ? 2200 : 5000 }));
    const cities = W.labels.map(c => ({ name: c.n, x: mx(c.lon), y: my(c.lat), pop: c.pop }));
    PATHS = { land, borders, lakes, rivers, admin, labels, cities };
    return PATHS;
  }

  class GTMap {
    constructor(el, opts = {}) {
      this.el = el; this.opts = opts;
      this.cv = document.createElement('canvas'); this.cv.className = 'map-canvas'; el.appendChild(this.cv);
      this.g = this.cv.getContext('2d');
      this.k = 0; this.tx = 0; this.ty = 0; // pixels per world unit, translation
      this.pins = []; this.lines = []; this.cursor = null; this.dirty = true;
      this.P = buildPaths();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
      this.bind(); this.resize(); this.reset();
      const tick = () => { this.raf = requestAnimationFrame(tick); if (this.dirty) { this.dirty = false; this.draw(); } };
      tick();
    }
    resize() {
      const r = this.el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      const ow = this.w || r.width;
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
      this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
      this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
      if (!this.k) this.reset(); else { this.tx += (this.w - ow) / 2; this.clampView(); }
      this.dirty = true;
    }
    reset() { const k = Math.max(this.w / 1, this.h / 0.72); this.k = Math.max(this.w, 260); this.tx = (this.w - this.k) / 2; this.ty = (this.h - this.k * 0.95) / 2 - this.k * 0.06; this.clampView(); this.dirty = true; }
    clampView() {
      const minK = Math.max(this.w, this.h * 1.1) * 0.95; if (this.k < minK) this.k = minK;
      if (this.k > 6e6) this.k = 6e6;
      // vertical clamp (Mercator square spans y 0..1)
      const top = this.k * 0.03, bot = this.k * 0.92;
      if (this.ty > -top + 20) this.ty = -top + 20;
      if (this.ty + bot < this.h - 20) this.ty = this.h - 20 - bot;
      // horizontal wrap
      while (this.tx > 0) this.tx -= this.k; while (this.tx < -this.k) this.tx += this.k;
    }
    toScreen(lat, lon) { return [this.tx + mx(lon) * this.k, this.ty + my(lat) * this.k]; }
    zoomAt(px, py, f) { const nk = Math.max(Math.max(this.w, this.h * 1.1) * 0.95, Math.min(6e6, this.k * f)); f = nk / this.k; this.tx = px - (px - this.tx) * f; this.ty = py - (py - this.ty) * f; this.k = nk; this.clampView(); this.dirty = true; }
    fit(points, pad = 60) {
      if (!points.length) return this.reset();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      const ref = mx(points[0][1]);
      for (const [la, lo] of points) { let x = mx(lo); if (x - ref > 0.5) x -= 1; if (ref - x > 0.5) x += 1; const y = my(la); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const dx = Math.max(x1 - x0, 0.0008), dy = Math.max(y1 - y0, 0.0008);
      this.k = Math.min((this.w - pad * 2) / dx, (this.h - pad * 2) / dy, 2e5);
      this.tx = this.w / 2 - (x0 + x1) / 2 * this.k; this.ty = this.h / 2 - (y0 + y1) / 2 * this.k; this.clampView(); this.dirty = true;
    }
    bind() {
      const c = this.cv; const pts = new Map(); let drag = null, pinch = null, moved = 0;
      c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty }; else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; } });
      c.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const r = c.getBoundingClientRect(); this.zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinch.d); pinch.d = d; moved += 10; return; }
        if (drag) { moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y); this.tx = drag.tx + e.clientX - drag.x; this.ty = drag.ty + e.clientY - drag.y; this.clampView(); this.dirty = true; }
      });
      const up = e => {
        if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (drag && moved < 6 && this.opts.onPick) { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left - this.tx) / this.k, y = (e.clientY - r.top - this.ty) / this.k; const [la, lo] = unproj(((x % 1) + 1) % 1, y); this.opts.onPick(la, lo); }
        if (!pts.size) drag = null;
      };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
      c.addEventListener('wheel', e => { e.preventDefault(); const r = c.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
    }
    setPins(pins) { this.pins = pins; this.dirty = true; }
    setLines(lines) { this.lines = lines; this.dirty = true; }
    draw() {
      const g = this.g, dpr = this.dpr, k = this.k; const P = this.P;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#a9cbe0'; g.fillRect(0, 0, this.w, this.h);
      const offs = []; for (let o = -1; o <= 2; o++) { const x0 = this.tx + o * k; if (x0 < this.w && x0 + k > 0) offs.push(o); }
      for (const o of offs) {
        g.setTransform(dpr * k, 0, 0, dpr * k, dpr * (this.tx + o * k), dpr * this.ty);
        g.fillStyle = '#efece3'; g.fill(P.land);
        g.fillStyle = '#a9cbe0'; g.fill(P.lakes);
        if (k > 2500) { g.strokeStyle = '#8fbad6'; g.lineWidth = (k > 20000 ? 1.4 : 0.8) / k; g.stroke(P.rivers); }
        if (k > 1800) { g.strokeStyle = 'rgba(150,140,160,.55)'; g.lineWidth = 0.8 / k; g.setLineDash([3 / k, 2 / k]); g.stroke(P.admin); g.setLineDash([]); }
        g.strokeStyle = '#9d8f9f'; g.lineWidth = (k > 3000 ? 1.4 : 1) / k; g.stroke(P.borders);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // labels
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const placed = [];
      const tryLabel = (txt, sx, sy, font, fill, halo) => {
        g.font = font; const w = g.measureText(txt).width + 6, h = 14;
        for (const p of placed) if (Math.abs(p[0] - sx) < (p[2] + w) / 2 && Math.abs(p[1] - sy) < h) return false;
        if (sx < -w || sx > this.w + w || sy < -h || sy > this.h + h) return false;
        g.lineWidth = 3; g.strokeStyle = halo; g.strokeText(txt, sx, sy); g.fillStyle = fill; g.fillText(txt, sx, sy); placed.push([sx, sy, w]); return true;
      };
      for (const o of offs) for (const L of P.labels) { if (k < L.minK) continue; tryLabel(L.name, this.tx + (L.x + o) * k, this.ty + L.y * k, `600 ${k > 8000 ? 13 : 11}px "Figtree", system-ui, sans-serif`, '#5b4d5f', 'rgba(239,236,227,.9)'); }
      if (k > 3200) for (const o of offs) for (const C of P.cities) {
        if (k < 9000 && C.pop < 2000000) continue; if (k < 25000 && C.pop < 800000) continue;
        const sx = this.tx + (C.x + o) * k, sy = this.ty + C.y * k;
        if (tryLabel(C.name, sx, sy - 9, `500 11px "Figtree", system-ui, sans-serif`, '#3d3d3d', 'rgba(255,255,255,.85)')) { g.fillStyle = '#555'; g.beginPath(); g.arc(sx, sy, 2.4, 0, 6.3); g.fill(); }
      }
      // result lines
      for (const L of this.lines) {
        const [ax, ay] = this.toScreen(L.a[0], L.a[1]); let [bx, by] = this.toScreen(L.b[0], L.b[1]);
        if (bx - ax > k / 2) bx -= k; if (ax - bx > k / 2) bx += k;
        g.strokeStyle = L.color || '#222'; g.lineWidth = 2.5; g.setLineDash([7, 6]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
      }
      // pins
      for (const p of this.pins) {
        let [sx, sy] = this.toScreen(p.lat, p.lon);
        for (const o of [-1, 0, 1]) {
          const x = sx + o * k; if (x < -30 || x > this.w + 30) continue;
          if (p.kind === 'target') {
            g.fillStyle = '#111'; g.fillRect(x - 1, sy - 30, 2.5, 30);
            g.fillStyle = '#16a34a'; g.beginPath(); g.moveTo(x + 1.5, sy - 30); g.lineTo(x + 20, sy - 24); g.lineTo(x + 1.5, sy - 17); g.fill();
            g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, sy, 6, 2.5, 0, 0, 6.3); g.fill();
          } else {
            g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, sy, 7, 3, 0, 0, 6.3); g.fill();
            g.fillStyle = p.color || '#e5484d'; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
            g.beginPath(); g.arc(x, sy - 16, 12, 0, 6.3); g.fill(); g.stroke();
            g.beginPath(); g.moveTo(x - 6, sy - 8); g.lineTo(x, sy); g.lineTo(x + 6, sy - 8); g.fill();
            g.fillStyle = '#fff'; g.font = '700 11px "Figtree", system-ui, sans-serif'; g.fillText((p.label || '?').slice(0, 2).toUpperCase(), x, sy - 15.5);
          }
        }
      }
    }
    destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.cv.remove(); }
  }
  root.GTMap = GTMap; root.GTMapProj = { mx, my, unproj };
})(this);
