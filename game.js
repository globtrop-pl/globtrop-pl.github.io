// Globtrop – game flow: solo, team duels with bots, and friends via the artifact room.
(function (root) {
  const W = root.GTWorld, Bots = root.GTBots;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const TEAM = [{ name: 'Czerwoni', col: '#e5484d' }, { name: 'Niebiescy', col: '#3e8bff' }];
  const HP = 6000, SOLO_ROUNDS = 5, AFTER_FIRST = 15000, RESULT_MS = 9000;
  const MV_LABEL = { move: 'Ruch', nomove: 'No Move', nmpz: 'NMPZ' };

  // ------------------------------------------------------------ local prefs
  const store = { get(k, d) { try { const v = localStorage.getItem('globtrop.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('globtrop.' + k, JSON.stringify(v)); } catch (e) { } } };
  const prefs = Object.assign({ nick: '', mv: 'move', tl: 0, size: 2, lvl: 5, rival: 'none', qmv: 'move' }, store.get('prefs', {}));
  const QP_WAIT = 45000; // quick play: seconds to wait for random players before bots fill in
  function savePrefs() { store.set('prefs', prefs); }

  // ------------------------------------------------------------ net
  const Net = { room: null, me: 'me', lobbyPeers: [], game: null, gamePeers: [], hostSeenAt: 0, offset: 0, connected: false };
  async function netInit() {
    try {
      const room = root.GTRoom ? await root.GTRoom() : null;
      if (!room) return;
      Net.room = room;
      room.onPeers(ch => { Net.lobbyPeers = ch.peers; const me = ch.peers.find(p => p.sameTab); if (me) Net.me = me.peer; renderOpenRooms(); }, () => { Net.room = null; renderOpenRooms(); });
      room.onConnection(c => { Net.connected = c; renderOpenRooms(); });
      room.presence({ nick: nick() }).catch(() => { });
      renderOpenRooms();
    } catch (e) { Net.room = null; }
  }
  function nick() { return (prefs.nick || 'Gracz').slice(0, 16); }
  function lobbyAnnounce() {
    if (!Net.room) return;
    const S = G.S;
    const host = S && S.mode === 'team' && G.isHost && !G.local && S.ph !== 'end' ? { code: S.code, size: S.size, n: S.pl.filter(p => !p.b).length, max: S.size * 2, ph: S.ph, mv: S.mv, pub: !!S.pub } : null;
    Net.room.presence({ nick: nick(), host }).catch(() => { });
  }

  // ------------------------------------------------------------ game state
  const G = { S: null, isHost: false, local: true, loadedSeed: null, myPin: null, guessed: false, botDue: {}, lastShownResult: -1, hostTimer: 0, map: null, bigMap: null, endShown: false };
  function now() { return Date.now(); }
  function hostNow() { return G.isHost ? now() : now() - Net.offset; }
  function newCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function newSeed() { return (Math.random() * 4294967295) >>> 0; }
  function freshState(opts) {
    return { v: 1, pub: !!opts.pub, qs: opts.pub ? now() + QP_WAIT : 0, code: opts.code || newCode(), mode: opts.mode, size: opts.size || 1, mv: opts.mv, tl: opts.tl, lvl: opts.lvl, host: Net.me, ph: 'lobby', pl: [], hp: [HP, HP], r: 0, seed: 0, rs: 0, dl: 0, now: now(), g: {}, res: null, hist: [], tot: {}, win: null, nextAt: 0 };
  }
  function me() { return G.S && G.S.pl.find(p => p.id === Net.me); }
  function teamOf(id) { const p = G.S.pl.find(q => q.id === id); return p ? p.t : 0; }

  // ------------------------------------------------------------ host logic
  function publish() {
    const S = G.S; S.v++; S.now = now();
    if (!G.local && G.isHost && Net.game) {
      const json = JSON.stringify(S);
      if (json.length > 3900) { S.hist = S.hist.slice(-2); }
      Net.game.presence({ S, nick: nick() }).catch(() => { });
      lobbyAnnounce();
    }
    apply(S);
  }
  function hostStart() {
    const S = G.S; S.hp = [HP, HP]; S.hist = []; S.tot = {}; S.win = null; newRound(1);
  }
  function prefetch() { if (!G.nextLoc) G.nextLoc = GTStreet.find().catch(() => null); }
  async function newRound(r) {
    if (G.finding || now() < (G.retryAt || 0)) return; G.finding = true; searching(true);
    let loc = null;
    try { loc = G.nextLoc ? await G.nextLoc : null; G.nextLoc = null; if (!loc) loc = await GTStreet.find(); }
    catch (e) { loc = null; }
    G.finding = false; searching(false);
    if (!G.S) return;
    if (!loc) { G.retryAt = now() + 5000; toast('Nie udało się znaleźć panoramy. Sprawdź klucz Google Maps i połączenie.'); return; }
    const S = G.S; S.r = r; S.ph = 'round'; S.loc = loc; S.seed = loc.seed; S.rs = now(); S.dl = S.tl ? S.rs + S.tl * 1000 : 0; S.g = {}; S.res = null;
    G.botDue = {};
    for (const p of S.pl) if (p.b) { let due = S.rs + Bots.delay(p.b, S.seed ^ GT.hashStr(p.id)); if (S.dl) due = Math.min(due, S.dl - 1500); G.botDue[p.id] = due; }
    publish();
  }
  function multiplier(r) { return r <= 3 ? 1 : 1 + (r - 3) * 0.5; }
  function registerGuess(id, la, lo) {
    const S = G.S; if (S.ph !== 'round' || S.g[id]) return false;
    const loc = S.loc; const km = GT.haversine(loc.lat, loc.lon, la, lo);
    S.g[id] = [+la.toFixed(4), +lo.toFixed(4), GT.score(km)];
    const humans = S.pl.length;
    if (S.mode === 'team' && humans > 1 && Object.keys(S.g).length === 1) { const t = now() + AFTER_FIRST; if (!S.dl || S.dl > t) S.dl = t; }
    return true;
  }
  function hostTick() {
    const S = G.S; if (!S || !G.isHost) return;
    let changed = false; const t = now();
    if (S.ph === 'lobby' && !G.local) {
      changed = syncLobbyPlayers() || changed;
      if (S.pub) {
        const humans = S.pl.filter(p => !p.b).length;
        // two people searching at once: the lone host moves into the other open room
        if (humans === 1 && t > (G.mergeAt || 0)) {
          G.mergeAt = t + 2000;
          const other = openRooms(S.size, S.mv).find(r => r.code !== S.code && (r.n > 1 || r.code < S.code));
          if (other) { joinRoom(other.code); return; }
        }
        if (humans >= S.size * 2 || t >= S.qs) { fillBots(true); hostStart(); return; }
      }
    }
    if (S.ph === 'round') {
      // human guesses from presence
      if (!G.local) for (const p of Net.gamePeers) { const gs = p.presence && p.presence.guess; if (gs && gs.r === S.r && gs.s === S.seed && S.pl.find(q => q.id === p.peer)) changed = registerGuess(p.peer, +gs.la, +gs.lo) || changed; }
      // solo: once you have guessed, the bot rival answers straight away
      if (S.mode === 'solo' && S.pl.every(p => p.b || S.g[p.id])) for (const id in G.botDue) G.botDue[id] = Math.min(G.botDue[id], t);
      // bot guesses
      for (const id in G.botDue) if (t >= G.botDue[id] && !S.g[id]) { const b = S.pl.find(p => p.id === id); const loc = S.loc; const [la, lo] = Bots.guess(b.b, loc, S.seed ^ GT.hashStr(id) ^ 0x777); changed = registerGuess(id, la, lo) || changed; }
      const allIn = S.pl.every(p => S.g[p.id] || (!p.b && !present(p.id)));
      if (allIn || (S.dl && t >= S.dl)) { finishRound(); return; }
    }
    if (S.ph === 'result' && t >= S.nextAt && !G.finding) { nextOrEnd(); return; }
    if (changed) publish();
  }
  function present(id) { if (G.local) return id === Net.me; return Net.gamePeers.some(p => p.peer === id); }
  function finishRound() {
    const S = G.S; const loc = S.loc; prefetch();
    if (S.mode === 'team') {
      const best = [null, null];
      for (const p of S.pl) { const g = S.g[p.id]; const sc = g ? g[2] : 0; if (!best[p.t] || sc > best[p.t][1]) best[p.t] = [p.id, sc]; }
      const a = best[0] ? best[0][1] : 0, b = best[1] ? best[1][1] : 0, mult = multiplier(S.r);
      const dmg = Math.round(Math.abs(a - b) * mult), lose = a === b ? -1 : a > b ? 1 : 0;
      if (lose >= 0) S.hp[lose] = Math.max(0, S.hp[lose] - dmg);
      S.res = { r: S.r, best, dmg, lose, mult };
      S.hist.push([S.r, loc.cc, lose, dmg]); if (S.hist.length > 8) S.hist.shift();
    } else {
      for (const p of S.pl) { const g = S.g[p.id]; S.tot[p.id] = (S.tot[p.id] || 0) + (g ? g[2] : 0); }
      S.res = { r: S.r };
      const mine = S.g[Net.me]; S.hist.push([S.r, loc.cc, mine ? mine[2] : 0]);
    }
    S.ph = 'result'; S.nextAt = now() + RESULT_MS + (S.mode === 'solo' ? 600000 : 0);
    publish();
  }
  function nextOrEnd() {
    const S = G.S;
    const over = S.mode === 'team' ? (S.hp[0] <= 0 || S.hp[1] <= 0 || S.r >= 30) : S.r >= SOLO_ROUNDS;
    if (over) { S.ph = 'end'; S.win = S.mode === 'team' ? (S.hp[0] === S.hp[1] ? -1 : S.hp[0] > S.hp[1] ? 0 : 1) : null; publish(); return; }
    newRound(S.r + 1);
  }
  function syncLobbyPlayers() {
    const S = G.S; let changed = false;
    const humans = Net.gamePeers.filter(p => p.kind === 'viewer');
    // drop humans that left
    const before = S.pl.length; S.pl = S.pl.filter(p => p.b || humans.some(h => h.peer === p.id)); if (S.pl.length !== before) changed = true;
    for (const h of humans) {
      const pr = h.presence || {}; let p = S.pl.find(q => q.id === h.peer);
      const want = pr.want === 1 ? 1 : pr.want === 0 ? 0 : null;
      const cnt = t => S.pl.filter(q => q.t === t && q.id !== h.peer).length;
      if (!p) {
        let t = want !== null ? want : cnt(0) <= cnt(1) ? 0 : 1;
        if (cnt(t) >= S.size) { const bot = S.pl.find(q => q.t === t && q.b); if (bot) S.pl.splice(S.pl.indexOf(bot), 1); else t = 1 - t; }
        if (cnt(t) >= S.size) { const bot = S.pl.find(q => q.t === t && q.b); if (bot) S.pl.splice(S.pl.indexOf(bot), 1); else continue; }
        S.pl.push({ id: h.peer, nk: String(pr.nick || 'Gracz').slice(0, 16), t, b: 0 }); changed = true;
      } else {
        const nk = String(pr.nick || p.nk).slice(0, 16); if (nk !== p.nk) { p.nk = nk; changed = true; }
        if (want !== null && want !== p.t) {
          if (cnt(want) < S.size) { p.t = want; changed = true; }
          else { const bot = S.pl.find(q => q.t === want && q.b); if (bot) { bot.t = p.t; p.t = want; changed = true; } }
        }
      }
    }
    return changed;
  }
  function fillBots(silent) {
    const S = G.S; let i = 0; const used = new Set(S.pl.map(p => p.nk));
    for (const t of [0, 1]) while (S.pl.filter(p => p.t === t).length < S.size) {
      let nm; do { nm = Bots.NAMES[(Math.random() * Bots.NAMES.length) | 0]; } while (used.has(nm) && used.size < Bots.NAMES.length); used.add(nm);
      S.pl.push({ id: 'b' + (Date.now() % 100000) + '_' + (i++), nk: nm, t, b: S.lvl });
    }
    if (!silent) publish();
  }
  function clearBots() { G.S.pl = G.S.pl.filter(p => !p.b); publish(); }

  // ------------------------------------------------------------ start / join
  function startSolo() {
    leaveGame();
    G.local = true; G.isHost = true; Net.me = Net.room ? Net.me : 'me';
    G.S = freshState({ mode: 'solo', mv: prefs.mv, tl: prefs.tl, lvl: prefs.lvl });
    G.S.pl = [{ id: Net.me, nk: nick(), t: 0, b: 0 }];
    if (prefs.rival === 'bot') G.S.pl.push({ id: 'b_rival', nk: Bots.NAMES[(Math.random() * Bots.NAMES.length) | 0], t: 1, b: prefs.lvl });
    startHostLoop(); hostStart();
  }
  function openRooms(size, mv) {
    return Net.lobbyPeers.filter(p => !p.sameTab && p.presence && p.presence.host).map(p => p.presence.host)
      .filter(h => h.pub && h.ph === 'lobby' && h.size === size && h.mv === mv && h.n < h.max).sort((a, b) => b.n - a.n);
  }
  function quickPlay(size) {
    if (!Net.room) { toast('Szybka gra wymaga połączenia z Firebase (config.js).'); return; }
    readQuick();
    const room = openRooms(size, prefs.qmv)[0];
    if (room) { joinRoom(room.code); return; }
    createTeamGame(true, { pub: true, size, mv: prefs.qmv });
  }
  function createTeamGame(withFriends, o = {}) {
    leaveGame();
    G.S = freshState({ mode: 'team', size: o.size || prefs.size, mv: o.mv || prefs.mv, tl: prefs.tl, lvl: prefs.lvl, pub: !!o.pub });
    G.isHost = true; G.local = !(withFriends && Net.room);
    if (G.local) Net.me = Net.room ? Net.me : 'me';
    G.S.host = Net.me;
    G.S.pl = [{ id: Net.me, nk: nick(), t: 0, b: 0 }];
    startHostLoop();
    if (!G.local) joinRoom(G.S.code, true).then(() => publish()); else { fillBots(); }
  }
  async function joinRoom(code, asHost) {
    code = String(code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    if (!code || !Net.room) { toast(Net.room ? 'Wpisz kod pokoju.' : 'Gra ze znajomymi nie jest jeszcze skonfigurowana (Firebase w config.js).'); return; }
    if (!asHost) { leaveGame(); G.isHost = false; G.local = false; G.S = null; showScreen('lobby'); renderLobbyWaiting(code); }
    try {
      const gr = await Net.room.join('g-' + code);
      Net.game = gr; Net.gameCode = code;
      gr.presence({ nick: nick(), want: null, guess: null }).catch(() => { });
      startHostLoop();
      gr.onPeers(ch => { Net.gamePeers = ch.peers; const meP = ch.peers.find(p => p.sameTab); if (meP) Net.me = meP.peer; onGamePeers(); }, e => { toast('Połączenie z pokojem przerwane.'); });
    } catch (e) { toast('Nie udało się dołączyć do pokoju (' + (e && e.code || 'błąd') + ').'); showScreen('home'); }
  }
  function onGamePeers() {
    if (G.isHost) { if (G.S && G.S.host !== Net.me && Net.me !== 'me') { G.S.host = Net.me; } return; }
    // find authoritative state
    let best = null, bestPeer = null;
    for (const p of Net.gamePeers) { const S = p.presence && p.presence.S; if (S && S.host === p.peer && (!best || S.v > best.v || (S.v === best.v && p.peer < bestPeer.peer))) { best = S; bestPeer = p; } }
    if (best) {
      Net.hostSeenAt = now();
      if (!G.S || best.v !== G.S.v || best.seed !== G.S.seed) { Net.offset = (bestPeer.updatedAt || now()) - best.now; G.S = JSON.parse(JSON.stringify(best)); apply(G.S); }
    } else if (G.S && G.S.ph !== 'lobby' || (G.S && now() - Net.hostSeenAt > 4000)) maybeTakeOver();
  }
  function maybeTakeOver() {
    const S = G.S; if (!S || G.isHost || !Net.game) return;
    if (Net.gamePeers.some(p => p.peer === S.host)) { Net.hostSeenAt = now(); return; }
    if (now() - Net.hostSeenAt < 4000) return;
    const humans = S.pl.filter(p => !p.b && Net.gamePeers.some(q => q.peer === p.id)).map(p => p.id).sort();
    if (humans[0] === Net.me) {
      G.isHost = true; S.host = Net.me; G.botDue = {};
      if (S.ph === 'round') for (const p of S.pl) if (p.b && !S.g[p.id]) G.botDue[p.id] = now() + Bots.delay(p.b, S.seed ^ GT.hashStr(p.id)) / 2;
      startHostLoop(); toast('Gospodarz wyszedł. Prowadzisz teraz grę.'); publish();
    }
  }
  function startHostLoop() { clearInterval(G.hostTimer); G.hostTimer = setInterval(() => { if (G.isHost) hostTick(); else maybeTakeOver(); }, 250); }
  function leaveGame() {
    clearInterval(G.hostTimer);
    if (Net.game) { Net.game.leave().catch(() => { }); Net.game = null; Net.gamePeers = []; }
    G.S = null; G.isHost = false; G.loadedSeed = null; G.lastShownResult = -1; G.endShown = false;
    lobbyAnnounce();
  }

  // ------------------------------------------------------------ player actions
  function placePin(la, lo) {
    const S = G.S; if (!S || S.ph !== 'round' || G.guessed) return;
    G.myPin = [la, lo]; G.map.setPins([{ lat: la, lon: lo, color: myColor(), label: nick() }]);
    $('#guessBtn').disabled = false; $('#guessBtn').textContent = 'Zgadnij';
  }
  function myColor() { const p = me(); return G.S && G.S.mode === 'team' && p ? TEAM[p.t].col : '#f5c84c'; }
  function submitGuess() {
    const S = G.S; if (!S || S.ph !== 'round' || G.guessed || !G.myPin) return;
    G.guessed = true; $('#guessBtn').disabled = true; $('#guessBtn').textContent = 'Czekamy na resztę…';
    if (G.isHost) { if (registerGuess(Net.me, G.myPin[0], G.myPin[1])) publish(); }
    else if (Net.game) Net.game.presence({ guess: { r: S.r, s: S.seed, la: +G.myPin[0].toFixed(4), lo: +G.myPin[1].toFixed(4) } }).catch(() => { });
    updateHud();
  }
  function setWant(t) { if (Net.game) Net.game.presence({ want: t }).catch(() => { }); if (G.isHost && G.S) { const p = me(); if (p && p.t !== t) { const other = G.S.pl.filter(q => q.t === t); if (other.length < G.S.size) p.t = t; else { const bot = other.find(q => q.b); if (bot) { bot.t = p.t; p.t = t; } } publish(); } } }

  // ------------------------------------------------------------ rendering
  function showScreen(id) { $$('.screen').forEach(s => s.hidden = s.id !== id); document.body.classList.toggle('ingame', id === 'game'); if (id === 'game') { GTStreet.kick(); } }
  function searching(on) { const el = $('#searching'); if (el) el.hidden = !on; }
  function apply(S) {
    if (!S) return;
    if (S.ph === 'lobby') { showScreen('lobby'); renderLobby(); return; }
    if (S.loc && S.seed !== G.loadedSeed) {
      G.loadedSeed = S.seed; G.guessed = false; G.myPin = null;
      const loc = S.loc;
      showScreen('game');
      GTStreet.show(loc, S.mv);
      setMoveUi(S.mv);
      G.map.setPins([]); G.map.setLines([]); G.map.reset();
      $('#guessBtn').disabled = true; $('#guessBtn').textContent = 'Postaw pinezkę na mapie';
      $('#resultOv').hidden = true; $('#endOv').hidden = true;
      G.endShown = false;
    }
    if (S.ph === 'round') { showScreen('game'); $('#resultOv').hidden = true; if (S.g[Net.me]) G.guessed = true; }
    if (S.ph === 'result' && G.lastShownResult !== S.r * 1e10 + S.seed) { G.lastShownResult = S.r * 1e10 + S.seed; showResult(); }
    if (S.ph === 'end' && !G.endShown) { G.endShown = true; if ($('#resultOv').hidden) showResult(); setTimeout(showEnd, S.mode === 'solo' ? 0 : 2500); }
    updateHud();
  }
  function setMoveUi(mv) {
    $('#moveCtl').hidden = mv !== 'move';
    $('#zoomCtl').hidden = mv === 'nmpz';
    $('#mvBadge').textContent = MV_LABEL[mv];
  }
  function fmtTime(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function updateHud() {
    const S = G.S; if (!S) return;
    const hud = $('#hud');
    if (S.mode === 'team') {
      hud.className = 'hud team';
      const bars = [0, 1].map(t => {
        const pl = S.pl.filter(p => p.t === t);
        const dots = pl.map(p => `<span class="pdot ${S.g[p.id] ? 'in' : ''} ${p.id === Net.me ? 'me' : ''}" title="${esc(p.nk)}">${esc(p.nk.slice(0, 1))}</span>`).join('');
        return `<div class="tbar t${t}"><div class="tname">${TEAM[t].name}</div><div class="hpwrap"><div class="hp" style="width:${S.hp[t] / HP * 100}%"></div><span class="hpnum">${S.hp[t]}</span></div><div class="dots">${dots}</div></div>`;
      });
      hud.innerHTML = `${bars[0]}<div class="mid"><div class="rnd">Runda ${S.r}</div><div class="mult">×${multiplier(S.r).toFixed(1)}</div><div class="timer" id="timer"></div></div>${bars[1]}`;
    } else {
      hud.className = 'hud solo';
      const tot = S.tot[Net.me] || 0; const bot = S.pl.find(p => p.b);
      hud.innerHTML = `<div class="stat"><span>Runda</span><b>${S.r} / ${SOLO_ROUNDS}</b></div><div class="stat"><span>Ty</span><b>${tot.toLocaleString('pl-PL')}</b></div>${bot ? `<div class="stat"><span>${esc(bot.nk)} · bot ${bot.b}</span><b>${(S.tot[bot.id] || 0).toLocaleString('pl-PL')}${S.g[bot.id] ? ' ✓' : ''}</b></div>` : ''}<div class="timer" id="timer"></div>`;
    }
    tickTimer();
  }
  function tickTimer() {
    const qt = $('#qpTimer'); if (qt && G.S && G.S.pub && G.S.ph === 'lobby') qt.textContent = fmtTime(G.S.qs - hostNow());
    const S = G.S, el = $('#timer'); if (!el || !S) return;
    if (S.ph === 'round' && S.dl) { const left = S.dl - hostNow(); el.textContent = fmtTime(left); el.classList.toggle('urgent', left < 10500); el.hidden = false; }
    else el.hidden = true;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function countryName(cc) { const c = W.byCode[cc]; return c ? c.name : cc; }

  function showResult() {
    const S = G.S; const loc = S.loc; const ov = $('#resultOv'); ov.hidden = false;
    if (!G.bigMap) G.bigMap = new GTMap($('#resultMap'), {});
    const pins = [{ kind: 'target', lat: loc.lat, lon: loc.lon }], lines = [], pts = [[loc.lat, loc.lon]];
    for (const p of S.pl) { const g = S.g[p.id]; if (!g) continue; const col = S.mode === 'team' ? TEAM[p.t].col : p.b ? '#3e8bff' : '#f5c84c'; pins.push({ lat: g[0], lon: g[1], color: col, label: p.nk }); lines.push({ a: [loc.lat, loc.lon], b: [g[0], g[1]], color: col }); pts.push([g[0], g[1]]); }
    G.bigMap.setPins(pins); G.bigMap.setLines(lines); requestAnimationFrame(() => { G.bigMap.resize(); G.bigMap.fit(pts, 70); });
    const where = `<div class="where"><span class="flagchip">${loc.cc}</span><div><b>${esc(countryName(loc.cc))}</b><small>okolice: ${esc(loc.town)}</small></div></div>`;
    let body = '';
    if (S.mode === 'team') {
      const R = S.res;
      const rows = S.pl.slice().sort((a, b) => (S.g[b.id] ? S.g[b.id][2] : -1) - (S.g[a.id] ? S.g[a.id][2] : -1)).map(p => {
        const g = S.g[p.id]; const km = g ? GT.haversine(loc.lat, loc.lon, g[0], g[1]) : null;
        const best = R && R.best[p.t] && R.best[p.t][0] === p.id;
        return `<li class="t${p.t} ${best ? 'best' : ''}"><span class="nm">${esc(p.nk)}${p.b ? ` <em>bot ${p.b}</em>` : ''}${p.id === Net.me ? ' <em>ty</em>' : ''}</span><span class="km">${km === null ? 'brak' : GT.fmtKm(km)}</span><span class="pts">${g ? g[2].toLocaleString('pl-PL') : 0}</span></li>`;
      }).join('');
      const dmgTxt = !R ? '' : R.lose < 0 ? 'Remis w rundzie. Nikt nie traci punktów życia.' : `${TEAM[R.lose].name} tracą <b>${R.dmg.toLocaleString('pl-PL')}</b> pkt życia${R.mult > 1 ? ` (mnożnik ×${R.mult.toFixed(1)})` : ''}.`;
      body = `${where}<p class="dmg">${dmgTxt}</p><div class="hpmini">${[0, 1].map(t => `<div class="t${t}"><span>${TEAM[t].name}</span><div class="hpwrap"><div class="hp" style="width:${S.hp[t] / HP * 100}%"></div><span class="hpnum">${S.hp[t]}</span></div></div>`).join('')}</div><ol class="rows">${rows}</ol>`;
    } else {
      const g = S.g[Net.me]; const km = g ? GT.haversine(loc.lat, loc.lon, g[0], g[1]) : null;
      body = `${where}<div class="soloRes"><div><span>Odległość</span><b>${km === null ? 'brak' : GT.fmtKm(km)}</b></div><div><span>Punkty</span><b>${g ? g[2].toLocaleString('pl-PL') : 0}</b><i style="width:${(g ? g[2] : 0) / 50}%"></i></div></div>`;
      const bot = S.pl.find(p => p.b);
      if (bot) { const bg = S.g[bot.id]; const bkm = bg ? GT.haversine(loc.lat, loc.lon, bg[0], bg[1]) : null; body += `<ol class="rows"><li class="t1"><span class="nm">${esc(bot.nk)} <em>bot ${bot.b} · ${Bots.LEVELS[bot.b - 1].name}</em></span><span class="km">${bkm === null ? 'brak' : GT.fmtKm(bkm)}</span><span class="pts">${bg ? bg[2].toLocaleString('pl-PL') : 0}</span></li></ol>`; }
    }
    $('#resultBody').innerHTML = body;
    const btn = $('#nextBtn');
    btn.hidden = !(G.isHost) || S.ph === 'end';
    btn.textContent = S.mode === 'solo' && S.r >= SOLO_ROUNDS ? 'Pokaż wynik' : 'Następna runda';
    $('#nextInfo').textContent = S.ph === 'end' ? '' : G.isHost ? (S.mode === 'solo' ? '' : 'Kolejna runda za chwilę…') : 'Kolejna runda za chwilę…';
  }
  function showEnd() {
    const S = G.S; if (!S) return; const ov = $('#endOv'); ov.hidden = false;
    let html = '';
    if (S.mode === 'team') {
      const my = me(); const won = my && S.win === my.t;
      html = `<h2 class="${S.win >= 0 ? 't' + S.win : ''}">${S.win < 0 ? 'Remis' : `Wygrywają ${TEAM[S.win].name}`}</h2><p>${my ? (won ? 'Twoja drużyna wygrała.' : S.win < 0 ? 'Obie drużyny skończyły równo.' : 'Tym razem przegrana. Rewanż?') : ''}</p>
        <ul class="hist">${S.hist.map(h => `<li><span>Runda ${h[0]}</span><span>${esc(countryName(h[1]))}</span><span>${h[2] < 0 ? 'remis' : '−' + h[3].toLocaleString('pl-PL') + ' ' + TEAM[h[2]].name.toLowerCase()}</span></li>`).join('')}</ul>`;
    } else {
      const tot = S.tot[Net.me] || 0; const bot = S.pl.find(p => p.b);
      const vs = bot ? (() => { const bt = S.tot[bot.id] || 0; return `<p><b>${tot > bt ? 'Wygrałeś z botem' : tot < bt ? 'Bot wygrał' : 'Remis z botem'}</b>: ${esc(bot.nk)} (poziom ${bot.b}) zdobył ${bt.toLocaleString('pl-PL')} pkt.</p>`; })() : '';
      html = `<h2>${tot.toLocaleString('pl-PL')} <small>/ 25 000</small></h2>${vs}<p>${tot > 22000 ? 'Poziom mistrzowski.' : tot > 15000 ? 'Bardzo dobry wynik.' : tot > 8000 ? 'Nieźle. Następnym razem patrz na znaki i słupki.' : 'Spróbuj jeszcze raz: patrz na stronę ruchu, linie i pismo.'}</p>
        <ul class="hist">${S.hist.map(h => `<li><span>Runda ${h[0]}</span><span>${esc(countryName(h[1]))}</span><span>${h[2].toLocaleString('pl-PL')} pkt</span></li>`).join('')}</ul>`;
    }
    $('#endBody').innerHTML = html;
    $('#againBtn').hidden = !G.isHost;
  }

  // ------------------------------------------------------------ lobby UI
  function renderLobbyWaiting(code) { $('#lobbyCode').textContent = code.toUpperCase(); $('#lobbyTeams').innerHTML = '<p class="muted">Łączenie z pokojem…</p>'; $('#lobbyHostCtl').hidden = true; $('#lobbyInfo').textContent = ''; }
  function renderLobby() {
    const S = G.S; if (!S) return;
    $('#lobbyCode').textContent = S.code.toUpperCase();
    $('#codeRow').hidden = G.local || S.pub;
    $('#lobbyInfo').innerHTML = (S.pub ? `<b>Szybka gra</b> · szukam graczy, start za <span id="qpTimer"></span> (wolne miejsca zajmą boty)<br>` : '') + `${S.size}v${S.size} · ${MV_LABEL[S.mv]} · ${S.tl ? 'runda ' + fmtTime(S.tl * 1000) : 'bez limitu czasu'} · boty: poziom ${S.lvl} (${Bots.LEVELS[S.lvl - 1].name})`;
    $('#lobbyTeams').innerHTML = [0, 1].map(t => {
      const pl = S.pl.filter(p => p.t === t); const slots = [];
      for (let i = 0; i < S.size; i++) { const p = pl[i]; slots.push(p ? `<li class="${p.id === Net.me ? 'me' : ''}"><span class="av" style="background:${TEAM[t].col}">${esc(p.nk.slice(0, 1).toUpperCase())}</span><span>${esc(p.nk)}</span>${p.b ? `<em>bot · ${Bots.LEVELS[p.b - 1].name}</em>` : p.id === S.host ? '<em>gospodarz</em>' : ''}</li>` : `<li class="empty"><span class="av"></span><span>Wolne miejsce</span></li>`); }
      const my = me(); const canJoin = !my || my.t !== t;
      return `<div class="team t${t}"><h3>${TEAM[t].name}</h3><ul>${slots.join('')}</ul>${canJoin && (!G.local || G.isHost) ? `<button class="ghost small" data-want="${t}">Przejdź tutaj</button>` : ''}</div>`;
    }).join('<div class="vs">VS</div>');
    $$('#lobbyTeams [data-want]').forEach(b => b.onclick = () => setWant(+b.dataset.want));
    $('#lobbyHostCtl').hidden = !G.isHost;
    const full = S.pl.length === S.size * 2;
    $('#startBtn').disabled = !full; $('#startBtn').textContent = full ? 'Rozpocznij mecz' : `Brakuje ${S.size * 2 - S.pl.length} graczy`;
    $('#guestWait').hidden = G.isHost;
  }
  function renderOpenRooms() {
    const box = $('#openRooms'); if (!box) return;
    if (!Net.room) { box.innerHTML = '<p class="muted">Gra ze znajomymi zadziała po dodaniu konfiguracji Firebase w pliku config.js (instrukcja w README). Solo i mecze z botami działają już teraz.</p>'; $('#joinRow').classList.add('off'); return; }
    $('#joinRow').classList.remove('off');
    const rooms = Net.lobbyPeers.filter(p => !p.sameTab && p.presence && p.presence.host && p.presence.host.code);
    const online = Net.lobbyPeers.length;
    box.innerHTML = `<p class="muted">${online > 1 ? `Online: ${online} ${online < 5 ? 'osoby' : 'osób'}` : 'Na razie jesteś tu sam. Zaproś znajomych albo graj z botami.'}</p>` + (rooms.length ? `<ul class="rooms">${rooms.map(p => { const h = p.presence.host; return `<li><div><b>${esc(String(p.presence.nick || 'Gracz').slice(0, 16))}</b><small>${h.size}v${h.size} · ${MV_LABEL[h.mv] || ''} · ${h.n}/${h.max} ${h.ph === 'lobby' ? '' : '· w trakcie'}</small></div><button class="small" data-join="${esc(h.code)}">${h.ph === 'lobby' ? 'Dołącz' : 'Oglądaj'}</button></li>`; }).join('')}</ul>` : '');
    $$('#openRooms [data-join]').forEach(b => b.onclick = () => joinRoom(b.dataset.join));
  }

  // ------------------------------------------------------------ misc UI
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3800); }
  function renderSetup(kind) {
    $('#setupTitle').textContent = kind === 'solo' ? 'Gra solo' : 'Mecz drużynowy';
    $('#sizeRow').hidden = kind === 'solo'; $('#rivalRow').hidden = kind !== 'solo'; $('#friendsBtn').hidden = kind === 'solo';
    $('#setupGo').textContent = kind === 'solo' ? 'Graj' : 'Graj z botami';
    $('#setupGo').onclick = () => { readSetup(); if (kind === 'solo') startSolo(); else createTeamGame(false); };
    $('#friendsBtn').onclick = () => { readSetup(); if (!Net.room) { toast('Gra ze znajomymi nie jest jeszcze skonfigurowana (Firebase w config.js).'); return; } createTeamGame(true); };
    $('#friendsBtn').disabled = !Net.room;
    for (const [name, val] of [['mv', prefs.mv], ['tl', String(prefs.tl)], ['size', String(prefs.size)], ['rival', prefs.rival]]) $$(`[name="${name}"]`).forEach(r => r.checked = r.value === val);
    $('#lvl').value = prefs.lvl; lvlLabel();
    showScreen('setup');
  }
  function readSetup() {
    const v = n => { const r = $(`[name="${n}"]:checked`); return r ? r.value : null; };
    prefs.mv = v('mv') || 'move'; prefs.tl = +(v('tl') || 0); prefs.size = +(v('size') || 2); prefs.lvl = +$('#lvl').value; prefs.rival = v('rival') || 'none'; savePrefs();
  }
  function readQuick() { const r = $('[name="qmv"]:checked'); prefs.qmv = r ? r.value : 'move'; savePrefs(); }
  function lvlLabel() { const l = +$('#lvl').value; $('#lvlName').textContent = `${l}. ${Bots.LEVELS[l - 1].name}`; $('#lvlDesc').textContent = Bots.LEVELS[l - 1].desc; $('#lvl').style.setProperty('--p', ((l - 1) / 9 * 100) + '%'); }

  function initUI() {
    $('#nick').value = prefs.nick;
    $('#nick').addEventListener('input', e => { prefs.nick = e.target.value.trim().slice(0, 16); savePrefs(); if (Net.room) Net.room.presence({ nick: nick() }).catch(() => { }); if (Net.game) Net.game.presence({ nick: nick() }).catch(() => { }); });
    $('#soloCard').onclick = () => renderSetup('solo');
    $('#teamCard').onclick = () => renderSetup('team');
    $$('[name="qmv"]').forEach(r => { r.checked = r.value === prefs.qmv; r.onchange = readQuick; });
    $$('[data-qp]').forEach(b => b.onclick = () => quickPlay(+b.dataset.qp));
    $('#joinBtn').onclick = () => joinRoom($('#joinCode').value);
    $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(e.target.value); });
    $('#lvl').addEventListener('input', lvlLabel);
    $$('[data-home]').forEach(b => b.onclick = () => { leaveGame(); $('#endOv').hidden = true; $('#resultOv').hidden = true; showScreen('home'); renderOpenRooms(); });
    $('#fillBots').onclick = () => fillBots();
    $('#clearBots').onclick = () => clearBots();
    $('#startBtn').onclick = () => { if (G.isHost) hostStart(); };
    $('#copyCode').onclick = () => { const code = G.S ? G.S.code.toUpperCase() : ''; if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('Skopiowano kod ' + code), () => toast('Kod pokoju: ' + code)); else toast('Kod pokoju: ' + code); };
    $('#guessBtn').onclick = submitGuess;
    $('#nextBtn').onclick = () => { if (G.isHost && G.S && G.S.ph === 'result') nextOrEnd(); };
    $('#againBtn').onclick = () => { if (!G.isHost) return; $('#endOv').hidden = true; if (G.S.mode === 'solo') startSolo(); else { G.S.ph = 'lobby'; G.S.hp = [HP, HP]; G.S.r = 0; G.loadedSeed = null; G.endShown = false; publish(); } };
    $('#fwd').onclick = () => GTStreet.step(1); $('#back').onclick = () => GTStreet.step(-1);
    $('#toStart').onclick = () => GTStreet.resetView();
    $('#zin').onclick = () => GTStreet.zoom(0.8); $('#zout').onclick = () => GTStreet.zoom(1.25);
    $('#mapToggle').onclick = () => $('#mini').classList.toggle('open');
    $('#mapSize').onclick = () => $('#mini').classList.toggle('big');
    document.addEventListener('keydown', e => {
      if ($('#game').hidden || e.target.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') { submitGuess(); e.preventDefault(); return; }
      if (G.S && G.S.mv === 'move') return; // Street View handles its own arrow keys in move mode
      if (e.key === 'ArrowLeft' || e.key === 'a') GTStreet.rotate(8);
      if (e.key === 'ArrowRight' || e.key === 'd') GTStreet.rotate(-8);
    });
    if (!GTStreet.init($('#view'))) { $('#noKey').hidden = false; }
    GTStreet.onView(v => { $('#needle').style.transform = `rotate(${-v.heading}deg)`; });
    G.map = new GTMap($('#miniMap'), { onPick: placePin });
    setInterval(tickTimer, 200);
    showScreen('home');
    renderOpenRooms();
    netInit();
  }
  root.GTGame = { init: initUI, G, Net };
})(this);
