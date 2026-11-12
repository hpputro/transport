# Lintas Kota

Game strategi transportasi berbasis browser: hubungkan ibu kota provinsi di Indonesia dengan jalur kereta, antar penumpang ke tujuannya, dan jaga agar warga tetap puas.

Main langsung: https://hpputro.github.io/transport/

## Cara main

Buka `index.html` di browser. Tidak perlu instalasi atau server.

### Target

Sambungkan **semua ibu kota provinsi** di peta dalam satu jaringan. Kota muncul bertahap di posisi geografisnya. Kalau semua kota yang sudah ada telah tersambung, kota berikutnya muncul lebih cepat.

| Peta | Wilayah baru | Jumlah kota | Jalur maksimal | Kas awal |
|---|---|---|---|---|
| 1 | Sumatra | 10 | 4 | $1500 |
| 2 | + Jawa | 16 | 6 | $2500 |
| 3 | + Sulawesi | 22 | 8 | $3500 |
| 4 | + Papua | 28 | 10 | $4500 |
| 5 | + Kalimantan | 33 | 12 | $5500 |
| 6 | + Bali & Nusa Tenggara | 36 | 14 | $6500 |
| 7 | + Maluku | 38 (semua) | 15 (semua) | $7500 |

**Peta Bebas** (tombol di layar pembuka): pulau-pulau acak yang berbeda setiap permainan (bukan peta Indonesia), dengan ke-38 ibu kota provinsi muncul bertahap di posisi acak, menyebar dari tengah peta. Aturan jalur dan kas awal sama dengan Peta 7 (maks. 15 jalur, $7.500). Menang kalau semua 38 kota terhubung; setelah itu bisa main lagi dengan peta acak baru atau tetap di peta ini (mode santai). Rekornya disimpan terpisah.

**Urutan munculnya kota**
- Setiap peta dimulai di wilayah yang baru ditambahkan: kota pertama acak, lalu kota terdekat di pulau yang sama, sampai 3 kota. Peta 7 dimulai dengan 2 kota karena Maluku hanya punya 2 ibu kota.
- Setelah itu, setiap kota baru dipilih acak dari dua kemungkinan, sehingga pulau-pulau bisa berselang-seling:
  - **tumbuh**: kota tersisa yang paling dekat dengan kota yang sudah ada di pulau itu;
  - **menyeberang** ke pulau tetangga yang belum punya kota, lewat kota pertama berikut (aturan lengkap di `GEO.SPREAD` di `geo.js`):

| Dari → ke | Kota pertama | Syarat / pengecualian |
|---|---|---|
| Jawa → Sumatra | Bandar Lampung | Palembang, kalau Serang sudah ada |
| Sulawesi → Jawa | Surabaya | harus sudah ada Makassar |
| Papua → Sulawesi | Manado | harus sudah ada Sorong |
| Sulawesi → Papua | Sorong | harus sudah ada Manado |
| Kalimantan → Sulawesi | Mamuju / Palu / Makassar | harus sudah ada Samarinda |
| Nusa Tenggara → Jawa | Surabaya / Semarang | |
| Jawa → Kalimantan | Banjarbaru / Palangka Raya | harus sudah ada Surabaya |
| Maluku → Sulawesi | Manado / Kendari / Gorontalo | |
| Maluku → Papua | Sorong / Manokwari | |
| Sulawesi → Nusa Tenggara | Mataram (Lombok) / Kupang | harus sudah ada Makassar atau Kendari |

Untuk aturan dengan pengecualian (Jawa → Sumatra), urutannya diundi 50-50 di awal setiap permainan: Serang muncul sebelum Sumatra dimasuki (pintu masuk Palembang), atau Serang ditahan sampai Sumatra dimasuki (pintu masuk Bandar Lampung).

- **Skor** tiap peta adalah **populasi negara**, yaitu jumlah populasi semua kota (lihat "Status kota" di bawah). Rekornya disimpan per peta.
- **Setelah menang** kamu bisa memilih:
  - lanjut ke peta berikutnya, atau
  - tetap di peta ini dalam mode santai: kepuasan selalu penuh dan tidak bisa kalah. Tombol "Peta berikutnya" tetap tersedia di bagian atas.
- **Progres peta** tersimpan di browser. Di layar pembuka ada tombol "Lanjut Peta N".

- **Bangun jalur**: klik sebuah kota, lalu klik kota-kota berikutnya. Setiap ruas rel ada biayanya, tergantung jarak dan medan:
  - darat ×1
  - melintasi negara tetangga ×2
  - gunung ×2,5 (terowongan)
  - laut ×4 (jembatan)
