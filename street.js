// Globtrop – Google Street View: finding random official panoramas and showing them per game mode.
(function (root) {
  const W = root.GTWorld;
  let pano = null, svc = null, el = null, blocker = null, mode = 'move', start = null, listeners = [];

  function ready() { return !!(root.google && google.maps && google.maps.StreetViewPanorama); }

  function init(container) {
    el = container;
    if (!ready()) return false;
    svc = new google.maps.StreetViewService();
    const host = document.createElement('div'); host.className = 'sv'; el.appendChild(host);
    blocker = document.createElement('div'); blocker.className = 'sv-block'; blocker.hidden = true; el.appendChild(blocker);
    pano = new google.maps.StreetViewPanorama(host, {
      addressControl: false, showRoadLabels: false, fullscreenControl: false, motionTracking: false, motionTrackingControl: false,
      enableCloseButton: false, panControl: false, zoomControl: false, linksControl: true, clickToGo: true, imageDateControl: false,
      disableDefaultUI: true, visible: true,
    });
    pano.addListener('pov_changed', () => { const pv = pano.getPov(); for (const f of listeners) f({ heading: pv.heading || 0, zoom: pv.zoom || 0 }); });
    return true;
  }

  // One attempt: random town from the weighted country table -> nearest official panorama.
  function query(lat, lon, radius) {
    const opts = { location: { lat, lng: lon }, radius, preference: google.maps.StreetViewPreference.NEAREST };
    if (google.maps.StreetViewSource && google.maps.StreetViewSource.GOOGLE) opts.sources = [google.maps.StreetViewSource.GOOGLE];
    else opts.source = google.maps.StreetViewSource.OUTDOOR;
    return svc.getPanorama(opts).then(r => r.data).catch(() => null);
  }
  async function find() {
    if (!svc) throw new Error('Street View nie jest gotowe');
    for (let attempt = 0; attempt < 30; attempt++) {
      const seed = (Math.random() * 4294967295) >>> 0;
      const l = W.pickLocation(seed);
      const radius = l.urban === 2 ? 400 : l.urban === 1 ? 2000 : 10000;
      const d = await query(l.lat, l.lon, radius);
      if (!d || !d.location || !d.links || !d.links.length) continue;
      const lat = d.location.latLng.lat(), lon = d.location.latLng.lng();
      const c = W.countryAt(lat, lon);
      if (!c || c.code !== l.cc) continue;
      const near = W.nearbyTowns(l.cc, lat, lon, 1, 0)[0];
      return { seed, pano: d.location.pano, lat: +lat.toFixed(5), lon: +lon.toFixed(5), cc: l.cc, town: near ? near.name : l.town, h: Math.round(Math.random() * 360) };
    }
    throw new Error('Nie znaleziono panoramy');
  }

  function setMode(m) {
    mode = m;
    if (!pano) return;
    const move = m === 'move', look = m !== 'nmpz';
    pano.setOptions({ linksControl: move, clickToGo: move, scrollwheel: look, disableDoubleClickZoom: !move, keyboardShortcuts: move });
    blocker.hidden = look; // NMPZ: nothing reaches the panorama
  }
  function show(loc, m) {
    if (!pano) return;
    start = { pano: loc.pano, pov: { heading: loc.h || 0, pitch: 0 }, zoom: 0 };
    setMode(m);
    pano.setPano(loc.pano); pano.setPov(start.pov); pano.setZoom(0); pano.setVisible(true);
  }
  function step(dir) {
    if (mode !== 'move' || !pano) return;
    const links = pano.getLinks() || []; if (!links.length) return;
    const h = (pano.getPov().heading || 0) + (dir < 0 ? 180 : 0);
    let best = null, bd = 999;
    for (const l of links) { const d = Math.abs(((l.heading - h + 540) % 360) - 180); if (d < bd) { bd = d; best = l; } }
    if (best && bd < 100) pano.setPano(best.pano);
  }
  function rotate(deg) { if (mode === 'nmpz' || !pano) return; const pv = pano.getPov(); pano.setPov({ heading: (pv.heading || 0) - deg, pitch: pv.pitch || 0 }); }
  function zoom(f) { if (mode === 'nmpz' || !pano) return; const z = pano.getZoom() || 0; pano.setZoom(Math.max(0, Math.min(4, z + (f < 1 ? 0.6 : -0.6)))); }
  function resetView() { if (!pano || !start) return; pano.setPano(start.pano); pano.setPov(start.pov); pano.setZoom(0); }
  function onView(f) { listeners.push(f); }
  function kick() { if (pano && root.google) google.maps.event.trigger(pano, 'resize'); }
  root.GTStreet = { ready, init, find, show, setMode, step, rotate, zoom, resetView, onView, kick };
})(this);
