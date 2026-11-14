(() => {
  'use strict';

  // ================= Konstanta =================
  const GEO = window.LINTAS_GEO;
  // Proyeksi sederhana bujur/lintang → koordinat dunia (1° = PX_PER_DEG px)
  const LON0 = 93.8, LAT0 = 6.6, PX_PER_DEG = 90;
  const W = 4330, H = 1600;          // ukuran dunia: 93.8°–141.9° BT, 6.6° LU–11.2° LS
  const proj = (lon, lat) => ({ x: (lon - LON0) * PX_PER_DEG, y: (LAT0 - lat) * PX_PER_DEG });
  // Peta "Satu Jawa": proyeksi sendiri yang jauh lebih rapat (lihat jawa.js), dunia berukuran sama
  const JAWA = window.LINTAS_JAWA, JV = JAWA.VIEW;
  const projJawa = (lon, lat) => ({ x: (lon - JV.lon0) * JV.ppd, y: (JV.lat0 - lat) * JV.ppd });
  let PPD = PX_PER_DEG; // px per derajat pada peta yang sedang dimainkan (untuk menghitung km)
  const CELL = 10;                   // ukuran sel medan
  const GW = W / CELL, GH = H / CELL;
  const LAND = 0, WATER = 1, MOUNT = 2, FOREIGN = 3;

  // 10 warna jalur/kereta: Maroon, Red, Pink, Yellow, Orange, Lime, DarkGreen, Skyblue, Navy, Violet
  // 15 jalur: Maroon, Red, Pink, Ochre, Orange, Lemon, Lime, Green, DarkGreen, SkyBlue, Blue, Navy, Lilac, Violet, Plum
  const LINE_COLORS = ['#8b1e3f', '#e63946', '#ec5fa8', '#c98a14', '#f37021', '#f0d000', '#9acd1c', '#2eaa4a', '#1e6b34',
    '#3aa6e0', '#2563eb', '#1a2d6b', '#b48ad8', '#7b3fb5', '#8e4585'];
  const LINE_NAMES = ['Marun', 'Merah', 'Pink', 'Oker', 'Jingga', 'Kuning', 'Hijau Muda', 'Hijau', 'Hijau Tua',
    'Biru Langit', 'Biru', 'Biru Dongker', 'Lila', 'Ungu', 'Plum'];
  // Sebuah jalur bisa dipakai kalau DUA syarat terpenuhi:
  //  1. peta: Peta 1 = maks. 4 jalur, tiap peta +2, Peta 7 = semua (15)
  //  2. populasi negara: jalur ke-(i+1) butuh UNLOCK_AT[i]
  const UNLOCK_AT = [0, 0, 20, 40, 120, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000];
  const linesForLevel = (level) => Math.min(LINE_COLORS.length, 2 + 2 * level);
  const levelForLine = (i) => (i < 4 ? 1 : Math.ceil((i - 3) / 2) + 1); // jalur ke-(i+1) tersedia mulai peta ini
  const availableLines = () => {
    let n = 0;
    while (n < linesForLevel(S.level) && S.population >= UNLOCK_AT[n]) n++;
    return n;
  };
  /** Alasan jalur ke-(i+1) belum bisa dipakai. */
  const lockReason = (i) => (i >= linesForLevel(S.level)
    ? `Jalur ${LINE_NAMES[i]} tersedia mulai Indonesia ${levelForLine(i)}`
    : `Jalur ${LINE_NAMES[i]} terbuka setelah populasi negara ${UNLOCK_AT[i]}`);

  const DAY_LEN = 20;        // detik per hari permainan
  const TRAIN_SPEED = 110;   // px per detik (±1,2° per detik)
  const DWELL = 0.5;         // lama berhenti di stasiun (tetap, tidak tergantung jumlah penumpang)
  const HOLD_RATIO = 0.9;    // kereta menahan diri kalau jarak ke kereta depan < 90% jarak ideal
  // laju penumpang per kota (penumpang/detik) = SPAWN_BASE + SPAWN_PER_LEVEL × level
  const SPAWN_BASE = 0.05;      // laju dasar: 1 penumpang tiap 20 detik
  const SPAWN_PER_LEVEL = 0.04; // tambahan per level kota
  const DAY_GROWTH = 0.025;  // laju penumpang naik 2,5% (dari laju dasar) per hari
  const DAY_MULT_MAX = 2;    // ...tapi paling tinggi 2× laju dasar
  const DRAIN_BASE = 0.7;      // kepuasan turun minimal 0,7/detik begitu kota melebihi kapasitas
  const DRAIN_PER_RATIO = 2;   // ...ditambah 2/detik untuk setiap kelipatan kapasitas yang terlampaui
  const DRAIN_MAX = 3;         // ...maksimal 3/detik per kota
  const MAX_HOLD = 2;       // lama menahan diri maksimal per pemberhentian (detik)
  const TRAIN_COST = 400;
  const CAP_COST = 250;
  // muatan satu kereta per level gerbong (level 1 = bawaan, beli "+ Gerbong" untuk naik level)
  const CAR_CAP = [0, 6, 10, 14, 18, 21];
  const MAX_CAR = CAR_CAP.length - 1;
  const BASE_CAP = CAR_CAP[1];
  const KM_PER_TRAIN = 500; // jumlah kereta maksimal per jalur = panjang jalur (km) ÷ 500, minimal 1
  const KM_PER_TRAIN_JAWA = 100; // peta Satu Jawa ±4,9× lebih rapat, jadi 1 kereta per 100 km
  const UPKEEP = 20;         // perawatan harian: $20 per kereta
  const UPKEEP_PER_SEAT = 2; // ...+ $2 per kursi (kapasitas) kereta
  const UPKEEP_TRACK_DIV = 50; // ...+ harga rel semua jalur ÷ 50 (2% per hari; ikut pengali medan)
  const PRICE_GROWTH = 1.5;  // harga kereta & gerbong naik 1,5× setiap kali membeli (per jalur)
  const START_MONEY = 1500;
  const SPEEDS = [0.25, 0.5, 1, 2, 3]; // tombol keyboard 1..5; bawaan = 1× (tingkat ke-3)
  const MAX_ZOOM = 6;        // zoom maksimal relatif terhadap tampilan seluruh wilayah
  const MIN_ZOOM = 0.75;     // sedikit di bawah 1 supaya skala bisa dipertahankan saat panel bawah membesar/mengecil
  const LAST_MAP = GEO.LEVEL_REGIONS.length; // peta 1 = Sumatra, tiap peta menambah satu wilayah
  // Level kota 0..10. Level 0 (Kampung) = belum terhubung jalur, kapasitas 0: penumpang pertama saja sudah membuatnya penuh.
  // Begitu tersambung, kota langsung menjadi Dusun (1); setelah itu kapasitas berlipat 2× tiap level.
  // Hanya ukuran lingkaran yang membedakan level di peta.
  const SIZE_NAME = ['Kampung', 'Dusun', 'Desa', 'Distrik', 'Kota Praja', 'Kotamadya', 'Kota Besar', 'Metropolitan', 'Megapolitan', 'Kota Global', 'Kapital'];
  const SIZE_CAP = [0, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const SIZE_R = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
  const MAX_LEVEL = SIZE_NAME.length - 1;
  // total kunjungan untuk naik dari level i ke i+1 (selisih antarlevel = 5 × kapasitas level itu);
  // Kampung → Dusun bukan lewat kunjungan, tapi saat kota tersambung jalur
  const GROW_AT = [0, 40, 120, 280, 600, 1240, 2520, 5080, 10200, 20440];
  // jumlah maksimal kota per level dalam satu permainan: Kota Global paling banyak 3, Kapital hanya 1
  const LEVEL_LIMIT = { 9: 5, 10: 1 };
  const levelFull = (lv) => LEVEL_LIMIT[lv] !== undefined && S.cities.filter((c) => c.size === lv).length >= LEVEL_LIMIT[lv];
  const NUMBER_FROM = 3;     // mulai Distrik, penumpang menunggu ditampilkan sebagai angka di dalam lingkaran
  // Kota Festival: tiap hari kelipatan 10 (kalau populasi negara > 1000) satu kota terhubung dipilih acak
  // secara bergiliran (setiap kota dapat giliran sekali sebelum ada yang festival lagi). Selama 3 hari,
  // bonus jalur kota itu dalam bobot tujuan penumpang bertambah log10(populasi negara).
  // Stiker landmark: hiasan peta, dipasang berurutan dari yang termurah. Harga landmark ke-n = $1.000 × 1,5^(n−1).
  const LANDMARKS = [
    ['🏠', 'Rumah'], ['🌳', 'Taman'], ['⛲', 'Air Mancur'], ['🏪', 'Pasar'], ['🏫', 'Sekolah'],
    ['🚏', 'Halte'], ['🕌', 'Masjid'], ['🚨', 'Kantor Polisi'], ['🏥', 'Rumah Sakit'], ['🏛️', 'Istana Negara'],
    ['🚉', 'Stasiun'], ['🏭', 'Perindustrian'], ['🏟️', 'Stadion'], ['🎓', 'Universitas'], ['⚓', 'Pelabuhan'],
    ['🏯', 'Kastil'], ['🏢', 'Perkantoran'], ['🗼', 'Menara'], ['🏕️', 'Perkemahan'], ['✈️', 'Bandara'],
  ];
  const LANDMARK_COST = 1000, LANDMARK_GROWTH = 1.5, LANDMARK_PX = 24; // ukuran ikon di peta (ikut zoom)
  const landmarkPrice = (i) => Math.round(LANDMARK_COST * LANDMARK_GROWTH ** i);
  const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const FESTIVAL_EVERY = 10, FESTIVAL_DAYS = 3, FESTIVAL_MIN_POP = 1000;
  const FESTIVAL_COLOR = '#e6007e';
  const SAME_LINE_BONUS = 2; // kota tujuan yang satu jalur dengan kota asal 2× lebih sering dipilih

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  let S = null;              // state permainan
  let terrainCanvas = null;
  let TERRAIN = null;        // grid medan yang sedang dipakai
  const INDO = { terrain: null, canvas: null }; // medan & gambar peta Indonesia (dibuat sekali saat halaman dimuat)
  const JAWA_T = { terrain: null, canvas: null }; // medan & gambar peta Satu Jawa (dibuat saat pertama dimainkan)
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

  /** Rasterisasi garis pantai & pegunungan (geo.js atau jawa.js) menjadi grid medan (sekali per peta). */
  function buildTerrain(G = { land: GEO.LAND, foreign: GEO.FOREIGN, ridges: GEO.RIDGES, lon0: LON0, lat0: LAT0, ppd: PX_PER_DEG }) {
    const withBox = (poly) => {
      const lons = poly.map((p) => p[0]), lats = poly.map((p) => p[1]);
      return { poly, x0: Math.min(...lons), x1: Math.max(...lons), y0: Math.min(...lats), y1: Math.max(...lats) };
    };
    const land = G.land.map(withBox), foreign = G.foreign.map(withBox);
    const hit = (list, lon, lat) => list.some((b) => lon >= b.x0 && lon <= b.x1 && lat >= b.y0 && lat <= b.y1 && inPoly(lon, lat, b.poly));
    const type = new Uint8Array(GW * GH);
    const noise = makeNoise(mulberry32(12345), 60, 24);
    const shade = new Float32Array(GW * GH);
    for (let cy = 0; cy < GH; cy++) {
      for (let cx = 0; cx < GW; cx++) {
        const lon = G.lon0 + ((cx + 0.5) * CELL) / G.ppd, lat = G.lat0 - ((cy + 0.5) * CELL) / G.ppd;
        const i = cy * GW + cx;
        shade[i] = noise(cx / GW, cy / GH);
        if (hit(foreign, lon, lat)) type[i] = FOREIGN;
        else if (hit(land, lon, lat)) {
          const mount = G.ridges.some(([w, pts]) => distToPolyline(lon, lat, pts) < w * (0.75 + 0.5 * shade[i]));
          type[i] = mount ? MOUNT : LAND;
        } else type[i] = WATER;
      }
    }
    return { type, shade, depth: waterDepth(type) };
  }

  /** Jarak tiap sel laut ke daratan terdekat (untuk gradasi warna laut dangkal → dalam). */
  function waterDepth(type) {
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
    return depth;
  }

  // ---- Peta Bebas: pulau-pulau acak (bukan peta Indonesia) ----
  const FREE_BOUNDS = { x0: 0, y0: 0, x1: 2600, y1: 1600 }; // bagian dunia yang dipakai Peta Bebas

  /** Medan acak dari noise di dalam FREE_BOUNDS (tepi cenderung laut → kepulauan); di luarnya laut. */
  function genFreeTerrain(rng) {
    const bw = FREE_BOUNDS.x1 / CELL, bh = FREE_BOUNDS.y1 / CELL;
    const n1 = makeNoise(rng, 5, 3), n2 = makeNoise(rng, 11, 7), n3 = makeNoise(rng, 26, 16);
    const noise = makeNoise(rng, 60, 24);
    const elev = new Float32Array(GW * GH);
    const shade = new Float32Array(GW * GH);
    const inside = [];
    for (let cy = 0; cy < GH; cy++) {
      for (let cx = 0; cx < GW; cx++) {
        const i = cy * GW + cx;
        shade[i] = noise(cx / GW, cy / GH);
        if (cx >= bw || cy >= bh) { elev[i] = -1; continue; }
        const u = (cx + 0.5) / bw, v = (cy + 0.5) / bh;
        let e = 0.55 * n1(u, v) + 0.3 * n2(u, v) + 0.15 * n3(u, v);
        e -= 0.5 * Math.pow(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2, 3);
        elev[i] = e;
        inside.push(e);
      }
    }
    inside.sort((a, b) => a - b);
    const waterLvl = inside[Math.floor(inside.length * 0.4)], mountLvl = inside[Math.floor(inside.length * 0.9)];
    const type = new Uint8Array(GW * GH);
    for (let i = 0; i < type.length; i++) type[i] = elev[i] < waterLvl ? WATER : elev[i] > mountLvl ? MOUNT : LAND;
    return { type, shade, depth: waterDepth(type) };
  }

  function landAround(x, y, r) {
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      if (terrainAt(x + Math.cos(ang) * r, y + Math.sin(ang) * r) === WATER) return false;
    }
    return true;
  }

  /** Kota berikutnya di Peta Bebas: nama ibu kota acak, posisi acak di daratan yang menyebar dari tengah peta. */
  function freeCityDef() {
    const left = S.remaining;
    if (!left.length) return null;
    const def = left[Math.floor(S.rng() * left.length)];
    const B = FREE_BOUNDS, n = S.cities.length;
    const mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2;
    // makin lama gagal, syarat jarak antarkota dilonggarkan supaya 38 kota selalu muat
    for (let tries = 0; tries < 2500; tries++) {
      const radius = (n < 3 ? 300 : 380 + n * 55) + tries * 2;
      const minD = tries < 400 ? 160 : tries < 900 ? 120 : tries < 1600 ? 90 : 70;
      const x = B.x0 + 80 + S.rng() * (B.x1 - B.x0 - 160), y = B.y0 + 80 + S.rng() * (B.y1 - B.y0 - 160);
      if (Math.hypot(x - mx, y - my) > radius) continue;
      const ty = terrainAt(x, y);
      if (!(ty === LAND || (tries >= 1600 && ty === MOUNT)) || !landAround(x, y, 14)) continue;
      if (S.cities.some((c) => Math.hypot(c.x - x, c.y - y) < minD)) continue;
      return { name: def.name, region: 'free', x, y };
    }
    return null;
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
      c += (ty === WATER ? 4 : ty === MOUNT ? 3 : ty === FOREIGN ? 2 : 1) * (d / n);
    }
    return Math.round(c * 0.7 / 5) * 5;
  }

  // ================= Kota =================
  // Ibu kota provinsi di posisi aslinya (lihat geo.js)
  const ALL_CITIES = GEO.CITIES.map(([name, lon, lat, region, label]) => ({ name, region, label, ...proj(lon, lat) }));
  // Kota & ibu kota kabupaten di Jawa (peta Satu Jawa); posisi label diatur otomatis supaya tidak bertumpuk
  const JAWA_CITIES = JAWA.CITIES.map(([name, lon, lat, region, kab, major]) => ({ name, region, kab, major: !!major, ...projJawa(lon, lat) }));
  placeLabels(JAWA_CITIES);
  /**
   * Pilih posisi label tiap kota (bawah/atas/kanan/kiri) yang paling sedikit menimpa label lain dan lingkaran kota lain.
   * Kota besar didahulukan. Dihitung sekali untuk ukuran tampilan normal (UI = 1).
   */
  function placeLabels(list) {
    const m = document.createElement('canvas').getContext('2d');
    m.font = '600 16px system-ui, sans-serif';
    const R = 12, h = 16, rects = [];
    const boxFor = (c, pos) => {
      const w = m.measureText(c.name).width;
      if (pos === 'top') return { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y - R - 9 - h, y1: c.y - R - 6 };
      if (pos === 'left') return { x0: c.x - R - 6 - w, x1: c.x - R - 6, y0: c.y + 6 - h, y1: c.y + 9 };
      if (pos === 'right') return { x0: c.x + R + 6, x1: c.x + R + 6 + w, y0: c.y + 6 - h, y1: c.y + 9 };
      return { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y + R + 20 - h, y1: c.y + R + 23 };
    };
    const ov = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    for (const c of list.slice().sort((a, b) => b.major - a.major)) {
      let best = 'bottom', bs = Infinity;
      for (const pos of ['bottom', 'top', 'right', 'left']) {
        const b = boxFor(c, pos);
        let sc = pos === 'bottom' ? 0 : 1; // sedikit lebih suka di bawah kota
        for (const r of rects) sc += ov(b, r);
        for (const o of list) if (o !== c) sc += 2 * ov(b, { x0: o.x - R, x1: o.x + R, y0: o.y - R, y1: o.y + R });
        if (sc < bs) { bs = sc; best = pos; }
      }
      c.label = best === 'bottom' ? undefined : best;
      rects.push(boxFor(c, best));
    }
  }
  const levelRegions = (level) => GEO.LEVEL_REGIONS.slice(0, level);
  const levelCities = (level) => ALL_CITIES.filter((c) => levelRegions(level).includes(c.region));
  const mapCities = (level) => levelCities(level).length;
  const regionName = (key) => (JAWA.PROVINCES[key] ? JAWA.PROVINCES[key].name : GEO.REGIONS[key] ? GEO.REGIONS[key].name : 'Peta Bebas');
  /** Teks tombol pindah peta: "Peta 6: Nusa Tenggara" (nama wilayah yang ditambahkan peta itu, versi singkat). */
  const mapButtonLabel = (level) => { const r = GEO.REGIONS[GEO.LEVEL_REGIONS[level - 1]]; return `Indonesia ${level}: ${r.short || r.name}`; };
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

  /**
   * Pilih kota berikutnya yang muncul. Calon-calonnya:
   *  - tumbuh: di tiap pulau yang sudah punya kota, kota tersisa yang paling dekat dengan kota-kota di pulau itu;
   *  - menyeberang: kota pertama di pulau tetangga yang belum punya kota, menurut aturan GEO.SPREAD.
   * Salah satu calon dipilih acak, jadi pulau-pulau boleh berselang-seling.
   * Kota-kota awal (maks. 3) selalu tumbuh di pulau yang baru ditambahkan di peta ini.
   */
  function nextCityDef() {
    const left = S.remaining;
    if (!left.length) return null;
    const pick = (arr) => arr[Math.floor(S.rng() * arr.length)];
    const has = (name) => S.cities.some((c) => c.name === name);
    const started = new Set(S.cities.map((c) => c.region));
    // Aturan dengan pengecualian (ifPresent) diundi 50-50 di awal permainan (S.spreadPlan):
    //  'before' → kota pengecualian harus muncul dulu sebelum menyeberang (kota pertama = alt)
    //  'after'  → kota pengecualian ditahan sampai pulau tujuan sudah punya kota (kota pertama = cities)
    const blocked = new Set();
    GEO.SPREAD.forEach((rule, i) => {
      if (S.spreadPlan[i] === 'after' && !started.has(rule.to)) blocked.add(rule.ifPresent);
    });
    const growIn = (region) => {
      const cand = left.filter((d) => d.region === region && !blocked.has(d.name));
      const mine = S.cities.filter((c) => c.region === region);
      if (!cand.length) return null;
      if (!mine.length) return pick(cand);
      const near = (d) => Math.min(...mine.map((c) => dist(c, d)));
      return cand.reduce((a, b) => (near(b) < near(a) ? b : a));
    };
    const newest = GEO.LEVEL_REGIONS[S.level - 1];
    if (S.cities.length < 3 && left.some((d) => d.region === newest)) return growIn(newest);
    const options = [];
    for (const region of started) { const d = growIn(region); if (d) options.push(d); }
    const regions = levelRegions(S.level);
    GEO.SPREAD.forEach((rule, i) => {
      if (!started.has(rule.from) || started.has(rule.to) || !regions.includes(rule.to)) return;
      if (rule.requires && !rule.requires.some(has)) return; // kota syarat di pulau asal belum muncul
      if (S.spreadPlan[i] === 'before' && !has(rule.ifPresent)) return; // tunggu kota pengecualian muncul dulu
      const names = rule.ifPresent && has(rule.ifPresent) ? rule.alt : rule.cities;
      const cand = left.filter((d) => names.includes(d.name));
      if (cand.length) options.push(pick(cand));
    });
    // cadangan: kalau tidak ada calon (seharusnya tidak terjadi), ambil kota tersisa yang terdekat
    if (!options.length) return left.reduce((a, b) => (Math.min(...S.cities.map((c) => dist(c, b))) < Math.min(...S.cities.map((c) => dist(c, a))) ? b : a));
    return pick(options);
  }

  /**
   * Satu Jawa: mulai di salah satu kota besar (diundi), lalu kota muncul dari yang dekat dengan kota yang sudah ada:
   * dua kota awal berikutnya = yang terdekat, setelah itu acak di antara 3 kota tersisa yang terdekat.
   */
  function jawaCityDef() {
    const left = S.remaining;
    if (!left.length) return null;
    if (!S.cities.length) {
      const starts = left.filter((d) => JAWA.STARTS.includes(d.name));
      return starts[Math.floor(S.rng() * starts.length)] || left[0];
    }
    const near = (d) => Math.min(...S.cities.map((c) => dist(c, d)));
    const sorted = left.map((d) => ({ d, n: near(d) })).sort((a, b) => a.n - b.n);
    const k = Math.min(S.cities.length < 3 ? 1 : 3, sorted.length);
    return sorted[Math.floor(S.rng() * k)].d;
  }

  /** Munculkan kota berikutnya. */
  function spawnCity() {
    const def = S.free ? freeCityDef() : S.jawa ? jawaCityDef() : nextCityDef();
    if (!def) return null;
    S.remaining = S.remaining.filter((d) => d.name !== def.name);
    const city = {
      id: S.cities.length, name: def.name, region: def.region, label: def.label, x: def.x, y: def.y,
      kab: def.kab, major: def.major, color: def.color,
      // kota baru = Kampung (level 0) sampai tersambung jalur
      size: 0, visits: 0, pop: 0, wait: [], acc: S.rng() * 0.6, born: S.t, overT: 0,
    };
    S.cities.push(city);
    recomputeNetwork();
    return city;
  }

  /**
   * Daya tarik kota sebagai tujuan berdasarkan kepadatannya: 1 selama penumpang menunggu ≤ kapasitas,
   * lalu turun dengan (kapasitas / menunggu)² saat kelebihan (1,5× kapasitas → 44%, 2× → 25%).
   */
  /**
   * Kapasitas yang dipakai untuk menilai "penuh": kapasitas level, kecuali Kampung (kapasitas 0)
   * yang dianggap berkapasitas maksimal (kapasitas Kapital). Dipakai bersama oleh kepuasan, tampilan, dan tujuan penumpang.
   */
  const effectiveCap = (c) => (c.size === 0 ? SIZE_CAP[MAX_LEVEL] : SIZE_CAP[c.size]);

  function crowdFactor(c) {
    const cap = effectiveCap(c), n = c.wait.length;
    return n <= cap ? 1 : (cap / n) ** 2;
  }

  /** Rasio penumpang menunggu terhadap kapasitas (>1 = penuh dan menurunkan kepuasan). */
  function fillRatio(c) {
    return c.wait.length / effectiveCap(c);
  }

  /**
   * Penurunan kepuasan per detik oleh satu kota, berdasarkan rasio menunggu ÷ kapasitas:
   *   rasio ≤ 1 → 0;  rasio > 1 → 0,7 + 2 × (rasio − 1), maksimal 3.
   */
  function satisfactionDrain(c) {
    const ratio = fillRatio(c);
    return ratio > 1 ? Math.min(DRAIN_MAX, DRAIN_BASE + DRAIN_PER_RATIO * (ratio - 1)) : 0;
  }

  const isFestival = (c) => !!S.festival && S.festival.id === c.id;
  const festivalBonus = () => Math.log10(Math.max(1, S.population)); // ditambahkan ke bonus jalur

  /** Dipanggil saat hari berganti: akhiri festival yang sudah 3 hari, mulai yang baru di hari kelipatan 10. */
  function updateFestival() {
    if (S.festival && S.day >= S.festival.until) {
      toast(`Festival di ${S.cities[S.festival.id].name} selesai`, 'fest', 4000);
      S.festival = null;
    }
    if (S.festival || S.day % FESTIVAL_EVERY !== 0 || S.population <= FESTIVAL_MIN_POP) return;
    // bergiliran: pilih acak di antara kota terhubung yang belum dapat giliran; kalau semua sudah, mulai putaran baru
    let pool = S.cities.filter((c) => c.size >= 1 && !S.festivalDone.includes(c.id));
    if (!pool.length) {
      // putaran baru; kota yang terakhir festival tidak langsung terpilih lagi (kecuali hanya dia yang terhubung)
      const last = S.festivalDone[S.festivalDone.length - 1];
      S.festivalDone = [];
      pool = S.cities.filter((c) => c.size >= 1);
      if (pool.length > 1) pool = pool.filter((c) => c.id !== last);
    }
    if (!pool.length) return;
    const c = pool[Math.floor(S.rng() * pool.length)];
    S.festivalDone.push(c.id);
    S.festival = { id: c.id, from: S.day, until: S.day + FESTIVAL_DAYS };
    toast(`🎉 Festival di ${c.name}! Hari ${S.day}–${S.day + FESTIVAL_DAYS - 1}: lebih banyak orang ingin berkunjung`, 'fest', 6000);
  }

  function spawnPassenger(city) {
    const others = S.cities.filter((c) => c !== city);
    if (!others.length) return;
    let tot = 0;
    // kota yang berada dalam satu jalur dengan kota asal (bisa dicapai tanpa pindah jalur)
    const sameLine = new Set();
    for (const L of S.lines) if (L.stations.includes(city.id)) for (const id of L.stations) sameLine.add(id);
    // bobot tujuan = ukuran kota × faktor kepadatan × (bonus satu jalur + bonus festival) ÷ (1 + jarak/500)
    const w = others.map((c) => {
      // festival menambah bonus jalur sebesar log10(populasi negara)
      const bonus = (sameLine.has(c.id) ? SAME_LINE_BONUS : 1) + (isFestival(c) ? festivalBonus() : 0);
      const size = Math.max(1, c.size);
      const v = (size * crowdFactor(c) * bonus) / (1 + dist(c, city) / 500);
      tot += v;
      return v;
    });
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
    // Kampung yang baru tersambung langsung menjadi Dusun (level tidak turun lagi kalau jalurnya dibongkar)
    for (const c of S.cities) {
      if (c.size === 0 && S.connected[c.id]) {
        c.size = 1;
        toast(`${c.name} tersambung dan menjadi ${SIZE_NAME[1].toLowerCase()}!`, 'good');
      }
    }
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
    const L = { id: slot, color: LINE_COLORS[slot], name: LINE_NAMES[slot], stations: [], order: [], segCosts: [], trains: [], car: 1, cap: BASE_CAP };
    S.lines.push(L);
    S.lines.sort((a, b) => a.id - b.id);
    S.selected = L;
    S.building = true;
    S.buildEnd = 'tail';
    return L;
  }

  // Harga naik 1,5× setiap kali membeli, dihitung per jalur.
  const trainPrice = (L) => Math.round(TRAIN_COST * PRICE_GROWTH ** L.trains.length);
  const capPrice = (L) => Math.round(CAP_COST * PRICE_GROWTH ** (L.car - 1));

  /** Panjang rel sebuah jalur dalam km (1° ≈ 111 km). */
  function lineKm(L) {
    let len = 0;
    for (let s = 0; s + 1 < L.stations.length; s++) len += dist(S.cities[L.stations[s]], S.cities[L.stations[s + 1]]);
    return (len / PPD) * 111;
  }

  /** Jumlah kereta maksimal sebuah jalur: 1 kereta per 500 km rel (dibulatkan ke atas), minimal 1. */
  const kmPerTrain = () => (S && S.jawa ? KM_PER_TRAIN_JAWA : KM_PER_TRAIN);
  const maxTrains = (L) => Math.max(1, Math.ceil(lineKm(L) / kmPerTrain()));

  /**
   * Biaya perawatan harian:
   *   kereta = jumlah kereta × $20 + total kapasitas kereta × $2
   *   jalur  = total harga rel semua jalur ÷ 50 (rel di laut/gunung lebih mahal dirawat)
   */
  function upkeepCost() {
    const trains = S.trains.length * UPKEEP + S.trains.reduce((a, t) => a + t.line.cap, 0) * UPKEEP_PER_SEAT;
    const lines = Math.round(S.lines.reduce((a, L) => a + L.segCosts.reduce((x, c) => x + c, 0), 0) / UPKEEP_TRACK_DIV);
    return { trains, lines, total: trains + lines };
  }

  function addTrain(L) {
    if (L.stations.length < 2) return;
    const max = maxTrains(L);
    if (L.trains.length >= max) { toast(`Jalur ${L.name} maks ${max} kereta (1 kereta per ${kmPerTrain()} km)`, 'bad'); return; }
    const price = trainPrice(L);
    if (S.money < price) { toast(`Kas tidak cukup (butuh $${price})`, 'bad'); return; }
    S.money -= price;
    L.spent = (L.spent || 0) + price; // dicatat untuk pengembalian uang saat jalur dihapus
    // muncul di kota pertama dalam urutan pembuatan (depo), berangkat ke arah kota kedua dalam urutan itu
    const i = L.stations.indexOf(L.order[0]), j = L.stations.indexOf(L.order[1]);
    const tr = { line: L, i, dir: Math.sign(j - i), prog: 0, state: 'dwell', dwellT: 0.6, pax: [] };
    L.trains.push(tr);
    S.trains.push(tr);
    serve(tr, L.stations[tr.i]);
  }

  function upgradeCap(L) {
    if (L.car >= MAX_CAR) return;
    const price = capPrice(L);
    if (S.money < price) { toast(`Kas tidak cukup (butuh $${price})`, 'bad'); return; }
    S.money -= price;
    L.spent = (L.spent || 0) + price;
    L.car++;
    L.cap = CAR_CAP[L.car];
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
    const cut = dropExtraTrains(L);
    toast(`Stasiun ${removed} dilepas dari jalur ${L.name}, kembali $${refund + cut.refund}` +
      (cut.n ? ` · ${cut.n} kereta ikut dibongkar (jalur kini maks ${maxTrains(L)} kereta)` : ''));
  }

  /**
   * Kalau jalur memendek sampai jumlah keretanya melebihi batas, kereta terakhir yang dibeli dibongkar.
   * Penumpangnya turun di stasiun tempat kereta itu berada; uang kembali 50% dari harga beli kereta itu.
   */
  function dropExtraTrains(L) {
    let n = 0, refund = 0;
    while (L.trains.length > maxTrains(L)) { refund += removeTrain(L); n++; }
    return { n, refund };
  }

  /** Harga kereta yang terakhir dibeli di jalur ini (dasar uang kembali saat kereta dibongkar). */
  const lastTrainPrice = (L) => Math.round(TRAIN_COST * PRICE_GROWTH ** Math.max(0, L.trains.length - 1));

  /** Stasiun terdekat dari posisi kereta saat ini (stasiun asal, atau stasiun tujuan kalau sudah lewat separuh ruas). */
  function nearestStation(tr) {
    const st = tr.line.stations, i = clamp(tr.i, 0, st.length - 1), j = tr.i + tr.dir;
    if (tr.state === 'dwell' || j < 0 || j >= st.length) return st[i];
    const len = dist(S.cities[st[i]], S.cities[st[j]]) || 1;
    return tr.prog > len / 2 ? st[j] : st[i];
  }

  /**
   * Bongkar kereta yang terakhir dibeli: penumpangnya turun di stasiun terdekat dan menunggu kereta lain,
   * uang kembali 50% dari harga kereta itu. Mengembalikan jumlah uang yang kembali.
   */
  function removeTrain(L) {
    if (!L.trains.length) return 0;
    const paid = lastTrainPrice(L);
    const tr = L.trains.pop();
    S.trains = S.trains.filter((t) => t !== tr);
    S.cities[nearestStation(tr)].wait.push(...tr.pax);
    L.spent = Math.max(0, (L.spent || 0) - paid);
    const refund = Math.round(paid * 0.5);
    S.money += refund;
    return refund;
  }

  function deleteLine(L) {
    const track = L.segCosts.reduce((a, b) => a + b, 0);
    // kembali 50% dari biaya rel + 50% dari yang dibayar untuk kereta & gerbong jalur ini
    const refund = Math.round((track + (L.spent || 0)) * 0.5);
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
      // satu kali saring (bukan splice di dalam loop): penumpang yang naik dipindah, sisanya tetap berurutan
      if (tr.pax.length < L.cap && city.wait.length) {
        const stay = [];
        for (const p of city.wait) {
          if (tr.pax.length < L.cap && D(N, p.dest) < D(ci, p.dest)) { tr.pax.push(p); moved++; }
          else stay.push(p);
        }
        city.wait = stay;
      }
    }
    return moved;
  }

  /** Kunjungan = penumpang yang turun di kota ini (sampai tujuan atau transit). Jadi syarat naik level. */
  function addVisit(city) {
    city.visits++;
    if (city.size >= 1 && city.size < MAX_LEVEL && city.visits >= GROW_AT[city.size] && !levelFull(city.size + 1)) {
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

  /** Posisi kereta dalam satu putaran pulang-pergi jalurnya (0 = stasiun awal, berangkat maju). */
  function cyclePos(tr, segs, total) {
    const before = segs.slice(0, tr.i).reduce((a, b) => a + b, 0);
    return tr.dir > 0 ? before + tr.prog : 2 * total - before + tr.prog;
  }

  /** Jarak ke kereta di depannya pada jalur yang sama, sebagai bagian dari satu putaran (0..1). */
  function gapAhead(tr) {
    const L = tr.line, st = L.stations;
    if (L.trains.length < 2) return 1;
    const segs = [];
    for (let k = 0; k + 1 < st.length; k++) segs.push(dist(S.cities[st[k]], S.cities[st[k + 1]]));
    const total = segs.reduce((a, b) => a + b, 0), cyc = 2 * total;
    const me = cyclePos(tr, segs, total), myIdx = L.trains.indexOf(tr);
    let best = cyc;
    L.trains.forEach((o, k) => {
      if (o === tr) return;
      let d = (((cyclePos(o, segs, total) - me) % cyc) + cyc) % cyc;
      if (d === 0 && k > myIdx) d = cyc; // posisi sama persis: kereta dengan urutan lebih awal dianggap di depan
      best = Math.min(best, d);
    });
    return best / cyc;
  }

  function updateTrain(tr, dt) {
    const st = tr.line.stations;
    if (st.length < 2) return;
    if (tr.state === 'dwell') {
      tr.dwellT -= dt;
      if (tr.dwellT > 0) return;
      // terlalu dekat dengan kereta di depan → tunggu sebentar di stasiun supaya jarak antarkereta merata
      const ideal = 1 / tr.line.trains.length;
      if ((tr.holdT || 0) < MAX_HOLD && gapAhead(tr) < HOLD_RATIO * ideal) { tr.holdT = (tr.holdT || 0) + dt; return; }
      if (tr.holdT) serve(tr, st[tr.i]); // naikkan penumpang yang datang selama menunggu
      tr.holdT = 0;
      tr.state = 'move';
      return;
    }
    const A = S.cities[st[tr.i]], B = S.cities[st[tr.i + tr.dir]];
    tr.prog += TRAIN_SPEED * dt;
    if (tr.prog >= dist(A, B)) {
      tr.i += tr.dir;
      tr.prog = 0;
      if (tr.i + tr.dir < 0 || tr.i + tr.dir >= st.length) tr.dir = -tr.dir;
      for (const p of tr.pax) p.hops++;
      serve(tr, st[tr.i]);
      tr.state = 'dwell';
      tr.dwellT = DWELL;
      tr.holdT = 0;
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

  /**
   * Mulai permainan baru. free = Peta Bebas: pulau acak dengan ke-38 ibu kota di posisi acak;
   * aturan jalur & kas awal mengikuti peta terakhir (Peta 7).
   */
  function newGame(seed, level, mode = 'indo') {
    if (mode === true) mode = 'free';
    const free = mode === 'free', jawa = mode === 'jawa';
    if (free || jawa) level = LAST_MAP; // aturan jalur & kas awal = peta terakhir
    S = {
      seed, rng: mulberry32(seed), level, mode, free, jawa,
      target: jawa ? JAWA_CITIES.length : free ? ALL_CITIES.length : mapCities(level),
      t: 0, day: 1, money: START_MONEY + (level - 1) * 1000, earned: 0, population: 0, satisfaction: 100,
      cities: [], lines: [], trains: [], dist: [], segMap: new Map(), connected: [], largest: 0,
      nextCityAt: 14, speed: 1, paused: false, started: false, over: false,
      won: false, winChoice: false, relaxed: false,
      selected: null, building: false, buildEnd: 'tail', unlocked: 2, // jalur yang bisa dipakai (diperbarui di update)
      particles: [],
      festival: null,    // { id, from, until }: kota festival, berlangsung dari hari `from` sampai sebelum hari `until`
      festivalDone: [],  // kota yang sudah mendapat giliran festival pada putaran ini
      landmarks: [],     // stiker landmark yang terpasang: { i (urutan di LANDMARKS), x, y }
      placing: false,    // sedang memilih tempat untuk landmark berikutnya
    };
    // kota peta ini yang belum muncul (Peta Bebas: hanya namanya, posisinya diacak saat muncul)
    S.history = []; // populasi negara & kota per hari (untuk grafik)
    S.remaining = jawa ? JAWA_CITIES.slice() : free ? ALL_CITIES.map((c) => ({ name: c.name })) : levelCities(level).slice();
    // undian 50-50 untuk aturan menyeberang yang punya pengecualian (lihat nextCityDef)
    S.spreadPlan = GEO.SPREAD.map((rule) => (rule.ifPresent ? (S.rng() < 0.5 ? 'before' : 'after') : null));
    // medan: Peta Bebas dibuat acak tiap permainan; peta Indonesia memakai medan yang sudah dibuat sekali
    if (free) { TERRAIN = genFreeTerrain(S.rng); renderTerrain(); }
    else if (jawa) {
      if (!JAWA_T.terrain) {
        JAWA_T.terrain = TERRAIN = buildTerrain({ land: JAWA.LAND, foreign: JAWA.FOREIGN, ridges: JAWA.RIDGES, lon0: JV.lon0, lat0: JV.lat0, ppd: JV.ppd });
        renderTerrain();
        JAWA_T.canvas = terrainCanvas;
      } else { TERRAIN = JAWA_T.terrain; terrainCanvas = JAWA_T.canvas; }
    } else if (TERRAIN !== INDO.terrain) { TERRAIN = INDO.terrain; terrainCanvas = INDO.canvas; }
    PPD = jawa ? JV.ppd : PX_PER_DEG;
    view.bounds = free ? { ...FREE_BOUNDS } : jawa ? { x0: 0, y0: 0, x1: W, y1: H } : levelBounds(level);
    // kota awal: maks. 3, semuanya di pulau baru (Peta 7 / Maluku hanya punya 2)
    const startCount = free || jawa ? 3 : Math.min(3, S.remaining.filter((d) => d.region === GEO.LEVEL_REGIONS[level - 1]).length);
    for (let i = 0; i < startCount; i++) spawnCity();
    recordHistory();
    renderChips();
    updatePanel();
    updateHint();
  }

  function update(dt) {
    S.t += dt;
    const day = Math.floor(S.t / DAY_LEN) + 1;
    if (day > S.day) {
      S.day = day;
      recordHistory(); // titik data harian untuk grafik pertumbuhan populasi
      updateFestival();
      const cost = upkeepCost();
      S.money -= cost.total;
      toast(cost.total ? `Hari ${day} · perawatan -$${cost.total} (kereta $${cost.trains} + jalur $${cost.lines})` : `Hari ${day}`);
    }
    if (S.cities.length < S.target) {
      // semua kota yang ada sudah tersambung → kota berikutnya datang lebih cepat
      if (S.largest === S.cities.length) S.nextCityAt = Math.min(S.nextCityAt, S.t + 5);
      if (S.t >= S.nextCityAt) {
        const c = spawnCity();
        // Satu Jawa punya 114 kota, jadi kota baru datang lebih rapat
        S.nextCityAt = S.t + (S.jawa ? 10 + S.cities.length * 0.12 : 15 + S.cities.length * 0.6);
        if (c) toast(S.free ? `Kota baru: ${c.name} (${S.cities.length}/${S.target})` : `Kota baru: ${c.name}, ${regionName(c.region)} (${S.cities.length}/${S.target})`, 'good');
        else S.target = S.cities.length; // peta sudah terlalu padat; target disesuaikan
      }
    }
    // laju penumpang naik 2,5% per hari, maksimal ×2 (tercapai di hari ke-41)
    const mult = Math.min(DAY_MULT_MAX, 1 + DAY_GROWTH * (S.day - 1));
    for (const c of S.cities) {
      if (S.t - c.born > 6) {
        const rate = (SPAWN_BASE + SPAWN_PER_LEVEL * c.size) * mult * (S.connected[c.id] ? 1 : 0.6);
        c.acc += rate * dt;
        while (c.acc >= 1) { c.acc -= 1; spawnPassenger(c); }
      }
      const drain = satisfactionDrain(c);
      if (drain > 0) {
        c.overT += dt;
        if (!S.relaxed) S.satisfaction -= drain * dt;
      } else {
        c.overT = Math.max(0, c.overT - dt * 2);
      }
    }
    for (const tr of S.trains) updateTrain(tr, dt);
    for (const p of S.particles) { p.life -= dt; p.y -= 14 * dt; }
    S.particles = S.particles.filter((p) => p.life > 0);

    const unlocked = availableLines();
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
    closeChart(); // panel menang/kalah ada di panel bawah, jangan tertutup grafik
    S.building = false;
    if (bottomPanel.collapsed) setBottomCollapsed(false); // panel hasil ada di panel bawah
    pruneStubLines();
    renderChips();
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

  /** Kunci rekor & label peta yang sedang dimainkan. */
  const recordKey = () => (S.jawa ? 'jawa' : S.free ? 'free' : S.level);
  const mapName = () => (S.jawa ? 'Satu Jawa' : S.free ? 'Peta Bebas' : `peta ${S.level}`);

  function win() {
    S.won = true;
    S.winChoice = true;
    if (S.jawa) {
      const best = recordBest('jawa', S.population);
      showResult({
        title: 'Satu Jawa tersambung!',
        kind: 'good',
        reason: `Semua ${S.cities.length} kota & ibu kota kabupaten di Jawa terhubung dalam satu jaringan. Kalau tetap di peta ini, kepuasan selalu penuh dan kamu tidak bisa kalah.`,
        stats: [['Populasi', S.population], ['Rekor populasi Satu Jawa', best], ['Hari', S.day]],
        actions: [
          { label: 'Main lagi Satu Jawa', primary: true, fn: () => startMap(0, 'jawa') },
          { label: 'Tetap di peta ini', fn: stayRelaxed },
        ],
      });
      return;
    }
    if (S.free) {
      const best = recordBest('free', S.population);
      showResult({
        title: 'Peta Bebas selesai!',
        kind: 'good',
        reason: `Semua ${S.cities.length} kota terhubung dalam satu jaringan. Kalau tetap di peta ini, kepuasan selalu penuh dan kamu tidak bisa kalah.`,
        stats: [['Populasi negara', S.population], ['Rekor populasi Peta Bebas', best], ['Hari', S.day]],
        actions: [
          { label: 'Main lagi Peta Bebas (peta acak baru)', primary: true, fn: () => startMap(0, 'free') },
          { label: 'Tetap di peta ini', fn: stayRelaxed },
        ],
      });
      return;
    }
    const best = recordBest(S.level, S.population);
    const last = S.level >= LAST_MAP;
    if (!last) saveNum('map', Math.max(loadNum('map'), S.level + 1));
    const actions = [];
    if (!last) actions.push({ label: mapButtonLabel(S.level + 1), primary: true, fn: () => startMap(S.level + 1) });
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
    // kota yang ikut menurunkan kepuasan, dari yang paling parah
    const full = S.cities.filter((c) => satisfactionDrain(c) > 0).sort((a, b) => satisfactionDrain(b) - satisfactionDrain(a));
    const best = recordBest(recordKey(), S.population);
    const names = full.slice(0, 4).map((c) => `${c.name} (${c.wait.length}/${SIZE_CAP[c.size]})`).join(', ');
    showResult({
      title: 'Jaringan kewalahan!',
      kind: 'bad',
      reason: full.length
        ? `Kota penuh: ${names}${full.length > 4 ? `, +${full.length - 4} lainnya` : ''}. Kota bertanda merah di peta.`
        : 'Kepuasan warga habis.',
      stats: [['Populasi negara', S.population], [`Rekor populasi ${mapName()}`, best], ['Kota terhubung', `${Math.max(0, S.largest)}/${S.target}`]],
      actions: [{
        label: S.jawa ? 'Main lagi Satu Jawa' : S.free ? 'Main lagi Peta Bebas (peta acak baru)' : `Ulangi Indonesia ${S.level}`,
        primary: true,
        fn: () => startMap(S.level, S.mode),
      }],
    });
    if (full.length) { view.cx = full[0].x; view.cy = full[0].y; applyView(); }
  }

  function startMap(level, mode = 'indo') {
    if (mode === true) mode = 'free';
    newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0, level, mode);
    view.needsInit = true;
    S.started = true;
    $('overlay').hidden = true;
    hideResult();
    setSpeed(1);
    refreshUi();
    if (mode === 'free') { toast(`Peta Bebas: pulau acak · hubungkan ${S.target} kota dalam satu jaringan`); return; }
    if (mode === 'jawa') { toast(`Satu Jawa: mulai dari ${S.cities[0].name} · hubungkan ${S.target} kota & ibu kota kabupaten dalam satu jaringan`); return; }
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
    S.building = false;
    refreshUi(); // refreshUi membersihkan jalur yang belum punya 2 kota
  }

  /**
   * Hapus jalur "setengah jadi" (kurang dari 2 kota) yang tidak sedang dibangun.
   * Jalur seperti ini tidak punya kereta dan tidak punya panel tombol, jadi tidak boleh tertinggal.
   */
  function pruneStubLines() {
    for (const L of S.lines.slice()) {
      if (L.stations.length >= 2 || (S.building && S.selected === L)) continue;
      deleteLine(L);
    }
  }

  function selectLine(L) {
    if (S.building) stopBuilding();           // selesaikan pembangunan dulu (juga kalau L = jalur yang sedang dibangun)
    if (L && !S.lines.includes(L)) L = null;  // jalur itu ternyata setengah jadi dan sudah dihapus
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
    // jalur baru belum punya kereta; kereta dibeli lewat tombol "+ Kereta"
    if (st.length === 2 && !L.trains.length) toast(`Jalur ${L.name} dibuat. Tambah kereta ($${trainPrice(L)}) supaya bisa beroperasi.`);
    S.particles.push({ x: (from.x + c.x) / 2, y: (from.y + c.y) / 2, text: `-$${cost}`, life: 1.2, color: '#b3261e' });
    refreshUi();
  }

  function onPointerDown(e) {
    if (blocked()) return;
    const p = toWorld(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y; mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.inside = true;
    if (S.placing) { placeLandmark(p); return; }
    // landmark: klik/ketuk dua kali untuk menghapus (klik sekali tidak melakukan apa-apa)
    const lm = !S.building && landmarkAt(p);
    if (lm) {
      const now = performance.now();
      if (lmTap && lmTap.lm === lm && now - lmTap.t < 450) { lmTap = null; removeLandmark(lm); }
      else lmTap = { lm, t: now };
      return;
    }
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
        toast(S.unlocked < LINE_COLORS.length ? `Semua jalur terpakai. ${lockReason(S.unlocked)}.` : 'Semua jalur sudah terpakai.', 'bad');
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
    if (e.button === 2) { if (!blocked()) { if (S.placing) cancelPlacing(); else stopBuilding(); } return; }
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
    else if (e.key === 'Escape') { if (S.placing) cancelPlacing(); else if (S.building) stopBuilding(); else selectLine(null); }
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
  $('b-train').addEventListener('click', () => { if (S.selected) { addTrain(S.selected); refreshUi(); } });
  $('b-untrain').addEventListener('click', () => {
    const L = S.selected;
    if (!L || !L.trains.length) return;
    const n = L.trains[L.trains.length - 1].pax.length;
    const refund = removeTrain(L);
    toast(`1 kereta jalur ${L.name} dibongkar, kembali $${refund}` + (n ? ` · ${n} penumpang turun di stasiun terdekat` : ''));
    refreshUi();
  });
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
  $('b-free').addEventListener('click', () => startMap(0, 'free'));
  $('b-jawa').addEventListener('click', () => startMap(0, 'jawa'));
  $('b-next').addEventListener('click', () => { if (S.won && S.level < LAST_MAP) startMap(S.level + 1); });

  // ================= UI DOM =================
  function toast(msg, kind, ms = 2400) {
    const box = $('toasts');
    box.style.top = $('hud-top').offsetHeight + 10 + 'px'; // tepat di bawah HUD atas (tingginya bisa berubah di HP)
    if (box.lastChild && box.lastChild.textContent === msg && box.lastChild.style.opacity !== '0') return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    // maksimal 3 toast; notifikasi festival tidak ikut tergeser oleh toast biasa
    while (box.children.length > 3) ([...box.children].find((t) => !t.classList.contains('fest')) || box.firstChild).remove();
    setTimeout(() => { el.style.opacity = '0'; }, ms);
    setTimeout(() => el.remove(), ms + 500);
  }

  /**
   * Chip jalur + chip stiker. Tombolnya dibuat sekali (beserta listener-nya); setiap pemanggilan hanya
   * memperbarui teks, warna, dan kelasnya. Sebelumnya semua tombol dibongkar & dibuat ulang tiap perubahan jalur.
   */
  const chipEls = [];
  let stickerEl = null;
  function buildChips() {
    const box = $('chips');
    for (let i = 0; i < LINE_COLORS.length; i++) {
      const b = document.createElement('button');
      b.addEventListener('click', () => {
        if (blocked()) return;
        S.placing = false;
        if (i >= S.unlocked) { toast(lockReason(i)); return; }
        const cur = S.lines.find((l) => l.id === i);
        if (cur) { selectLine(S.selected === cur && !S.building ? null : cur); return; }
        if (S.building) stopBuilding();
        newLine(i);
        refreshUi();
      });
      box.appendChild(b);
      chipEls.push(b);
    }
    // chip stiker landmark: menampilkan landmark berikutnya (yang termurah yang belum terpasang)
    stickerEl = document.createElement('button');
    stickerEl.addEventListener('click', () => {
      if (blocked()) return;
      const li = nextLandmark();
      if (li < 0) { toast(`Semua ${LANDMARKS.length} landmark sudah terpasang`); return; }
      if (S.placing) { cancelPlacing(); return; }
      const price = landmarkPrice(li);
      if (S.money < price) { toast(`Kas tidak cukup untuk ${LANDMARKS[li][1]} (butuh $${price.toLocaleString('id-ID')})`, 'bad'); return; }
      selectLine(null); // berhenti membangun / lepas pilihan jalur
      S.placing = true;
      refreshUi();
    });
    box.appendChild(stickerEl);
  }
  /** Ubah properti DOM hanya kalau nilainya berbeda (menghindari kerja tata letak yang tidak perlu). */
  const setIf = (obj, key, val) => { if (obj[key] !== val) obj[key] = val; };
  function renderChips() {
    if (!chipEls.length) buildChips();
    for (let i = 0; i < LINE_COLORS.length; i++) {
      const b = chipEls[i];
      const L = S.lines.find((l) => l.id === i);
      let cls = 'chip', text, title;
      if (i >= S.unlocked) { cls += ' locked'; text = '🔒'; title = lockReason(i); }
      else if (!L) { cls += ' free'; text = '+'; title = `Jalur ${LINE_NAMES[i]} baru`; }
      else { text = String(L.trains.length); title = `Jalur ${LINE_NAMES[i]} · ${L.trains.length} kereta`; }
      if (S.selected && S.selected.id === i) cls += ' sel';
      setIf(b, 'className', cls);
      setIf(b, 'textContent', text);
      setIf(b, 'title', title);
      setIf(b.style, 'background', LINE_COLORS[i]);
      setIf(b.style, 'color', L ? '#fff' : LINE_COLORS[i]);
    }
    const s = stickerEl, li = nextLandmark();
    if (li < 0) {
      setIf(s, 'className', 'chip sticker locked');
      setIf(s, 'textContent', '✓');
      setIf(s, 'title', `Semua ${LANDMARKS.length} landmark sudah terpasang`);
    } else {
      const [icon, name] = LANDMARKS[li];
      setIf(s, 'className', 'chip sticker' + (S.placing ? ' sel' : ''));
      setIf(s, 'textContent', icon);
      setIf(s, 'title', `${name} · $${landmarkPrice(li).toLocaleString('id-ID')} — klik, lalu klik di daratan untuk memasang. Klik dua kali landmark di peta untuk menghapusnya.`);
    }
  }

  // ---- stiker landmark ----
  let lmTap = null; // ketukan pertama pada landmark (untuk mendeteksi klik dua kali)
  /** Landmark termurah yang belum terpasang, atau -1 kalau semuanya sudah. */
  function nextLandmark() {
    for (let i = 0; i < LANDMARKS.length; i++) if (!S.landmarks.some((l) => l.i === i)) return i;
    return -1;
  }
  /** Landmark terpasang di dekat titik p (radius mengikuti ukuran ikon, lebih lebar untuk jari). */
  function landmarkAt(p) {
    const r = Math.max(LANDMARK_PX * 0.6 * UI, screenPx(mouse.touch ? 26 : 14));
    let best = null, bd = Infinity;
    for (const l of S.landmarks) { const d = dist(l, p); if (d < r && d < bd) { best = l; bd = d; } }
    return best;
  }
  /** Boleh dipasang di mana saja asal bukan air (laut/danau) dan tidak menimpa kota. */
  const canPlaceAt = (p) => terrainAt(p.x, p.y) !== WATER && !cityAt(p);
  function placeLandmark(p) {
    const li = nextLandmark();
    if (li < 0) { cancelPlacing(); return; }
    const [icon, name] = LANDMARKS[li], price = landmarkPrice(li);
    if (terrainAt(p.x, p.y) === WATER) { toast('Landmark tidak bisa dipasang di laut atau danau', 'bad'); return; }
    if (cityAt(p)) { toast('Terlalu dekat dengan kota, pilih tempat lain', 'bad'); return; }
    if (S.money < price) { toast(`Kas tidak cukup untuk ${name} (butuh $${price.toLocaleString('id-ID')})`, 'bad'); cancelPlacing(); return; }
    S.money -= price;
    S.landmarks.push({ i: li, x: p.x, y: p.y });
    S.placing = false;
    S.particles.push({ x: p.x, y: p.y - 22, text: `-$${price.toLocaleString('id-ID')}`, life: 1.2, color: '#b3261e' });
    toast(`${icon} ${name} terpasang`, 'good');
    refreshUi();
  }
  function cancelPlacing() { S.placing = false; refreshUi(); }
  /** Hapus landmark (tanpa uang kembali); ikonnya kembali ke chip stiker. */
  function removeLandmark(lm) {
    S.landmarks = S.landmarks.filter((l) => l !== lm);
    toast(`${LANDMARKS[lm.i][0]} ${LANDMARKS[lm.i][1]} dihapus, ikonnya kembali ke chip stiker`);
    refreshUi();
  }
  function drawLandmarks() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${LANDMARK_PX * UI}px ${EMOJI_FONT}`;
    for (const l of S.landmarks) {
      if (!onScreen(l)) continue;
      ctx.save(); ctx.translate(l.x, l.y); ctx.scale(UI, UI);
      const sz = LANDMARK_PX * 1.4;
      blit(sprite(`lm|${l.i}`, sz, sz, sz / 2, sz / 2, (g) => {
        g.font = `${LANDMARK_PX}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(LANDMARKS[l.i][0], 0, 0);
      }), 0, 0);
      ctx.restore();
    }
    // pratinjau di bawah kursor saat memilih tempat (mouse saja; di layar sentuh langsung ketuk)
    if (S.placing && mouse.inside && !mouse.touch) {
      const li = nextLandmark();
      if (li >= 0) {
        const ok = canPlaceAt(mouse);
        ctx.globalAlpha = ok ? 0.7 : 0.35;
        ctx.fillText(LANDMARKS[li][0], mouse.x, mouse.y);
        ctx.globalAlpha = 1;
        if (!ok) {
          const r = LANDMARK_PX * 0.7 * UI;
          ctx.strokeStyle = '#d64045'; ctx.lineWidth = 3 * UI;
          ctx.beginPath(); ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2);
          ctx.moveTo(mouse.x - r * 0.7, mouse.y + r * 0.7); ctx.lineTo(mouse.x + r * 0.7, mouse.y - r * 0.7); ctx.stroke();
        }
      }
    }
    ctx.textBaseline = 'alphabetic';
  }

  function updatePanel() {
    const L = S.selected;
    const panel = $('line-panel');
    panel.hidden = !L || L.stations.length < 2;
    if (panel.hidden) return;
    $('lp-name').textContent = `Jalur ${L.name}`;
    $('lp-name').style.color = L.color;
    const depo = S.cities[L.order[0]].name, next = S.cities[L.order[1]].name;
    const maxT = maxTrains(L);
    $('lp-info').textContent = `${L.trains.length}/${maxT} kereta · muat ${L.cap}`;
    $('b-train').title = L.trains.length >= maxT
      ? `Maks ${maxT} kereta: 1 kereta per ${kmPerTrain()} km rel (jalur ini ${Math.round(lineKm(L)).toLocaleString('id-ID')} km). Perpanjang jalur untuk menambah batas.`
      : `Kereta baru muncul di ${depo}, berangkat ke arah ${next}`;
    $('b-extend').classList.toggle('active', S.building);
    const tp = trainPrice(L), cp = capPrice(L);
    $('b-train').textContent = L.trains.length >= maxT ? 'Kereta maks' : `+ Kereta ($${tp})`;
    $('b-train').disabled = L.trains.length >= maxT || S.money < tp;
    $('b-untrain').textContent = L.trains.length ? `− Kereta (+$${Math.round(lastTrainPrice(L) * 0.5)})` : '− Kereta';
    $('b-untrain').disabled = !L.trains.length;
    $('b-untrain').title = L.trains.length
      ? 'Bongkar kereta yang terakhir dibeli: penumpangnya turun di stasiun terdekat, uang kembali 50% dari harganya'
      : 'Jalur ini belum punya kereta';
    $('b-cap').textContent = L.car >= MAX_CAR ? 'Gerbong maks' : `+ Gerbong ($${cp})`;
    $('b-cap').disabled = L.car >= MAX_CAR || S.money < cp;
    $('b-cap').title = L.car >= MAX_CAR ? `Gerbong level ${MAX_CAR}: muat ${L.cap}` : `Gerbong level ${L.car + 1}: muat ${L.cap} → ${CAR_CAP[L.car + 1]} per kereta`;
    const st = L.stations, n = st.length, canTrim = n > 2;
    const trimBtn = (id, label, city, cost) => {
      const b = $(id);
      b.textContent = `${label} ${S.cities[city].name}` + (canTrim ? ` (+$${Math.round(cost * 0.5)})` : '');
      b.disabled = !canTrim;
      b.title = canTrim ? `Lepas stasiun ${S.cities[city].name} dan bongkar relnya (uang kembali 50%)`
        : 'Jalur minimal 2 stasiun. Gunakan "Hapus jalur" untuk menghapusnya.';
    };
    trimBtn('b-trim-head', 'Putus', st[0], L.segCosts[0]);
    trimBtn('b-trim-tail', 'Putus', st[n - 1], L.segCosts[n - 2]);
  }

  function updateHint() {
    let h;
    const L = S.selected;
    const li = S.placing ? nextLandmark() : -1;
    if (li >= 0) {
      h = `Pasang ${LANDMARKS[li][0]} ${LANDMARKS[li][1]} ($${landmarkPrice(li).toLocaleString('id-ID')}): klik di daratan (bukan laut/danau). Esc, klik kanan, atau klik chip stiker lagi untuk batal.`;
    } else if (S.building && L) {
      if (!L.stations.length) h = `Jalur ${L.name}: klik kota pertama.`;
      else h = `Jalur ${L.name}: klik kota berikutnya untuk memasang rel dari ujung ${S.buildEnd === 'head' ? 'awal' : 'akhir'}. Klik ujung lain untuk pindah arah. Klik area kosong atau Esc untuk selesai.`;
    } else if (L) {
      h = 'Klik ujung jalur untuk memperpanjang, atau gunakan tombol di atas. Klik area kosong untuk batal memilih.';
    } else {
      h = 'Klik kota untuk membuat jalur baru · klik jalur untuk memilihnya · seret untuk menggeser peta, gulir/cubit untuk zoom.' +
        (S.landmarks.length ? ' · klik dua kali landmark untuk menghapusnya' : '');
    }
    $('hint').textContent = h;
  }

  function refreshUi() {
    pruneStubLines();
    // panel bawah otomatis terbuka saat jalur dipilih/dibangun, supaya tombol-tombolnya bisa dipakai
    if (bottomPanel.collapsed && (S.selected || S.building)) setBottomCollapsed(false);
    renderChips();
    updatePanel();
    updateHint();
    resize();
    cityPanel.last = 0; // perbarui panel samping segera
  }

  // ---- panel bawah: bisa disembunyikan dengan tombol V ----
  const bottomPanel = {
    collapsed: (() => { try { return localStorage.getItem('lintasKota.bottomCollapsed') === '1'; } catch (e) { return false; } })(),
  };
  function setBottomCollapsed(collapsed) {
    bottomPanel.collapsed = collapsed;
    try { localStorage.setItem('lintasKota.bottomCollapsed', collapsed ? '1' : '0'); } catch (e) { /* abaikan */ }
    $('hud-bottom').classList.toggle('collapsed', collapsed);
    const label = collapsed ? 'Tampilkan panel bawah' : 'Sembunyikan panel bawah';
    $('b-collapse').title = label;
    $('b-collapse').setAttribute('aria-label', label);
    resize();
  }
  $('b-collapse').addEventListener('click', () => setBottomCollapsed(!bottomPanel.collapsed));

  // ================= Grafik pertumbuhan populasi =================
  /** Catat populasi negara & tiap kota (dipanggil saat permainan dimulai dan setiap pergantian hari). */
  function recordHistory() {
    S.history.push({ x: S.day, total: S.population, pops: S.cities.map((c) => c.pop) });
  }

  const CHART_TOP = 10; // jumlah kota terbesar yang digambar
  // warna per pulau; tiap kota mendapat gradasi tetap (gelap → terang) menurut urutannya di daftar ibu kota
  const REGION_HUES = [
    { regions: ['sumatra'], h: [0, 8], s: 78, l: [24, 68] },             // merah
    { regions: ['jawa'], h: [128, 140], s: 62, l: [18, 55] },            // hijau
    { regions: ['sulawesi'], h: [212, 205], s: 78, l: [24, 66] },        // biru
    { regions: ['papua'], h: [272, 282], s: 55, l: [24, 70] },           // ungu
    { regions: ['kalimantan'], h: [40, 52], s: 95, l: [36, 54] },        // kuning
    { regions: ['maluku', 'nusatenggara'], h: [0, 0], s: 0, l: [6, 62] }, // hitam
  ];
  // Satu Jawa: warna per provinsi, gradasi per kota
  const JAWA_HUES = [
    { regions: ['banten'], h: [22, 32], s: 90, l: [30, 60] },            // oranye
    { regions: ['jakarta'], h: [0, 0], s: 0, l: [12, 12] },              // hitam
    { regions: ['jabar'], h: [128, 140], s: 62, l: [18, 58] },           // hijau
    { regions: ['jateng'], h: [0, 8], s: 78, l: [24, 70] },              // merah
    { regions: ['diy'], h: [272, 282], s: 55, l: [26, 66] },             // ungu
    { regions: ['jatim'], h: [212, 205], s: 78, l: [22, 68] },           // biru
  ];
  const CITY_COLOR = {};
  for (const g of JAWA_HUES) shadeGroup(JAWA_CITIES.filter((c) => g.regions.includes(c.region)), g, (c, col) => { c.color = col; });
  for (const g of REGION_HUES) shadeGroup(ALL_CITIES.filter((c) => g.regions.includes(c.region)), g, (c, col) => { CITY_COLOR[c.name] = col; });
  /** Beri tiap kota dalam satu kelompok gradasi warnanya sendiri. */
  function shadeGroup(list, g, set) {
    // kota yang bersebelahan di daftar (biasanya bertetangga di peta) diberi gradasi yang berjauhan:
    // urutan gradasi 0, ½N, 1, ½N+1, … (mis. 10 kota: 0 5 1 6 2 7 3 8 4 9)
    const half = Math.ceil(list.length / 2);
    list.forEach((c, i) => {
      const step = i % 2 ? half + (i >> 1) : i >> 1;
      const t = list.length > 1 ? step / (list.length - 1) : 0;
      const lerp = ([a, b]) => a + (b - a) * t;
      set(c, `hsl(${lerp(g.h).toFixed(0)}, ${g.s}%, ${lerp(g.l).toFixed(0)}%)`);
    });
  }
  const fmt = (v) => Math.round(v).toLocaleString('id-ID');
  const chart = { open: false, data: null, hover: null, lastRender: 0 };
  const CHART_REFRESH = 0.25; // detik (waktu nyata) antar-pembaruan grafik live

  /** Data grafik: titik harian + titik "sekarang"; 10 kota terbesar. */
  function chartData() {
    const pts = S.history.slice();
    const nowX = 1 + S.t / DAY_LEN;
    if (nowX > pts[pts.length - 1].x + 0.01) pts.push({ x: nowX, total: S.population, pops: S.cities.map((c) => c.pop) });
    const xs = pts.map((p) => p.x);
    const ranked = S.cities.slice().sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name, 'id'));
    const top = ranked.slice(0, CHART_TOP); // kota di luar 10 besar tidak digambar
    const series = top.map((c) => ({ name: c.name, color: c.color || CITY_COLOR[c.name] || '#898781', city: c, values: pts.map((p) => p.pops[c.id] || 0) }));
    return { xs, total: pts.map((p) => p.total), series };
  }

  /** Batas sumbu "rapi" (1, 2, 5 × 10^n) dengan ±5 garis bantu. */
  function niceTicks(max, count = 5) {
    if (max <= 0) return [0, 1];
    const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw));
    const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)); // populasi selalu bilangan bulat
    const top = Math.ceil(max / step) * step, ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /**
   * Grafik garis SVG di dalam `box`: garis 2px, sumbu y mulai dari 0, garis bantu tipis,
   * penanda di ujung garis, dan garis vertikal + tooltip yang mengikuti kursor (semua seri pada hari itu).
   */
  function lineChart(box, xs, series) {
    box.innerHTML = '';
    const W = box.clientWidth, H = box.clientHeight;
    const m = { l: 44, r: 14, t: 10, b: 24 };
    const pw = Math.max(10, W - m.l - m.r), ph = Math.max(10, H - m.t - m.b);
    const xMax = Math.max(2, xs[xs.length - 1]);
    const yTicks = niceTicks(Math.max(1, ...series.flatMap((s) => s.values)));
    const yMax = yTicks[yTicks.length - 1];
    const X = (x) => m.l + ((x - 1) / (xMax - 1)) * pw;
    const Y = (y) => m.t + ph - (y / yMax) * ph;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, box);
    // garis bantu horizontal + label sumbu y
    for (const v of yTicks) {
      svgEl('line', { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), stroke: v === 0 ? '#c3c2b7' : '#e1e0d9', 'stroke-width': 1 }, svg);
      const t = svgEl('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, svg);
      t.textContent = fmt(v);
    }
    // label sumbu x (hari)
    const xStep = Math.max(1, Math.ceil((xMax - 1) / 8));
    for (let d = 1; d <= Math.floor(xMax); d += xStep) {
      const t = svgEl('text', { x: X(d), y: m.t + ph + 16, 'text-anchor': 'middle' }, svg);
      t.textContent = `H${d}`;
    }
    // garis tiap seri, lalu penanda di ujungnya (dengan cincin warna permukaan)
    for (const s of series) {
      const d = s.values.map((v, k) => `${k ? 'L' : 'M'}${X(xs[k]).toFixed(1)},${Y(v).toFixed(1)}`).join('');
      svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    }
    for (const s of series) {
      const k = xs.length - 1;
      svgEl('circle', { cx: X(xs[k]), cy: Y(s.values[k]), r: 4, fill: s.color, stroke: '#fcfcfb', 'stroke-width': 2 }, svg);
    }
    // garis vertikal + titik + tooltip saat kursor/jari bergerak di atas grafik
    const cross = svgEl('line', { y1: m.t, y2: m.t + ph, stroke: '#898781', 'stroke-width': 1, visibility: 'hidden' }, svg);
    const dots = series.map((s) => svgEl('circle', { r: 4, fill: s.color, stroke: '#fcfcfb', 'stroke-width': 2, visibility: 'hidden' }, svg));
    const hit = svgEl('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' }, svg);
    const tip = $('ch-tip');
    const hide = () => { cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); tip.hidden = true; };
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      let k = 0;
      xs.forEach((x, i) => { if (Math.abs(X(x) - px) < Math.abs(X(xs[k]) - px)) k = i; });
      const cx = X(xs[k]);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      dots.forEach((d, i) => { d.setAttribute('cx', cx); d.setAttribute('cy', Y(series[i].values[k])); d.setAttribute('visibility', 'visible'); });
      // isi tooltip: nilai dulu, lalu nama (teks berwarna tinta, warna seri hanya di garis kecil)
      tip.textContent = '';
      const head = document.createElement('div');
      head.className = 'tt-head';
      head.textContent = k === xs.length - 1 && xs[k] % 1 ? `Hari ${Math.floor(xs[k])} (sekarang)` : `Hari ${xs[k]}`;
      tip.appendChild(head);
      series.map((s) => ({ s, v: s.values[k] })).sort((a, b) => b.v - a.v).forEach(({ s, v }) => {
        const row = document.createElement('div');
        row.className = 'tt-row';
        const i = document.createElement('i'); i.style.background = s.color;
        const bEl = document.createElement('b'); bEl.textContent = fmt(v);
        const sp = document.createElement('span'); sp.textContent = s.name;
        row.append(i, bEl, sp);
        tip.appendChild(row);
      });
      tip.hidden = false;
      const tx = ev.clientX + 14 + tip.offsetWidth > window.innerWidth ? ev.clientX - tip.offsetWidth - 14 : ev.clientX + 14;
      tip.style.left = Math.max(4, tx) + 'px';
      tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 4, Math.max(4, ev.clientY - tip.offsetHeight / 2)) + 'px';
    };
    // posisi kursor diingat, supaya tooltip tetap tampil (dan ikut berubah) saat grafik digambar ulang
    const track = (ev) => { chart.hover = { clientX: ev.clientX, clientY: ev.clientY }; show(chart.hover); };
    hit.addEventListener('pointermove', track);
    hit.addEventListener('pointerdown', track);
    hit.addEventListener('pointerleave', () => { chart.hover = null; hide(); });
    if (chart.hover) show(chart.hover);
  }

  function renderCharts() {
    const d = chartData();
    chart.data = d;
    const n = d.xs.length;
    $('ch-note').textContent = S.jawa
      ? '— 10 kota terbesar · warna menurut provinsi: oranye Banten, hitam DKI Jakarta, hijau Jawa Barat, merah Jawa Tengah, ungu DI Yogyakarta, biru Jawa Timur (gradasi per kota)'
      : '— 10 kota terbesar · warna menurut pulau: merah Sumatra, hijau Jawa, biru Sulawesi, ungu Papua, kuning Kalimantan, hitam Maluku & Nusa Tenggara (gradasi per kota)';
    $('ch-sub').textContent = `${S.jawa ? 'Satu Jawa' : S.free ? 'Peta Bebas' : `Indonesia ${S.level}`} · hari ${S.day} · ${S.cities.length}/${S.target} kota`;
    // legenda (selalu ada untuk ≥ 2 seri)
    const leg = $('ch-legend');
    leg.textContent = '';
    for (const s of d.series) {
      const sp = document.createElement('span');
      const i = document.createElement('i'); i.style.background = s.color;
      sp.append(i, document.createTextNode(s.name));
      leg.appendChild(sp);
    }
    lineChart($('ch-plot-cities'), d.xs, d.series);
    // tabel nilai (juga cadangan untuk warna berkontras rendah)
    const back = Math.max(0, n - 6); // ±5 hari lalu
    const tb = $('ch-table');
    tb.textContent = '';
    const hr = tb.insertRow();
    for (const h of ['Kota', 'Level', 'Populasi', '+5 hari']) { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); }
    for (const s of d.series) {
      const r = tb.insertRow();
      const c0 = r.insertCell(); const i = document.createElement('i'); i.style.background = s.color; c0.append(i, document.createTextNode(s.name));
      r.insertCell().textContent = s.city ? `${LEVEL_CODE[s.city.size]} ${SIZE_NAME[s.city.size]}` : '–';
      r.insertCell().textContent = fmt(s.values[n - 1]);
      const dv = s.values[n - 1] - s.values[back];
      r.insertCell().textContent = (dv >= 0 ? '+' : '−') + fmt(Math.abs(dv));
    }
  }

  /** Grafik menutupi peta tapi tidak HUD atas, jadi kecepatan / jeda tetap bisa diatur. */
  function placeChart() { $('chart-overlay').style.top = $('hud-top').offsetHeight + 'px'; }
  function openChart() {
    chart.open = true;
    chart.hover = null;
    $('chart-overlay').hidden = false;
    $('b-chart').classList.add('active');
    $('b-chart').blur(); // Spasi tetap menjeda/menjalankan permainan, bukan menekan tombol ini
    placeChart();
    renderCharts();
    chart.lastRender = performance.now();
  }
  function closeChart() {
    if (!chart.open) return;
    chart.open = false;
    chart.hover = null;
    $('chart-overlay').hidden = true;
    $('ch-tip').hidden = true;
    $('b-chart').classList.remove('active');
  }
  /** Dipanggil tiap frame: gambar ulang grafik secara berkala selama terbuka. */
  function tickChart(now) {
    if (!chart.open || now - chart.lastRender < CHART_REFRESH * 1000) return;
    chart.lastRender = now;
    placeChart();
    renderCharts();
  }
  $('b-chart').addEventListener('click', () => (chart.open ? closeChart() : openChart()));
  $('ch-close').addEventListener('click', closeChart);
  // pintasan permainan (Spasi, 1–5, …) tetap berlaku; Esc hanya menutup grafik
  window.addEventListener('keydown', (e) => {
    if (chart.open && e.key === 'Escape') { e.stopImmediatePropagation(); closeChart(); }
  }, true);
  window.addEventListener('resize', () => { if (chart.open) renderCharts(); });

  // ---- panel samping: daftar kota / daftar jalur ----
  const LEVEL_CODE = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']; // 0 = Kampung, I = Dusun … X = Kapital
  const PANEL_W = 400;  // sama dengan lebar #city-panel di style.css
  const wideScreen = () => window.innerWidth >= 900; // di layar lebar panel berdampingan dengan peta
  const cityPanel = {
    // mode: 'cities' | 'lines'; open = panel tampil
    mode: (() => { try { return localStorage.getItem('lintasKota.panelMode') === 'lines' ? 'lines' : 'cities'; } catch (e) { return 'cities'; } })(),
    open: (() => { try { const v = localStorage.getItem('lintasKota.cityPanel'); return v == null ? wideScreen() : v === '1'; } catch (e) { return wideScreen(); } })(),
    last: 0,
  };

  /** Tampilkan panel dengan isi `mode`, atau tutup panel (mode = null). */
  function setPanel(mode) {
    cityPanel.open = !!mode;
    if (mode) cityPanel.mode = mode;
    try {
      localStorage.setItem('lintasKota.cityPanel', mode ? '1' : '0');
      localStorage.setItem('lintasKota.panelMode', cityPanel.mode);
    } catch (e) { /* abaikan */ }
    applyPanelUi();
    cityPanel.last = 0;
    resize();
  }
  function applyPanelUi() {
    const lines = cityPanel.mode === 'lines';
    $('city-panel').hidden = !cityPanel.open;
    $('cp-title').textContent = lines ? 'Daftar jalur' : 'Daftar kota';
    $('cp-cities').hidden = lines;
    $('cp-note-cities').hidden = lines;
    $('cp-lines').hidden = !lines;
    $('cp-note-lines').hidden = !lines;
    $('b-cities').classList.toggle('active', cityPanel.open && !lines);
    $('b-lines').classList.toggle('active', cityPanel.open && lines);
  }
  const setCityPanel = (open) => setPanel(open ? 'cities' : null);
  // klik tombol yang sedang aktif = tutup panel; tombol lain = ganti isi panel
  const togglePanel = (mode) => setPanel(cityPanel.open && cityPanel.mode === mode ? null : mode);
  $('b-cities').addEventListener('click', () => togglePanel('cities'));
  $('b-lines').addEventListener('click', () => togglePanel('lines'));
  $('cp-close').addEventListener('click', () => setPanel(null));

  /** Isi tabel jalur: No | Jalur | Kota | Jarak | Kereta | Gerbong | Okupansi. */
  function renderLinePanel() {
    const lines = S.lines.filter((L) => L.stations.length >= 2);
    $('cp-count').textContent = `${lines.length}/${S.unlocked} jalur`;
    const body = $('ln-body');
    if (!lines.length) {
      body.innerHTML = '<tr><td class="empty" colspan="7">Belum ada jalur. Klik sebuah kota untuk mulai membangun.</td></tr>';
      return;
    }
    if (body.children.length !== lines.length || body.querySelector('.empty')) {
      body.innerHTML = '';
      for (let k = 0; k < lines.length; k++) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td></td><td><span class="swatch"></span><span></span></td><td></td><td></td><td></td><td></td><td></td>';
        tr.addEventListener('click', () => {
          const L = S.lines.find((l) => l.id === +tr.dataset.id);
          if (L) { selectLine(L); if (!wideScreen()) setPanel(null); }
        });
        body.appendChild(tr);
      }
    }
    const rows = lines.map((L) => {
      const onboard = L.trains.reduce((a, t) => a + t.pax.length, 0), seats = L.trains.length * L.cap;
      return {
        L, onboard, seats,
        stations: L.stations.length,
        km: Math.round(lineKm(L)),
        trains: L.trains.length,
        cars: L.car,  // level gerbong (1 bawaan … 5)
        occ: seats ? onboard / seats : -1,
      };
    }).sort((a, b) => lineSort.dir * LINE_CMP[lineSort.key](a, b) || a.L.id - b.L.id);
    rows.forEach((r, k) => {
      const { L } = r;
      const tr = body.children[k];
      tr.dataset.id = L.id;
      tr.className = S.selected === L ? 'sel' : '';
      const c = tr.children;
      c[0].textContent = k + 1;
      c[1].firstChild.style.background = L.color;
      c[1].lastChild.textContent = L.name;
      c[2].textContent = r.stations;
      c[3].textContent = r.km.toLocaleString('id-ID'); // km
      c[4].textContent = r.trains;
      c[4].title = `${r.trains} dari maks ${maxTrains(L)} kereta (1 per ${kmPerTrain()} km)`;
      c[5].textContent = r.cars;
      c[5].title = `Gerbong level ${r.cars} · muat ${L.cap} penumpang per kereta`;
      c[6].textContent = r.seats ? `${Math.round(r.occ * 100)}%` : '–';
      c[6].title = r.seats ? `${r.onboard} penumpang dari ${r.seats} kursi` : '';
    });
  }

  // Urutan tabel: klik judul kolom untuk mengurutkan, klik lagi untuk membalik arah.
  // dir: 1 = naik ▲ (kecil → besar, A → Z), -1 = turun ▼. "No" = urutan bawaan.
  const SORT_FIRST_DIR = { default: -1, lines: -1, wait: -1, ratio: -1, level: -1, pop: -1, name: 1 };
  const citySort = { key: 'default', dir: -1 };
  /** Urutan bawaan (juga pemecah seri kolom lain): populasi, lalu level, lalu okupansi (semua dari terbesar), lalu nama A–Z. */
  const defaultCmp = (a, b) => b.c.pop - a.c.pop || b.c.size - a.c.size || b.ratio - a.ratio || a.c.name.localeCompare(b.c.name, 'id');
  // pembanding naik (kecil → besar / A → Z)
  const SORT_CMP = {
    default: () => 0,
    ratio: (a, b) => a.ratio - b.ratio,
    wait: (a, b) => a.c.wait.length - b.c.wait.length,
    lines: (a, b) => linesAt(a.c).length - linesAt(b.c).length,
    level: (a, b) => a.c.size - b.c.size,
    pop: (a, b) => a.c.pop - b.c.pop,
    name: (a, b) => a.c.name.localeCompare(b.c.name, 'id'),
  };

  /**
   * Pasang pengurutan lewat klik judul kolom (th[data-sort]) pada tabel di dalam `sel`.
   * `sort` = { key, dir } yang dibaca saat tabel diisi; `firstDir` = arah klik pertama per kolom.
   */
  function makeSortable(sel, sort, firstDir) {
    const ths = () => document.querySelectorAll(`${sel} thead th[data-sort]`);
    const paint = () => ths().forEach((th) => {
      const on = th.dataset.sort === sort.key;
      th.classList.toggle('sorted', on);
      const label = th.dataset.label || (th.dataset.label = th.textContent);
      th.innerHTML = '';
      th.append(label);
      if (on && sort.key !== 'default') {
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = sort.dir > 0 ? '▲' : '▼'; // ▲ naik, ▼ turun
        th.append(arrow);
      }
    });
    ths().forEach((th) => th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sort.key === key && key !== 'default') sort.dir = -sort.dir;
      else { sort.key = key; sort.dir = firstDir[key]; }
      paint();
      cityPanel.last = 0; // perbarui tabel segera
    }));
    return paint;
  }
  makeSortable('#cp-cities', citySort, SORT_FIRST_DIR);

  // Tabel jalur: urutan bawaan = urutan warna jalur (Marun, Merah, …)
  const lineSort = { key: 'default', dir: 1 };
  const LINE_FIRST_DIR = { default: 1, name: 1, stations: -1, km: -1, trains: -1, cars: -1, occ: -1 };
  const LINE_CMP = { // pembanding naik
    default: () => 0,
    name: (a, b) => a.L.name.localeCompare(b.L.name, 'id'),
    stations: (a, b) => a.stations - b.stations,
    km: (a, b) => a.km - b.km,
    trains: (a, b) => a.trains - b.trains,
    cars: (a, b) => a.cars - b.cars,
    occ: (a, b) => a.occ - b.occ,
  };
  makeSortable('#cp-lines', lineSort, LINE_FIRST_DIR);

  /** Isi tabel sesuai urutan yang dipilih; nilai yang sama diurutkan dengan urutan bawaan. */
  /** Jalur yang melewati kota `c`, urut warna jalur. */
  const linesAt = (c) => S.lines.filter((L) => L.stations.includes(c.id)).sort((a, b) => a.id - b.id);

  function renderCityPanel() {
    const cmp = SORT_CMP[citySort.key];
    // ratio = untuk urutan (Kampung selalu di atas saat diurutkan turun, yang penumpangnya lebih banyak lebih dulu);
    // fill = untuk warna baris (sama dengan aturan turunnya kepuasan)
    const rows = S.cities.map((c) => ({ c, fill: fillRatio(c), ratio: c.size === 0 ? 1e6 + c.wait.length : c.wait.length / SIZE_CAP[c.size] }))
      .sort((a, b) => citySort.dir * cmp(a, b) || defaultCmp(a, b));
    $('cp-count').textContent = `${S.cities.length}/${S.target} kota`;
    const body = $('cp-body');
    // isi ulang hanya kalau jumlah baris berubah; selebihnya perbarui teksnya saja
    if (body.children.length !== rows.length) {
      body.innerHTML = '';
      for (let k = 0; k < rows.length; k++) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td></td><td></td><td></td><td class="cp-dots"></td><td></td><td></td><td></td>';
        tr.addEventListener('click', () => focusCity(+tr.dataset.id));
        body.appendChild(tr);
      }
    }
    rows.forEach(({ c, fill }, k) => {
      const tr = body.children[k];
      tr.dataset.id = c.id;
      tr.className = fill > 1 ? 'over' : fill > 0.5 ? 'warn' : '';
      tr.title = c.size === 0
        ? `${c.name} · Kampung (belum terhubung) · ${c.wait.length} menunggu`
        : `${c.name} · ${SIZE_NAME[c.size]} · ${c.wait.length}/${SIZE_CAP[c.size]} menunggu`;
      const cells = tr.children;
      cells[0].textContent = k + 1;
      cells[1].textContent = LEVEL_CODE[c.size];
      cells[2].textContent = (isFestival(c) ? '🎉 ' : '') + c.name;
      // jalur yang melewati kota: bulatan berwarna jalur (digambar ulang hanya kalau berubah)
      const ls = linesAt(c);
      const key = ls.map((L) => L.id).join(',');
      if (cells[3].dataset.key !== key) {
        cells[3].dataset.key = key;
        cells[3].textContent = '';
        for (const L of ls) {
          const dot = document.createElement('i');
          dot.style.background = L.color;
          dot.title = `Jalur ${L.name}`;
          cells[3].appendChild(dot);
        }
        if (!ls.length) cells[3].textContent = '–';
      }
      cells[4].textContent = c.wait.length;
      // okupansi = menunggu ÷ kapasitas; Kampung (kapasitas 0) tidak punya persentase
      cells[5].textContent = c.size === 0 ? '–' : `${Math.round((c.wait.length / SIZE_CAP[c.size]) * 100)}%`;
      cells[6].textContent = c.pop;
    });
  }

  /** Geser peta ke kota yang dipilih dari daftar dan tandai sebentar. */
  function focusCity(id) {
    const c = S.cities[id];
    if (!c) return;
    view.cx = c.x; view.cy = c.y;
    applyView();
    S.focus = { id, until: performance.now() + 1800 };
    if (!wideScreen()) setCityPanel(false); // di HP tutup panel supaya peta terlihat
  }

  let lastHud = '';
  function updateHud() {
    if (cityPanel.open && performance.now() - cityPanel.last > 400) {
      cityPanel.last = performance.now();
      if (cityPanel.mode === 'lines') renderLinePanel(); else renderCityPanel();
    }
    const key = [S.level, S.mode, S.largest, S.cities.length, S.target, S.relaxed, S.day, Math.round(S.money), S.population, Math.round(S.satisfaction)].join('|');
    if (key !== lastHud) {
      lastHud = key;
      const newest = regionName(GEO.LEVEL_REGIONS[S.level - 1]);
      $('s-map').textContent = S.jawa ? `Satu Jawa${S.relaxed ? ' · santai' : ''}` : S.free
        ? `Peta Bebas${S.relaxed ? ' · santai' : ''}`
        : `Peta ${S.level} · ${S.level > 1 ? '+' : ''}${newest}${S.relaxed ? ' · santai' : ''}`;
      $('s-map').title = S.jawa ? `${S.target} kota & ibu kota kabupaten di Pulau Jawa` : S.free ? 'Pulau acak dengan 38 ibu kota provinsi' : levelRegions(S.level).map(regionName).join(' + ');
      // jumlah kota dalam jaringan terbesar / target kota peta ini
      $('s-conn').textContent = `${S.largest}/${S.target} kota`;
      $('s-conn').title = `Kota terhubung dalam satu jaringan. ${S.cities.length} dari ${S.target} kota sudah muncul.`;
      $('s-sat-lbl').textContent = S.relaxed ? 'Kepuasan (aman)' : 'Kepuasan';
      $('b-next').hidden = !(S.relaxed && !S.free && !S.jawa && S.level < LAST_MAP);
      $('b-next').textContent = mapButtonLabel(Math.min(S.level + 1, LAST_MAP));
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
    // (kunjungan/syarat level berikutnya); Kampung belum bisa naik lewat kunjungan, Kapital sudah tertinggi
    // kalau kuota level berikutnya sudah habis (5 Kota Global / 1 Kapital), tulis "kuota penuh"
    const visits = c.size === 0 ? 'belum terhubung' : c.size >= MAX_LEVEL ? `${c.visits}`
      : `${c.visits}/${GROW_AT[c.size]}` + (levelFull(c.size + 1) ? ` · ${SIZE_NAME[c.size + 1]} sudah ${LEVEL_LIMIT[c.size + 1]}` : '');
    const appeal = crowdFactor(c);
    // Contoh:
    //   Padang: II Desa (63/120)
    //   Populasi: 9/16 (14)          ← menunggu/kapasitas (populasi)
    //   Medan (4), Jambi (3), Bengkulu (2)
    //   Belum ada rute: 2
    //   Terlalu padat: minat dikunjungi 79%
    //   Jalur: Merah, Kuning
    tip.textContent = `${c.name}: ${LEVEL_CODE[c.size]} ${SIZE_NAME[c.size]} (${visits})` +
      (S.jawa ? `\n${c.kab ? `Ibu kota ${c.kab}` : c.region === 'jakarta' ? 'Ibu kota negara' : `Kota ${c.name}`}, ${regionName(c.region)}` : '') +
      `\nPopulasi: ${c.wait.length}/${cap} (${c.pop})` +
      (top ? `\n${top}` : '') +
      (noRoute ? `\nBelum ada rute: ${noRoute}` : '') +
      (appeal < 1 ? `\nTerlalu padat: minat dikunjungi ${Math.round(appeal * 100)}%` : '') +
      `\nJalur: ${lines || 'belum terhubung'}` +
      (isFestival(c) ? `\n🎉 Festival sampai hari ${S.festival.until - 1}: bonus jalur +${festivalBonus().toFixed(2)}` : '');
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
    view.dpr = Math.min(2, window.devicePixelRatio || 1); // maks 2×: di layar 3× hampir tak terlihat bedanya, piksel jauh lebih sedikit
    // ukuran kanvas hanya diubah kalau memang berbeda: menetapkannya ulang (walau sama) membuang & mengalokasikan
    // ulang seluruh buffer kanvas, dan resize() dipanggil setiap kali jalur berubah
    const cw = Math.round(window.innerWidth * view.dpr), ch = Math.round(window.innerHeight * view.dpr);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    // panel bawah yang disembunyikan tidak memakan ruang peta (hanya tombol ^ yang mengambang)
    const top = $('hud-top').offsetHeight, bottom = bottomPanel.collapsed ? 0 : $('hud-bottom').offsetHeight;
    $('toasts').style.top = top + 10 + 'px'; // notifikasi tepat di bawah HUD atas
    // Kalau ukuran jendela sama dan hanya tinggi HUD yang berubah (mis. panel jalur muncul/hilang),
    // pertahankan skala & posisi peta di layar supaya kota tidak "melompat".
    const keep = !view.needsInit && view.winW === window.innerWidth && view.winH === window.innerHeight;
    const old = { scale: view.scale, ox: view.ox, oy: view.oy };
    view.winW = window.innerWidth; view.winH = window.innerHeight;
    // panel daftar kota mengisi ruang di antara HUD atas dan bawah; di layar lebar peta bergeser memberi tempat
    const panel = $('city-panel');
    panel.style.top = top + 'px';
    panel.style.bottom = bottom + 'px';
    const side = cityPanel.open && wideScreen() ? PANEL_W : 0;
    view.area = { x: 0, y: top, w: window.innerWidth - side, h: Math.max(50, window.innerHeight - top - bottom) };
    const B = view.bounds, bw = B.x1 - B.x0, bh = B.y1 - B.y0;
    view.fit = Math.max(0.02, Math.min((view.area.w - 16) / bw, (view.area.h - 16) / bh));
    if (view.needsInit) {
      // tampilkan seluruh wilayah; hanya kalau peta jadi terlalu kecil (mis. di HP) perbesar & fokus ke kota awal
      view.needsInit = false;
      const cover = Math.max(view.area.w / bw, view.area.h / bh) / view.fit;
      view.zoom = view.area.w < 700 && view.fit < 0.4 ? clamp(Math.min(cover, 0.5 / view.fit), 1, MAX_ZOOM) : 1;
      // Satu Jawa: pulau terlalu panjang untuk 3 kota awal; mulai dengan skala ±0,9 (seperti peta Indonesia di-zoom)
      if (S.jawa) view.zoom = clamp(0.9 / view.fit, 1, MAX_ZOOM);
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
  /**
   * Latar (laut + medan) yang sudah diskalakan ke ukuran layar. Memperbesar gambar medan adalah pekerjaan
   * menggambar termahal, jadi hanya dilakukan saat peta digeser/di-zoom/layar berubah; frame lain cukup menyalin 1:1.
   */
  const bg = { canvas: document.createElement('canvas'), key: '', terrain: null };
  function drawBackground() {
    const key = `${canvas.width}x${canvas.height}|${view.scale}|${view.ox}|${view.oy}|${view.dpr}`;
    if (bg.key !== key || bg.terrain !== terrainCanvas) {
      bg.key = key; bg.terrain = terrainCanvas;
      if (bg.canvas.width !== canvas.width || bg.canvas.height !== canvas.height) { bg.canvas.width = canvas.width; bg.canvas.height = canvas.height; }
      const g = bg.canvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#78b6d2';
      g.fillRect(0, 0, bg.canvas.width, bg.canvas.height);
      const k = view.scale * view.dpr;
      g.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
      g.drawImage(terrainCanvas, 0, 0, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg.canvas, 0, 0);
  }

  const vis = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const onScreen = (p) => p.x > vis.x0 && p.x < vis.x1 && p.y > vis.y0 && p.y < vis.y1;

  function draw(now) {
    drawBackground();
    updateSpriteScale();
    const k = view.scale * view.dpr;
    ctx.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
    // bagian dunia yang terlihat (+ tepi untuk lingkaran, titik penumpang & nama); yang di luarnya tidak digambar
    const m = 160 * UI;
    vis.x0 = -view.ox / view.scale - m; vis.y0 = -view.oy / view.scale - m;
    vis.x1 = (window.innerWidth - view.ox) / view.scale + m; vis.y1 = (window.innerHeight - view.oy) / view.scale + m;

    drawLines();
    drawLandmarks();
    drawPreview();
    if (S.jawa) cullLabels();
    for (const c of S.cities) if (onScreen(c)) drawCity(c, now);
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

  /**
   * Satu Jawa: tentukan nama kota mana yang digambar frame ini. Kota diurutkan dari yang paling penting
   * (kota besar, level tertinggi, populasi terbesar); nama yang menimpa nama yang sudah dipilih dilewati.
   * Jadi nama hanya hilang kalau memang tidak ada ruang, dan muncul lagi saat peta di-zoom.
   */
  function cullLabels() {
    ctx.font = '600 16px system-ui, sans-serif';
    const kept = [];
    const order = S.cities.slice().sort((a, b) => b.major - a.major || b.size - a.size || b.pop - a.pop || a.id - b.id);
    for (const c of order) {
      if (c.labelW === undefined) c.labelW = ctx.measureText(c.name).width;
      const r = SIZE_R[c.size], w = c.labelW;
      let x0, x1, y0, y1; // kotak nama relatif pusat kota (sebelum diskalakan UI), sama dengan posisi gambar di drawCity
      if (c.label === 'top') { x0 = -w / 2; x1 = w / 2; y0 = -r - 25; y1 = -r - 6; }
      else if (c.label === 'left') { x0 = -r - 6 - w; x1 = -r - 6; y0 = -10; y1 = 9; }
      else if (c.label === 'right') { x0 = r + 6; x1 = r + 6 + w; y0 = -10; y1 = 9; }
      else { x0 = -w / 2; x1 = w / 2; y0 = r + 4; y1 = r + 23; }
      const box = { x0: c.x + x0 * UI, x1: c.x + x1 * UI, y0: c.y + y0 * UI, y1: c.y + y1 * UI };
      c.showLabel = !kept.some((k) => box.x0 < k.x1 && box.x1 > k.x0 && box.y0 < k.y1 && box.y1 > k.y0);
      if (c.showLabel) kept.push(box);
    }
  }

  // ---- sprite: bentuk yang digambar berulang (lingkaran stasiun, titik penumpang, angka, nama kota, kereta, ikon)
  // dibuat sekali ke kanvas kecil, lalu setiap frame cukup ditempel dengan drawImage. Di GPU, menggambar ratusan
  // lingkaran/teks sebagai path setiap frame jauh lebih mahal daripada menempel gambar jadi.
  const sprites = new Map();
  let spriteQ = 1; // piksel layar per satuan lokal (sudah termasuk UI), dibulatkan ke kelipatan 10% supaya cache awet saat zoom
  function updateSpriteScale() {
    const px = view.scale * view.dpr * UI;
    spriteQ = Math.pow(1.1, Math.round(Math.log(px) / Math.log(1.1)));
  }
  /** Ambil (atau buat sekali) sprite berukuran w×h satuan lokal; draw(g) menggambar relatif titik jangkar (ax, ay). */
  function sprite(key, w, h, ax, ay, draw) {
    const k = key + '@' + spriteQ.toFixed(4);
    let s = sprites.get(k);
    if (!s) {
      if (sprites.size > 1500) sprites.clear(); // batas memori: angka antrean terus berganti
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w * spriteQ));
      cv.height = Math.max(1, Math.ceil(h * spriteQ));
      const g = cv.getContext('2d');
      g.scale(spriteQ, spriteQ);
      g.translate(ax, ay);
      draw(g);
      s = { cv, ax, ay, w: cv.width / spriteQ, h: cv.height / spriteQ };
      sprites.set(k, s);
    }
    return s;
  }
  /** Tempel sprite dengan titik jangkarnya di (x, y), dalam koordinat lokal kanvas saat ini. */
  const blit = (s, x, y) => ctx.drawImage(s.cv, x - s.ax, y - s.ay, s.w, s.h);
  const circleSprite = (r, fill, stroke, lw) => sprite(`c|${r}|${fill}|${stroke}|${lw}`, 2 * r + lw + 4, 2 * r + lw + 4, r + lw / 2 + 2, r + lw / 2 + 2, (g) => {
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  });

  function drawLines() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // satu path per jalur (bukan satu per ruas); ruas tetap terpisah (moveTo) karena geser sejajarnya bisa beda
    const path = (L) => {
      ctx.beginPath();
      for (let k = 0; k + 1 < L.stations.length; k++) {
        const a = L.stations[k], b = L.stations[k + 1];
        const [ox, oy] = segOffset(L.id, a, b);
        const A = S.cities[a], B = S.cities[b];
        ctx.moveTo(A.x + ox, A.y + oy); ctx.lineTo(B.x + ox, B.y + oy);
      }
    };
    for (const L of S.lines) {
      if (L.stations.length < 2) continue;
      path(L);
      if (S.selected === L) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 14 * UI;
        ctx.stroke();
      }
      ctx.strokeStyle = L.color;
      ctx.lineWidth = 8 * UI;
      ctx.stroke();
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
    if (!onScreen(p)) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    ctx.scale(UI, UI);
    // gerbong level 5 (muat 21): penumpang bertumpuk 3 baris, kereta lebih lebar; level 1–4: 2 baris
    const L = tr.line, rows = L.car >= MAX_CAR ? 3 : 2;
    const len = 28 + (Math.min(L.cap, CAR_CAP[MAX_CAR - 1]) - BASE_CAP) * 1.1;
    const h = rows * 6.6 + 2.8, row0 = -((rows - 1) * 6.6) / 2;
    const n = tr.pax.length;
    // satu sprite per (warna, gerbong, jumlah penumpang): badan kereta + titik penumpang
    blit(sprite(`t|${L.color}|${L.car}|${L.cap}|${n}`, len + 4, h + 4, len / 2 + 2, h / 2 + 2, (g) => {
      g.fillStyle = L.color; g.strokeStyle = '#1f2433'; g.lineWidth = 1.5;
      const x = -len / 2, y = -h / 2, rr = 4;
      g.beginPath();
      g.moveTo(x + rr, y); g.arcTo(x + len, y, x + len, y + h, rr); g.arcTo(x + len, y + h, x, y + h, rr);
      g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + len, y, rr); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#fff';
      const cols = Math.ceil(L.cap / rows), sp = (len - 6) / cols;
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const cx = -len / 2 + 3 + sp * ((k % cols) + 0.5), cy = row0 + Math.floor(k / cols) * 6.6;
        g.moveTo(cx + 2.1, cy); g.arc(cx, cy, 2.1, 0, Math.PI * 2);
      }
      g.fill();
    }), 0, 0);
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
    const fill = fillRatio(c);
    if (fill > 0.5) {
      const over = fill > 1; // sama dengan syarat turunnya kepuasan
      const pulse = over ? 0.6 + 0.4 * Math.sin(now * 8) : 1;
      ctx.strokeStyle = over ? `rgba(214,64,69,${pulse})` : '#f0a202';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(X, Y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fill));
      ctx.stroke();
    }
    // beacon Kota Festival: dua cincin magenta yang terus melebar & memudar
    if (isFestival(c)) {
      for (let k = 0; k < 2; k++) {
        const ph = (now / 1.6 + k / 2) % 1;
        ctx.strokeStyle = `rgba(230,0,126,${0.85 * (1 - ph)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(X, Y, r + 6 + ph * 34, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // stasiun
    const L = S.selected;
    const onSel = L && L.stations.includes(c.id);
    blit(circleSprite(r, '#fff', onSel ? L.color : '#1f2433', onSel ? 4.5 : 3), X, Y);
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
      const col = n > cap ? '#d64045' : n ? '#1f2433' : '#a3aab8';
      blit(sprite(`n|${label}|${fs.toFixed(2)}|${col}`, 2 * r, 2 * r, r, r, (g) => {
        g.font = `800 ${fs}px system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col;
        g.fillText(label, 0, 1);
      }), X, Y);
      // titik merah kecil di tepi lingkaran: ada penumpang yang tujuannya belum terjangkau
      if (c.wait.some((p) => !isFinite(D(c.id, p.dest)))) blit(circleSprite(4, '#e0565b', '#fff', 1.5), X + r * 0.72, Y - r * 0.72);
    } else {
      // Kampung & Desa: satu titik per penumpang di samping lingkaran
      const shown = Math.min(c.wait.length, 24);
      const dark = circleSprite(3, '#3a4256', null, 0), red = circleSprite(3, '#e0565b', null, 0);
      for (let k = 0; k < shown; k++) {
        blit(isFinite(D(c.id, c.wait[k].dest)) ? dark : red, X + r + 10 + (k % 6) * 8, Y - r + 4 + Math.floor(k / 6) * 8);
      }
      if (c.wait.length > 24) {
        const more = `+${c.wait.length - 24}`;
        blit(sprite(`m|${more}`, 8 + more.length * 8, 16, 0, 12, (g) => {
          g.fillStyle = '#d64045'; g.font = '700 12px system-ui, sans-serif'; g.textAlign = 'left';
          g.fillText(more, 0, 0);
        }), X + r + 7, Y - r + 4 + 4 * 8 + 5);
      }
    }
    // nama kota (posisi label diatur per kota di geo.js / otomatis di Satu Jawa supaya tidak bertumpuk)
    let lx = X, ly = Y + r + 20, align = 'center';
    if (c.label === 'top') ly = Y - r - 9;
    else if (c.label === 'left') { lx = X - r - 6; ly = Y + 6; align = 'right'; }
    else if (c.label === 'right') { lx = X + r + 6; ly = Y + 6; align = 'left'; }
    // Satu Jawa: nama yang akan menimpa nama kota lain yang lebih penting tidak digambar (lihat cullLabels)
    if (!S.jawa || c.showLabel) {
      if (c.labelW === undefined) { ctx.font = '600 16px system-ui, sans-serif'; c.labelW = ctx.measureText(c.name).width; }
      const w = c.labelW + 10, ax = align === 'center' ? w / 2 : align === 'left' ? 5 : w - 5;
      blit(sprite(`l|${c.name}|${align}`, w, 26, ax, 19, (g) => {
        g.font = '600 16px system-ui, sans-serif'; g.textAlign = align;
        g.lineWidth = 3.5; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.strokeText(c.name, 0, 0);
        g.fillStyle = '#1f2433';
        g.fillText(c.name, 0, 0);
      }), lx, ly);
    }
    ctx.textAlign = 'center';
    // kota yang dipilih dari daftar kota: cincin biru berdenyut sebentar
    if (S.focus && S.focus.id === c.id && performance.now() < S.focus.until) {
      const k = (S.focus.until - performance.now()) / 1800;
      ctx.strokeStyle = `rgba(31,120,209,${0.4 + 0.6 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(X, Y, r + 12 + 10 * (1 - k), 0, Math.PI * 2); ctx.stroke();
    }
    // setelah kalah: tandai kota yang penuh supaya mudah ditemukan
    if (S.over && satisfactionDrain(c) > 0) {
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
    tickChart(now);
    requestAnimationFrame(frame);
  }

  INDO.terrain = TERRAIN = buildTerrain();
  renderTerrain();
  INDO.canvas = terrainCanvas;
  applyPanelUi();
  $('hud-bottom').classList.toggle('collapsed', bottomPanel.collapsed);
  newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0, 1);
  const reached = Math.min(LAST_MAP, loadNum('map'));
  if (reached > 1) {
    $('b-continue').hidden = false;
    $('b-continue').textContent = mapButtonLabel(reached);
    $('b-start').classList.remove('primary');
  }
  const bests = [];
  for (let l = 1; l <= LAST_MAP; l++) { const b = loadNum('best.' + l); if (b) bests.push(`Indonesia ${l}: ${b}`); }
  const bestJawa = loadNum('best.jawa');
  if (bestJawa) bests.push(`Satu Jawa: ${bestJawa}`);
  const bestFree = loadNum('best.free');
  if (bestFree) bests.push(`Random: ${bestFree}`);
  if (bests.length) $('best-start').textContent = `Rekor populasi negara · ${bests.join(' · ')}`;
  resize();
  requestAnimationFrame(frame);

  // dipakai untuk pengujian otomatis
  window.__lintasKota = { get state() { return S; }, view, toast, segCost, ALL_CITIES, spawnPassenger, cityAt, lineAt, toWorld, mouse, newGame, spawnCity, satisfactionDrain, upkeepCost, lineKm, openChart, closeChart, CITY_COLOR, addVisit, DAY_LEN, terrainAt, JAWA_CITIES, newLine, addTrain, upgradeCap, recomputeNetwork };
})();
