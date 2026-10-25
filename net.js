// Globtrop – multiplayer rooms on Firebase Realtime Database.
// Exposes the same small "room" API the game uses: presence(), onPeers(), onConnection(), join(), leave().
(function (root) {
  const ID = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

  function makeRoom(db, path) {
    const ref = db.ref(path + '/peers'), myRef = ref.child(ID);
    let mine = {}, peers = [], subs = [], alive = true, writeT = 0, pending = false;
    const snapshot = () => peers;
    myRef.onDisconnect().remove();
    const write = () => {
      pending = false;
      return myRef.set({ p: JSON.stringify(mine), t: firebase.database.ServerValue.TIMESTAMP });
    };
    function presence(patch) {
      if (!alive) return Promise.reject({ code: 'invalid_argument', message: 'room left' });
      for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
      mine = JSON.parse(JSON.stringify(mine));
      // apply locally at once, coalesce network writes (~15/s)
      const local = peers.filter(p => p.peer !== ID); local.push(peerObj(ID, mine, Date.now())); peers = local; emit();
      if (!pending) { pending = true; clearTimeout(writeT); writeT = setTimeout(write, 60); }
      return Promise.resolve();
    }
    function peerObj(id, presence, updatedAt) { return { peer: id, by: null, isMe: id === ID, sameTab: id === ID, kind: 'viewer', guest: false, presence, updatedAt }; }
    const listener = ref.on('value', snap => {
      const now = Date.now(), next = [];
      snap.forEach(c => { const v = c.val() || {}; let p = {}; try { p = JSON.parse(v.p || '{}'); } catch (e) { } const old = peers.find(q => q.peer === c.key); next.push(peerObj(c.key, c.key === ID ? mine : p, old && JSON.stringify(old.presence) === JSON.stringify(p) ? old.updatedAt : now)); });
      if (!next.some(p => p.peer === ID)) next.push(peerObj(ID, mine, now));
      peers = next; emit();
    });
    function emit() { const s = snapshot(); subs.forEach(f => { try { f({ peers: s, joined: [], left: [], updated: [] }); } catch (e) { console.error(e); } }); }
    write();
    return {
      name: path,
      presence,
      onPeers(f) { subs.push(f); setTimeout(() => f({ peers: snapshot(), joined: [], left: [], updated: [] }), 0); return () => { subs = subs.filter(x => x !== f); }; },
      peers: snapshot,
      connected: () => true,
      onConnection(f) { const r = db.ref('.info/connected'); const h = r.on('value', s => f(!!s.val())); return () => r.off('value', h); },
      emit() { return Promise.resolve(); }, on() { return () => { }; },
      leave() { alive = false; ref.off('value', listener); subs = []; return myRef.remove(); },
      join(name) { if (!/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(name)) return Promise.reject({ code: 'invalid_argument' }); return Promise.resolve(makeRoom(db, 'rooms/' + name.replace(/\./g, '_'))); },
    };
  }

  let lobby = null;
  root.GTRoom = async function () {
    if (lobby) return lobby;
    const cfg = root.GLOBTROP_CONFIG && root.GLOBTROP_CONFIG.firebase;
    if (!cfg || !cfg.databaseURL || !root.firebase) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      lobby = makeRoom(firebase.database(), 'lobby');
      return lobby;
    } catch (e) { console.error('Firebase', e); return null; }
  };
})(this);
