# Mango Cheese — Realtime Dashboard & POS

Dashboard operasional Re-Bites Mango Cheese Milk: input penjualan & belanja
langsung dari HP di booth, HPP dihitung otomatis dengan **FIFO**, dan seluruh
data tersinkron **dua arah** dengan Google Sheets.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Lucide React ·
Recharts · googleapis.

---

## 1. Fitur

### Modul HPP & Inventori Batch (FIFO engine)
- Input belanja bahan baku per batch: tanggal, nama item, total biaya, estimasi yield cup.
- `cost_per_cup = total_biaya / yield_cup` (dibulatkan ke rupiah utuh).
- Penjualan **N** cup memotong batch `ACTIVE` bertanggal paling awal. Kalau N
  melebihi sisa batch itu, batch dihabiskan (status jadi `DEPLETED`) dan sisa
  kekurangannya otomatis diambil dari batch aktif berikutnya, berantai sampai
  N terpenuhi.
- HPP satu transaksi = gabungan biaya seluruh batch yang terpakai.
- Pembulatan tidak menumpuk: biaya tiap potongan dihitung sebagai selisih dua
  nilai kumulatif yang dibulatkan, jadi kalau satu batch habis, jumlah seluruh
  potongan HPP-nya **persis** sama dengan total biaya belanja batch tersebut.
- Kalau stok batch kurang, transaksi tetap tercatat, ditandai `shortageCups`,
  dan dashboard menampilkan peringatan supaya batch-nya segera diinput.

### Modul Transaksi
- Form penjualan harian: jumlah cup + harga jual → memicu alokasi FIFO,
  menghasilkan omzet, HPP terpakai, dan laba kotor (preview-nya sudah muncul
  sebelum tombol simpan ditekan).
- Form OPEX: tanggal, kategori (Es Batu, Ongkir/Bensin, Promosi, Sewa/Listrik,
  Lainnya), nominal, catatan.
- Tabel riwayat (rekap harian / penjualan / OPEX) dengan filter rentang tanggal
  plus pintasan Hari ini · 7 hari · Bulan ini · Semua.

### Google Sheets two-way sync
- **READ** — dashboard membaca tab `Batches`, `Sales`, dan `Expenses`.
- **WRITE** — setiap input dari UI langsung `append`/`update`/`delete` baris di
  tab yang bersangkutan.
- **RE-KALKULASI** — `POST /api/sync` menjalankan ulang FIFO untuk seluruh data
  lalu menulis balik kolom turunan (HPP per cup, cup terpakai, sisa, status
  batch, HPP terpakai & laba kotor tiap penjualan) ke spreadsheet.
- Template Google Apps Script (`google-apps-script/Code.gs`) memasang trigger
  `onEdit` + `onChange`, jadi perubahan manual di spreadsheet langsung memicu
  re-kalkulasi tersebut.

### Metrik, proyeksi & health tracker
- 4 kartu metrik: Total Omzet, Total HPP Terpakai, Total OPEX, Laba Bersih
  (`net = gross profit − OPEX`).
- Health badge: **Hijau/Sehat** net margin ≥ 40% · **Kuning/Waspada** 20–39% ·
  **Merah/Kritis** < 20%.
- Grafik area kumulatif Omzet vs Pengeluaran (HPP + OPEX) sepanjang bulan
  berjalan, plus garis putus-putus proyeksi omzet akhir bulan (rata-rata harian
  × jumlah hari dalam bulan).
- BEP progress bar: cup terjual vs titik balik modal
  `(belanja batch ACTIVE + total OPEX) ÷ margin per cup`.

### Kunci password
- Isi env `APP_PASSWORD` untuk mengunci seluruh dashboard: halaman diarahkan ke
  `/login`, dan seluruh endpoint API membalas `401` tanpa sesi yang sah.
- Password tidak pernah ditulis di kode, dan cookie sesi hanya menyimpan hash
  SHA-256 dari password — jadi isi cookie tidak bisa dipakai menebak balik
  passwordnya, dan sesi lama otomatis gugur begitu passwordnya diganti.
- Sesi berlaku 30 hari per perangkat (cookie `httpOnly`), dengan tombol
  **Keluar** di header.
