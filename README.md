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
- **Penumpang** muncul di tiap kota dengan tujuan kota lain. Mereka otomatis mencari rute terpendek, termasuk transit antar-jalur.
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

  | Level | Kapasitas | Total kunjungan untuk mencapainya |
  |---|---|---|
  | Kampung | 8 | (awal) |
  | Desa | 16 | 40 |
  | Distrik | 32 | 120 |
  | Kota Kecil | 64 | 280 |
  | Kota Besar | 128 | 600 |
  | Metropolitan | 256 | 1.240 |
  | Megapolitan | 512 | 2.520 |
  | Kapital | 1024 | 5.080 |

  - Kampung dan Desa: penumpang menunggu ditampilkan sebagai titik di samping kota.
  - Mulai Distrik: ditampilkan sebagai angka di dalam lingkaran (merah kalau melebihi kapasitas). Titik merah kecil di tepi lingkaran berarti ada penumpang yang tujuannya belum terjangkau.
- **Jalur baru** terbuka setelah populasi negara mencapai 40, 120, dan 250.
- **Kalah**: kota yang terlalu penuh (lingkaran merah berkedip) menurunkan kepuasan. Kalau kepuasan habis, permainan selesai.

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

Garis pantai digambar kasar dari titik-titik koordinat: cukup untuk mengenali bentuk pulau dan menghitung biaya rel, bukan peta yang akurat. Urutan munculnya kota dalam satu peta diacak setiap permainan.