- **Perpanjang jalur**: pilih jalurnya, lalu klik salah satu ujungnya. Kamu bisa memperpanjang dari ujung awal maupun ujung akhir.
- **Kereta**: jalur baru dibuat **tanpa kereta**; beli kereta lewat tombol "+ Kereta" dan gerbong lewat "+ Gerbong". Harga naik 1,5× setiap kali membeli, dihitung per jalur: kereta $400 → $600 → $900 → $1.350 → …, gerbong $250 → $375 → $563 → $844. Kalau jalur dihapus, kembali 50% dari biaya rel ditambah 50% dari yang dibayar untuk kereta & gerbong jalur itu.
  - **Jumlah kereta maksimal** = panjang jalur (km) ÷ 500, dibulatkan ke atas (minimal 1). Contoh: 450 km → 1 kereta, 501 km → 2 kereta, 1.200 km → 3 kereta, 3.177 km → 7 kereta. Panel bawah menampilkannya sebagai "2/3 kereta". Kalau jalur diputus sampai jumlah keretanya melebihi batas baru, kereta yang terakhir dibeli ikut dibongkar: penumpangnya turun di stasiun terdekat dan uang kembali 50% dari harga kereta itu.
  - **Gerbong** menentukan muatan tiap kereta di jalur itu: level 1 (bawaan) muat 6, level 2 muat 10, level 3 muat 14, level 4 muat 18, level 5 muat 21. Di peta, penumpang di dalam kereta digambar 2 baris; pada level 5 bertumpuk 3 baris.
  - Tiap jalur menyimpan **urutan pembuatan**, yaitu urutan kota saat jalur itu ditarik (termasuk saat diperpanjang dari ujung mana pun).
  - Kereta baru selalu muncul di **kota pertama** dalam urutan itu (depo) dan berangkat ke arah **kota kedua**. Arahkan kursor ke tombol "+ Kereta" untuk melihatnya, misalnya "Kereta baru muncul di Medan, berangkat ke arah Pekanbaru". Teks di panel bawah hanya menampilkan nama jalur, jumlah kereta, dan muatan (mis. "Jalur Marun · 2 kereta · muat 10").
  - Kalau sebuah kota dilepas dengan tombol "Putus <kota ujung>", kota itu keluar dari urutan dan depo serta arah mengikuti kota berikutnya dalam urutan.
  - Kereta berhenti 0,5 detik di setiap stasiun, berapa pun jumlah penumpang yang naik atau turun.
  - Supaya kereta tidak berkumpul: kalau jarak ke kereta di depannya kurang dari 90% jarak ideal (satu putaran pulang-pergi ÷ jumlah kereta), kereta menunggu di stasiun maksimal 2 detik. Penumpang yang datang selama menunggu ikut naik saat kereta berangkat.
- **Penumpang** muncul di tiap kota dengan tujuan kota lain. Mereka otomatis mencari rute terpendek, termasuk transit antar-jalur.
  - Laju per kota: `(0,06 + 0,045 × level) × pengali hari` penumpang/detik, hanya 60% kalau kota belum punya jalur.
  - Pengali hari: `1 + 3% × (hari − 1)`, paling tinggi ×2 (tercapai di hari ke-34).
  - Tujuan dipilih acak berbobot: `level kota tujuan × faktor kepadatan × bonus satu jalur ÷ (1 + jarak/500)`. Kota besar dan dekat lebih sering dituju.
  - Bonus satu jalur = 2 kalau kota tujuan berada di jalur yang sama dengan kota asal (bisa dicapai tanpa pindah jalur), selain itu 1.
  - Faktor kepadatan = 1 selama penumpang yang menunggu di kota tujuan ≤ kapasitas. Kalau melebihi, faktornya `(kapasitas ÷ menunggu)²`: kota yang penuh 1,5× kapasitas hanya 44% diminati, 2× hanya 25%. Tooltip kota menampilkan angka ini.
  - Titik gelap: penumpang yang sudah punya rute.
  - Titik merah: tujuannya belum terhubung ke jaringan.
- **Pendapatan**: tarif = $10 + $5 × jumlah stasiun yang dilewati.
- **Biaya perawatan harian** (ditagih setiap pergantian hari): kereta = jumlah kereta × $20 + total kapasitas kereta × $2; jalur = total panjang semua jalur (km) ÷ 100. Notifikasinya menampilkan rinciannya, misalnya "perawatan −$228 (kereta $224 + jalur $4)".
- **Status kota** (tampil di tooltip kota):
  - **Dikunjungi**: jumlah penumpang yang turun di kota itu, baik yang sampai tujuan maupun yang transit pindah jalur. Penumpang yang hanya lewat di dalam kereta tidak dihitung. Ini syarat naik level (lihat tabel di bawah). Kota transit yang ramai naik level lebih cepat.
  - **Populasi**: jumlah penumpang yang diantar ke kota itu sebagai tujuan akhir. Populasi semua kota dijumlahkan menjadi **populasi negara** (HUD atas), yang jadi skor permainan.