- Webhook `POST /api/sync` dari Apps Script tetap bisa masuk tanpa sesi selama
  membawa `SYNC_SECRET` yang benar.
- Kalau `APP_PASSWORD` dikosongkan, dashboard terbuka tanpa kunci (praktis saat
  `npm run dev`).

### UI/UX & teknis
- Mobile-first: layout satu kolom, header sticky, bottom nav, tombol pintas
  jumlah cup dan nominal, input `inputmode="numeric"` (keypad angka), font 16px
  supaya iOS tidak auto-zoom.
- Mode terang/gelap: ikut setelan HP secara otomatis (siang terang, malam
  gelap), bisa dikunci manual lewat tombol tema dan diingat di `localStorage`.
  Warna seri grafik punya dua set — masing-masing sudah diverifikasi kontras
  dan keterbacaannya untuk buta warna terhadap latar mode-nya.
- Hapus transaksi tidak pakai dialog konfirmasi: langsung jalan, lalu muncul
  toast **Urungkan** selama 7 detik.
- Empty state berisi panduan tiga langkah saat data masih kosong, dan skeleton
  saat snapshot pertama dimuat.
- Semua rupiah dibulatkan dengan `Math.round()` dan disimpan sebagai integer.
- Fallback koneksi lambat/putus di booth:
  - snapshot terakhir di-cache di `localStorage` → layar langsung terisi;
  - input yang gagal terkirim masuk antrean di `localStorage` dan dikirim ulang
    otomatis saat koneksi kembali (event `online` + polling 45 detik);
  - angka dihitung ulang di browser memakai FIFO engine yang sama dengan server,
    jadi hasil offline tidak pernah beda rumus;
  - kalau kredensial Google Sheets belum diisi, aplikasi tetap jalan memakai
    penyimpanan lokal (`.data/db.json`, atau memori proses kalau filesystem
    read-only) — berguna untuk demo dan setup awal.

---

## 2. Menjalankan

```bash
cd dashboard
npm install
cp .env.example .env.local   # boleh dikosongkan dulu (mode lokal)
npm run dev                  # http://localhost:3000
```

Perintah lain:

```bash
npm run build      # build produksi
npm run start      # jalankan hasil build
npm run typecheck  # tsc --noEmit
npm test           # unit test FIFO, metrik, BEP, proyeksi, parser
```

---

## 3. Setup Google Sheets

1. **Buat spreadsheet** baru. Salin ID-nya dari URL:
   `docs.google.com/spreadsheets/d/`**`<ID>`**`/edit`.
2. **Buat service account** di Google Cloud Console → aktifkan *Google Sheets
   API* → Keys → *Add key* → JSON.
3. **Share spreadsheet** ke `client_email` service account tersebut sebagai
   **Editor**.
4. Isi `.env.local`:

   ```env
   GOOGLE_SHEET_ID=1AbC...
   GOOGLE_CLIENT_EMAIL=mango-pos@project-id.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
   SYNC_SECRET=rahasia-bebas
   APP_PASSWORD=password-untuk-buka-dashboard
   ```

   `GOOGLE_PRIVATE_KEY` boleh ditulis satu baris dengan literal `\n` — aplikasi
   mengubahnya kembali jadi baris baru asli.
5. Jalankan aplikasi. Tab `Batches`, `Sales`, `Expenses` beserta barisan header
   dibuat otomatis saat pertama kali diakses kalau belum ada.

### Struktur kolom

`Batches`

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| ID | Tanggal | Nama Item | Total Biaya | Yield Cup | HPP per Cup | Terpakai (Cup) | Sisa (Cup) | Status | Catatan | Dibuat |

`Sales`

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| ID | Tanggal | Cup Terjual | Harga per Cup | Omzet | HPP Terpakai | Laba Kotor | Channel | Catatan | Dibuat |

`Expenses`

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| ID | Tanggal | Kategori | Nominal | Catatan | Dibuat |

Kolom **F–I di `Batches`** dan **E–G di `Sales`** adalah kolom turunan: boleh
dilihat, tapi isinya ditimpa ulang setiap re-kalkulasi. Yang perlu diisi manual
cukup kolom mentahnya (tanggal, nama item, biaya, yield, cup, harga, dst.) —
kolom `ID` dan `Dibuat` boleh dikosongkan, sistem akan mengisinya sendiri.

