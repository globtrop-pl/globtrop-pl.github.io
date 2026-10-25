// Globtrop – game flow: solo (optionally vs a bot), team duels, quick play with random players, settings & sound.
(function (root) {
  const W = root.GTWorld, Bots = root.GTBots, A = root.GTAudio, I = root.GTi18n, t = I.t;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const TEAM_COL = ['#e5484d', '#3e8bff'];
  const teamName = i => t('team.' + i);
  const lvlName = l => t('lvls')[l - 1][0], lvlDesc = l => t('lvls')[l - 1][1];
  const mvName = m => t('mv.' + m);
  const HP = 6000, SOLO_ROUNDS = 5, AFTER_FIRST = 15000, RESULT_MS = 9000, QP_WAIT = 45000, COUNTDOWN = 3600, HURRY = 15000;
  const makeMap = (el, o) => (root.google && google.maps && google.maps.Map && root.GTGMap) ? new GTGMap(el, o) : new GTMap(el, o);

  // ------------------------------------------------------------ local prefs
  const store = { get(k, d) { try { const v = localStorage.getItem('globtrop.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('globtrop.' + k, JSON.stringify(v)); } catch (e) { } } };
  const prefs = Object.assign({ nick: '', mv: 'move', tl: 0, size: 2, lvl: 5, rival: 'none', qmv: 'move', lang: I.lang, music: true, musicVol: 0.45, sfx: true, sfxVol: 0.7, station: 'lofi' }, store.get('prefs', {}));
  function savePrefs() { store.set('prefs', prefs); }

  // ------------------------------------------------------------ net
  const Net = { room: null, me: 'me', lobbyPeers: [], game: null, gamePeers: [], hostSeenAt: 0, offset: 0, connected: false, ready: false };
  async function netInit() {
    try {
      const room = root.GTRoom ? await root.GTRoom() : null;
      Net.ready = true;
      if (!room) { renderOpenRooms(); if (G.pendingQuick) { G.pendingQuick = null; hideMatchmaking(); toast(t('noFriends')); } return; }
      Net.room = room;
      room.onPeers(ch => { Net.lobbyPeers = ch.peers; const me = ch.peers.find(p => p.sameTab); if (me) Net.me = me.peer; renderOpenRooms(); }, () => { Net.room = null; renderOpenRooms(); });
      room.onConnection(c => { Net.connected = c; renderOpenRooms(); });
      room.presence({ nick: nick() }).catch(() => { });
      renderOpenRooms();
      if (G.pendingQuick) { const s = G.pendingQuick; G.pendingQuick = null; setTimeout(() => quickPlay(s), 1200); }
    } catch (e) { Net.room = null; Net.ready = true; renderOpenRooms(); }
  }
  function nick() { return (prefs.nick || (I.lang === 'pl' ? 'Gracz' : 'Player')).slice(0, 16); }
  function lobbyAnnounce() {
    if (!Net.room) return;
    const S = G.S;
    const host = S && S.mode === 'team' && G.isHost && !G.local && S.ph !== 'end' ? { code: S.code, size: S.size, n: S.pl.filter(p => !p.b).length, max: S.size * 2, ph: S.ph, mv: S.mv, pub: !!S.pub } : null;
    Net.room.presence({ nick: nick(), host }).catch(() => { });
  }

  // ------------------------------------------------------------ game state
  const G = { S: null, isHost: false, local: true, loadedSeed: null, myPin: null, guessed: false, botDue: {}, lastShownResult: -1, hostTimer: 0, map: null, bigMap: null, endShown: false, lastHumans: 0, lastTick: -1 };
  function now() { return Date.now(); }
  function hostNow() { return G.isHost ? now() : now() - Net.offset; }
  function newCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function freshState(opts) {
    return { v: 1, pub: !!opts.pub, qs: opts.pub ? now() + QP_WAIT : 0, code: opts.code || newCode(), mode: opts.mode, size: opts.size || 1, mv: opts.mv, tl: opts.tl, lvl: opts.lvl, host: Net.me, ph: 'lobby', pl: [], hp: [HP, HP], r: 0, seed: 0, rs: 0, dl: 0, now: now(), g: {}, res: null, hist: [], tot: {}, win: null, nextAt: 0 };
  }
  function me() { return G.S && G.S.pl.find(p => p.id === Net.me); }

  // ------------------------------------------------------------ host logic
  function publish() {
    const S = G.S; S.v++; S.now = now();
    if (!G.local && G.isHost && Net.game) {
      if (JSON.stringify(S).length > 3900) S.hist = S.hist.slice(-2);
      Net.game.presence({ S, nick: nick() }).catch(() => { });
      lobbyAnnounce();
    }
    apply(S);
  }
  function hostStart() { const S = G.S; S.hp = [HP, HP]; S.hist = []; S.tot = {}; S.win = null; newRound(1); }
  function prefetch() { if (!G.nextLoc) G.nextLoc = GTStreet.find().catch(() => null); }
  async function newRound(r) {
    if (G.finding || now() < (G.retryAt || 0)) return; G.finding = true; searching(true);
    let loc = null;
    try { loc = G.nextLoc ? await G.nextLoc : null; G.nextLoc = null; if (!loc) loc = await GTStreet.find(); }
    catch (e) { loc = null; }
    G.finding = false; searching(false);
    if (!G.S) return;
    if (!loc) { G.retryAt = now() + 5000; toast(t('noPano')); return; }
    const S = G.S; S.r = r; S.ph = 'round'; S.loc = loc; S.seed = loc.seed; S.rs = now() + COUNTDOWN; S.dl = S.tl ? S.rs + S.tl * 1000 : 0; S.g = {}; S.res = null;
    G.botDue = {};
    for (const p of S.pl) if (p.b) { let due = S.rs + Bots.delay(p.b, S.seed ^ GT.hashStr(p.id)); if (S.dl) due = Math.min(due, S.dl - 1500); G.botDue[p.id] = due; }
    publish();
  }
  function multiplier(r) { return r <= 3 ? 1 : 1 + (r - 3) * 0.5; }
  function registerGuess(id, la, lo) {
    const S = G.S; if (S.ph !== 'round' || S.g[id] || now() < S.rs - 300) return false;
    const loc = S.loc; const km = GT.haversine(loc.lat, loc.lon, la, lo);
    S.g[id] = [+la.toFixed(4), +lo.toFixed(4), GT.score(km)];
    if (S.mode === 'team' && S.pl.length > 1 && Object.keys(S.g).length === 1) { const tt = Math.max(now(), S.rs) + AFTER_FIRST; if (!S.dl || S.dl > tt) S.dl = tt; }
    return true;
  }
  function openRooms(size, mv) {
    return Net.lobbyPeers.filter(p => !p.sameTab && p.presence && p.presence.host).map(p => p.presence.host)
      .filter(h => h.pub && h.ph === 'lobby' && h.size === size && h.mv === mv && h.n < h.max).sort((a, b) => b.n - a.n);
  }
  function hostTick() {
    const S = G.S; if (!S || !G.isHost) return;
    let changed = false; const tt = now();
    if (S.ph === 'lobby' && !G.local) {
      changed = syncLobbyPlayers() || changed;
      if (S.pub) {
        const humans = S.pl.filter(p => !p.b).length;
        if (humans === 1 && tt > (G.mergeAt || 0)) { // two people searching at once: the lone host moves into the other open room
          G.mergeAt = tt + 2000;
          const other = openRooms(S.size, S.mv).find(r => r.code !== S.code && (r.n > 1 || r.code < S.code));
          if (other) { joinRoom(other.code, false, true); return; }
        }
        if (!G.finding && (humans >= S.size * 2 || tt >= S.qs)) { fillBots(true); hostStart(); return; }
      }
    }
    if (S.ph === 'round') {
      if (!G.local) for (const p of Net.gamePeers) { const gs = p.presence && p.presence.guess; if (gs && gs.r === S.r && gs.s === S.seed && S.pl.find(q => q.id === p.peer)) changed = registerGuess(p.peer, +gs.la, +gs.lo) || changed; }
      if (S.mode === 'solo' && S.pl.every(p => p.b || S.g[p.id])) for (const id in G.botDue) G.botDue[id] = Math.min(G.botDue[id], tt);
      for (const id in G.botDue) if (tt >= G.botDue[id] && !S.g[id]) { const b = S.pl.find(p => p.id === id); const [la, lo] = Bots.guess(b.b, S.loc, S.seed ^ GT.hashStr(id) ^ 0x777); changed = registerGuess(id, la, lo) || changed; }
      const allIn = S.pl.every(p => S.g[p.id] || (!p.b && !present(p.id)));
      if (allIn || (S.dl && tt >= S.dl)) { finishRound(); return; }
    }
    if (S.ph === 'result' && tt >= S.nextAt && !G.finding) { nextOrEnd(); return; }
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
    const before = S.pl.length; S.pl = S.pl.filter(p => p.b || humans.some(h => h.peer === p.id)); if (S.pl.length !== before) changed = true;
    for (const h of humans) {
      const pr = h.presence || {}; let p = S.pl.find(q => q.id === h.peer);
      const want = pr.want === 1 ? 1 : pr.want === 0 ? 0 : null;
      const cnt = tm => S.pl.filter(q => q.t === tm && q.id !== h.peer).length;
      if (!p) {
        let tm = want !== null ? want : cnt(0) <= cnt(1) ? 0 : 1;
        if (cnt(tm) >= S.size) { const bot = S.pl.find(q => q.t === tm && q.b); if (bot) S.pl.splice(S.pl.indexOf(bot), 1); else tm = 1 - tm; }
        if (cnt(tm) >= S.size) { const bot = S.pl.find(q => q.t === tm && q.b); if (bot) S.pl.splice(S.pl.indexOf(bot), 1); else continue; }
        S.pl.push({ id: h.peer, nk: String(pr.nick || 'Gracz').slice(0, 16), t: tm, b: 0 }); changed = true;
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
    for (const tm of [0, 1]) while (S.pl.filter(p => p.t === tm).length < S.size) {
      let nm; do { nm = Bots.NAMES[(Math.random() * Bots.NAMES.length) | 0]; } while (used.has(nm) && used.size < Bots.NAMES.length); used.add(nm);
      S.pl.push({ id: 'b' + (Date.now() % 100000) + '_' + (i++), nk: nm, t: tm, b: S.lvl });
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
  function quickPlay(size) {
    readQuick();
    prefs.size = size; savePrefs();
    showMatchmaking(size, prefs.qmv);
    if (!Net.ready) { G.pendingQuick = size; return; }
    if (!Net.room) { hideMatchmaking(); toast(t('noFriends')); return; }
    const room = openRooms(size, prefs.qmv)[0];
    if (room) { joinRoom(room.code, false, true); return; }
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
    if (!G.local) joinRoom(G.S.code, true).then(() => publish()); else fillBots();
  }
  async function joinRoom(code, asHost, quick) {
    code = String(code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    if (!code || !Net.room) { toast(Net.room ? t('enterCode') : t('noFriends')); return; }
    if (!asHost) { leaveGame(); G.isHost = false; G.local = false; G.S = null; if (!quick) { hideMatchmaking(); showScreen('lobby'); renderLobbyWaiting(code); } }
    try {
      const gr = await Net.room.join('g-' + code);
      Net.game = gr; Net.gameCode = code;
      gr.presence({ nick: nick(), want: null, guess: null }).catch(() => { });
      startHostLoop();
      gr.onPeers(ch => { Net.gamePeers = ch.peers; const meP = ch.peers.find(p => p.sameTab); if (meP) Net.me = meP.peer; onGamePeers(); }, () => toast(t('connLost')));
    } catch (e) { toast(t('joinFail', (e && e.code) || 'error')); hideMatchmaking(); showScreen('home'); }
  }
  function onGamePeers() {
    if (G.isHost) { if (G.S && G.S.host !== Net.me && Net.me !== 'me') G.S.host = Net.me; return; }
    let best = null, bestPeer = null;
    for (const p of Net.gamePeers) { const S = p.presence && p.presence.S; if (S && S.host === p.peer && (!best || S.v > best.v || (S.v === best.v && p.peer < bestPeer.peer))) { best = S; bestPeer = p; } }
    if (best) {
      Net.hostSeenAt = now();
      if (!G.S || best.v !== G.S.v || best.seed !== G.S.seed) { Net.offset = (bestPeer.updatedAt || now()) - best.now; G.S = JSON.parse(JSON.stringify(best)); apply(G.S); }
    } else maybeTakeOver();
  }
  function maybeTakeOver() {
    const S = G.S; if (!S || G.isHost || !Net.game) return;
    if (Net.gamePeers.some(p => p.peer === S.host)) { Net.hostSeenAt = now(); return; }
    if (now() - Net.hostSeenAt < 4000) return;
    const humans = S.pl.filter(p => !p.b && Net.gamePeers.some(q => q.peer === p.id)).map(p => p.id).sort();
    if (humans[0] === Net.me) {
      G.isHost = true; S.host = Net.me; G.botDue = {};
      if (S.ph === 'round') for (const p of S.pl) if (p.b && !S.g[p.id]) G.botDue[p.id] = now() + Bots.delay(p.b, S.seed ^ GT.hashStr(p.id)) / 2;
      startHostLoop(); toast(t('hostLeft')); publish();
    }
  }
  function startHostLoop() { clearInterval(G.hostTimer); G.hostTimer = setInterval(() => { if (G.isHost) hostTick(); else maybeTakeOver(); }, 250); }
  function leaveGame() {
    clearInterval(G.hostTimer);
    if (Net.game) { Net.game.leave().catch(() => { }); Net.game = null; Net.gamePeers = []; }
    G.S = null; G.isHost = false; G.loadedSeed = null; G.lastShownResult = -1; G.endShown = false; G.lastHumans = 0; G.pendingQuick = null;
    lobbyAnnounce();
  }
  function goHome() { leaveGame(); hideMatchmaking(); $('#endOv').hidden = true; $('#resultOv').hidden = true; showScreen('home'); renderOpenRooms(); }

  // ------------------------------------------------------------ player actions
  function placePin(la, lo) {
    const S = G.S; if (!S || S.ph !== 'round' || G.guessed || hostNow() < S.rs) return;
    G.myPin = [la, lo]; G.map.setPins([{ lat: la, lon: lo, color: myColor(), label: nick() }]);
    $('#guessBtn').disabled = false; $('#guessBtn').textContent = t('guess'); A.sfx('pin');
  }
  function myColor() { const p = me(); return G.S && G.S.mode === 'team' && p ? TEAM_COL[p.t] : '#f5c84c'; }
  function submitGuess() {
    const S = G.S; if (!S || S.ph !== 'round' || G.guessed || !G.myPin || hostNow() < S.rs) return;
    G.guessed = true; $('#guessBtn').disabled = true; $('#guessBtn').textContent = t('waiting'); A.sfx('guess');
    if (G.isHost) { if (registerGuess(Net.me, G.myPin[0], G.myPin[1])) publish(); }
    else if (Net.game) Net.game.presence({ guess: { r: S.r, s: S.seed, la: +G.myPin[0].toFixed(4), lo: +G.myPin[1].toFixed(4) } }).catch(() => { });
    updateHud();
  }
  function setWant(tm) { if (Net.game) Net.game.presence({ want: tm }).catch(() => { }); if (G.isHost && G.S) { const p = me(); if (p && p.t !== tm) { const other = G.S.pl.filter(q => q.t === tm); if (other.length < G.S.size) p.t = tm; else { const bot = other.find(q => q.b); if (bot) { bot.t = p.t; p.t = tm; } } publish(); } } }

  // ------------------------------------------------------------ rendering
  function showScreen(id) { $$('.screen').forEach(s => s.hidden = s.id !== id); document.body.classList.toggle('ingame', id === 'game'); if (id === 'game') GTStreet.kick(); }
  function searching(on) { const el = $('#searching'); if (el) el.hidden = !on; }
  function apply(S) {
    if (!S) return;
    if (S.ph === 'lobby') {
      const humans = S.pl.filter(p => !p.b).length; if (humans > G.lastHumans && G.lastHumans > 0) A.sfx('join'); G.lastHumans = humans;
      if (S.pub) { renderMatchmaking(); return; }
      hideMatchmaking(); showScreen('lobby'); renderLobby(); return;
    }
    hideMatchmaking();
    if (S.loc && S.seed !== G.loadedSeed) {
      G.loadedSeed = S.seed; G.guessed = false; G.myPin = null;
      showScreen('game');
      GTStreet.show(S.loc, S.mv);
      setMoveUi(S.mv);
      if (!G.map) G.map = makeMap($('#miniMap'), { onPick: placePin, small: true });
      G.map.setPins([]); G.map.setLines([]); G.map.reset();
      startCountdown();
      $('#guessBtn').disabled = true; $('#guessBtn').textContent = t('placePin');
      $('#resultOv').hidden = true; $('#endOv').hidden = true;
      G.endShown = false;
    }
    if (S.ph === 'round') { showScreen('game'); $('#resultOv').hidden = true; if (S.g[Net.me]) G.guessed = true; }
    if (S.ph === 'result' && G.lastShownResult !== S.r * 1e10 + S.seed) { G.lastShownResult = S.r * 1e10 + S.seed; showResult(true); }
    if (S.ph === 'end' && !G.endShown) { G.endShown = true; if ($('#resultOv').hidden) showResult(true); setTimeout(showEnd, S.mode === 'solo' ? 0 : 2500); }
    updateHud();
  }
  // 3-2-1 countdown before each round (timer and guessing start when it ends)
  function startCountdown() {
    const S = G.S; if (!S) return; const cd = $('#cd'), numEl = $('#cdNum'); let last = null;
    $('#cdRound').textContent = S.mode === 'team' ? `${t('round')} ${S.r} · ×${multiplier(S.r).toFixed(1)}` : `${t('round')} ${S.r} / ${SOLO_ROUNDS}`;
    cd.hidden = false; document.body.classList.add('counting');
    cancelAnimationFrame(G.cdRaf);
    const frame = () => {
      if (!G.S || G.S.seed !== S.seed) { cd.hidden = true; document.body.classList.remove('counting'); return; }
      const rem = S.rs - hostNow();
      const label = rem > 0 ? String(Math.min(3, Math.ceil(rem / 1000))) : t('go');
      if (label !== last) {
        last = label; numEl.textContent = label; numEl.classList.toggle('go', rem <= 0);
        numEl.classList.remove('pop'); void numEl.offsetWidth; numEl.classList.add('pop');
        A.sfx(rem > 0 ? 'count' : 'go');
      }
      if (rem < -650) { cd.hidden = true; document.body.classList.remove('counting'); return; }
      G.cdRaf = requestAnimationFrame(frame);
    };
    frame();
  }
  function setMoveUi(mv) { $('#moveCtl').hidden = mv !== 'move'; $('#zoomCtl').hidden = mv === 'nmpz'; $('#mvBadge').textContent = mvName(mv); }
  function fmtTime(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  const locale = () => I.lang === 'pl' ? 'pl-PL' : I.lang === 'de' ? 'de-DE' : I.lang === 'es' ? 'es-ES' : 'en-GB';
  const num = n => Number(n).toLocaleString(locale());
  function updateHud() {
    const S = G.S; if (!S) return;
    const hud = $('#hud');
    if (S.mode === 'team') {
      hud.className = 'hud team';
      const bars = [0, 1].map(tm => {
        const dots = S.pl.filter(p => p.t === tm).map(p => `<span class="pdot ${S.g[p.id] ? 'in' : ''} ${p.id === Net.me ? 'me' : ''}" title="${esc(p.nk)}">${esc(p.nk.slice(0, 1))}</span>`).join('');
        return `<div class="tbar t${tm}"><div class="tname">${teamName(tm)}</div><div class="hpwrap"><div class="hp" style="width:${S.hp[tm] / HP * 100}%"></div><span class="hpnum">${S.hp[tm]}</span></div><div class="dots">${dots}</div></div>`;
      });
      hud.innerHTML = `${bars[0]}<div class="mid"><div class="rnd">${t('round')} ${S.r}</div><div class="mult">×${multiplier(S.r).toFixed(1)}</div><div class="timer" id="timer"></div></div>${bars[1]}`;
    } else {
      hud.className = 'hud solo';
      const tot = S.tot[Net.me] || 0; const bot = S.pl.find(p => p.b);
      hud.innerHTML = `<div class="stat"><span>${t('round')}</span><b>${S.r} / ${SOLO_ROUNDS}</b></div><div class="stat"><span>${bot ? t('you') : t('score')}</span><b>${num(tot)}</b></div>${bot ? `<div class="stat"><span>${esc(bot.nk)} · ${t('bot')} ${bot.b}</span><b>${num(S.tot[bot.id] || 0)}${S.g[bot.id] ? ' ✓' : ''}</b></div>` : ''}<div class="timer" id="timer"></div>`;
    }
    tickTimer();
  }
  function tickTimer() {
    const S = G.S;
    if (S && S.pub && S.ph === 'lobby') { const qt = $('#mmTimer'); if (qt) qt.textContent = t('mmStartIn', fmtTime(S.qs - hostNow())); const bar = $('#mmBar'); if (bar) bar.style.width = Math.max(0, Math.min(100, 100 - (S.qs - hostNow()) / QP_WAIT * 100)) + '%'; }
    const el = $('#timer'); if (!el || !S) return;
    if (S.ph === 'round' && S.dl) {
      const left = Math.min(S.dl - hostNow(), S.dl - S.rs); el.textContent = fmtTime(left); const hurry = left < HURRY + 500 && left > 0 && hostNow() >= S.rs; el.classList.toggle('urgent', hurry); el.hidden = false;
      document.body.classList.toggle('hurry', hurry);
      const sec = Math.ceil(left / 1000); if (hurry && sec !== G.lastTick) { G.lastTick = sec; A.sfx(sec <= 5 ? 'tickHi' : 'tick'); const tm = $('#timer'); if (tm) { tm.classList.remove('beat'); void tm.offsetWidth; tm.classList.add('beat'); } }
    } else { el.hidden = true; document.body.classList.remove('hurry'); }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function countryName(cc) { const c = W.byCode[cc]; return c ? c.name : cc; }

  function showResult(withSound) {
    const S = G.S; const loc = S.loc; const ov = $('#resultOv'); ov.hidden = false;
    if (!G.bigMap) G.bigMap = makeMap($('#resultMap'), {});
    const pins = [{ kind: 'target', lat: loc.lat, lon: loc.lon }], lines = [], pts = [[loc.lat, loc.lon]];
    for (const p of S.pl) { const g = S.g[p.id]; if (!g) continue; const col = S.mode === 'team' ? TEAM_COL[p.t] : p.b ? '#3e8bff' : '#f5c84c'; pins.push({ lat: g[0], lon: g[1], color: col, label: p.nk }); lines.push({ a: [loc.lat, loc.lon], b: [g[0], g[1]], color: col }); pts.push([g[0], g[1]]); }
    G.bigMap.setPins(pins); G.bigMap.setLines(lines); requestAnimationFrame(() => { G.bigMap.resize(); G.bigMap.fit(pts, 70); });
    const where = `<div class="where"><span class="flagchip">${loc.cc}</span><div><b>${esc(countryName(loc.cc))}</b><small>${t('near')}: ${esc(loc.town)}</small></div></div>`;
    let body = '';
    const row = (p, extraCls) => { const g = S.g[p.id]; const km = g ? GT.haversine(loc.lat, loc.lon, g[0], g[1]) : null; return `<li class="t${p.t} ${extraCls || ''}"><span class="nm">${esc(p.nk)}${p.b ? ` <em>${t('bot')} ${p.b} · ${esc(lvlName(p.b))}</em>` : ''}${p.id === Net.me ? ` <em>${t('you').toLowerCase()}</em>` : ''}</span><span class="km">${km === null ? t('none') : GT.fmtKm(km)}</span><span class="pts">${g ? num(g[2]) : 0}</span></li>`; };
    if (S.mode === 'team') {
      const R = S.res;
      const rows = S.pl.slice().sort((a, b) => (S.g[b.id] ? S.g[b.id][2] : -1) - (S.g[a.id] ? S.g[a.id][2] : -1)).map(p => row(p, R && R.best[p.t] && R.best[p.t][0] === p.id ? 'best' : '')).join('');
      const dmgTxt = !R ? '' : R.lose < 0 ? t('tie') : t('dmg', teamName(R.lose), num(R.dmg), R.mult > 1 ? t('mult', R.mult.toFixed(1)) : '');
      body = `${where}<p class="dmg">${dmgTxt}</p><div class="hpmini">${[0, 1].map(tm => `<div class="t${tm}"><span>${teamName(tm)}</span><div class="hpwrap"><div class="hp" style="width:${S.hp[tm] / HP * 100}%"></div><span class="hpnum">${S.hp[tm]}</span></div></div>`).join('')}</div><ol class="rows">${rows}</ol>`;
      if (withSound && R) { const my = me(); if (my && R.lose === my.t) setTimeout(() => A.sfx('damage'), 450); else { const g = S.g[Net.me]; A.sfx('score', g ? g[2] : 0); } }
    } else {
      const g = S.g[Net.me]; const km = g ? GT.haversine(loc.lat, loc.lon, g[0], g[1]) : null;
      body = `${where}<div class="soloRes"><div><span>${t('distance')}</span><b>${km === null ? t('none') : GT.fmtKm(km)}</b></div><div><span>${t('points')}</span><b>${g ? num(g[2]) : 0}</b><i style="width:${(g ? g[2] : 0) / 50}%"></i></div></div>`;
      const bot = S.pl.find(p => p.b); if (bot) body += `<ol class="rows">${row(bot)}</ol>`;
      if (withSound) A.sfx('score', g ? g[2] : 0);
    }
    $('#resultBody').innerHTML = body;
    const btn = $('#nextBtn');
    btn.hidden = !G.isHost || S.ph === 'end';
    btn.textContent = S.mode === 'solo' && S.r >= SOLO_ROUNDS ? t('showScore') : t('nextRound');
    $('#nextInfo').textContent = S.ph === 'end' || (G.isHost && S.mode === 'solo') ? '' : t('nextSoon');
  }
  function showEnd(silent) {
    const S = G.S; if (!S) return; const ov = $('#endOv'); ov.hidden = false;
    let html = '';
    if (S.mode === 'team') {
      const my = me(); const won = my && S.win === my.t;
      html = `<h2 class="${S.win >= 0 ? 't' + S.win : ''}">${S.win < 0 ? t('draw') : t('winTeam', teamName(S.win))}</h2><p>${my ? (won ? t('wonTeam') : S.win < 0 ? t('drawTeam') : t('lostTeam')) : ''}</p>
        <ul class="hist">${S.hist.map(h => `<li><span>${t('roundN', h[0])}</span><span>${esc(countryName(h[1]))}</span><span>${h[2] < 0 ? t('roundDraw') : '−' + num(h[3]) + ' ' + teamName(h[2]).toLowerCase()}</span></li>`).join('')}</ul>`;
      if (my && silent !== true) A.sfx(won ? 'win' : 'lose');
    } else {
      const tot = S.tot[Net.me] || 0; const bot = S.pl.find(p => p.b);
      let vs = '', res = 0;
      if (bot) { const bt = S.tot[bot.id] || 0; res = tot > bt ? 1 : tot < bt ? -1 : 0; vs = `<p>${t('vsBot', res, esc(bot.nk), bot.b, num(bt))}</p>`; }
      html = `<h2>${num(tot)} <small>/ ${num(25000)}</small></h2>${vs}<p>${t('soloMsg', tot)}</p>
        <ul class="hist">${S.hist.map(h => `<li><span>${t('roundN', h[0])}</span><span>${esc(countryName(h[1]))}</span><span>${num(h[2])} ${t('pts')}</span></li>`).join('')}</ul>`;
      if (silent !== true) A.sfx(bot ? (res >= 0 ? 'win' : 'lose') : tot > 12000 ? 'win' : 'lose');
    }
    $('#endBody').innerHTML = html;
    $('#againBtn').hidden = !G.isHost;
  }

  // ------------------------------------------------------------ matchmaking screen (quick play)
  function showMatchmaking(size, mv) {
    $('#mm').hidden = false;
    $('#mmSub').textContent = t('mmSub', size, mvName(mv));
    $('#mmFound').textContent = t('mmConnecting'); $('#mmTimer').textContent = ''; $('#mmBar').style.width = '0%'; $('#mmNames').textContent = '';
    $('#mmSlots').innerHTML = Array.from({ length: size * 2 }, (_, i) => `<span class="slot ${i === 0 ? 'on me' : ''}">${i === 0 ? esc(nick().slice(0, 1).toUpperCase()) : ''}</span>`).join('');
    $('#mmStart').hidden = true;
  }
  function renderMatchmaking() {
    const S = G.S; if (!S) return; $('#mm').hidden = false;
    $('#mmSub').textContent = t('mmSub', S.size, mvName(S.mv));
    const humans = S.pl.filter(p => !p.b);
    $('#mmFound').textContent = t('mmFound', humans.length, S.size * 2);
    $('#mmSlots').innerHTML = Array.from({ length: S.size * 2 }, (_, i) => { const p = humans[i]; return `<span class="slot ${p ? 'on' : ''} ${p && p.id === Net.me ? 'me' : ''}" title="${p ? esc(p.nk) : ''}">${p ? esc(p.nk.slice(0, 1).toUpperCase()) : ''}</span>`; }).join('');
    $('#mmNames').textContent = humans.map(p => p.nk).join(' · ');
    $('#mmStart').hidden = !G.isHost;
    tickTimer();
  }
  function hideMatchmaking() { const m = $('#mm'); if (m) m.hidden = true; }

  // ------------------------------------------------------------ lobby UI
  function renderLobbyWaiting(code) { $('#lobbyCode').textContent = code.toUpperCase(); $('#lobbyTeams').innerHTML = `<p class="muted">${t('connecting')}</p>`; $('#lobbyHostCtl').hidden = true; $('#lobbyInfo').textContent = ''; }
  function renderLobby() {
    const S = G.S; if (!S) return;
    $('#lobbyCode').textContent = S.code.toUpperCase();
    $('#codeRow').hidden = G.local;
    $('#lobbyInfo').textContent = t('lobbyInfo', S.size, mvName(S.mv), S.tl ? fmtTime(S.tl * 1000) : 0, S.lvl, lvlName(S.lvl));
    $('#lobbyTeams').innerHTML = [0, 1].map(tm => {
      const pl = S.pl.filter(p => p.t === tm); const slots = [];
      for (let i = 0; i < S.size; i++) { const p = pl[i]; slots.push(p ? `<li class="${p.id === Net.me ? 'me' : ''}"><span class="av" style="background:${TEAM_COL[tm]}">${esc(p.nk.slice(0, 1).toUpperCase())}</span><span>${esc(p.nk)}</span>${p.b ? `<em>${t('bot')} · ${esc(lvlName(p.b))}</em>` : p.id === S.host ? `<em>${t('host')}</em>` : ''}</li>` : `<li class="empty"><span class="av"></span><span>${t('freeSlot')}</span></li>`); }
      const my = me(); const canJoin = !my || my.t !== tm;
      return `<div class="team t${tm}"><h3>${teamName(tm)}</h3><ul>${slots.join('')}</ul>${canJoin && (!G.local || G.isHost) ? `<button class="ghost small" data-want="${tm}">${t('moveHere')}</button>` : ''}</div>`;
    }).join('<div class="vs">VS</div>');
    $$('#lobbyTeams [data-want]').forEach(b => b.onclick = () => setWant(+b.dataset.want));
    $('#lobbyHostCtl').hidden = !G.isHost;
    const full = S.pl.length === S.size * 2;
    $('#startBtn').disabled = !full; $('#startBtn').textContent = full ? t('start') : t('missing', S.size * 2 - S.pl.length);
    $('#guestWait').hidden = G.isHost;
  }
  function renderOpenRooms() {
    const box = $('#openRooms'); if (!box) return;
    if (!Net.room) { box.innerHTML = Net.ready ? `<p class="muted">${t('noFirebase')}</p>` : ''; $('#joinRow').classList.toggle('off', Net.ready); return; }
    $('#joinRow').classList.remove('off');
    const rooms = Net.lobbyPeers.filter(p => !p.sameTab && p.presence && p.presence.host && p.presence.host.code && !p.presence.host.pub);
    const online = Net.lobbyPeers.length;
    box.innerHTML = `<p class="muted">${online > 1 ? t('online', online) : t('alone')}</p>` + (rooms.length ? `<ul class="rooms">${rooms.map(p => { const h = p.presence.host; return `<li><div><b>${esc(String(p.presence.nick || 'Gracz').slice(0, 16))}</b><small>${h.size}v${h.size} · ${mvName(h.mv) || ''} · ${h.n}/${h.max} ${h.ph === 'lobby' ? '' : '· ' + t('inProgress')}</small></div><button class="small" data-join="${esc(h.code)}">${h.ph === 'lobby' ? t('join') : t('watch')}</button></li>`; }).join('')}</ul>` : '');
    $$('#openRooms [data-join]').forEach(b => b.onclick = () => joinRoom(b.dataset.join));
  }

  // ------------------------------------------------------------ settings (language, music radio, sound effects)
  function renderSettings() {
    $('#langSeg').innerHTML = I.LANGS.map(([code, name]) => `<label><input type="radio" name="lang" value="${code}" ${code === I.lang ? 'checked' : ''}><span>${name}</span></label>`).join('');
    $$('[name="lang"]').forEach(r => r.onchange = () => setLanguage(r.value));
    $('#stations').innerHTML = A.STATIONS.map(id => `<button class="station ${id === prefs.station ? 'on' : ''}" data-st="${id}"><i aria-hidden="true"></i>${esc(t('st.' + id))}</button>`).join('');
    $$('[data-st]').forEach(b => b.onclick = () => { prefs.station = b.dataset.st; if (!prefs.music) prefs.music = true; savePrefs(); A.configure({ music: true, station: prefs.station }); A.setStation(prefs.station); A.unlock(); renderSettings(); });
    $('#musicOn').checked = prefs.music; $('#musicVol').value = Math.round(prefs.musicVol * 100);
    $('#sfxOn').checked = prefs.sfx; $('#sfxVol').value = Math.round(prefs.sfxVol * 100);
    updateNowPlaying(A.state());
  }
  function updateNowPlaying(s) { const el = $('#nowPlaying'); if (el) el.textContent = s.music && s.playing ? `${t('nowPlaying')}: ${t('st.' + s.station)} · ${t('track', s.track)}` : `${t('music')}: ${t('off')}`; $$('.station').forEach(b => b.classList.toggle('on', b.dataset.st === s.station)); document.body.classList.toggle('music-on', !!(s.music && s.playing)); }
  function setLanguage(l) {
    prefs.lang = l; savePrefs(); I.setLang(l); W.setLang(l);
    if (G.map) G.map.redraw(); if (G.bigMap) G.bigMap.redraw();
    renderSettings(); renderOpenRooms(); lvlLabel();
    if (G.setupKind) { $('#setupTitle').textContent = G.setupKind === 'solo' ? t('soloTitle') : t('teamTitle'); $('#setupGo').textContent = G.setupKind === 'solo' ? t('play') : t('playBots'); }
    if (G.S) { updateHud(); if (G.S.ph === 'lobby') { if (G.S.pub) renderMatchmaking(); else renderLobby(); } if (!$('#resultOv').hidden) showResult(false); if (!$('#endOv').hidden) showEnd(true); if (G.S.ph === 'round') { setMoveUi(G.S.mv); $('#guessBtn').textContent = G.guessed ? t('waiting') : G.myPin ? t('guess') : t('placePin'); } }
  }

  // ------------------------------------------------------------ misc UI
  let toastT = 0;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3800); }
  function renderSetup(kind) {
    G.setupKind = kind;
    $('#setupTitle').textContent = kind === 'solo' ? t('soloTitle') : t('teamTitle');
    $('#sizeRow').hidden = kind === 'solo'; $('#rivalRow').hidden = kind !== 'solo'; $('#friendsBtn').hidden = kind === 'solo';
    const syncBotRow = () => { const r = $('[name="rival"]:checked'); $('#botRow').hidden = kind === 'solo' && !(r && r.value === 'bot'); };
    $$('[name="rival"]').forEach(r => r.onchange = syncBotRow);
    $('#setupGo').textContent = kind === 'solo' ? t('play') : t('playBots');
    $('#setupGo').onclick = () => { readSetup(); if (kind === 'solo') startSolo(); else createTeamGame(false); };
    $('#friendsBtn').onclick = () => { readSetup(); if (!Net.room) { toast(t('noFriends')); return; } createTeamGame(true); };
    $('#friendsBtn').disabled = !Net.room;
    for (const [name, val] of [['mv', prefs.mv], ['tl', String(prefs.tl)], ['size', String(prefs.size)], ['rival', prefs.rival]]) $$(`[name="${name}"]`).forEach(r => r.checked = r.value === val);
    $('#lvl').value = prefs.lvl; lvlLabel(); syncBotRow();
    showScreen('setup');
  }
  function readSetup() {
    const v = n => { const r = $(`[name="${n}"]:checked`); return r ? r.value : null; };
    prefs.mv = v('mv') || 'move'; prefs.tl = +(v('tl') || 0); prefs.size = +(v('size') || 2); prefs.lvl = +$('#lvl').value; prefs.rival = v('rival') || 'none'; savePrefs();
  }
  function readQuick() { const r = $('[name="qmv"]:checked'); prefs.qmv = r ? r.value : 'move'; savePrefs(); }
  function lvlLabel() { const l = +$('#lvl').value; $('#lvlName').textContent = `${l}. ${lvlName(l)}`; $('#lvlDesc').textContent = lvlDesc(l); $('#lvl').style.setProperty('--p', ((l - 1) / 9 * 100) + '%'); }

  function initUI() {
    I.setLang(prefs.lang); W.setLang(prefs.lang);
    A.configure({ music: prefs.music, musicVol: prefs.musicVol, sfx: prefs.sfx, sfxVol: prefs.sfxVol, station: prefs.station });
    A.onChange(updateNowPlaying);
    // browsers allow sound only after the first interaction
    const unlock = () => { A.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) A.sfx('click'); }, true);

    $('#nick').value = prefs.nick;
    $('#nick').addEventListener('input', e => { prefs.nick = e.target.value.trim().slice(0, 16); savePrefs(); if (Net.room) Net.room.presence({ nick: nick() }).catch(() => { }); if (Net.game) Net.game.presence({ nick: nick() }).catch(() => { }); });
    $('#soloCard').onclick = () => renderSetup('solo');
    $('#teamCard').onclick = () => renderSetup('team');
    $$('[name="qmv"]').forEach(r => { r.checked = r.value === prefs.qmv; r.onchange = readQuick; });
    $$('[data-qp]').forEach(b => b.onclick = () => quickPlay(+b.dataset.qp));
    $('#joinBtn').onclick = () => joinRoom($('#joinCode').value);
    $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(e.target.value); });
    $('#lvl').addEventListener('input', lvlLabel);
    $$('[data-home]').forEach(b => b.onclick = goHome);
    $('#mmCancel').onclick = goHome;
    $('#mmStart').onclick = () => { if (G.isHost && G.S && G.S.ph === 'lobby') { $('#mmFound').textContent = t('mmStarting'); fillBots(true); hostStart(); } };
    $('#fillBots').onclick = () => fillBots();
    $('#clearBots').onclick = () => clearBots();
    $('#startBtn').onclick = () => { if (G.isHost) hostStart(); };
    $('#copyCode').onclick = () => { const code = G.S ? G.S.code.toUpperCase() : ''; if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast(t('copied', code)), () => toast(t('codeIs', code))); else toast(t('codeIs', code)); };
    $('#guessBtn').onclick = submitGuess;
    $('#nextBtn').onclick = () => { if (G.isHost && G.S && G.S.ph === 'result') nextOrEnd(); };
    $('#againBtn').onclick = () => { if (!G.isHost) return; $('#endOv').hidden = true; if (G.S.mode === 'solo') startSolo(); else { G.S.ph = 'lobby'; G.S.hp = [HP, HP]; G.S.r = 0; if (G.S.pub) G.S.qs = now() + QP_WAIT; G.loadedSeed = null; G.endShown = false; publish(); } };
    $('#fwd').onclick = () => GTStreet.step(1); $('#back').onclick = () => GTStreet.step(-1);
    $('#toStart').onclick = () => GTStreet.resetView();
    $('#zin').onclick = () => GTStreet.zoom(0.8); $('#zout').onclick = () => GTStreet.zoom(1.25);
    $('#mapToggle').onclick = () => $('#mini').classList.toggle('open');
    $('#mapSize').onclick = () => $('#mini').classList.toggle('big');
    // settings
    $$('[data-settings]').forEach(b => b.onclick = () => { renderSettings(); $('#settings').hidden = false; });
    $('#settingsClose').onclick = () => { $('#settings').hidden = true; };
    $('#settings').addEventListener('click', e => { if (e.target.id === 'settings') $('#settings').hidden = true; });
    $('#musicOn').onchange = e => { prefs.music = e.target.checked; savePrefs(); A.configure({ music: prefs.music }); if (prefs.music) A.unlock(); };
    $('#musicVol').oninput = e => { prefs.musicVol = e.target.value / 100; savePrefs(); A.configure({ musicVol: prefs.musicVol }); };
    $('#sfxOn').onchange = e => { prefs.sfx = e.target.checked; savePrefs(); A.configure({ sfx: prefs.sfx }); };
    $('#sfxVol').oninput = e => { prefs.sfxVol = e.target.value / 100; savePrefs(); A.configure({ sfxVol: prefs.sfxVol }); };
    $('#sfxVol').onchange = () => A.sfx('pin');
    $('#nextTrack').onclick = () => { if (!prefs.music) { prefs.music = true; savePrefs(); A.configure({ music: true }); $('#musicOn').checked = true; } A.nextTrack(); A.unlock(); };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { $('#settings').hidden = true; return; }
      if ($('#game').hidden || e.target.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') { submitGuess(); e.preventDefault(); return; }
      if (G.S && G.S.mv === 'move') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') GTStreet.rotate(8);
      if (e.key === 'ArrowRight' || e.key === 'd') GTStreet.rotate(-8);
    });
    if (!GTStreet.init($('#view'))) { $('#noKey').hidden = false; }
    GTStreet.onView(v => { $('#needle').style.transform = `rotate(${-v.heading}deg)`; });
    setInterval(tickTimer, 200);
    showScreen('home');
    renderOpenRooms();
    netInit();
  }
  root.GTGame = { init: initUI, G, Net };
})(this);