- **Level kota**: makin tinggi level, makin besar kapasitas, tetapi kota juga menghasilkan lebih banyak penumpang. Di peta, level hanya dibedakan dari ukuran lingkaran.

  | Kode | Level | Kapasitas | Cara mencapainya |
  |---|---|---|---|
  | 0 | Kampung | 0 | kota baru yang belum terhubung jalur |
  | I | Dusun | 8 | langsung, begitu kota tersambung jalur |
  | II | Desa | 14 | total 40 kunjungan |
  | III | Distrik | 25 | 110 kunjungan |
  | IV | Kota Praja | 43 | 235 kunjungan |
  | V | Kotamadya | 75 | 450 kunjungan |
  | VI | Kota Besar | 131 | 825 kunjungan |
  | VII | Metropolitan | 230 | 1.480 kunjungan |
  | VIII | Megapolitan | 402 | 2.630 kunjungan |
  | IX | Kota Global | 704 | 4.640 kunjungan · **maksimal 3 kota** |
  | X | Kapital | 1231 | 8.160 kunjungan · **hanya 1 kota** |

  - Kapasitas naik 1,75× tiap level (dibulatkan). Selisih kunjungan untuk naik satu level = 5 × kapasitas level saat itu (mis. Dusun 8 → 40 kunjungan, Desa 14 → 70 kunjungan lagi, jadi total 110), sehingga ikut naik ±1,75× per level.
  - Kuota: kalau sudah ada 3 Kota Global, Megapolitan lain tetap Megapolitan walau kunjungannya cukup. Tooltip kotanya menulis "Kota Global sudah 3". Begitu salah satu Kota Global naik menjadi Kapital, kuotanya terbuka satu, dan Megapolitan yang kunjungannya sudah cukup naik pada kunjungan berikutnya. Kapital hanya boleh 1, jadi Kota Global lainnya berhenti di Kota Global.
  - Kampung tetap menghasilkan penumpang (60% dari laju normal). Kapasitasnya tercatat 0, tetapi untuk perhitungan kepuasan Kampung dianggap berkapasitas maksimal (kapasitas Kapital, 1231), jadi praktis tidak menurunkan kepuasan. Level tidak turun lagi kalau jalurnya kemudian dibongkar.
  - Kampung, Dusun, dan Desa: penumpang menunggu ditampilkan sebagai titik di samping kota.
  - Mulai Distrik: ditampilkan sebagai angka di dalam lingkaran (merah kalau melebihi kapasitas). Titik merah kecil di tepi lingkaran berarti ada penumpang yang tujuannya belum terjangkau.
- **Jalur**: ada 15 jalur dengan warna Marun, Merah, Pink, Oker, Jingga, Kuning, Hijau Muda, Hijau, Hijau Tua, Biru Langit, Biru, Biru Dongker, Lila, Ungu, dan Plum. Sebuah jalur bisa dipakai kalau dua syarat terpenuhi: (1) peta: Peta 1 maksimal 4 jalur, tiap peta berikutnya +2, di Peta 7 kelima belas jalur tersedia; (2) populasi negara: jalur ke-1 sampai ke-15 butuh 0, 0, 20, 40, 120, 250, 500, 1.000, 2.000, 4.000, 8.000, 16.000, 32.000, 64.000, 128.000. Di HP, deretan bulatan jalur bisa digeser ke samping.
- **Kepuasan & kalah**: kota yang penumpang menunggunya melebihi kapasitas (lingkaran merah berkedip) menurunkan kepuasan, dihitung dari rasio `menunggu ÷ kapasitas`:
  - rasio ≤ 1 → tidak turun;
  - rasio > 1 → turun `0,7 + 2 × (rasio − 1)` per detik, maksimal 3 per detik per kota (dijumlahkan untuk semua kota);
  - contoh: Dusun 9/8 → 0,95/detik; Dusun 12/8 → 1,7/detik; Kapital 1241/1231 → 0,72/detik;
  - Kampung dihitung dengan kapasitas Kapital (1231). Aturan "penuh" yang sama dipakai untuk lingkaran merah di peta, baris merah di daftar kota, tooltip "Terlalu padat", dan bobot tujuan penumpang.

  Setiap penumpang yang sampai di tujuan menambah kepuasan +0,6 (maksimal 100). Kalau kepuasan habis, permainan selesai.