Format tanggal aman ditulis `YYYY-MM-DD` maupun `dd/mm/yyyy`; nominal boleh
`250000`, `250.000`, atau `Rp 250.000`.

### Webhook Apps Script

Pasang `google-apps-script/Code.gs` mengikuti instruksi di bagian atas file
tersebut (Script properties `DASHBOARD_URL` + `SYNC_SECRET`, lalu jalankan
`setupTriggers` sekali). Setelah itu setiap edit manual di spreadsheet memicu
`POST /api/sync` → FIFO dihitung ulang → kolom turunan ditulis balik.

---

## 4. API

| Endpoint | Method | Kegunaan |
|---|---|---|
| `/api/sync` | `GET` | Snapshot lengkap: data + metrik + chart + BEP |
| `/api/sync` | `POST` | Re-kalkulasi FIFO & tulis balik kolom turunan (dipakai webhook Apps Script; butuh `x-sync-secret` bila `SYNC_SECRET` diisi) |
| `/api/batches` | `GET` `POST` `DELETE` | Batch belanja bahan baku |
| `/api/sales` | `GET` `POST` `DELETE` | Penjualan harian |
| `/api/expenses` | `GET` `POST` `PATCH` `DELETE` | Pengeluaran operasional |
| `/api/login` | `POST` `DELETE` | Masuk (pasang cookie sesi) dan keluar |

Contoh:

```bash
curl -X POST http://localhost:3000/api/sales \
  -H 'content-type: application/json' \
  -d '{"date":"2026-08-12","cups":45,"pricePerCup":15000,"channel":"Booth"}'
```

Response `POST` selalu membawa `snapshot` terbaru, jadi UI cukup sekali
round-trip untuk update seluruh angka.

---

## 5. Struktur kode

```
dashboard/
├─ app/
│  ├─ api/{sync,batches,sales,expenses,login}/route.ts   # REST + webhook + sesi
│  ├─ login/page.tsx      # halaman kunci password
│  ├─ layout.tsx · globals.css · page.tsx
├─ middleware.ts          # gerbang password untuk semua halaman & API
├─ components/            # UI (form, chart, tabel, kartu metrik, toast)
├─ hooks/
│  ├─ useDashboard.ts     # cache lokal, antrean offline, polling
│  └─ useTheme.ts         # store tema terang/gelap lintas komponen
├─ lib/
│  ├─ fifo.ts             # FIFO engine (murni, tanpa I/O)
│  ├─ metrics.ts          # metrik, health, chart, BEP
│  ├─ derive.ts           # data mentah -> seluruh angka dashboard
│  ├─ parse.ts            # normalisasi rupiah/tanggal/kategori
│  ├─ auth.ts             # kunci password (hash cookie, tanpa simpan password)
│  ├─ sheets.ts           # wrapper googleapis
│  ├─ store.ts            # Sheets ↔ fallback lokal
│  └─ snapshot.ts · types.ts · format.ts · api.ts
├─ google-apps-script/Code.gs
└─ tests/                 # unit test FIFO & parser
```

`lib/fifo.ts`, `lib/metrics.ts`, dan `lib/derive.ts` adalah fungsi murni tanpa
I/O — dipakai server (setelah membaca Sheets) **dan** browser (hitung ulang
optimistis saat offline), jadi tidak ada dua versi rumus.

---

## 6. Deploy

Vercel (atau host Node lain):

1. Import repo, set **Root Directory** ke `dashboard`.
2. Isi environment variables `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`,
   `GOOGLE_PRIVATE_KEY`, `SYNC_SECRET`, dan `APP_PASSWORD`.
3. Deploy, lalu isi `DASHBOARD_URL` di Script properties Apps Script dengan URL
   hasil deploy.

Catatan: mode fallback lokal menulis ke `.data/db.json`. Di lingkungan
serverless yang filesystem-nya read-only, datanya hanya bertahan selama proses
hidup — itu memang cuma jaring pengaman; sumber kebenaran tetap Google Sheets.
