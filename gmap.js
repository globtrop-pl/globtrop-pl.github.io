// Globtrop – guess map on Google Maps (streets, every town, like in GeoGuessr). Same interface as the canvas GTMap.
(function (root) {
  let PinOverlay = null;
  function defineOverlay() {
    if (PinOverlay) return;
    PinOverlay = class extends google.maps.OverlayView {
      constructor(pin) { super(); this.pin = pin; this.div = null; }
      onAdd() {
        const d = document.createElement('div'); d.className = 'gpin' + (this.pin.kind === 'target' ? ' target' : '');
        if (this.pin.kind === 'target') d.innerHTML = '<svg width="34" height="40" viewBox="0 0 34 40"><path d="M4 2v36" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M5 3h22l-5 6 5 6H5z" fill="#16a34a" stroke="#0b5d2a" stroke-width="1.5"/></svg>';
        else { d.style.setProperty('--c', this.pin.color || '#e5484d'); d.innerHTML = `<span>${String(this.pin.label || '?').slice(0, 2).toUpperCase().replace(/[<>&"]/g, '')}</span>`; }
        this.div = d; this.getPanes().overlayMouseTarget.appendChild(d);
      }
      draw() { const p = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.pin.lat, this.pin.lon)); if (p && this.div) { this.div.style.left = p.x + 'px'; this.div.style.top = p.y + 'px'; } }
      onRemove() { if (this.div) this.div.remove(); this.div = null; }
    };
  }
  const STYLE = [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ];
  class GTGMap {
    constructor(el, opts = {}) {
      defineOverlay();
      this.el = el; this.opts = opts; this.pins = []; this.lines = [];
      this.map = new google.maps.Map(el, {
        center: { lat: 20, lng: 0 }, zoom: 1, minZoom: 1, disableDefaultUI: true, zoomControl: !opts.small, clickableIcons: false, keyboardShortcuts: false,
        gestureHandling: 'greedy', draggableCursor: opts.onPick ? 'crosshair' : 'grab', styles: STYLE, backgroundColor: '#aadaff', isFractionalZoomEnabled: true,
      });
      if (opts.onPick) this.map.addListener('click', e => opts.onPick(e.latLng.lat(), ((e.latLng.lng() + 540) % 360) - 180));
    }
    setPins(pins) { this.pins.forEach(o => o.setMap(null)); this.pins = pins.map(p => { const o = new PinOverlay(p); o.setMap(this.map); return o; }); }
    setLines(lines) {
      this.lines.forEach(l => l.setMap(null));
      this.lines = lines.map(L => new google.maps.Polyline({ map: this.map, path: [{ lat: L.a[0], lng: L.a[1] }, { lat: L.b[0], lng: L.b[1] }], geodesic: true, strokeOpacity: 0, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: L.color || '#222', strokeWeight: 3, scale: 3 }, offset: '0', repeat: '14px' }] }));
    }
    reset() { this.map.setCenter({ lat: 20, lng: 0 }); this.map.setZoom(this.el.clientWidth > 500 ? 2 : 1); }
    fit(points, pad = 60) {
      if (!points.length) return this.reset();
      const b = new google.maps.LatLngBounds(); points.forEach(([la, lo]) => b.extend({ lat: la, lng: lo }));
      this.map.fitBounds(b, pad);
      google.maps.event.addListenerOnce(this.map, 'idle', () => { if (this.map.getZoom() > 16) this.map.setZoom(16); });
    }
    resize() { } redraw() { }
  }
  root.GTGMap = GTGMap;
})(this);
