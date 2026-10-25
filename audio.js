// Globtrop – sound: a generative "radio" with five stations and synthesized sound effects (Web Audio, no files).
(function (root) {
  let ctx = null, master, musicBus, sfxBus, musicFilter, reverb, reverbSend, noiseBuf = null;
  const S = { music: true, musicVol: 0.5, sfx: true, sfxVol: 0.7, station: 'lofi' };
  let playing = false, timer = 0, nextTime = 0, step = 0, trackSeed = 1, trackNo = 1, listeners = [];

  // ---------- music theory helpers
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], PENTA = [0, 2, 4, 7, 9];
  const STATIONS = {
    lofi: { bpm: 76, swing: 0.18, scale: MAJ, progs: [[1, 6, 2, 5], [4, 3, 6, 1], [2, 5, 1, 6], [1, 4, 3, 6]], seventh: true, keys: [57, 60, 62, 55], drums: 'boombap', pad: 'keys', lead: 'lofi', bass: 'soft', crackle: true, cutoff: 2600 },
    synth: { bpm: 100, swing: 0, scale: MIN, progs: [[1, 6, 3, 7], [1, 7, 6, 7], [6, 4, 1, 5], [1, 3, 6, 5]], seventh: false, keys: [57, 52, 55], drums: 'four', pad: 'saw', lead: 'arp', bass: 'eighths', crackle: false, cutoff: 5200 },
    ambient: { bpm: 60, swing: 0, scale: MAJ, progs: [[1, 4, 6, 5], [1, 5, 6, 4], [4, 1, 5, 6]], seventh: true, keys: [60, 62, 57], drums: 'none', pad: 'warm', lead: 'bell', bass: 'drone', crackle: false, cutoff: 3200 },
    bossa: { bpm: 118, swing: 0.08, scale: MAJ, progs: [[2, 5, 1, 1], [1, 6, 2, 5], [4, 7, 3, 6], [2, 5, 1, 6]], seventh: true, keys: [60, 62, 65], drums: 'bossa', pad: 'pluck', lead: 'flute', bass: 'bossa', crackle: false, cutoff: 4200 },
    chip: { bpm: 138, swing: 0, scale: MAJ, progs: [[1, 5, 6, 4], [6, 4, 1, 5], [1, 4, 5, 4]], seventh: false, keys: [60, 64, 67], drums: 'chip', pad: 'none', lead: 'chip', bass: 'chip', crackle: false, cutoff: 7000 },
  };
  const ORDER = ['lofi', 'synth', 'ambient', 'bossa', 'chip'];
  let song = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 4000;
    musicBus = ctx.createGain(); musicBus.connect(musicFilter); musicFilter.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    // reverb from a decaying noise impulse
    reverb = ctx.createConvolver(); const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    reverb.buffer = ir; reverbSend = ctx.createGain(); reverbSend.gain.value = 0.35; reverbSend.connect(reverb); reverb.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    applyVolumes();
    return true;
  }
  function applyVolumes() {
    if (!ctx) return; const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(S.music ? S.musicVol * 0.55 : 0, t, 0.15);
    sfxBus.gain.setTargetAtTime(S.sfx ? S.sfxVol : 0, t, 0.05);
  }

  // ---------- instruments (all scheduled at absolute time t)
  function env(g, t, a, peak, d, sustain, r, len) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(sustain, t + a, d); g.gain.setTargetAtTime(0.0001, t + len, r);
  }
  function osc(type, f, t, len, vol, opts = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (opts.detune) o.detune.value = opts.detune;
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t + len);
    let out = g;
    if (opts.cut) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(opts.cut, t); if (opts.cutEnd) fl.frequency.exponentialRampToValueAtTime(opts.cutEnd, t + len); fl.Q.value = opts.q || 0.7; o.connect(fl); fl.connect(g); } else o.connect(g);
    env(g, t, opts.a || 0.005, vol, opts.d || 0.15, (opts.s === undefined ? 0.6 : opts.s) * vol, opts.r || 0.12, len);
    out.connect(opts.bus || musicBus); if (opts.verb) out.connect(reverbSend);
    o.start(t); o.stop(t + len + (opts.r || 0.12) * 6 + 0.05);
  }
  function noise(t, len, vol, type, freq, bus, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(bus || musicBus); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
  }
  function kick(t, v = 1) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4); }
  function snare(t, v = 1) { noise(t, 0.18, 0.45 * v, 'bandpass', 1900, musicBus, 0.8); osc('triangle', 190, t, 0.06, 0.25 * v, { s: 0, d: 0.04 }); }
  function hat(t, v = 1, open) { noise(t, open ? 0.25 : 0.05, 0.18 * v, 'highpass', 7500); }

  // ---------- generative song
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  function newSong() {
    const st = STATIONS[S.station], r = rng(trackSeed * 7919 + ORDER.indexOf(S.station) * 104729);
    const key = st.keys[Math.floor(r() * st.keys.length)] + Math.floor(r() * 3) - 1;
    const prog = st.progs[Math.floor(r() * st.progs.length)];
    // a melody motif (scale degrees per 8th) reused with variation
    const motif = []; let deg = Math.floor(r() * 5);
    for (let i = 0; i < 16; i++) { if (r() < 0.38) motif.push(null); else { deg = Math.max(-2, Math.min(9, deg + Math.floor(r() * 5) - 2)); motif.push(deg); } }
    song = { st, key, prog, motif, r, bars: 0 };
  }
  function degreeNote(st, key, deg, oct = 0) { const sc = st.scale, n = sc.length; const o = Math.floor(deg / n), i = ((deg % n) + n) % n; return key + sc[i] + 12 * (o + oct); }
  function chordNotes(st, key, root) { const d = root - 1; const notes = [degreeNote(st, key, d), degreeNote(st, key, d + 2), degreeNote(st, key, d + 4)]; if (st.seventh) notes.push(degreeNote(st, key, d + 6)); return notes; }

  function scheduleStep(s, t) { // s: 16th index within the 4-bar phrase (0..63)
    const st = song.st, beat = 60 / st.bpm, six = beat / 4;
    const bar = Math.floor(s / 16), pos = s % 16;
    const chord = chordNotes(st, song.key, song.prog[bar % song.prog.length]);
    const r = song.r;
    if (pos % 2 === 1) t += six * st.swing; // swing on off-16ths
    // ---- pads / comping
    if (pos === 0) {
      if (st.pad === 'keys') chord.forEach((n, i) => { osc('sine', midi(n), t + i * 0.012, beat * 3.6, 0.07, { a: 0.01, d: 0.6, s: 0.35, r: 0.5, verb: true }); osc('triangle', midi(n + 12), t, beat * 1.2, 0.02, { s: 0.1 }); });
      if (st.pad === 'saw') chord.forEach(n => { osc('sawtooth', midi(n), t, beat * 3.9, 0.035, { a: 0.25, s: 0.8, r: 0.4, cut: 1400, detune: -8, verb: true }); osc('sawtooth', midi(n), t, beat * 3.9, 0.035, { a: 0.25, s: 0.8, r: 0.4, cut: 1400, detune: 8 }); });
      if (st.pad === 'warm') chord.forEach(n => { osc('triangle', midi(n), t, beat * 4.2, 0.06, { a: 1.2, s: 0.9, r: 1.6, verb: true }); osc('sine', midi(n - 12), t, beat * 4.2, 0.04, { a: 1.4, s: 0.9, r: 1.8 }); });
    }
    if (st.pad === 'pluck' && [0, 3, 6, 10, 12].includes(pos)) chord.forEach((n, i) => osc('triangle', midi(n + 12), t + i * 0.008, six * 1.5, 0.05, { s: 0, d: 0.12, r: 0.1, verb: true }));
    // ---- bass
    const rootN = chord[0] - 24;
    if (st.bass === 'soft' && (pos === 0 || pos === 10)) osc('sine', midi(rootN), t, beat * 1.3, 0.28, { s: 0.7, r: 0.15 });
    if (st.bass === 'eighths' && pos % 2 === 0) osc('sawtooth', midi(rootN + (pos % 8 === 6 ? 12 : 0)), t, six * 1.6, 0.13, { s: 0.5, cut: 900, cutEnd: 300 });
    if (st.bass === 'drone' && pos === 0 && bar % 2 === 0) osc('sine', midi(rootN), t, beat * 8, 0.16, { a: 1.5, s: 0.9, r: 2 });
    if (st.bass === 'bossa' && [0, 6, 8, 14].includes(pos)) osc('sine', midi(pos === 6 || pos === 14 ? chord[2] - 24 : rootN), t, six * 2.2, 0.26, { s: 0.6 });
    if (st.bass === 'chip' && pos % 2 === 0) osc('triangle', midi(rootN + 12 + (pos % 4 === 2 ? 12 : 0)), t, six * 1.4, 0.18, { s: 0.8, r: 0.02 });
    // ---- lead / melody
    const md = song.motif[pos], second = bar % 2 === 1;
    if (st.lead === 'arp') { const n = chord[pos % chord.length] + 12 + (pos % 8 >= 4 ? 12 : 0); osc('square', midi(n), t, six * 0.8, 0.035, { s: 0.3, cut: 2600, verb: true }); }
    if (st.lead === 'chip') { if (pos % 2 === 0 && md !== null) osc('square', midi(degreeNote(st, song.key, md + (second ? 2 : 0), 1)), t, six * 1.7, 0.06, { s: 0.7, r: 0.02 }); if (pos % 4 === 1) osc('square', midi(chord[(pos >> 2) % 3] + 24), t, six * 0.6, 0.025, { s: 0.5 }); }
    if (st.lead === 'lofi' && pos % 2 === 0 && md !== null && r() < 0.55) osc('triangle', midi(degreeNote(st, song.key, md, 1)), t, six * 3, 0.05, { a: 0.02, s: 0.35, r: 0.25, verb: true });
    if (st.lead === 'bell' && pos % 4 === 0 && md !== null && r() < 0.5) { const f = midi(degreeNote(st, song.key, md, 1)); osc('sine', f, t, beat * 2, 0.06, { a: 0.003, d: 0.6, s: 0.1, r: 1.5, verb: true }); osc('sine', f * 2.76, t, beat * 0.6, 0.015, { s: 0, d: 0.3 }); }
    if (st.lead === 'flute' && pos % 2 === 0 && md !== null && bar % 4 >= 2 && r() < 0.7) osc('sine', midi(degreeNote(st, song.key, md, 1)), t, six * 2.6, 0.05, { a: 0.05, s: 0.8, r: 0.15, verb: true });
    // ---- drums
    switch (st.drums) {
      case 'boombap': if (pos === 0 || pos === 7 || pos === 10) kick(t, 0.8); if (pos === 4 || pos === 12) snare(t, 0.55); if (pos % 2 === 0) hat(t, 0.5); break;
      case 'four': if (pos % 4 === 0) kick(t); if (pos === 4 || pos === 12) snare(t, 0.8); if (pos % 2 === 1) hat(t, 0.6); if (pos === 14) hat(t, 0.5, true); break;
      case 'bossa': if ([0, 6, 8, 14].includes(pos)) kick(t, 0.45); if ([3, 6, 10, 12].includes(pos)) noise(t, 0.04, 0.12, 'bandpass', 3000, musicBus, 2); hat(t, 0.25); break;
      case 'chip': if (pos % 8 === 0) kick(t, 0.7); if (pos % 8 === 4) noise(t, 0.09, 0.3, 'highpass', 1500); if (pos % 2 === 0) noise(t, 0.02, 0.12, 'highpass', 9000); break;
    }
    if (st.crackle && r() < 0.35) noise(t + r() * six, 0.01, 0.05 + r() * 0.05, 'highpass', 3000);
  }
  function tick() {
    if (!playing || !ctx) return;
    const st = song.st, six = 60 / st.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      scheduleStep(step % 64, nextTime);
      nextTime += six; step++;
      if (step % 64 === 0) { song.bars += 4; if (song.bars >= 48) { trackSeed++; trackNo++; newSong(); emit(); } else if (song.r() < 0.35) { // small variation between phrases
        const m = song.motif; const i = Math.floor(song.r() * m.length); m[i] = m[i] === null ? Math.floor(song.r() * 7) : null; } }
    }
  }
  function startMusic() {
    if (!S.music || !ensure() || playing) return;
    playing = true; musicFilter.frequency.setTargetAtTime(STATIONS[S.station].cutoff, ctx.currentTime, 0.2);
    if (!song) newSong(); nextTime = ctx.currentTime + 0.1; step = 0;
    clearInterval(timer); timer = setInterval(tick, 25); emit();
  }
  function stopMusic() { playing = false; clearInterval(timer); emit(); }
  function setStation(id) { if (!STATIONS[id]) return; S.station = id; trackSeed = Math.floor(Math.random() * 1000); trackNo = 1; newSong(); if (ctx) musicFilter.frequency.setTargetAtTime(STATIONS[id].cutoff, ctx.currentTime, 0.2); step = 0; if (ctx) nextTime = ctx.currentTime + 0.05; emit(); }
  function nextTrack() { trackSeed++; trackNo++; newSong(); step = 0; if (ctx) nextTime = ctx.currentTime + 0.05; emit(); }
  function emit() { for (const f of listeners) f(state()); }
  function state() { return { playing, station: S.station, track: trackNo, music: S.music, sfx: S.sfx, musicVol: S.musicVol, sfxVol: S.sfxVol }; }

  // ---------- sound effects
  function sfx(name, arg) {
    if (!S.sfx || !ensure()) return;
    const t = ctx.currentTime + 0.01, B = { bus: sfxBus };
    switch (name) {
      case 'click': osc('triangle', 880, t, 0.03, 0.12, { ...B, s: 0, d: 0.02 }); break;
      case 'hover': osc('sine', 1320, t, 0.02, 0.04, { ...B, s: 0 }); break;
      case 'pin': osc('sine', 660, t, 0.06, 0.25, { ...B, s: 0, d: 0.05, glide: 990 }); noise(t, 0.05, 0.12, 'bandpass', 2400, sfxBus, 3); break;
      case 'guess': [523, 659, 784].forEach((f, i) => osc('triangle', f, t + i * 0.06, 0.12, 0.2, { ...B, s: 0.3 })); break;
      case 'score': { const p = Math.max(0, Math.min(5000, arg || 0)), n = 1 + Math.round(p / 1000); const base = p > 4500 ? 72 : 64; for (let i = 0; i < n; i++) osc('triangle', midi(base + [0, 4, 7, 12, 16, 19][i]), t + i * 0.08, 0.18, 0.18, { ...B, s: 0.4, r: 0.2 }); if (p < 500) osc('sawtooth', 180, t, 0.4, 0.12, { ...B, glide: 90, cut: 900 }); break; }
      case 'damage': { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.4); g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.55); noise(t, 0.3, 0.35, 'lowpass', 900, sfxBus); break; }
      case 'tick': osc('square', 1500, t, 0.02, 0.06, { ...B, s: 0 }); break;
      case 'join': osc('sine', 587, t, 0.1, 0.18, { ...B, s: 0.4 }); osc('sine', 880, t + 0.09, 0.14, 0.18, { ...B, s: 0.4 }); break;
      case 'start': [392, 523, 659, 784].forEach((f, i) => osc('square', f, t + i * 0.09, 0.14, 0.09, { ...B, s: 0.5, cut: 3000 })); break;
      case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => osc('triangle', f, t + i * 0.12, i === 5 ? 0.6 : 0.14, 0.22, { ...B, s: 0.5, r: 0.3 })); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => osc('triangle', f, t + i * 0.18, 0.3, 0.2, { ...B, s: 0.5, r: 0.3 })); break;
    }
  }
  function configure(o) { Object.assign(S, o); if (S.music) { if (ctx) startMusic(); } else stopMusic(); applyVolumes(); emit(); }
  function unlock() { if (!ensure()) return; if (S.music && !playing) startMusic(); }
  root.GTAudio = { configure, unlock, sfx, setStation, nextTrack, onChange: f => listeners.push(f), state, STATIONS: ORDER };
})(this);