- **Daftar kota** (tombol "☰ Kota" di kanan atas): tabel `No | Lv | Kota | Jalur | Tunggu | Okupansi | Pop`. Kolom Jalur berisi bulatan berwarna jalur (berbingkai hitam) untuk tiap jalur yang melewati kota itu, dan diurutkan menurut jumlah jalur. Urutan bawaannya: populasi terbesar, lalu level tertinggi, lalu okupansi (menunggu ÷ kapasitas) terbesar. Urutan bawaan ini juga dipakai sebagai pemecah seri saat mengurutkan kolom lain. Okupansi Kampung ditulis "–" karena kapasitasnya 0, dan saat okupansi diurutkan turun Kampung selalu di atas. Level ditulis dengan kode pada tabel di atas (0 Kampung, I Dusun … X Kapital). Klik judul kolom untuk mengurutkan berdasarkan kolom itu (klik lagi untuk membalik arah, ▲ naik / ▼ turun); klik "No" untuk kembali ke urutan bawaan. Baris kuning = lebih dari 50% kapasitas, merah = melebihi kapasitas. Klik baris untuk menggeser peta ke kota itu. Di layar lebar panel ini terbuka di samping peta; di HP panel tertutup sampai tombolnya diketuk.
- **Daftar jalur** (tombol "☰ Jalur" di sebelah tombol Kota; panel yang sama, berganti isi): tabel `No | Jalur | Kota | Jarak | Kereta | Gerbong | Okupansi`. Kota = jumlah stasiun, Jarak = panjang rel (km, 1° ≈ 111 km), Gerbong = level gerbong (1 bawaan … 5), Okupansi = persentase penumpang di dalam semua kereta jalur itu dibanding total kapasitasnya saat ini. Klik judul kolom untuk mengurutkan (klik lagi untuk membalik arah; "No" = urutan warna jalur). Klik baris untuk memilih jalur. Klik tombol yang sedang aktif untuk menutup panel.
- **Grafik** (tombol "📈 Grafik"; di HP hanya ikon 📈): grafik garis *Populasi kota* untuk **10 kota terbesar** yang menutupi peta (HUD atas tetap terlihat). Kota di luar 10 besar tidak digambar. Di bawahnya ada tabel `Kota | Level | Populasi | +5 hari` (selisih dibanding 5 hari lalu). Warna garis menurut pulau: merah Sumatra, hijau Jawa, biru Sulawesi, ungu Papua, kuning Kalimantan, hitam/abu Maluku & Nusa Tenggara. Tiap kota punya gradasi tetap dari pulaunya; kota yang bersebelahan di daftar ibu kota diberi gradasi gelap–terang yang berselang supaya mudah dibedakan. Warna tidak berubah walau peringkat kota naik-turun, dan Peta Bebas memakai warna yang sama. Permainan **tidak dijeda**: grafik dan tabel diperbarui live 4× per detik, dengan titik paling kanan = saat ini; titik lain dicatat tiap pergantian hari. Arahkan kursor / ketuk grafik untuk melihat angka tiap hari. Kecepatan dan jeda (tombol atau `Spasi`, `1`–`5`) tetap bisa dipakai. Tutup dengan ✕ Tutup, tombol 📈 lagi, atau `Esc`; grafik juga tertutup sendiri saat menang/kalah.

## Kontrol

| Aksi | Mouse / keyboard | Layar sentuh |
|---|---|---|
| Bangun / pilih | klik | ketuk |
| Geser peta | seret | seret |
| Zoom | roda mouse, `+` / `-` | cubit |
| Selesai membangun | klik area kosong, klik kanan, `Esc` | ketuk area kosong |
| Jeda / kecepatan | `Spasi`; `1`–`5` | tombol ❚❚ dan 1–5 di kanan atas |
| Buka / tutup grafik populasi | tombol 📈 Grafik; tutup dengan `Esc` | tombol 📈 |
| Sembunyikan / tampilkan panel bawah | tombol V (pojok kanan atas panel bawah) / ^ (pojok kanan bawah) | sama |

Kecepatan 1–5 setara ¼×, ½×, 1×, 2×, 3× waktu normal. Permainan dimulai di kecepatan 3 (normal).

Panel bawah yang disembunyikan memberi peta ruang lebih; panel itu terbuka lagi otomatis saat sebuah jalur dipilih atau dibangun, dan saat panel menang/kalah muncul. Pilihan terakhir diingat browser.

## Struktur

- `index.html`: kerangka halaman dan HUD
- `style.css`: tampilan HUD
- `geo.js`: data geografi: garis pantai yang disederhanakan, pegunungan utama, koordinat 38 ibu kota provinsi, dan urutan wilayah tiap peta
- `game.js`: seluruh logika permainan (peta medan dari data geografi, rute penumpang dengan BFS, simulasi kereta, dan rendering canvas)

Garis pantai digambar kasar dari titik-titik koordinat: cukup untuk mengenali bentuk pulau dan menghitung biaya rel, bukan peta yang akurat. Urutan munculnya kota diacak setiap permainan, mengikuti aturan di atas.
