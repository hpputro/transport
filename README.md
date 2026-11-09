# Lintas Kota

Game strategi transportasi berbasis browser: hubungkan ibu kota provinsi di Indonesia dengan jalur kereta, antar penumpang ke tujuannya, dan jaga agar warga tetap puas.

Main langsung: https://hpputro.github.io/transport/

## Cara main

Buka `index.html` di browser. Tidak perlu instalasi atau server.

### Target

Sambungkan **semua ibu kota provinsi** di peta dalam satu jaringan. Kota muncul bertahap di posisi geografisnya. Kalau semua kota yang sudah ada telah tersambung, kota berikutnya muncul lebih cepat.

| Peta | Wilayah baru | Jumlah kota | Kas awal |
|---|---|---|---|
| 1 | Sumatra | 10 | $1500 |
| 2 | + Jawa | 16 | $2500 |
| 3 | + Sulawesi | 22 | $3500 |
| 4 | + Papua | 28 | $4500 |
| 5 | + Kalimantan | 33 | $5500 |
| 6 | + Bali & Nusa Tenggara | 36 | $6500 |
| 7 | + Maluku | 38 (semua) | $7500 |

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
- **Kereta**: jalur baru otomatis mendapat 1 kereta gratis. Tambah kereta (maks. 4 per jalur) atau gerbong untuk menambah kapasitas.
  - Tiap jalur menyimpan **urutan pembuatan**, yaitu urutan kota saat jalur itu ditarik (termasuk saat diperpanjang dari ujung mana pun).
  - Kereta baru selalu muncul di **kota pertama** dalam urutan itu (depo) dan berangkat ke arah **kota kedua**. Panel jalur menampilkannya, misalnya "depo Medan → Pekanbaru".
  - Kalau sebuah kota dilepas dengan "Potong awal/akhir", kota itu keluar dari urutan dan depo serta arah mengikuti kota berikutnya dalam urutan.
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
- **Pendapatan**: tarif = $10 + $5 × jumlah stasiun yang dilewati. Biaya perawatan $20 per kereta per hari.
- **Status kota** (tampil di tooltip kota):
  - **Dikunjungi**: jumlah penumpang yang turun di kota itu, baik yang sampai tujuan maupun yang transit pindah jalur. Penumpang yang hanya lewat di dalam kereta tidak dihitung. Ini syarat naik level (lihat tabel di bawah). Kota transit yang ramai naik level lebih cepat.
  - **Populasi**: jumlah penumpang yang diantar ke kota itu sebagai tujuan akhir. Populasi semua kota dijumlahkan menjadi **populasi negara** (HUD atas), yang jadi skor permainan.
- **Level kota**: makin tinggi level, makin besar kapasitas, tetapi kota juga menghasilkan lebih banyak penumpang. Di peta, level hanya dibedakan dari ukuran lingkaran.

  | Kode | Level | Kapasitas | Cara mencapainya |
  |---|---|---|---|
  | 0 | Kampung | 0 | kota baru yang belum terhubung jalur |
  | I | Dusun | 8 | langsung, begitu kota tersambung jalur |
  | II | Desa | 16 | total 40 kunjungan |
  | III | Distrik | 32 | 120 kunjungan |
  | IV | Kota Kecil | 64 | 280 kunjungan |
  | V | Kota Besar | 128 | 600 kunjungan |
  | VI | Metropolitan | 256 | 1.240 kunjungan |
  | VII | Megapolitan | 512 | 2.520 kunjungan |
  | VIII | Kapital | 1024 | 5.080 kunjungan |

  - Kampung tetap menghasilkan penumpang (60% dari laju normal). Karena kapasitasnya 0, penumpang pertama saja sudah membuatnya penuh dan kepuasan mulai turun, jadi kota baru perlu segera disambungkan. Level tidak turun lagi kalau jalurnya kemudian dibongkar.
  - Kampung, Dusun, dan Desa: penumpang menunggu ditampilkan sebagai titik di samping kota.
  - Mulai Distrik: ditampilkan sebagai angka di dalam lingkaran (merah kalau melebihi kapasitas). Titik merah kecil di tepi lingkaran berarti ada penumpang yang tujuannya belum terjangkau.
- **Jalur**: ada 10 jalur dengan warna Marun, Merah, Merah Muda, Kuning, Oranye, Hijau Muda, Hijau Tua, Biru Langit, Biru Dongker, dan Ungu. Tiga jalur pertama langsung tersedia; jalur berikutnya terbuka setelah populasi negara mencapai 40, 120, 250, 500, 1.000, 2.000, dan 4.000.
- **Kalah**: kota yang terlalu penuh (lingkaran merah berkedip) menurunkan kepuasan. Kalau kepuasan habis, permainan selesai.
- **Daftar kota** (tombol "☰ Kota" di kanan atas): tabel `No | Lv | Kota | Tunggu/Kap | Pop.`, diurutkan dari persentase tunggu/kapasitas terbesar, lalu level tertinggi, lalu populasi terbesar. Level ditulis dengan kode pada tabel di atas (0 Kampung, I Dusun … VIII Kapital). Klik judul kolom untuk mengurutkan berdasarkan kolom itu (klik lagi untuk membalik arah, ▲ naik / ▼ turun); klik "No" untuk kembali ke urutan bawaan. Baris kuning = lebih dari 50% kapasitas, merah = melebihi kapasitas. Klik baris untuk menggeser peta ke kota itu. Di layar lebar panel ini terbuka di samping peta; di HP panel tertutup sampai tombolnya diketuk.

## Kontrol

| Aksi | Mouse / keyboard | Layar sentuh |
|---|---|---|
| Bangun / pilih | klik | ketuk |
| Geser peta | seret | seret |
| Zoom | roda mouse, `+` / `-` | cubit |
| Selesai membangun | klik area kosong, klik kanan, `Esc` | ketuk area kosong |
| Jeda / kecepatan | `Spasi`; `1`–`5` | tombol ❚❚ dan 1–5 di kanan atas |

Kecepatan 1–5 setara ¼×, ½×, 1×, 2×, 3× waktu normal. Permainan dimulai di kecepatan 3 (normal).

## Struktur

- `index.html`: kerangka halaman dan HUD
- `style.css`: tampilan HUD
- `geo.js`: data geografi: garis pantai yang disederhanakan, pegunungan utama, koordinat 38 ibu kota provinsi, dan urutan wilayah tiap peta
- `game.js`: seluruh logika permainan (peta medan dari data geografi, rute penumpang dengan BFS, simulasi kereta, dan rendering canvas)

Garis pantai digambar kasar dari titik-titik koordinat: cukup untuk mengenali bentuk pulau dan menghitung biaya rel, bukan peta yang akurat. Urutan munculnya kota diacak setiap permainan, mengikuti aturan di atas.
