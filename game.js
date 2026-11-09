(() => {
  'use strict';

  // ================= Konstanta =================
  const GEO = window.LINTAS_GEO;
  // Proyeksi sederhana bujur/lintang → koordinat dunia (1° = PX_PER_DEG px)
  const LON0 = 93.8, LAT0 = 6.6, PX_PER_DEG = 90;
  const W = 4330, H = 1600;          // ukuran dunia: 93.8°–141.9° BT, 6.6° LU–11.2° LS
  const proj = (lon, lat) => ({ x: (lon - LON0) * PX_PER_DEG, y: (LAT0 - lat) * PX_PER_DEG });
  const CELL = 10;                   // ukuran sel medan
  const GW = W / CELL, GH = H / CELL;
  const LAND = 0, WATER = 1, MOUNT = 2, FOREIGN = 3;

  const LINE_COLORS = ['#e63946', '#1f78d1', '#f0a202', '#2a9d4b', '#8e44ad', '#e0609a'];
  const LINE_NAMES = ['Merah', 'Biru', 'Kuning', 'Hijau', 'Ungu', 'Merah Muda'];
  const UNLOCK_AT = [0, 0, 0, 40, 120, 250]; // populasi negara yang dibutuhkan untuk membuka jalur

  const DAY_LEN = 20;        // detik per hari permainan
  const TRAIN_SPEED = 110;   // px per detik (±1,2° per detik)
  const TRAIN_COST = 400;
  const CAP_COST = 250;
  const CAP_STEP = 4;
  const BASE_CAP = 6, MAX_CAP = 18;
  const MAX_TRAINS = 4;
  const UPKEEP = 20;         // biaya perawatan per kereta per hari
  const START_MONEY = 1500;
  const SPEEDS = [0.25, 0.5, 1, 2, 3]; // tombol keyboard 1..5; bawaan = 1× (tingkat ke-3)
  const MAX_ZOOM = 6;        // zoom maksimal relatif terhadap tampilan seluruh wilayah
  const MIN_ZOOM = 0.75;     // sedikit di bawah 1 supaya skala bisa dipertahankan saat panel bawah membesar/mengecil
  const LAST_MAP = GEO.LEVEL_REGIONS.length; // peta 1 = Sumatra, tiap peta menambah satu wilayah
  // Level kota 1..8: kapasitas berlipat dua tiap level; hanya ukuran lingkaran yang membedakan di peta
  const SIZE_NAME = ['', 'Kampung', 'Desa', 'Distrik', 'Kota Kecil', 'Kota Besar', 'Metropolitan', 'Megapolitan', 'Kapital'];
  const SIZE_CAP = [0, 8, 16, 32, 64, 128, 256, 512, 1024];
  const SIZE_R = [0, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5];
  const MAX_LEVEL = SIZE_NAME.length - 1;
  // total kunjungan untuk naik dari level i ke i+1 (selisih antarlevel = 5 × kapasitas level itu)
  const GROW_AT = [0, 40, 120, 280, 600, 1240, 2520, 5080];
  const NUMBER_FROM = 3;     // mulai Distrik, penumpang menunggu ditampilkan sebagai angka di dalam lingkaran

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  let S = null;              // state permainan
  let terrainCanvas = null;
  let TERRAIN = null;        // grid medan Indonesia (dibangun sekali saat halaman dimuat)
  const view = {
    scale: 1, ox: 0, oy: 0, dpr: 1, fit: 1, zoom: 1, cx: W / 2, cy: H / 2,
    area: { x: 0, y: 0, w: 1, h: 1 }, needsInit: true,
    bounds: { x0: 0, y0: 0, x1: W, y1: H }, // bagian peta yang aktif (wilayah peta ini)
  };
  // Pengali ukuran kota/label/kereta: saat peta di-zoom jauh, elemen diperbesar supaya tetap terbaca
  let UI = 1;
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
  function loadNum(key) { try { return +localStorage.getItem('lintasKota.' + key) || 0; } catch (e) { return 0; } }
  function saveNum(key, v) { try { localStorage.setItem('lintasKota.' + key, String(v)); } catch (e) { /* abaikan */ } }
  /** Simpan rekor populasi negara untuk peta ini; kembalikan rekornya. */
  function recordBest(level, population) {
    const best = Math.max(loadNum('best.' + level), population);
    saveNum('best.' + level, best);
    return best;
  }

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

  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function distToPolyline(x, y, pts) {
    let best = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
    }
    return best;
  }

  /** Rasterisasi garis pantai & pegunungan dari geo.js menjadi grid medan (sekali saja). */
  function buildTerrain() {
    const withBox = (poly) => {
      const lons = poly.map((p) => p[0]), lats = poly.map((p) => p[1]);
      return { poly, x0: Math.min(...lons), x1: Math.max(...lons), y0: Math.min(...lats), y1: Math.max(...lats) };
    };
    const land = GEO.LAND.map(withBox), foreign = GEO.FOREIGN.map(withBox);
    const hit = (list, lon, lat) => list.some((b) => lon >= b.x0 && lon <= b.x1 && lat >= b.y0 && lat <= b.y1 && inPoly(lon, lat, b.poly));
    const type = new Uint8Array(GW * GH);
    const noise = makeNoise(mulberry32(12345), 60, 24);
    const shade = new Float32Array(GW * GH);
    for (let cy = 0; cy < GH; cy++) {
      for (let cx = 0; cx < GW; cx++) {
        const lon = LON0 + ((cx + 0.5) * CELL) / PX_PER_DEG, lat = LAT0 - ((cy + 0.5) * CELL) / PX_PER_DEG;
        const i = cy * GW + cx;
        shade[i] = noise(cx / GW, cy / GH);
        if (hit(foreign, lon, lat)) type[i] = FOREIGN;
        else if (hit(land, lon, lat)) {
          const mount = GEO.RIDGES.some(([w, pts]) => distToPolyline(lon, lat, pts) < w * (0.75 + 0.5 * shade[i]));
          type[i] = mount ? MOUNT : LAND;
        } else type[i] = WATER;
      }
    }
    // jarak tiap sel laut ke daratan terdekat (untuk gradasi warna laut dangkal → dalam)
    const depth = new Uint16Array(GW * GH).fill(65535);
    const q = [];
    for (let i = 0; i < type.length; i++) if (type[i] !== WATER) { depth[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % GW, y = (i / GW) | 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (depth[j] > depth[i] + 1) { depth[j] = depth[i] + 1; q.push(j); }
      }
    }
    return { type, shade, depth };
  }

  function terrainAt(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return WATER;
    return TERRAIN.type[cy * GW + cx];
  }

  /** Gambar medan ke kanvas terpisah (resolusi setengah, diskalakan saat digambar). */
  function renderTerrain() {
    const T = TERRAIN, R = 0.5;
    terrainCanvas = document.createElement('canvas');
    terrainCanvas.width = W * R; terrainCanvas.height = H * R;
    const g = terrainCanvas.getContext('2d');
    const s = CELL * R;
    const at = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? WATER : T.type[y * GW + x];
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x, t = T.type[i], e = T.shade[i];
        let col;
        if (t === WATER) col = mix('#a8d5e6', '#78b6d2', clamp(T.depth[i] / 8, 0, 1));
        else if (t === FOREIGN) col = mix('#e3e1d8', '#d8d5ca', e);
        else if (t === MOUNT) col = mix('#cbbf9f', '#a8977a', e);
        else {
          const coast = at(x - 1, y) === WATER || at(x + 1, y) === WATER || at(x, y - 1) === WATER || at(x, y + 1) === WATER;
          col = coast ? '#efe4bf' : mix('#e6eed2', '#d0ddb2', e);
        }
        g.fillStyle = col;
        g.fillRect(x * s, y * s, s + 0.5, s + 0.5);
      }
    }
    // simbol gunung
    const r = mulberry32(7);
    for (let y = 1; y < GH - 1; y += 3) {
      for (let x = 1; x < GW - 1; x += 3) {
        if (T.type[y * GW + x] !== MOUNT || r() > 0.6) continue;
        const px = (x * CELL + 5 + (r() - 0.5) * 6) * R, py = (y * CELL + 7 + (r() - 0.5) * 6) * R;
        const m = (6 + r() * 3) * R;
        g.fillStyle = '#8f7f62';
        g.beginPath(); g.moveTo(px - m, py + m * 0.6); g.lineTo(px, py - m * 0.8); g.lineTo(px + m, py + m * 0.6); g.closePath(); g.fill();
        g.fillStyle = '#f4f1e8';
        g.beginPath(); g.moveTo(px - m * 0.35, py - m * 0.25); g.lineTo(px, py - m * 0.8); g.lineTo(px + m * 0.35, py - m * 0.25); g.closePath(); g.fill();
      }
    }
  }

  /** Biaya rel antar dua titik: jarak × pengali medan (darat 1, negara tetangga 2, gunung 2.5, laut 4). */
  function segCost(a, b) {
    const d = dist(a, b);
    const n = Math.max(1, Math.ceil(d / 8));
    let c = 0;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const ty = terrainAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      c += (ty === WATER ? 4 : ty === MOUNT ? 2.5 : ty === FOREIGN ? 2 : 1) * (d / n);
    }
    return Math.round(c * 0.7 / 5) * 5;
  }

  // ================= Kota =================
  // Ibu kota provinsi di posisi aslinya (lihat geo.js)
  const ALL_CITIES = GEO.CITIES.map(([name, lon, lat, region, label]) => ({ name, region, label, ...proj(lon, lat) }));
  const levelRegions = (level) => GEO.LEVEL_REGIONS.slice(0, level);
  const levelCities = (level) => ALL_CITIES.filter((c) => levelRegions(level).includes(c.region));
  const mapCities = (level) => levelCities(level).length;
  const regionName = (key) => GEO.REGIONS[key].name;
  /** Nama peta: "Sumatra", "Sumatra + Jawa", ... (dipendekkan untuk peta besar). */
  function levelTitle(level) {
    const names = levelRegions(level).map(regionName);
    return names.length <= 2 ? names.join(' + ') : `${names[0]} … ${names[names.length - 1]}`;
  }
  /** Kotak wilayah aktif peta ini (koordinat dunia), dengan sedikit tepi. */
  function levelBounds(level) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const key of levelRegions(level)) {
      const [lon0, lon1, lat0, lat1] = GEO.REGIONS[key].bounds;
      const a = proj(lon0 - 0.5, lat1 + 0.5), b = proj(lon1 + 0.5, lat0 - 0.5);
      x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, b.x); y1 = Math.max(y1, b.y);
    }
    return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(W, x1), y1: Math.min(H, y1) };
  }

  /** Munculkan kota berikutnya dari antrean kota peta ini. */
  function spawnCity() {
    const def = S.pool.shift();
    if (!def) return null;
    const city = {
      id: S.cities.length, name: def.name, region: def.region, label: def.label, x: def.x, y: def.y,
      size: 1, visits: 0, pop: 0, wait: [], acc: S.rng() * 0.6, born: S.t, overT: 0,
    };
    S.cities.push(city);
    recomputeNetwork();
    return city;
  }

  /** Urutan acak kota peta ini; 3 kota pertama saling berdekatan supaya awal permainan tidak terlalu berat. */
  function makePool(level, rng) {
    const pool = levelCities(level).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const first = pool[0];
    const near = pool.slice(1).sort((a, b) => dist(a, first) - dist(b, first)).slice(0, 2);
    return [first, ...near, ...pool.filter((c) => c !== first && !near.includes(c))];
  }

  /**
   * Daya tarik kota sebagai tujuan berdasarkan kepadatannya: 1 selama penumpang menunggu ≤ kapasitas,
   * lalu turun dengan (kapasitas / menunggu)² saat kelebihan (1,5× kapasitas → 44%, 2× → 25%).
   */
  function crowdFactor(c) {
    const cap = SIZE_CAP[c.size], n = c.wait.length;
    return n <= cap ? 1 : (cap / n) ** 2;
  }

  function spawnPassenger(city) {
    const others = S.cities.filter((c) => c !== city);
    if (!others.length) return;
    let tot = 0;
    // bobot tujuan = ukuran kota × faktor kepadatan ÷ (1 + jarak/500)
    const w = others.map((c) => { const v = (c.size * crowdFactor(c)) / (1 + dist(c, city) / 500); tot += v; return v; });
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
    // ukuran jaringan terbesar (jumlah kota yang saling terhubung)
    S.largest = 0;
    for (let s = 0; s < n; s++) {
      if (!S.connected[s]) continue;
      S.largest = Math.max(S.largest, S.dist[s].filter(isFinite).length);
    }
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
    const off = idx * 9 * UI;
    return [(-dy / len) * off, (dx / len) * off];
  }

  // ================= Jalur & kereta =================
  function newLine(slot) {
    // stations = urutan stasiun di sepanjang jalur; order = urutan kota saat jalur dibuat (untuk depo & arah kereta)
    const L = { id: slot, color: LINE_COLORS[slot], name: LINE_NAMES[slot], stations: [], order: [], segCosts: [], trains: [], cap: BASE_CAP };
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
    // muncul di kota pertama dalam urutan pembuatan (depo), berangkat ke arah kota kedua dalam urutan itu
    const i = L.stations.indexOf(L.order[0]), j = L.stations.indexOf(L.order[1]);
    const tr = { line: L, i, dir: Math.sign(j - i), prog: 0, state: 'dwell', dwellT: 0.6, pax: [] };
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
    const removedId = fromHead ? st[0] : st[n - 1];
    const removed = S.cities[removedId].name;
    const refund = Math.round((fromHead ? L.segCosts[0] : L.segCosts[n - 2]) * 0.5);
    S.money += refund;
    if (fromHead) {
      st.shift(); L.segCosts.shift();
      for (const tr of L.trains) tr.i -= 1;
    } else {
      st.pop(); L.segCosts.pop();
    }
    // kota yang dilepas keluar dari urutan pembuatan; depo & arah ikut kota berikutnya dalam urutan
    L.order = L.order.filter((id) => id !== removedId);
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
      else if (N < 0 || !(D(N, p.dest) < D(ci, p.dest))) { city.wait.push(p); addVisit(city); moved++; } // transit
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

  /** Kunjungan = penumpang yang turun di kota ini (sampai tujuan atau transit). Jadi syarat naik level. */
  function addVisit(city) {
    city.visits++;
    if (city.size < MAX_LEVEL && city.visits >= GROW_AT[city.size]) {
      city.size++;
      toast(`${city.name} berkembang menjadi ${SIZE_NAME[city.size].toLowerCase()}!`, 'good');
    }
  }

  function deliver(p, city) {
    const fare = 10 + 5 * p.hops;
    S.money += fare;
    S.earned += fare;
    S.population++;   // populasi negara = jumlah populasi semua kota
    city.pop++;       // populasi kota = penumpang yang diantar ke kota ini sebagai tujuan
    S.satisfaction = Math.min(100, S.satisfaction + 0.6);
    addVisit(city);
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
  /** Input & simulasi berhenti saat belum mulai, kalah, atau sedang memilih setelah menang. */
  const blocked = () => !S || !S.started || S.over || S.winChoice;

  function newGame(seed, level) {
    S = {
      seed, rng: mulberry32(seed), level, target: mapCities(level),
      t: 0, day: 1, money: START_MONEY + (level - 1) * 1000, earned: 0, population: 0, satisfaction: 100,
      cities: [], lines: [], trains: [], dist: [], segMap: new Map(), connected: [], largest: 0,
      nextCityAt: 14, speed: 1, paused: false, started: false, over: false,
      won: false, winChoice: false, relaxed: false,
      selected: null, building: false, buildEnd: 'tail', unlocked: 3,
      particles: [],
    };
    S.pool = makePool(level, S.rng);
    view.bounds = levelBounds(level);
    for (let i = 0; i < 3; i++) spawnCity();
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
    if (S.cities.length < S.target) {
      // semua kota yang ada sudah tersambung → kota berikutnya datang lebih cepat
      if (S.largest === S.cities.length) S.nextCityAt = Math.min(S.nextCityAt, S.t + 5);
      if (S.t >= S.nextCityAt) {
        const c = spawnCity();
        S.nextCityAt = S.t + 15 + S.cities.length * 0.6;
        if (c) toast(`Kota baru: ${c.name}, ${regionName(c.region)} (${S.cities.length}/${S.target})`, 'good');
        else S.target = S.cities.length; // peta sudah terlalu padat; target disesuaikan
      }
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
        if (!S.relaxed) S.satisfaction -= Math.min(3, 0.7 + 0.25 * (c.wait.length - cap)) * dt;
      } else {
        c.overT = Math.max(0, c.overT - dt * 2);
      }
    }
    for (const tr of S.trains) updateTrain(tr, dt);
    for (const p of S.particles) { p.life -= dt; p.y -= 14 * dt; }
    S.particles = S.particles.filter((p) => p.life > 0);

    const unlocked = UNLOCK_AT.filter((v) => S.population >= v).length;
    if (unlocked > S.unlocked) {
      S.unlocked = unlocked;
      toast(`Jalur ${LINE_NAMES[unlocked - 1]} terbuka!`, 'good');
      renderChips();
    }
    if (S.relaxed) S.satisfaction = 100;
    if (!S.won && S.cities.length >= S.target && S.largest === S.cities.length) win();
    else if (S.satisfaction <= 0) gameOver();
  }

  /** Tampilkan panel hasil di bawah layar (peta tetap terlihat dan bisa digeser/zoom). */
  function showResult({ title, kind, reason, stats, actions }) {
    S.building = false;
    $('toasts').innerHTML = '';
    $('res-title').textContent = title;
    $('res-title').className = kind;
    $('res-reason').textContent = reason;
    $('res-stats').innerHTML = '';
    for (const [label, value] of stats) {
      const d = document.createElement('div');
      d.innerHTML = '<span class="lbl"></span><b></b>';
      d.firstChild.textContent = label;
      d.lastChild.textContent = value;
      $('res-stats').appendChild(d);
    }
    $('res-actions').innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.primary) b.className = 'primary';
      b.addEventListener('click', a.fn);
      $('res-actions').appendChild(b);
    }
    $('hud-bottom').classList.add('is-result');
    $('result-panel').hidden = false;
    resize();
  }

  function hideResult() {
    $('hud-bottom').classList.remove('is-result');
    $('result-panel').hidden = true;
    resize();
  }

  function win() {
    S.won = true;
    S.winChoice = true;
    const best = recordBest(S.level, S.population);
    const last = S.level >= LAST_MAP;
    if (!last) saveNum('map', Math.max(loadNum('map'), S.level + 1));
    const actions = [];
    if (!last) actions.push({ label: `Lanjut ke Peta ${S.level + 1}: +${regionName(GEO.LEVEL_REGIONS[S.level])} (${mapCities(S.level + 1)} kota)`, primary: true, fn: () => startMap(S.level + 1) });
    actions.push({ label: 'Tetap di peta ini', primary: last, fn: stayRelaxed });
    if (last) actions.push({ label: 'Main lagi dari Peta 1', fn: () => startMap(1) });
    showResult({
      title: last ? 'Nusantara tersambung! Semua peta tamat.' : `Peta ${S.level} (${levelTitle(S.level)}) selesai!`,
      kind: 'good',
      reason: `Semua ${S.cities.length} kota terhubung dalam satu jaringan. Kalau tetap di peta ini, kepuasan selalu penuh dan kamu tidak bisa kalah.`,
      stats: [['Populasi negara', S.population], [`Rekor populasi peta ${S.level}`, best], ['Hari', S.day]],
      actions,
    });
  }

  function stayRelaxed() {
    S.winChoice = false;
    S.relaxed = true;
    S.satisfaction = 100;
    hideResult();
    refreshUi();
    toast('Mode santai: kepuasan selalu penuh. Lanjutkan sesukamu!', 'good');
  }

  function gameOver() {
    S.satisfaction = 0;
    S.over = true;
    const excess = (c) => c.wait.length - SIZE_CAP[c.size];
    const full = S.cities.filter((c) => excess(c) > 0).sort((a, b) => excess(b) - excess(a));
    const best = recordBest(S.level, S.population);
    const names = full.slice(0, 4).map((c) => `${c.name} (${c.wait.length}/${SIZE_CAP[c.size]})`).join(', ');
    showResult({
      title: 'Jaringan kewalahan!',
      kind: 'bad',
      reason: full.length
        ? `Kota penuh: ${names}${full.length > 4 ? `, +${full.length - 4} lainnya` : ''}. Kota bertanda merah di peta.`
        : 'Kepuasan warga habis.',
      stats: [['Populasi negara', S.population], [`Rekor populasi peta ${S.level}`, best], ['Kota terhubung', `${Math.max(0, S.largest)}/${S.target}`]],
      actions: [{ label: `Ulangi Peta ${S.level}`, primary: true, fn: () => startMap(S.level) }],
    });
    if (full.length) { view.cx = full[0].x; view.cy = full[0].y; applyView(); }
  }

  function startMap(level) {
    newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0, level);
    view.needsInit = true;
    S.started = true;
    $('overlay').hidden = true;
    hideResult();
    setSpeed(1);
    refreshUi();
    const added = level > 1 ? `+${regionName(GEO.LEVEL_REGIONS[level - 1])}` : regionName(GEO.LEVEL_REGIONS[0]);
    toast(`Peta ${level}: ${added} · hubungkan ${S.target} kota dalam satu jaringan`);
  }

  // ================= Input =================
  function toWorld(cx, cy) {
    return { x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale };
  }

  /** Jarak di dunia yang setara dengan `px` piksel layar pada zoom saat ini. */
  const screenPx = (px) => px / view.scale;

  /** Kota terdekat dalam jangkauan sentuh: minimal 32 px layar untuk jari, 16 px untuk mouse. */
  function cityAt(p) {
    const minR = screenPx(mouse.touch ? 32 : 16);
    let best = null, bd = Infinity;
    for (const c of S.cities) {
      const d = dist(c, p);
      if (d < Math.max((SIZE_R[c.size] + 14) * UI, minR) && d < bd) { best = c; bd = d; }
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
        if (Math.hypot(p.x - (ax + dx * t), p.y - (ay + dy * t)) < Math.max(10 * UI, screenPx(mouse.touch ? 22 : 8))) return L;
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
    if (!st.length) { st.push(c.id); L.order.push(c.id); refreshUi(); return; }
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
    L.order.push(c.id);
    recomputeNetwork();
    if (st.length === 2 && !L.trains.length) addTrain(L, true);
    S.particles.push({ x: (from.x + c.x) / 2, y: (from.y + c.y) / 2, text: `-$${cost}`, life: 1.2, color: '#b3261e' });
    refreshUi();
  }

  function onPointerDown(e) {
    if (blocked()) return;
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
        toast(S.unlocked < 6 ? 'Semua jalur terpakai. Tambah populasi negara untuk membuka jalur baru.' : 'Semua jalur sudah terpakai.', 'bad');
        return;
      }
      const line = newLine(slot);
      line.stations.push(c.id);
      line.order.push(c.id);
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
    view.zoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
    view.scale = view.fit * view.zoom;
    const a = view.area;
    view.cx = wp.x - (sx - (a.x + a.w / 2)) / view.scale;
    view.cy = wp.y - (sy - (a.y + a.h / 2)) / view.scale;
    applyView();
  }

  function trackMouse(e) {
    const p = toWorld(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y; mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.inside = true;
    mouse.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  }

  canvas.addEventListener('pointerdown', (e) => {
    trackMouse(e);
    if (e.button === 2) { if (!blocked()) stopBuilding(); return; }
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
      // jari lebih goyang daripada mouse: butuh gerak lebih jauh sebelum dianggap menggeser peta
      if (!drag.moved && Math.hypot(dx, dy) > (mouse.touch ? 12 : 7)) drag.moved = true;
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
      // layar sentuh tidak punya "kursor": tooltip kota hanya tampil sebentar setelah ketukan
      if (mouse.touch) mouse.tipUntil = performance.now() + 2500;
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
    if (blocked()) return;
    if (e.code === 'Space') { e.preventDefault(); setSpeed(S.paused ? S.speed : 0); }
    else if (e.key >= '1' && e.key <= String(SPEEDS.length)) setSpeed(SPEEDS[+e.key - 1]);
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
    if (!blocked()) setSpeed(+b.dataset.speed);
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
    // peta 1 sudah dibuat di latar belakang layar pembuka
    S.started = true;
    $('overlay').hidden = true;
    setSpeed(1);
    toast(`Peta 1: Sumatra · hubungkan ${S.target} kota · klik sebuah kota untuk mulai membangun jalur`);
  });
  $('b-continue').addEventListener('click', () => startMap(Math.min(LAST_MAP, loadNum('map'))));
  $('b-next').addEventListener('click', () => { if (S.won && S.level < LAST_MAP) startMap(S.level + 1); });

  // ================= UI DOM =================
  function toast(msg, kind) {
    const box = $('toasts');
    box.style.top = $('hud-top').offsetHeight + 10 + 'px'; // tepat di bawah HUD atas (tingginya bisa berubah di HP)
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
        b.title = `Terbuka setelah populasi negara ${UNLOCK_AT[i]}`;
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
        if (blocked()) return;
        if (i >= S.unlocked) { toast(`Jalur ${LINE_NAMES[i]} terbuka setelah populasi negara ${UNLOCK_AT[i]}`); return; }
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
    const depo = S.cities[L.order[0]].name, next = S.cities[L.order[1]].name;
    $('lp-info').textContent = `${L.stations.length} stasiun · ${L.trains.length} kereta · muat ${L.cap} · depo ${depo} → ${next}`;
    $('b-train').title = `Kereta baru muncul di ${depo}, berangkat ke arah ${next}`;
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
    const key = [S.level, S.largest, S.cities.length, S.target, S.relaxed, S.day, Math.round(S.money), S.population, Math.round(S.satisfaction)].join('|');
    if (key !== lastHud) {
      lastHud = key;
      const newest = regionName(GEO.LEVEL_REGIONS[S.level - 1]);
      $('s-map').textContent = `Peta ${S.level} · ${S.level > 1 ? '+' : ''}${newest}${S.relaxed ? ' · santai' : ''}`;
      $('s-map').title = levelRegions(S.level).map(regionName).join(' + ');
      // jumlah kota dalam jaringan terbesar / target kota peta ini
      $('s-conn').textContent = `${S.largest}/${S.target} kota`;
      $('s-conn').title = `Kota terhubung dalam satu jaringan. ${S.cities.length} dari ${S.target} kota sudah muncul.`;
      $('s-sat-lbl').textContent = S.relaxed ? 'Kepuasan (aman)' : 'Kepuasan';
      $('b-next').hidden = !(S.relaxed && S.level < LAST_MAP);
      $('b-next').textContent = `Peta ${S.level + 1}: +${regionName(GEO.LEVEL_REGIONS[S.level] || GEO.LEVEL_REGIONS[0])} →`;
      $('s-day').textContent = S.day;
      const m = $('s-money');
      m.textContent = `$${Math.round(S.money)}`;
      m.classList.toggle('neg', S.money < 0);
      $('s-deliv').textContent = S.population;
      const sat = $('s-sat');
      sat.style.width = clamp(S.satisfaction, 0, 100) + '%';
      sat.style.background = S.satisfaction > 60 ? '#2a9d4b' : S.satisfaction > 30 ? '#f0a202' : '#d64045';
      updatePanel();
    }
    // tooltip kota
    const tip = $('tooltip');
    const tipOn = mouse.inside && S.started && !(mouse.touch && !(performance.now() < mouse.tipUntil));
    const c = tipOn ? cityAt(mouse) : null;
    if (!c) { tip.hidden = true; return; }
    const cap = SIZE_CAP[c.size];
    const noRoute = c.wait.filter((p) => !isFinite(D(c.id, p.dest))).length;
    const counts = {};
    for (const p of c.wait) counts[p.dest] = (counts[p.dest] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, n]) => `${S.cities[id].name} (${n})`).join(', ');
    const lines = S.lines.filter((l) => l.stations.includes(c.id)).map((l) => l.name).join(', ');
    const visits = c.size < MAX_LEVEL
      ? `\nDikunjungi: ${c.visits}/${GROW_AT[c.size]} menuju ${SIZE_NAME[c.size + 1].toLowerCase()}`
      : `\nDikunjungi: ${c.visits} (level tertinggi)`;
    const appeal = crowdFactor(c);
    tip.textContent = `${c.name} · ${SIZE_NAME[c.size]}\nPopulasi: ${c.pop}${visits}\nMenunggu: ${c.wait.length}/${cap}` +
      (appeal < 1 ? `\nTerlalu padat: minat dikunjungi ${Math.round(appeal * 100)}%` : '') +
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
    const B = view.bounds, bw = B.x1 - B.x0, bh = B.y1 - B.y0;
    view.zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
    view.scale = view.fit * view.zoom;
    // kamera dibatasi ke wilayah peta yang aktif
    const halfW = a.w / 2 / view.scale, halfH = a.h / 2 / view.scale;
    view.cx = halfW * 2 >= bw ? (B.x0 + B.x1) / 2 : clamp(view.cx, B.x0 + halfW, B.x1 - halfW);
    view.cy = halfH * 2 >= bh ? (B.y0 + B.y1) / 2 : clamp(view.cy, B.y0 + halfH, B.y1 - halfH);
    view.ox = a.x + a.w / 2 - view.cx * view.scale;
    view.oy = a.y + a.h / 2 - view.cy * view.scale;
    // ukuran elemen ikut membesar saat skala kecil (maks. 2,6×), supaya kota tetap terlihat & mudah diklik
    UI = clamp(0.8 / view.scale, 1, 2.6);
  }

  function resize() {
    view.dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * view.dpr);
    canvas.height = Math.round(window.innerHeight * view.dpr);
    const top = $('hud-top').offsetHeight, bottom = $('hud-bottom').offsetHeight;
    $('toasts').style.top = top + 10 + 'px'; // notifikasi tepat di bawah HUD atas
    // Kalau ukuran jendela sama dan hanya tinggi HUD yang berubah (mis. panel jalur muncul/hilang),
    // pertahankan skala & posisi peta di layar supaya kota tidak "melompat".
    const keep = !view.needsInit && view.winW === window.innerWidth && view.winH === window.innerHeight;
    const old = { scale: view.scale, ox: view.ox, oy: view.oy };
    view.winW = window.innerWidth; view.winH = window.innerHeight;
    view.area = { x: 0, y: top, w: window.innerWidth, h: Math.max(50, window.innerHeight - top - bottom) };
    const B = view.bounds, bw = B.x1 - B.x0, bh = B.y1 - B.y0;
    view.fit = Math.max(0.02, Math.min((view.area.w - 16) / bw, (view.area.h - 16) / bh));
    if (view.needsInit) {
      // tampilkan seluruh wilayah; hanya kalau peta jadi terlalu kecil (mis. di HP) perbesar & fokus ke kota awal
      view.needsInit = false;
      const cover = Math.max(view.area.w / bw, view.area.h / bh) / view.fit;
      view.zoom = view.area.w < 700 && view.fit < 0.4 ? clamp(Math.min(cover, 0.5 / view.fit), 1, MAX_ZOOM) : 1;
      const n = S.cities.length || 1;
      view.cx = S.cities.reduce((s, c) => s + c.x, 0) / n;
      view.cy = S.cities.reduce((s, c) => s + c.y, 0) / n;
    } else if (keep) {
      const a = view.area;
      view.zoom = old.scale / view.fit;
      view.cx = (a.x + a.w / 2 - old.ox) / old.scale;
      view.cy = (a.y + a.h / 2 - old.oy) / old.scale;
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
    ctx.drawImage(terrainCanvas, 0, 0, W, H);

    drawLines();
    drawPreview();
    for (const c of S.cities) drawCity(c, now);
    for (const tr of S.trains) drawTrain(tr);

    ctx.textAlign = 'center';
    ctx.font = `700 ${16 * UI}px system-ui, sans-serif`;
    for (const p of S.particles) {
      ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
      ctx.lineWidth = 3 * UI; ctx.strokeStyle = '#fff';
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
          ctx.lineWidth = 14 * UI;
          ctx.beginPath(); ctx.moveTo(A.x + ox, A.y + oy); ctx.lineTo(B.x + ox, B.y + oy); ctx.stroke();
        }
        ctx.strokeStyle = L.color;
        ctx.lineWidth = 8 * UI;
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
    if (dist(from, to) < 20 * UI) return;
    const cost = segCost(from, to);
    ctx.save();
    ctx.setLineDash([10 * UI, 8 * UI]);
    ctx.strokeStyle = L.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 5 * UI;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.restore();
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    const label = `$${cost}`;
    ctx.font = `700 ${15 * UI}px system-ui, sans-serif`;
    const w = ctx.measureText(label).width + 14 * UI;
    ctx.fillStyle = '#fff';
    roundRect(mx - w / 2, my - 13 * UI, w, 26 * UI, 7 * UI); ctx.fill();
    ctx.strokeStyle = cost > S.money ? '#d64045' : L.color; ctx.lineWidth = 2 * UI; ctx.stroke();
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
    ctx.scale(UI, UI);
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
    // digambar relatif terhadap pusat kota (X, Y = 0) lalu diskalakan dengan UI
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(UI, UI);
    const X = 0, Y = 0;
    const r = SIZE_R[c.size], cap = SIZE_CAP[c.size];
    const age = S.t - c.born;
    if (age < 2.5 && S.started) {
      ctx.strokeStyle = `rgba(31,36,51,${1 - age / 2.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X, Y, r + age * 22, 0, Math.PI * 2); ctx.stroke();
    }
    // indikator kepadatan
    const fill = c.wait.length / cap;
    if (fill > 0.5) {
      const over = c.wait.length > cap;
      const pulse = over ? 0.6 + 0.4 * Math.sin(now * 8) : 1;
      ctx.strokeStyle = over ? `rgba(214,64,69,${pulse})` : '#f0a202';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(X, Y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fill));
      ctx.stroke();
    }
    // stasiun
    const L = S.selected;
    const onSel = L && L.stations.includes(c.id);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = onSel ? L.color : '#1f2433';
    ctx.lineWidth = onSel ? 4.5 : 3;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (S.building && L && L.stations.length) {
      const end = S.buildEnd === 'head' ? L.stations[0] : L.stations[L.stations.length - 1];
      if (end === c.id) {
        ctx.strokeStyle = L.color; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(X, Y, r + 11 + Math.sin(now * 5) * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // penumpang menunggu
    if (c.size >= NUMBER_FROM) {
      // Distrik ke atas: jumlah penumpang menunggu sebagai angka di dalam lingkaran (merah kalau melebihi kapasitas)
      const n = c.wait.length, label = String(n);
      const fs = Math.min(r * 0.95, (2 * r - 6) / (label.length * 0.62));
      ctx.font = `800 ${fs}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = n > cap ? '#d64045' : n ? '#1f2433' : '#a3aab8';
      ctx.fillText(label, X, Y + 1);
      ctx.textBaseline = 'alphabetic';
      // titik merah kecil di tepi lingkaran: ada penumpang yang tujuannya belum terjangkau
      if (c.wait.some((p) => !isFinite(D(c.id, p.dest)))) {
        ctx.fillStyle = '#e0565b';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(X + r * 0.72, Y - r * 0.72, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else {
      // Kampung & Desa: satu titik per penumpang di samping lingkaran
      const shown = Math.min(c.wait.length, 24);
      for (let k = 0; k < shown; k++) {
        const p = c.wait[k];
        const col = k % 6, row = Math.floor(k / 6);
        ctx.fillStyle = isFinite(D(c.id, p.dest)) ? '#3a4256' : '#e0565b';
        ctx.beginPath();
        ctx.arc(X + r + 10 + col * 8, Y - r + 4 + row * 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c.wait.length > 24) {
        ctx.fillStyle = '#d64045';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`+${c.wait.length - 24}`, X + r + 7, Y - r + 4 + 4 * 8 + 5);
      }
    }
    // nama kota (posisi label diatur per kota di geo.js supaya kota yang berdekatan tidak bertumpuk)
    ctx.font = '600 16px system-ui, sans-serif';
    let lx = X, ly = Y + r + 20;
    ctx.textAlign = 'center';
    if (c.label === 'top') ly = Y - r - 9;
    else if (c.label === 'left') { lx = X - r - 6; ly = Y + 6; ctx.textAlign = 'right'; }
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(c.name, lx, ly);
    ctx.fillStyle = '#1f2433';
    ctx.fillText(c.name, lx, ly);
    ctx.textAlign = 'center';
    // setelah kalah: tandai kota yang penuh supaya mudah ditemukan
    if (S.over && c.wait.length > cap) {
      const pulse = Math.sin(now * 5);
      ctx.strokeStyle = '#d64045';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(X, Y, r + 18 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
      const label = `PENUH ${c.wait.length}/${cap}`;
      ctx.font = '800 13px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 14;
      const by = Y - r - 40;
      ctx.fillStyle = '#d64045';
      roundRect(X - w / 2, by - 11, w, 22, 11); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, X, by + 1);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  // ================= Loop utama =================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!blocked() && !S.paused) {
      // kecepatan 2× / 3× dipecah jadi beberapa langkah kecil; ¼× / ½× cukup satu langkah yang diperkecil
      const steps = Math.ceil(S.speed);
      for (let k = 0; k < steps; k++) update(dt * S.speed / steps);
    }
    draw(now / 1000);
    updateHud();
    requestAnimationFrame(frame);
  }

  TERRAIN = buildTerrain();
  renderTerrain();
  newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0, 1);
  const reached = Math.min(LAST_MAP, loadNum('map'));
  if (reached > 1) {
    $('b-continue').hidden = false;
    $('b-continue').textContent = `Lanjut Peta ${reached}: ${levelTitle(reached)} (${mapCities(reached)} kota)`;
    $('b-start').classList.remove('primary');
  }
  const bests = [];
  for (let l = 1; l <= LAST_MAP; l++) { const b = loadNum('best.' + l); if (b) bests.push(`Peta ${l}: ${b}`); }
  if (bests.length) $('best-start').textContent = `Rekor populasi negara · ${bests.join(' · ')}`;
  resize();
  requestAnimationFrame(frame);

  // dipakai untuk pengujian otomatis
  window.__lintasKota = { get state() { return S; }, view, toast, segCost, ALL_CITIES, spawnPassenger, cityAt, lineAt, toWorld, mouse };
})();
