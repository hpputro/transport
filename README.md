# Lintas Kota

Game strategi transportasi berbasis browser: hubungkan kota-kota di sebuah kepulauan dengan jalur kereta, antar penumpang ke tujuannya, dan jaga agar warga tetap puas.

## Cara main

Buka `index.html` di browser. Tidak perlu instalasi atau server.

- **Bangun jalur**: klik sebuah kota, lalu klik kota-kota berikutnya. Setiap ruas rel ada biayanya, tergantung jarak dan medan:
  - darat ×1
  - gunung ×2,5 (terowongan)
  - laut ×4 (jembatan)
- **Perpanjang jalur**: pilih jalurnya, lalu klik salah satu ujungnya. Kamu bisa memperpanjang dari ujung awal maupun ujung akhir.
- **Kereta**: jalur baru otomatis mendapat 1 kereta gratis. Tambah kereta (maks. 4 per jalur) atau gerbong untuk menambah kapasitas.
- **Penumpang** muncul di tiap kota dengan tujuan kota lain. Mereka otomatis mencari rute terpendek, termasuk transit antar-jalur.
  - Titik gelap: penumpang yang sudah punya rute.
  - Titik merah: tujuannya belum terhubung ke jaringan.
- **Pendapatan**: tarif = $10 + $5 × jumlah stasiun yang dilewati. Biaya perawatan $20 per kereta per hari.
- **Pertumbuhan**: kota yang sering didatangi penumpang tumbuh lebih besar. Kota besar menampung lebih banyak orang, tetapi juga menghasilkan lebih banyak penumpang.
- **Jalur baru** terbuka setelah 40, 120, dan 250 penumpang terantar.
- **Kalah**: kota yang terlalu penuh (lingkaran merah berkedip) menurunkan kepuasan. Kalau kepuasan habis, permainan selesai.

## Kontrol

| Aksi | Mouse / keyboard | Layar sentuh |
|---|---|---|
| Bangun / pilih | klik | ketuk |
| Geser peta | seret | seret |
| Zoom | roda mouse, `+` / `-` | cubit |
| Selesai membangun | klik area kosong, klik kanan, `Esc` | ketuk area kosong |
| Jeda / kecepatan | `Spasi`, `1` `2` `3` | tombol di kanan atas |

## Struktur

- `index.html`: kerangka halaman dan HUD
- `style.css`: tampilan HUD
- `game.js`: seluruh logika permainan (pembuatan peta prosedural, rute penumpang dengan BFS, simulasi kereta, dan rendering canvas)

Peta dan nama kota dibuat acak setiap permainan.
