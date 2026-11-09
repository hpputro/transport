(() => {
  'use strict';

  // ================= Konstanta =================
  const W = 1600, H = 1000;          // ukuran dunia (koordinat peta)
  const CELL = 10;                   // ukuran sel medan
  const GW = W / CELL, GH = H / CELL;
  const LAND = 0, WATER = 1, MOUNT = 2;

  const LINE_COLORS = ['#e63946', '#1f78d1', '#f0a202', '#2a9d4b', '#8e44ad', '#e0609a'];
  const LINE_NAMES = ['Merah', 'Biru', 'Kuning', 'Hijau', 'Ungu', 'Merah Muda'];
  const UNLOCK_AT = [0, 0, 0, 40, 120, 250]; // jumlah penumpang terantar untuk membuka jalur

  const DAY_LEN = 20;        // detik per hari permainan
  const TRAIN_SPEED = 90;    // px per detik
  const TRAIN_COST = 400;
  const CAP_COST = 250;
  const CAP_STEP = 4;
  const BASE_CAP = 6, MAX_CAP = 18;
  const MAX_TRAINS = 4;
  const UPKEEP = 20;         // biaya perawatan per kereta per hari
  const START_MONEY = 1500;
  const MAX_CITIES = 18;
  const SIZE_CAP = [0, 8, 12, 16];
  const SIZE_R = [0, 13, 16, 20];
  const SIZE_NAME = ['', 'Kota kecil', 'Kota sedang', 'Kota besar'];
  const GROW_AT = [0, 40, 120];

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  let S = null;              // state permainan
  let terrainCanvas = null;
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1, fit: 1, zoom: 1, cx: W / 2, cy: H / 2, area: { x: 0, y: 0, w: 1, h: 1 }, needsInit: true };
  const mouse = { x: 0, y: 0, cx: 0, cy: 0, inside: false };

  // ================= Utilitas =================
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  }
  function loadBest() { try { return +localStorage.getItem('lintasKota.best') || 0; } catch (e) { return 0; } }
  function saveBest(v) { try { localStorage.setItem('lintasKota.best', String(v)); } catch (e) { /* abaikan */ } }

  // ================= Medan =================
  function makeNoise(rng, gw, gh) {
    const g = new Float32Array((gw + 1) * (gh + 1));
    for (let i = 0; i < g.length; i++) g[i] = rng();
    const r = gw + 1;
    return (u, v) => {
      const x = Math.min(u * gw, gw - 1e-6), y = Math.min(v * gh, gh - 1e-6);
      const x0 = Math.floor(x), y0 = Math.floor(y);
      let fx = x - x0, fy = y - y0;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = g[y0 * r + x0], b = g[y0 * r + x0 + 1];
      const c = g[(y0 + 1) * r + x0], d = g[(y0 + 1) * r + x0 + 1];
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };
  }

  function genTerrain(rng) {
    const n1 = makeNoise(rng, 4, 3), n2 = makeNoise(rng, 9, 6), n3 = makeNoise(rng, 22, 14);
    const elev = new Float32Array(GW * GH);
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const u = (x + 0.5) / GW, v = (y + 0.5) / GH;
        let e = 0.55 * n1(u, v) + 0.3 * n2(u, v) + 0.15 * n3(u, v);
        const edge = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
        e -= 0.5 * Math.pow(edge, 3); // tepi peta cenderung laut → kepulauan
        elev[y * GW + x] = e;
      }
    }
    const sorted = Array.from(elev).sort((a, b) => a - b);
    const waterLvl = sorted[Math.floor(sorted.length * 0.34)];
    const mountLvl = sorted[Math.floor(sorted.length * 0.9)];
    const type = new Uint8Array(GW * GH);
    for (let i = 0; i < type.length; i++) {
      type[i] = elev[i] < waterLvl ? WATER : elev[i] > mountLvl ? MOUNT : LAND;
    }
    return { elev, type, waterLvl, mountLvl, maxE: sorted[sorted.length - 1], minE: sorted[0] };
  }

  function terrainAt(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return WATER;
    return S.terrain.type[cy * GW + cx];
  }

  function renderTerrain() {
    const T = S.terrain;
    terrainCanvas = document.createElement('canvas');
    terrainCanvas.width = W; terrainCanvas.height = H;
    const g = terrainCanvas.getContext('2d');
    const at = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? WATER : T.type[y * GW + x];
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x, t = T.type[i], e = T.elev[i];
        let col;
        if (t === WATER) {
          col = mix('#a8d5e6', '#78b6d2', clamp((T.waterLvl - e) / 0.12, 0, 1));
        } else if (t === MOUNT) {
          col = mix('#cbbf9f', '#a8977a', clamp((e - T.mountLvl) / (T.maxE - T.mountLvl), 0, 1));
        } else {
          const coast = at(x - 1, y) === WATER || at(x + 1, y) === WATER || at(x, y - 1) === WATER || at(x, y + 1) === WATER;
          col = coast ? '#efe4bf' : mix('#e6eed2', '#d4e0b8', clamp((e - T.waterLvl) / (T.mountLvl - T.waterLvl), 0, 1));
        }
        g.fillStyle = col;
        g.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    // simbol gunung
    const r = mulberry32(S.seed + 7);
    for (let y = 1; y < GH - 1; y += 3) {
      for (let x = 1; x < GW - 1; x += 3) {
        if (T.type[y * GW + x] !== MOUNT || r() > 0.55) continue;
        const px = x * CELL + 5 + (r() - 0.5) * 6, py = y * CELL + 7 + (r() - 0.5) * 6;
        const s = 6 + r() * 3;
        g.fillStyle = '#8f7f62';
        g.beginPath(); g.moveTo(px - s, py + s * 0.6); g.lineTo(px, py - s * 0.8); g.lineTo(px + s, py + s * 0.6); g.closePath(); g.fill();
        g.fillStyle = '#f4f1e8';
        g.beginPath(); g.moveTo(px - s * 0.35, py - s * 0.25); g.lineTo(px, py - s * 0.8); g.lineTo(px + s * 0.35, py - s * 0.25); g.closePath(); g.fill();
      }
    }
  }

  /** Biaya rel antar dua titik: jarak × pengali medan (darat 1, gunung 2.5, laut 4). */
  function segCost(a, b) {
    const d = dist(a, b);
    const n = Math.max(1, Math.ceil(d / 8));
    let c = 0;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const ty = terrainAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      c += (ty === WATER ? 4 : ty === MOUNT ? 2.5 : 1) * (d / n);
    }
    return Math.round(c * 0.7 / 5) * 5;
  }

  // ================= Kota =================
  const SYL_A = ['Su', 'Ma', 'Ka', 'Ba', 'Pa', 'Ta', 'Se', 'Ja', 'Lo', 'Bo', 'Wa', 'Ra', 'Pe', 'Ci', 'Ke', 'Ga', 'Tu', 'Bi', 'Sa', 'Me', 'Ri', 'Da', 'Lem', 'Pan', 'Sin', 'Ban', 'Kur'];
  const SYL_B = ['ra', 'ma', 'nga', 'ka', 'lu', 'ri', 'wa', 'ndo', 'jo', 'pa', 'ta', 'di', 'dung', 'lang', 'tong', 'san', 'gi', 'ne', 'ru', 'bu'];
  const SYL_C = ['ng', 'n', 'r', 'k', '', '', '', '', 'ja', 'ri', 'sa'];
  const PREFIX = ['Tanjung ', 'Teluk ', 'Bukit ', 'Muara '];

  function genName(rng) {
    const used = new Set(S.cities.map((c) => c.name));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    for (let k = 0; k < 60; k++) {
      let n = pick(SYL_A) + pick(SYL_B) + pick(SYL_C);
      if (n.length > 9) continue;
      if (rng() < 0.15) n = pick(PREFIX) + n;
      if (!used.has(n)) return n;
    }
    return 'Kota ' + (S.cities.length + 1);
  }

  function landAround(x, y, r) {
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4;
      if (terrainAt(x + Math.cos(ang) * r, y + Math.sin(ang) * r) === WATER) return false;
    }
    return true;
  }

  function spawnCity() {
    const rng = S.rng, n = S.cities.length;
    let pos = null;
    for (let tries = 0; tries < 600 && !pos; tries++) {
      const radius = (n < 3 ? 230 : 300 + n * 45) + tries * 2;
      const minD = tries < 350 ? 150 : 110;
      const x = 70 + rng() * (W - 140), y = 70 + rng() * (H - 140);
      if (Math.hypot(x - W / 2, y - H / 2) > radius) continue;
      if (terrainAt(x, y) !== LAND || !landAround(x, y, 14)) continue;
      if (S.cities.some((c) => Math.hypot(c.x - x, c.y - y) < minD)) continue;
      pos = { x, y };
    }
    if (!pos) return null;
    const city = {
      id: n, name: genName(rng), x: pos.x, y: pos.y,
      size: 1, growth: 0, wait: [], acc: rng() * 0.6, born: S.t, overT: 0,
    };
    S.cities.push(city);
    recomputeNetwork();
    return city;
  }

  function spawnPassenger(city) {
    const others = S.cities.filter((c) => c !== city);
    if (!others.length) return;
    let tot = 0;
    const w = others.map((c) => { const v = c.size / (1 + dist(c, city) / 500); tot += v; return v; });
    let r = S.rng() * tot, k = 0;
    while (k < w.length - 1 && r > w[k]) { r -= w[k]; k++; }
    city.wait.push({ dest: others[k].id, hops: 0 });
  }

  // ================= Jaringan & rute =================
  function recomputeNetwork() {
    const n = S.cities.length;
    const adj = Array.from({ length: n }, () => new Set());
    S.segMap = new Map();
    for (const L of S.lines) {
      for (let k = 0; k + 1 < L.stations.length; k++) {
        const a = L.stations[k], b = L.stations[k + 1];
        adj[a].add(b); adj[b].add(a);
        const key = Math.min(a, b) + '-' + Math.max(a, b);
        if (!S.segMap.has(key)) S.segMap.set(key, []);
        const arr = S.segMap.get(key);
        if (!arr.includes(L.id)) arr.push(L.id);
      }
    }
    // jarak (jumlah pemberhentian) antar semua kota, via BFS
    S.dist = [];
    for (let s = 0; s < n; s++) {
      const d = new Array(n).fill(Infinity);
      d[s] = 0;
      const q = [s];
      for (let h = 0; h < q.length; h++) {
        const u = q[h];
        for (const v of adj[u]) if (d[v] === Infinity) { d[v] = d[u] + 1; q.push(v); }
      }
      S.dist.push(d);
    }
    S.connected = adj.map((s) => s.size > 0);
  }
  const D = (a, b) => S.dist[a][b];

  /** Geser jalur yang berbagi ruas rel supaya tidak saling menumpuk. */
  function segOffset(lineId, a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const arr = S.segMap.get(lo + '-' + hi);
    if (!arr || arr.length < 2) return [0, 0];
    const idx = arr.indexOf(lineId) - (arr.length - 1) / 2;
    const A = S.cities[lo], B = S.cities[hi];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    const off = idx * 9;
    return [(-dy / len) * off, (dx / len) * off];
  }

  // ================= Jalur & kereta =================
  function newLine(slot) {
    const L = { id: slot, color: LINE_COLORS[slot], name: LINE_NAMES[slot], stations: [], segCosts: [], trains: [], cap: BASE_CAP };
    S.lines.push(L);
    S.lines.sort((a, b) => a.id - b.id);
    S.selected = L;
    S.building = true;
    S.buildEnd = 'tail';
    return L;
  }

  function addTrain(L, free) {
    if (L.stations.length < 2) return;
    if (L.trains.length >= MAX_TRAINS) { toast(`Jalur ${L.name} sudah punya ${MAX_TRAINS} kereta`, 'bad'); return; }
    if (!free) {
      if (S.money < TRAIN_COST) { toast(`Kas tidak cukup (butuh $${TRAIN_COST})`, 'bad'); return; }
      S.money -= TRAIN_COST;
    }
    const n = L.stations.length;
    const atEnd = L.trains.length % 2 === 1;
    const tr = { line: L, i: atEnd ? n - 1 : 0, dir: atEnd ? -1 : 1, prog: 0, state: 'dwell', dwellT: 0.6, pax: [] };
    L.trains.push(tr);
    S.trains.push(tr);
    serve(tr, L.stations[tr.i]);
  }

  function upgradeCap(L) {
    if (L.cap >= MAX_CAP) return;
    if (S.money < CAP_COST) { toast(`Kas tidak cukup (butuh $${CAP_COST})`, 'bad'); return; }
    S.money -= CAP_COST;
    L.cap += CAP_STEP;
    toast(`Kereta jalur ${L.name} kini muat ${L.cap} penumpang`, 'good');
  }

  /** Pastikan kereta tetap berada di ruas yang valid setelah jalur dipotong. */
  function fixTrains(L) {
    const st = L.stations, m = st.length;
    for (const tr of L.trains) {
      const bad = tr.i < 0 || tr.i > m - 1 || tr.i + tr.dir < 0 || tr.i + tr.dir > m - 1;
      if (!bad) continue;
      tr.i = clamp(tr.i, 0, m - 1);
      tr.dir = tr.i === 0 ? 1 : -1;
      tr.prog = 0;
      tr.state = 'dwell';
      tr.dwellT = 0.4;
      serve(tr, st[tr.i]);
    }
  }

  /** Bongkar stasiun di ujung awal (fromHead = true) atau ujung akhir jalur. */
  function trimLine(L, fromHead) {
    const st = L.stations, n = st.length;
    if (n <= 2) return; // jalur 2 stasiun dihapus lewat tombol "Hapus jalur"
    const removed = S.cities[fromHead ? st[0] : st[n - 1]].name;
    const refund = Math.round((fromHead ? L.segCosts[0] : L.segCosts[n - 2]) * 0.5);
    S.money += refund;
    if (fromHead) {
      st.shift(); L.segCosts.shift();
      for (const tr of L.trains) tr.i -= 1;
    } else {
      st.pop(); L.segCosts.pop();
    }
    recomputeNetwork();
    fixTrains(L);
    toast(`Stasiun ${removed} dilepas dari jalur ${L.name}, kembali $${refund}`);
  }

  function deleteLine(L) {
    const track = L.segCosts.reduce((a, b) => a + b, 0);
    const refund = Math.round(track * 0.5 + Math.max(0, L.trains.length - 1) * TRAIN_COST * 0.5);
    for (const tr of L.trains) {
      if (L.stations.length) S.cities[L.stations[clamp(tr.i, 0, L.stations.length - 1)]].wait.push(...tr.pax);
    }
    S.trains = S.trains.filter((t) => t.line !== L);
    S.lines = S.lines.filter((l) => l !== L);
    S.money += refund;
    if (S.selected === L) { S.selected = null; S.building = false; }
    recomputeNetwork();
    if (refund) toast(`Jalur ${L.name} dihapus, kembali $${refund}`);
  }

  /** Penumpang turun/naik di kota `ci`. Mengembalikan jumlah penumpang yang berpindah. */
  function serve(tr, ci) {
    const L = tr.line, city = S.cities[ci];
    const nIdx = tr.i + tr.dir;
    const N = (L.stations.length > 1 && nIdx >= 0 && nIdx < L.stations.length) ? L.stations[nIdx] : -1;
    let moved = 0;
    const keep = [];
    for (const p of tr.pax) {
      if (p.dest === ci) { deliver(p, city); moved++; }
      else if (N < 0 || !(D(N, p.dest) < D(ci, p.dest))) { city.wait.push(p); moved++; } // transit
      else keep.push(p);
    }
    tr.pax = keep;
    if (N >= 0) {
      for (let k = 0; k < city.wait.length && tr.pax.length < L.cap;) {
        const p = city.wait[k];
        if (D(N, p.dest) < D(ci, p.dest)) { tr.pax.push(p); city.wait.splice(k, 1); moved++; }
        else k++;
      }
    }
    return moved;
  }

  function deliver(p, city) {
    const fare = 10 + 5 * p.hops;
    S.money += fare;
    S.earned += fare;
    S.delivered++;
    S.satisfaction = Math.min(100, S.satisfaction + 0.6);
    city.growth++;
    if (city.size < 3 && city.growth >= GROW_AT[city.size]) {
      city.size++;
      toast(`${city.name} berkembang menjadi ${SIZE_NAME[city.size].toLowerCase()}!`, 'good');
    }
    if (S.particles.length < 40) S.particles.push({ x: city.x, y: city.y - 18, text: `+$${fare}`, life: 1.2, color: '#1e7a3a' });
  }

  function updateTrain(tr, dt) {
    const st = tr.line.stations;
    if (st.length < 2) return;
    if (tr.state === 'dwell') {
      tr.dwellT -= dt;
      if (tr.dwellT <= 0) tr.state = 'move';
      return;
    }
    const A = S.cities[st[tr.i]], B = S.cities[st[tr.i + tr.dir]];
    tr.prog += TRAIN_SPEED * dt;
    if (tr.prog >= dist(A, B)) {
      tr.i += tr.dir;
      tr.prog = 0;
      if (tr.i + tr.dir < 0 || tr.i + tr.dir >= st.length) tr.dir = -tr.dir;
      for (const p of tr.pax) p.hops++;
      const moved = serve(tr, st[tr.i]);
      tr.state = 'dwell';
      tr.dwellT = 0.35 + 0.07 * moved;
    }
  }

  function trainPos(tr) {
    const L = tr.line, st = L.stations;
    if (st.length < 2) { const c = S.cities[st[0]]; return { x: c.x, y: c.y, ang: 0 }; }
    const a = st[tr.i], b = st[tr.i + tr.dir];
    const A = S.cities[a], B = S.cities[b];
    const len = dist(A, B) || 1;
    const t = Math.min(1, tr.prog / len);
    const [ox, oy] = segOffset(L.id, a, b);
    return { x: A.x + (B.x - A.x) * t + ox, y: A.y + (B.y - A.y) * t + oy, ang: Math.atan2(B.y - A.y, B.x - A.x) };
  }

  // ================= Siklus permainan =================
  function newGame(seed) {
    S = {
      seed, rng: mulberry32(seed),
      t: 0, day: 1, money: START_MONEY, earned: 0, delivered: 0, satisfaction: 100,
      cities: [], lines: [], trains: [], dist: [], segMap: new Map(), connected: [],
      nextCityAt: 14, speed: 1, paused: false, started: false, over: false,
      selected: null, building: false, buildEnd: 'tail', unlocked: 3,
      particles: [],
    };
    S.terrain = genTerrain(S.rng);
    for (let i = 0; i < 3; i++) spawnCity();
    renderTerrain();
    renderChips();
    updatePanel();
    updateHint();
  }

  function update(dt) {
    S.t += dt;
    const day = Math.floor(S.t / DAY_LEN) + 1;
    if (day > S.day) {
      S.day = day;
      const cost = S.trains.length * UPKEEP;
      S.money -= cost;
      toast(cost ? `Hari ${day} · perawatan kereta -$${cost}` : `Hari ${day}`);
    }
    if (S.t >= S.nextCityAt && S.cities.length < MAX_CITIES) {
      const c = spawnCity();
      S.nextCityAt = S.t + 17 + S.cities.length * 1.3;
      if (c) toast(`Kota baru muncul: ${c.name}`, 'good');
    }
    const mult = 1 + 0.06 * (S.day - 1);
    for (const c of S.cities) {
      if (S.t - c.born > 6) {
        const rate = (0.06 + 0.045 * c.size) * mult * (S.connected[c.id] ? 1 : 0.6);
        c.acc += rate * dt;
        while (c.acc >= 1) { c.acc -= 1; spawnPassenger(c); }
      }
      const cap = SIZE_CAP[c.size];
      if (c.wait.length > cap) {
        c.overT += dt;
        S.satisfaction -= Math.min(3, 0.7 + 0.25 * (c.wait.length - cap)) * dt;
      } else {
        c.overT = Math.max(0, c.overT - dt * 2);
      }
    }
    for (const tr of S.trains) updateTrain(tr, dt);
    for (const p of S.particles) { p.life -= dt; p.y -= 14 * dt; }
    S.particles = S.particles.filter((p) => p.life > 0);

    const unlocked = UNLOCK_AT.filter((v) => S.delivered >= v).length;
    if (unlocked > S.unlocked) {
      S.unlocked = unlocked;
      toast(`Jalur ${LINE_NAMES[unlocked - 1]} terbuka!`, 'good');
      renderChips();
    }
    if (S.satisfaction <= 0) gameOver();
  }

  function gameOver() {
    S.satisfaction = 0;
    S.over = true;
    S.building = false;
    const worst = S.cities.reduce((a, b) => (b.wait.length - SIZE_CAP[b.size] > a.wait.length - SIZE_CAP[a.size] ? b : a));
    const best = Math.max(loadBest(), S.delivered);
    saveBest(best);
    $('over-reason').textContent = `Warga ${worst.name} sudah tidak sabar lagi menunggu kereta.`;
    $('r-day').textContent = S.day;
    $('r-deliv').textContent = S.delivered;
    $('r-best').textContent = best;
    $('card-start').hidden = true;
    $('card-over').hidden = false;
    $('overlay').hidden = false;
  }

  // ================= Input =================
  function toWorld(cx, cy) {
    return { x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale };
  }

  function cityAt(p) {
    let best = null, bd = Infinity;
    for (const c of S.cities) {
      const d = dist(c, p);
      if (d < SIZE_R[c.size] + 14 && d < bd) { best = c; bd = d; }
    }
    return best;
  }

  function lineAt(p) {
    for (const L of S.lines) {
      for (let k = 0; k + 1 < L.stations.length; k++) {
        const a = L.stations[k], b = L.stations[k + 1];
        const [ox, oy] = segOffset(L.id, a, b);
        const A = S.cities[a], B = S.cities[b];
        const ax = A.x + ox, ay = A.y + oy, bx = B.x + ox, by = B.y + oy;
        const dx = bx - ax, dy = by - ay;
        const t = clamp(((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        if (Math.hypot(p.x - (ax + dx * t), p.y - (ay + dy * t)) < 10) return L;
      }
    }
    return null;
  }

  function stopBuilding() {
    const L = S.selected;
    S.building = false;
    if (L && L.stations.length < 2) { deleteLine(L); S.selected = null; }
    refreshUi();
  }

  function selectLine(L) {
    if (S.building && S.selected !== L) stopBuilding();
    S.selected = L;
    S.building = false;
    refreshUi();
  }

  function freeSlot() {
    for (let i = 0; i < S.unlocked; i++) if (!S.lines.some((l) => l.id === i)) return i;
    return -1;
  }

  function buildClick(c) {
    const L = S.selected, st = L.stations;
    if (!st.length) { st.push(c.id); refreshUi(); return; }
    const head = st[0], tail = st[st.length - 1];
    if (c.id === tail) { S.buildEnd = 'tail'; refreshUi(); return; }
    if (c.id === head) { S.buildEnd = 'head'; refreshUi(); return; }
    if (st.includes(c.id)) { toast(`${c.name} sudah dilewati jalur ${L.name}`, 'bad'); return; }
    const from = S.cities[S.buildEnd === 'head' ? head : tail];
    const cost = segCost(from, c);
    if (S.money < cost) { toast(`Kas tidak cukup (butuh $${cost})`, 'bad'); return; }
    S.money -= cost;
    if (S.buildEnd === 'head') {
      st.unshift(c.id); L.segCosts.unshift(cost);
      for (const tr of L.trains) tr.i += 1;
    } else {
      st.push(c.id); L.segCosts.push(cost);
    }
    recomputeNetwork();
    if (st.length === 2 && !L.trains.length) addTrain(L, true);
    S.particles.push({ x: (from.x + c.x) / 2, y: (from.y + c.y) / 2, text: `-$${cost}`, life: 1.2, color: '#b3261e' });
    refreshUi();
  }

  function onPointerDown(e) {
    if (!S || !S.started || S.over) return;
    const p = toWorld(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y; mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.inside = true;
    const c = cityAt(p);
    if (S.building) {
      if (c) buildClick(c); else stopBuilding();
      return;
    }
    if (c) {
      const L = S.selected;
      if (L && (c.id === L.stations[0] || c.id === L.stations[L.stations.length - 1])) {
        S.building = true;
        S.buildEnd = c.id === L.stations[0] && L.stations.length > 1 ? 'head' : 'tail';
        refreshUi();
        return;
      }
      const slot = freeSlot();
      if (slot < 0) {
        toast(S.unlocked < 6 ? 'Semua jalur terpakai. Antar lebih banyak penumpang untuk membuka jalur baru.' : 'Semua jalur sudah terpakai.', 'bad');
        return;
      }
      newLine(slot).stations.push(c.id);
      refreshUi();
      return;
    }
    selectLine(lineAt(p));
  }

  // ---- geser (seret) & zoom (roda mouse / cubit) ----
  const pointers = new Map();
  let drag = null, pinch = null;

  function zoomAt(sx, sy, z) {
    const wp = toWorld(sx, sy);
    view.zoom = clamp(z, 1, 4);
    view.scale = view.fit * view.zoom;
    const a = view.area;
    view.cx = wp.x - (sx - (a.x + a.w / 2)) / view.scale;
    view.cy = wp.y - (sy - (a.y + a.h / 2)) / view.scale;
    applyView();
  }

  function trackMouse(e) {
    const p = toWorld(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y; mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.inside = true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    trackMouse(e);
    if (e.button === 2) { if (S && S.started && !S.over) stopBuilding(); return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
    } else if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, zoom: view.zoom };
      if (drag) drag.moved = true;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    trackMouse(e);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, pinch.zoom * d / pinch.d);
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 7) drag.moved = true;
      if (drag.moved) {
        view.cx = drag.cx - dx / view.scale;
        view.cy = drag.cy - dy / view.scale;
        applyView();
      }
    }
  });
  function endPointer(e, cancelled) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (drag && !drag.moved && !cancelled) onPointerDown(e);
      drag = null;
    }
  }
  canvas.addEventListener('pointerup', (e) => endPointer(e, false));
  canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') mouse.inside = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, view.zoom * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (!S || !S.started || S.over) return;
    if (e.code === 'Space') { e.preventDefault(); setSpeed(S.paused ? S.speed : 0); }
    else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(+e.key);
    else if (e.key === 'Escape') { if (S.building) stopBuilding(); else selectLine(null); }
    else if (e.key === '+' || e.key === '=') zoomAt(view.area.x + view.area.w / 2, view.area.y + view.area.h / 2, view.zoom * 1.25);
    else if (e.key === '-') zoomAt(view.area.x + view.area.w / 2, view.area.y + view.area.h / 2, view.zoom / 1.25);
  });

  function setSpeed(v) {
    if (v === 0) S.paused = true;
    else { S.paused = false; S.speed = v; }
    document.querySelectorAll('.speed button').forEach((b) => {
      const s = +b.dataset.speed;
      b.classList.toggle('active', S.paused ? s === 0 : s === S.speed);
    });
  }
  document.querySelectorAll('.speed button').forEach((b) => b.addEventListener('click', () => {
    if (S && S.started && !S.over) setSpeed(+b.dataset.speed);
  }));

  $('b-extend').addEventListener('click', () => { if (S.selected) { S.building = true; S.buildEnd = 'tail'; refreshUi(); } });
  $('b-train').addEventListener('click', () => { if (S.selected) { addTrain(S.selected, false); refreshUi(); } });
  $('b-cap').addEventListener('click', () => { if (S.selected) { upgradeCap(S.selected); refreshUi(); } });
  $('b-trim-head').addEventListener('click', () => { if (S.selected) { trimLine(S.selected, true); refreshUi(); } });
  $('b-trim-tail').addEventListener('click', () => { if (S.selected) { trimLine(S.selected, false); refreshUi(); } });
  let delArmed = null;
  $('b-del').addEventListener('click', () => {
    const L = S.selected;
    if (!L) return;
    if (delArmed !== L) {
      // klik pertama hanya meminta konfirmasi
      delArmed = L;
      $('b-del').textContent = 'Yakin hapus?';
      setTimeout(() => { if (delArmed === L) { delArmed = null; $('b-del').textContent = 'Hapus jalur'; } }, 2500);
      return;
    }
    delArmed = null;
    $('b-del').textContent = 'Hapus jalur';
    deleteLine(L);
    refreshUi();
  });

  $('b-start').addEventListener('click', () => {
    S.started = true;
    $('overlay').hidden = true;
    setSpeed(1);
    toast('Klik sebuah kota untuk mulai membangun jalur');
  });
  $('b-restart').addEventListener('click', () => {
    newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    view.needsInit = true;
    S.started = true;
    $('overlay').hidden = true;
    setSpeed(1);
    resize();
  });

  // ================= UI DOM =================
  function toast(msg, kind) {
    const box = $('toasts');
    if (box.lastChild && box.lastChild.textContent === msg && box.lastChild.style.opacity !== '0') return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.style.opacity = '0'; }, 2400);
    setTimeout(() => el.remove(), 2900);
  }

  function renderChips() {
    const box = $('chips');
    box.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const b = document.createElement('button');
      const L = S.lines.find((l) => l.id === i);
      b.className = 'chip';
      b.style.background = LINE_COLORS[i];
      b.style.color = L ? '#fff' : LINE_COLORS[i];
      if (i >= S.unlocked) {
        b.classList.add('locked');
        b.textContent = '🔒';
        b.title = `Terbuka setelah ${UNLOCK_AT[i]} penumpang terantar`;
      } else if (!L) {
        b.classList.add('free');
        b.textContent = '+';
        b.title = `Jalur ${LINE_NAMES[i]} baru`;
      } else {
        b.textContent = L.trains.length;
        b.title = `Jalur ${LINE_NAMES[i]} · ${L.trains.length} kereta`;
      }
      if (S.selected && S.selected.id === i) b.classList.add('sel');
      b.addEventListener('click', () => {
        if (!S.started || S.over) return;
        if (i >= S.unlocked) { toast(`Antar ${UNLOCK_AT[i]} penumpang untuk membuka jalur ${LINE_NAMES[i]}`); return; }
        const cur = S.lines.find((l) => l.id === i);
        if (cur) { selectLine(S.selected === cur && !S.building ? null : cur); return; }
        if (S.building) stopBuilding();
        newLine(i);
        refreshUi();
      });
      box.appendChild(b);
    }
  }

  function updatePanel() {
    const L = S.selected;
    const panel = $('line-panel');
    panel.hidden = !L || L.stations.length < 2;
    if (panel.hidden) return;
    $('lp-name').textContent = `Jalur ${L.name}`;
    $('lp-name').style.color = L.color;
    $('lp-info').textContent = `${L.stations.length} stasiun · ${L.trains.length} kereta · muat ${L.cap}`;
    $('b-extend').classList.toggle('active', S.building);
    $('b-train').textContent = `+ Kereta ($${TRAIN_COST})`;
    $('b-train').disabled = L.trains.length >= MAX_TRAINS || S.money < TRAIN_COST;
    $('b-cap').textContent = L.cap >= MAX_CAP ? 'Gerbong maks' : `+ Gerbong ($${CAP_COST})`;
    $('b-cap').disabled = L.cap >= MAX_CAP || S.money < CAP_COST;
    const st = L.stations, n = st.length, canTrim = n > 2;
    const trimBtn = (id, label, city, cost) => {
      const b = $(id);
      b.textContent = `${label}: ${S.cities[city].name}` + (canTrim ? ` (+$${Math.round(cost * 0.5)})` : '');
      b.disabled = !canTrim;
      b.title = canTrim ? `Lepas stasiun ${S.cities[city].name} dan bongkar relnya (uang kembali 50%)`
        : 'Jalur minimal 2 stasiun. Gunakan "Hapus jalur" untuk menghapusnya.';
    };
    trimBtn('b-trim-head', 'Potong awal', st[0], L.segCosts[0]);
    trimBtn('b-trim-tail', 'Potong akhir', st[n - 1], L.segCosts[n - 2]);
  }

  function updateHint() {
    let h;
    const L = S.selected;
    if (S.building && L) {
      if (!L.stations.length) h = `Jalur ${L.name}: klik kota pertama.`;
      else h = `Jalur ${L.name}: klik kota berikutnya untuk memasang rel dari ujung ${S.buildEnd === 'head' ? 'awal' : 'akhir'}. Klik ujung lain untuk pindah arah. Klik area kosong atau Esc untuk selesai.`;
    } else if (L) {
      h = 'Klik ujung jalur untuk memperpanjang, atau gunakan tombol di atas. Klik area kosong untuk batal memilih.';
    } else {
      h = 'Klik kota untuk membuat jalur baru · klik jalur untuk memilihnya · seret untuk menggeser peta, gulir/cubit untuk zoom.';
    }
    $('hint').textContent = h;
  }

  function refreshUi() {
    renderChips();
    updatePanel();
    updateHint();
    resize();
  }

  let lastHud = '';
  function updateHud() {
    const key = [S.day, Math.round(S.money), S.delivered, Math.round(S.satisfaction)].join('|');
    if (key !== lastHud) {
      lastHud = key;
      $('s-day').textContent = S.day;
      const m = $('s-money');
      m.textContent = `$${Math.round(S.money)}`;
      m.classList.toggle('neg', S.money < 0);
      $('s-deliv').textContent = S.delivered;
      const sat = $('s-sat');
      sat.style.width = clamp(S.satisfaction, 0, 100) + '%';
      sat.style.background = S.satisfaction > 60 ? '#2a9d4b' : S.satisfaction > 30 ? '#f0a202' : '#d64045';
      updatePanel();
    }
    // tooltip kota
    const tip = $('tooltip');
    const c = mouse.inside && S.started ? cityAt(mouse) : null;
    if (!c) { tip.hidden = true; return; }
    const cap = SIZE_CAP[c.size];
    const noRoute = c.wait.filter((p) => !isFinite(D(c.id, p.dest))).length;
    const counts = {};
    for (const p of c.wait) counts[p.dest] = (counts[p.dest] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, n]) => `${S.cities[id].name} (${n})`).join(', ');
    const lines = S.lines.filter((l) => l.stations.includes(c.id)).map((l) => l.name).join(', ');
    tip.textContent = `${c.name} · ${SIZE_NAME[c.size]}\nMenunggu: ${c.wait.length}/${cap}` +
      (noRoute ? `\nBelum ada rute: ${noRoute}` : '') +
      (top ? `\nTujuan: ${top}` : '') +
      `\nJalur: ${lines || 'belum terhubung'}`;
    tip.hidden = false;
    const tx = Math.min(mouse.cx + 14, window.innerWidth - tip.offsetWidth - 8);
    const ty = Math.min(mouse.cy + 14, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
  }

  function applyView() {
    const a = view.area;
    view.zoom = clamp(view.zoom, 1, 4);
    view.scale = view.fit * view.zoom;
    const halfW = a.w / 2 / view.scale, halfH = a.h / 2 / view.scale;
    view.cx = halfW * 2 >= W ? W / 2 : clamp(view.cx, halfW, W - halfW);
    view.cy = halfH * 2 >= H ? H / 2 : clamp(view.cy, halfH, H - halfH);
    view.ox = a.x + a.w / 2 - view.cx * view.scale;
    view.oy = a.y + a.h / 2 - view.cy * view.scale;
  }

  function resize() {
    view.dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * view.dpr);
    canvas.height = Math.round(window.innerHeight * view.dpr);
    const top = $('hud-top').offsetHeight, bottom = $('hud-bottom').offsetHeight;
    view.area = { x: 0, y: top, w: window.innerWidth, h: Math.max(50, window.innerHeight - top - bottom) };
    view.fit = Math.max(0.05, Math.min((view.area.w - 16) / W, (view.area.h - 16) / H));
    if (view.needsInit) {
      // layar tegak (HP): perbesar supaya peta mengisi tinggi layar, fokus ke kota-kota awal
      view.needsInit = false;
      const cover = Math.max(view.area.w / W, view.area.h / H) / view.fit;
      view.zoom = cover > 1.3 ? Math.min(2.5, cover) : 1;
      const n = S.cities.length || 1;
      view.cx = S.cities.reduce((s, c) => s + c.x, 0) / n || W / 2;
      view.cy = S.cities.reduce((s, c) => s + c.y, 0) / n || H / 2;
    }
    applyView();
  }
  window.addEventListener('resize', resize);

  // ================= Gambar =================
  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#78b6d2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = view.scale * view.dpr;
    ctx.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
    ctx.drawImage(terrainCanvas, 0, 0);

    drawLines();
    drawPreview();
    for (const c of S.cities) drawCity(c, now);
    for (const tr of S.trains) drawTrain(tr);

    ctx.textAlign = 'center';
    ctx.font = '700 16px system-ui, sans-serif';
    for (const p of S.particles) {
      ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawLines() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const L of S.lines) {
      const sel = S.selected === L;
      for (let k = 0; k + 1 < L.stations.length; k++) {
        const a = L.stations[k], b = L.stations[k + 1];
        const [ox, oy] = segOffset(L.id, a, b);
        const A = S.cities[a], B = S.cities[b];
        if (sel) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 14;
          ctx.beginPath(); ctx.moveTo(A.x + ox, A.y + oy); ctx.lineTo(B.x + ox, B.y + oy); ctx.stroke();
        }
        ctx.strokeStyle = L.color;
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(A.x + ox, A.y + oy); ctx.lineTo(B.x + ox, B.y + oy); ctx.stroke();
      }
    }
  }

  function drawPreview() {
    const L = S.selected;
    if (!S.building || !L || !L.stations.length || !mouse.inside) return;
    const st = L.stations;
    const from = S.cities[S.buildEnd === 'head' ? st[0] : st[st.length - 1]];
    const hover = cityAt(mouse);
    const valid = hover && !st.includes(hover.id);
    const to = valid ? hover : mouse;
    if (dist(from, to) < 20) return;
    const cost = segCost(from, to);
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = L.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.restore();
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    const label = `$${cost}`;
    ctx.font = '700 15px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = '#fff';
    roundRect(mx - w / 2, my - 13, w, 26, 7); ctx.fill();
    ctx.strokeStyle = cost > S.money ? '#d64045' : L.color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = cost > S.money ? '#d64045' : '#1f2433';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTrain(tr) {
    if (tr.line.stations.length < 2) return;
    const p = trainPos(tr);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    const len = 28 + (tr.line.cap - BASE_CAP) * 1.1;
    ctx.fillStyle = tr.line.color;
    ctx.strokeStyle = '#1f2433';
    ctx.lineWidth = 1.5;
    roundRect(-len / 2, -8, len, 16, 4); ctx.fill(); ctx.stroke();
    // titik penumpang di dalam kereta
    ctx.fillStyle = '#fff';
    const n = tr.pax.length, cols = Math.ceil(tr.line.cap / 2);
    const sp = (len - 6) / cols;
    for (let k = 0; k < n; k++) {
      const col = k % cols, row = Math.floor(k / cols);
      ctx.beginPath();
      ctx.arc(-len / 2 + 3 + sp * (col + 0.5), row ? 3.3 : -3.3, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCity(c, now) {
    const r = SIZE_R[c.size], cap = SIZE_CAP[c.size];
    const age = S.t - c.born;
    if (age < 2.5 && S.started) {
      ctx.strokeStyle = `rgba(31,36,51,${1 - age / 2.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, r + age * 22, 0, Math.PI * 2); ctx.stroke();
    }
    // indikator kepadatan
    const fill = c.wait.length / cap;
    if (fill > 0.5) {
      const over = c.wait.length > cap;
      const pulse = over ? 0.6 + 0.4 * Math.sin(now * 8) : 1;
      ctx.strokeStyle = over ? `rgba(214,64,69,${pulse})` : '#f0a202';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fill));
      ctx.stroke();
    }
    // stasiun
    const L = S.selected;
    const onSel = L && L.stations.includes(c.id);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = onSel ? L.color : '#1f2433';
    ctx.lineWidth = onSel ? 4.5 : 3;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (c.size > 1) {
      ctx.fillStyle = '#1f2433';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.size === 2 ? 3 : 5.5, 0, Math.PI * 2); ctx.fill();
    }
    if (S.building && L && L.stations.length) {
      const end = S.buildEnd === 'head' ? L.stations[0] : L.stations[L.stations.length - 1];
      if (end === c.id) {
        ctx.strokeStyle = L.color; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(c.x, c.y, r + 11 + Math.sin(now * 5) * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // penumpang menunggu
    const shown = Math.min(c.wait.length, 24);
    for (let k = 0; k < shown; k++) {
      const p = c.wait[k];
      const col = k % 6, row = Math.floor(k / 6);
      ctx.fillStyle = isFinite(D(c.id, p.dest)) ? '#3a4256' : '#e0565b';
      ctx.beginPath();
      ctx.arc(c.x + r + 10 + col * 8, c.y - r + 4 + row * 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (c.wait.length > 24) {
      ctx.fillStyle = '#d64045';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`+${c.wait.length - 24}`, c.x + r + 7, c.y - r + 4 + 4 * 8 + 5);
    }
    // nama kota
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(c.name, c.x, c.y + r + 20);
    ctx.fillStyle = '#1f2433';
    ctx.fillText(c.name, c.x, c.y + r + 20);
  }

  // ================= Loop utama =================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (S.started && !S.over && !S.paused) {
      for (let k = 0; k < S.speed; k++) update(dt);
    }
    draw(now / 1000);
    updateHud();
    requestAnimationFrame(frame);
  }

  newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const best = loadBest();
  if (best) $('best-start').textContent = `Rekor kamu: ${best} penumpang terantar`;
  resize();
  requestAnimationFrame(frame);

  // dipakai untuk pengujian otomatis
  window.__lintasKota = { get state() { return S; }, view, toast };
})();
