/*
 * Data geografi Pulau Jawa untuk peta "Satu Jawa" di Lintas Kota.
 * Semua koordinat dalam [bujur, lintang] (derajat), disederhanakan: cukup untuk mengenali bentuk pulau
 * dan menghitung biaya rel (darat/laut/gunung), bukan untuk navigasi. Posisi kota kira-kira (±2 km).
 */
window.LINTAS_JAWA = (() => {
  // Proyeksi peta Jawa: lebih rapat daripada peta Indonesia (440 px per derajat, ±0,25 km per px)
  const VIEW = { lon0: 105.0, lat0: -5.35, ppd: 440 };

  const PROVINCES = {
    banten:  { name: 'Banten' },
    jakarta: { name: 'DKI Jakarta' },
    jabar:   { name: 'Jawa Barat' },
    jateng:  { name: 'Jawa Tengah' },
    diy:     { name: 'DI Yogyakarta' },
    jatim:   { name: 'Jawa Timur' },
  };

  // Daratan Jawa (searah jarum jam dari ujung barat: pantai utara → Banyuwangi → pantai selatan) dan Madura.
  const LAND = [
    [
      [105.22, -6.75], [105.42, -6.72], [105.55, -6.68], [105.65, -6.60], [105.78, -6.45], [105.83, -6.33],
      [105.85, -6.20], [105.88, -6.08], [105.95, -5.97], [106.02, -5.90], [106.12, -5.98], [106.20, -5.97],
      [106.32, -5.98], [106.45, -6.02], [106.55, -6.02], [106.68, -6.05], [106.78, -6.11], [106.88, -6.10],
      [106.97, -6.08], [107.02, -5.93], [107.10, -5.95], [107.30, -6.06], [107.45, -6.15], [107.62, -6.20],
      [107.85, -6.22], [108.10, -6.30], [108.28, -6.27], [108.38, -6.22], [108.45, -6.30], [108.48, -6.42],
      [108.55, -6.60], [108.60, -6.72], [108.80, -6.80], [109.00, -6.83], [109.14, -6.845], [109.38, -6.83],
      [109.68, -6.86], [109.85, -6.89], [110.05, -6.88], [110.25, -6.90], [110.42, -6.94], [110.50, -6.90],
      [110.58, -6.80], [110.63, -6.62], [110.66, -6.55], [110.70, -6.48], [110.88, -6.40], [111.00, -6.48],
      [111.05, -6.60], [111.15, -6.66], [111.34, -6.685], [111.52, -6.67], [111.75, -6.75], [111.95, -6.83],
      [112.06, -6.87], [112.30, -6.87], [112.48, -6.86], [112.60, -6.88], [112.65, -7.05], [112.68, -7.15],
      [112.73, -7.20], [112.80, -7.25], [112.82, -7.35], [112.85, -7.50], [112.88, -7.60], [113.00, -7.66],
      [113.22, -7.73], [113.41, -7.72], [113.60, -7.70], [113.75, -7.72], [114.00, -7.68], [114.20, -7.72],
      [114.42, -7.77], [114.40, -7.95], [114.40, -8.12], [114.40, -8.22], [114.37, -8.38], [114.34, -8.46],
      [114.47, -8.52], [114.58, -8.70], [114.45, -8.78], [114.30, -8.72], [114.20, -8.62], [114.00, -8.58],
      [113.85, -8.56], [113.70, -8.50], [113.55, -8.43], [113.45, -8.38], [113.25, -8.33], [113.00, -8.33],
      [112.80, -8.38], [112.65, -8.43], [112.45, -8.40], [112.25, -8.33], [112.05, -8.30], [111.90, -8.28],
      [111.72, -8.30], [111.50, -8.28], [111.30, -8.25], [111.10, -8.22], [110.90, -8.20], [110.70, -8.16],
      [110.50, -8.10], [110.33, -8.02], [110.10, -7.90], [109.95, -7.86], [109.75, -7.80], [109.55, -7.77],
      [109.40, -7.74], [109.20, -7.72], [109.05, -7.75], [108.85, -7.77], [108.75, -7.70], [108.65, -7.72],
      [108.30, -7.80], [108.05, -7.78], [107.80, -7.70], [107.65, -7.66], [107.45, -7.52], [107.25, -7.47],
      [107.05, -7.43], [106.85, -7.40], [106.55, -7.40], [106.40, -7.37], [106.42, -7.20], [106.45, -7.15],
      [106.52, -7.02], [106.40, -6.97], [106.25, -6.93], [106.05, -6.85], [105.85, -6.83], [105.60, -6.83],
      [105.45, -6.85], [105.30, -6.82],
    ],
    // Madura
    [
      [112.70, -6.90], [112.95, -6.88], [113.30, -6.88], [113.65, -6.88], [113.95, -6.92], [114.10, -7.00],
      [114.05, -7.10], [113.85, -7.12], [113.50, -7.21], [113.25, -7.23], [113.00, -7.18], [112.78, -7.18],
      [112.70, -7.08],
    ],
  ];

  // Di luar peta Satu Jawa (digambar abu-abu, rel di sana ×2): ujung selatan Lampung dan Bali barat.
  const FOREIGN = [
    [[105.0, -5.30], [105.90, -5.30], [105.88, -5.60], [105.82, -5.80], [105.70, -5.88], [105.55, -5.82],
      [105.35, -5.78], [105.20, -5.80], [105.0, -5.75]],
    [[114.44, -8.10], [114.60, -8.12], [114.90, -8.12], [114.90, -8.42], [114.65, -8.36], [114.50, -8.30], [114.43, -8.20]],
  ];

  // Gunung & pegunungan: [lebar (derajat), garis]
  const RIDGES = [
    [0.08, [[106.35, -6.75], [106.55, -6.72], [106.73, -6.70]]],   // Halimun–Salak
    [0.07, [[106.95, -6.75], [107.02, -6.80]]],                     // Gede–Pangrango
    [0.06, [[107.52, -6.76], [107.62, -6.77], [107.75, -6.80]]],    // Tangkuban Parahu–Bukit Tunggul
    [0.08, [[107.38, -7.15], [107.60, -7.18], [107.73, -7.30], [107.85, -7.32], [107.98, -7.32]]], // Patuha–Papandayan–Cikuray
    [0.05, [[108.05, -7.25], [108.10, -7.20]]],                     // Galunggung
    [0.08, [[108.40, -6.89], [108.41, -6.90]]],                     // Ciremai
    [0.10, [[109.21, -7.24], [109.22, -7.25]]],                     // Slamet
    [0.08, [[109.85, -7.20], [110.00, -7.30], [110.07, -7.38]]],    // Dieng–Sindoro–Sumbing
    [0.05, [[110.33, -7.18], [110.34, -7.19]]],                     // Ungaran
    [0.07, [[110.44, -7.45], [110.44, -7.54]]],                     // Merbabu–Merapi
    [0.05, [[110.10, -7.65], [110.15, -7.75]]],                     // Menoreh
    [0.07, [[110.89, -6.62], [110.90, -6.63]]],                     // Muria
    [0.08, [[111.19, -7.63], [111.20, -7.64]]],                     // Lawu
    [0.06, [[110.45, -8.05], [110.95, -8.10], [111.30, -8.12]]],    // Gunung Sewu
    [0.08, [[111.76, -7.81], [111.77, -7.82]]],                     // Wilis
    [0.06, [[112.31, -7.93], [112.45, -7.92]]],                     // Kelud–Kawi
    [0.06, [[112.59, -7.76], [112.58, -7.70]]],                     // Arjuno–Welirang
    [0.09, [[112.95, -7.94], [112.92, -8.11]]],                     // Bromo–Semeru
    [0.08, [[113.57, -7.97], [113.58, -7.98]]],                     // Argopuro
    [0.08, [[114.04, -8.12], [114.24, -8.06]]],                     // Raung–Ijen
  ];

  /*
   * Kota & ibu kota kabupaten: [nama, bujur, lintang, provinsi, kabupaten (kalau ibu kota kabupaten), kota besar?]
   * Kabupaten yang ibu kotanya berbeda nama memakai nama ibu kotanya (mis. Kab. Bogor → Cibinong).
   * DKI Jakarta digabung menjadi satu kota "Jakarta".
   */
  const CITIES = [
    // Banten (4 kota + 4 kabupaten)
    ['Cilegon', 106.054, -6.017, 'banten', null],
    ['Serang', 106.150, -6.120, 'banten', null, true],
    ['Tangerang', 106.630, -6.178, 'banten', null],
    ['Tangerang Selatan', 106.718, -6.288, 'banten', null],
    ['Ciruas', 106.250, -6.106, 'banten', 'Kab. Serang'],
    ['Tigaraksa', 106.478, -6.262, 'banten', 'Kab. Tangerang'],
    ['Rangkasbitung', 106.250, -6.358, 'banten', 'Kab. Lebak'],
    ['Pandeglang', 106.105, -6.308, 'banten', 'Kab. Pandeglang'],
    // DKI Jakarta
    ['Jakarta', 106.827, -6.175, 'jakarta', null, true],
    // Jawa Barat (9 kota + 18 kabupaten)
    ['Bandung', 107.619, -6.917, 'jabar', null, true],
    ['Cimahi', 107.542, -6.872, 'jabar', null],
    ['Bekasi', 106.976, -6.238, 'jabar', null],
    ['Bogor', 106.799, -6.597, 'jabar', null, true],
    ['Depok', 106.794, -6.402, 'jabar', null],
    ['Sukabumi', 106.927, -6.921, 'jabar', null, true],
    ['Cirebon', 108.557, -6.706, 'jabar', null, true],
    ['Tasikmalaya', 108.220, -7.327, 'jabar', null, true],
    ['Banjar', 108.534, -7.370, 'jabar', null],
    ['Soreang', 107.517, -7.033, 'jabar', 'Kab. Bandung'],
    ['Ngamprah', 107.473, -6.838, 'jabar', 'Kab. Bandung Barat'],
    ['Cikarang', 107.153, -6.261, 'jabar', 'Kab. Bekasi'],
    ['Cibinong', 106.854, -6.482, 'jabar', 'Kab. Bogor'],
    ['Ciamis', 108.353, -7.326, 'jabar', 'Kab. Ciamis'],
    ['Cianjur', 107.140, -6.817, 'jabar', 'Kab. Cianjur'],
    ['Sumber', 108.481, -6.759, 'jabar', 'Kab. Cirebon'],
    ['Garut', 107.903, -7.214, 'jabar', 'Kab. Garut'],
    ['Indramayu', 108.324, -6.327, 'jabar', 'Kab. Indramayu'],
    ['Karawang', 107.300, -6.306, 'jabar', 'Kab. Karawang'],
    ['Kuningan', 108.484, -6.976, 'jabar', 'Kab. Kuningan'],
    ['Majalengka', 108.227, -6.836, 'jabar', 'Kab. Majalengka'],
    ['Parigi', 108.500, -7.690, 'jabar', 'Kab. Pangandaran'],
    ['Purwakarta', 107.443, -6.556, 'jabar', 'Kab. Purwakarta'],
    ['Subang', 107.760, -6.571, 'jabar', 'Kab. Subang'],
    ['Palabuhanratu', 106.560, -6.980, 'jabar', 'Kab. Sukabumi'],
    ['Sumedang', 107.920, -6.859, 'jabar', 'Kab. Sumedang'],
    ['Singaparna', 108.111, -7.351, 'jabar', 'Kab. Tasikmalaya'],
    // Jawa Tengah (6 kota + 29 kabupaten)
    ['Semarang', 110.420, -6.967, 'jateng', null, true],
    ['Surakarta', 110.817, -7.566, 'jateng', null, true],
    ['Salatiga', 110.493, -7.331, 'jateng', null],
    ['Magelang', 110.217, -7.477, 'jateng', null],
    ['Pekalongan', 109.675, -6.892, 'jateng', null, true],
    ['Tegal', 109.140, -6.875, 'jateng', null, true],
    ['Banjarnegara', 109.698, -7.397, 'jateng', 'Kab. Banjarnegara'],
    ['Purwokerto', 109.230, -7.424, 'jateng', 'Kab. Banyumas', true],
    ['Batang', 109.730, -6.910, 'jateng', 'Kab. Batang'],
    ['Blora', 111.418, -6.969, 'jateng', 'Kab. Blora'],
    ['Boyolali', 110.596, -7.533, 'jateng', 'Kab. Boyolali'],
    ['Brebes', 109.040, -6.875, 'jateng', 'Kab. Brebes'],
    ['Cilacap', 109.009, -7.722, 'jateng', 'Kab. Cilacap', true],
    ['Demak', 110.638, -6.894, 'jateng', 'Kab. Demak'],
    ['Purwodadi', 110.916, -7.087, 'jateng', 'Kab. Grobogan'],
    ['Jepara', 110.675, -6.589, 'jateng', 'Kab. Jepara'],
    ['Karanganyar', 110.951, -7.596, 'jateng', 'Kab. Karanganyar'],
    ['Kebumen', 109.652, -7.668, 'jateng', 'Kab. Kebumen'],
    ['Kendal', 110.204, -6.925, 'jateng', 'Kab. Kendal'],
    ['Klaten', 110.606, -7.706, 'jateng', 'Kab. Klaten'],
    ['Kudus', 110.841, -6.805, 'jateng', 'Kab. Kudus', true],
    ['Mungkid', 110.255, -7.565, 'jateng', 'Kab. Magelang'],
    ['Pati', 111.038, -6.755, 'jateng', 'Kab. Pati'],
    ['Kajen', 109.588, -7.025, 'jateng', 'Kab. Pekalongan'],
    ['Pemalang', 109.381, -6.890, 'jateng', 'Kab. Pemalang'],
    ['Purbalingga', 109.364, -7.388, 'jateng', 'Kab. Purbalingga'],
    ['Purworejo', 110.009, -7.713, 'jateng', 'Kab. Purworejo'],
    ['Rembang', 111.341, -6.710, 'jateng', 'Kab. Rembang'],
    ['Ungaran', 110.405, -7.139, 'jateng', 'Kab. Semarang'],
    ['Sragen', 111.022, -7.427, 'jateng', 'Kab. Sragen'],
    ['Sukoharjo', 110.840, -7.682, 'jateng', 'Kab. Sukoharjo'],
    ['Slawi', 109.135, -6.983, 'jateng', 'Kab. Tegal'],
    ['Temanggung', 110.175, -7.317, 'jateng', 'Kab. Temanggung'],
    ['Wonogiri', 110.926, -7.814, 'jateng', 'Kab. Wonogiri'],
    ['Wonosobo', 109.900, -7.363, 'jateng', 'Kab. Wonosobo'],
    // DI Yogyakarta (1 kota + 4 kabupaten)
    ['Yogyakarta', 110.370, -7.797, 'diy', null, true],
    ['Sleman', 110.355, -7.716, 'diy', 'Kab. Sleman'],
    ['Bantul', 110.330, -7.888, 'diy', 'Kab. Bantul'],
    ['Wonosari', 110.601, -7.966, 'diy', 'Kab. Gunungkidul'],
    ['Wates', 110.158, -7.857, 'diy', 'Kab. Kulon Progo'],
    // Jawa Timur (9 kota + 29 kabupaten)
    ['Surabaya', 112.752, -7.257, 'jatim', null, true],
    ['Malang', 112.634, -7.977, 'jatim', null, true],
    ['Batu', 112.527, -7.871, 'jatim', null],
    ['Kediri', 112.012, -7.817, 'jatim', null, true],
    ['Blitar', 112.168, -8.098, 'jatim', null],
    ['Madiun', 111.523, -7.630, 'jatim', null, true],
    ['Mojokerto', 112.434, -7.472, 'jatim', null],
    ['Pasuruan', 112.907, -7.650, 'jatim', null],
    ['Probolinggo', 113.216, -7.760, 'jatim', null, true],
    ['Bangkalan', 112.737, -7.045, 'jatim', 'Kab. Bangkalan'],
    ['Banyuwangi', 114.360, -8.219, 'jatim', 'Kab. Banyuwangi', true],
    ['Kanigoro', 112.215, -8.131, 'jatim', 'Kab. Blitar'],
    ['Bojonegoro', 111.882, -7.150, 'jatim', 'Kab. Bojonegoro'],
    ['Bondowoso', 113.821, -7.913, 'jatim', 'Kab. Bondowoso'],
    ['Gresik', 112.650, -7.155, 'jatim', 'Kab. Gresik'],
    ['Jember', 113.700, -8.172, 'jatim', 'Kab. Jember', true],
    ['Jombang', 112.233, -7.546, 'jatim', 'Kab. Jombang'],
    ['Ngasem', 112.065, -7.820, 'jatim', 'Kab. Kediri'],
    ['Lamongan', 112.415, -7.117, 'jatim', 'Kab. Lamongan'],
    ['Lumajang', 113.223, -8.134, 'jatim', 'Kab. Lumajang'],
    ['Mejayan', 111.648, -7.551, 'jatim', 'Kab. Madiun'],
    ['Magetan', 111.330, -7.653, 'jatim', 'Kab. Magetan'],
    ['Kepanjen', 112.572, -8.130, 'jatim', 'Kab. Malang'],
    ['Mojosari', 112.556, -7.519, 'jatim', 'Kab. Mojokerto'],
    ['Nganjuk', 111.904, -7.605, 'jatim', 'Kab. Nganjuk'],
    ['Ngawi', 111.446, -7.404, 'jatim', 'Kab. Ngawi'],
    ['Pacitan', 111.106, -8.190, 'jatim', 'Kab. Pacitan'],
    ['Pamekasan', 113.474, -7.158, 'jatim', 'Kab. Pamekasan'],
    ['Bangil', 112.800, -7.599, 'jatim', 'Kab. Pasuruan'],
    ['Ponorogo', 111.462, -7.866, 'jatim', 'Kab. Ponorogo'],
    ['Kraksaan', 113.411, -7.762, 'jatim', 'Kab. Probolinggo'],
    ['Sampang', 113.250, -7.190, 'jatim', 'Kab. Sampang'],
    ['Sidoarjo', 112.718, -7.447, 'jatim', 'Kab. Sidoarjo'],
    ['Situbondo', 114.009, -7.710, 'jatim', 'Kab. Situbondo'],
    ['Sumenep', 113.861, -7.006, 'jatim', 'Kab. Sumenep', true],
    ['Trenggalek', 111.708, -8.050, 'jatim', 'Kab. Trenggalek'],
    ['Tuban', 112.050, -6.900, 'jatim', 'Kab. Tuban', true],
    ['Tulungagung', 111.902, -8.066, 'jatim', 'Kab. Tulungagung'],
  ];

  // Permainan dimulai di sekitar salah satu kota besar ini (diundi)
  const STARTS = ['Jakarta', 'Bandung', 'Semarang', 'Yogyakarta', 'Surabaya', 'Malang'];

  return { VIEW, PROVINCES, LAND, FOREIGN, RIDGES, CITIES, STARTS };
})();
