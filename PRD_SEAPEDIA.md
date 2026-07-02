# Product Requirements Document (PRD)
## SEAPEDIA — Integrated Multi-Role E-Commerce Marketplace

**Dokumen:** PRD
**Sumber:** COMPFEST 18 — Software Engineering Academy Technical Challenge
**Versi:** 1.0

---

## 1. Latar Belakang

SEAPEDIA adalah platform e-commerce yang menghubungkan tiga aktor utama non-admin —
**Penjual (Seller)**, **Pembeli (Buyer)**, dan **Kurir (Driver)** — dalam satu ekosistem
marketplace multi-toko, serta diawasi oleh **Admin**. Produk ini dibangun secara
bertahap (progresif) mulai dari tampilan publik dasar hingga sistem operasional penuh
yang mencakup transaksi, diskon, logistik, monitoring, dan keamanan.

## 2. Tujuan Produk

1. Menyediakan marketplace multi-seller yang dapat diakses publik (guest) maupun
   pengguna terautentikasi.
2. Mendukung satu username memiliki lebih dari satu role non-admin sekaligus, dengan
   otorisasi berbasis **active role**, bukan seluruh role yang dimiliki.
3. Menyediakan alur transaksi end-to-end: dari cart → checkout → proses penjual →
   pengiriman kurir → penyelesaian/retur.
4. Menyediakan sistem diskon (Voucher & Promo), dompet digital (wallet), dan
   perhitungan pajak (PPN 12%) yang konsisten.
5. Menyediakan panel monitoring Admin serta mekanisme penanganan pesanan *overdue*
   (auto refund/retur).
6. Memastikan aplikasi aman dari SQL Injection dan XSS, serta memiliki kontrol akses
   berbasis role yang solid di sisi backend.

## 3. Target Pengguna & Role

| Role | Deskripsi | Kapabilitas Utama |
|---|---|---|
| **Guest** | Pengunjung tanpa akun | Melihat katalog produk, detail produk, memberi ulasan aplikasi publik |
| **Buyer** | Pengguna yang berbelanja | Wallet, alamat pengiriman, cart, checkout, riwayat pesanan |
| **Seller** | Pengguna yang berjualan | Kelola toko (unik), kelola produk, proses pesanan masuk, laporan pendapatan |
| **Driver** | Pengguna pengantar barang | Cari job pengiriman, ambil job, konfirmasi selesai, lihat pendapatan |
| **Admin** | Pengelola sistem | Monitoring marketplace, kelola voucher/promo, trigger simulasi hari, tangani overdue |

**Catatan penting:** satu username non-admin bisa memiliki kombinasi role
(Buyer+Seller, Buyer+Driver, dst). Setelah login, user **wajib memilih active role**
untuk sesi berjalan, dan seluruh otorisasi backend mengacu ke active role tersebut —
bukan daftar role yang dimiliki.

## 4. Ruang Lingkup (Scope) — Berdasarkan Level

Peserta boleh berhenti di level manapun; penilaian hanya mencakup requirement level 1
s.d. level yang diklaim. Total core = 100 poin, bonus UI (10) & deployment (15).

---

### Level 1 — Public Marketplace, Autentikasi, & Review (20 pts)

**Fitur:**
- Landing page, listing produk (guest-accessible), detail produk read-only, halaman
  login & register.
- Registrasi, login, logout dengan password hashing + JWT/session/token.
- Model data mendukung 4 role; satu username bisa multi-role non-admin.
- Role selection screen/modal jika user punya >1 role non-admin.
- Proteksi route & endpoint berbasis active role.
- Dashboard profile menampilkan daftar role dimiliki + role aktif.
- Placeholder ringkasan saldo/finansial lintas role.
- Fitur review publik aplikasi (bukan review produk): nama, rating 1–5, komentar —
  bisa diisi guest maupun logged-in user, tanpa perlu checkout.
- Komponen UI reusable (Button, Input, Card, Navbar, Footer) + routing publik/privat.

**Business Rules:**
- Guest hanya boleh browse, tidak boleh checkout/akses dashboard privat.
- User multi-role tidak boleh masuk dashboard privat sebelum memilih active role.
- Review aplikasi ditampilkan sebagai teks biasa (aman, tidak merusak layout).

---

### Level 2 — Seller Experience (15 pts)

**Fitur:**
- CRUD profil toko Seller dengan validasi nama toko unik.
- CRUD produk (nama, deskripsi, harga, stok, pemilik toko) khusus milik Seller
  sendiri.
- Dashboard Seller menampilkan daftar produk miliknya.
- Katalog publik & detail produk terhubung ke data backend nyata (bukan dummy lagi),
  menampilkan info toko.

**Business Rules:**
- Nama toko unik (constraint DB dan/atau validasi backend).
- Seller hanya boleh kelola toko & produk miliknya sendiri.
- Guest tetap bisa lihat katalog & detail tanpa login.

---

### Level 3 — Buyer Wallet, Cart, & Checkout (20 pts)

**Fitur:**
- Wallet Buyer + dummy top-up + riwayat transaksi wallet.
- Manajemen alamat pengiriman Buyer.
- Cart: tambah/update/hapus produk, ringkasan cart.
- **Single-store checkout rule**: 1 cart hanya boleh berisi produk dari 1 toko.
- Checkout: pilih metode pengiriman (Instant/Next Day/Regular), hitung subtotal,
  ongkir, PPN 12%, total akhir.
- Order tersimpan dengan status awal **Sedang Dikemas**, status history + timestamp.
- Riwayat & detail pesanan Buyer; daftar pesanan masuk Seller.

**Business Rules:**
- Checkout gagal jika saldo wallet tidak cukup.
- Ongkir berbeda per metode pengiriman.
- Stok tidak boleh negatif setelah checkout.
- Cart menolak produk dari toko berbeda / minta buyer kosongkan cart dulu.

---

### Level 4 — Discounts & Seller Order Processing (15 pts)

**Fitur:**
- Resource Voucher (expiry + kuota pemakaian) dan Promo (expiry).
- Endpoint Admin generate voucher/promo; endpoint list & detail.
- Checkout menerima & memvalidasi kode diskon, menampilkan efeknya di ringkasan.
- Aksi Seller memproses order: **Sedang Dikemas → Menunggu Pengirim** (tercatat di
  status history).
- Laporan pengeluaran Buyer & pendapatan Seller.

**Business Rules:**
- Voucher/promo kedaluwarsa atau kuota habis tidak bisa dipakai.
- Aturan kombinasi voucher+promo harus konsisten & terdokumentasi.
- Urutan perhitungan diskon vs PPN 12% harus konsisten & terdokumentasi.
- Order tidak bisa diambil Driver sebelum diproses Seller.

---

### Level 5 — Delivery & Driver Workflow (10 pts)

**Fitur:**
- Resource delivery job, terhubung ke order tertentu.
- Driver: cari job tersedia (hanya status **Menunggu Pengirim**), lihat detail job.
- Take job → status order jadi **Sedang Dikirim**; confirm completed → **Pesanan
  Selesai**. Semua perubahan status tercatat dengan timestamp.
- Dashboard Driver: job aktif, riwayat job, earnings.

**Business Rules:**
- 1 order hanya boleh punya 1 driver aktif (no race condition antar driver).
- Driver tidak boleh lihat/ambil order berstatus Sedang Dikemas.
- Aturan perhitungan earning didefinisikan jelas & konsisten.

---

### Level 6 — Admin Monitoring & Overdue Handling (10 pts)

**Fitur:**
- Dashboard Admin: monitoring users, stores, products, orders, voucher/promo,
  delivery jobs, overdue orders.
- UI Admin lengkap untuk generate & lihat voucher/promo.
- Mekanisme **auto refund / auto return** untuk order overdue berdasarkan SLA metode
  pengiriman (Instant/Next Day/Regular).
- Simulasi hari berikutnya (scheduler/cron/worker/command/manual trigger Admin).

**Business Rules:**
- Order overdue final status minimal **Dikembalikan**.
- Refund hanya untuk order yang sudah checkout & dibayar; dana dikembalikan ke wallet
  Buyer + tercatat di riwayat transaksi.
- Pendapatan Seller yang sudah tercatat harus di-reversal jika order direfund/retur.
- Stok produk dikembalikan sesuai qty item yang direfund/retur.
- Tidak boleh ada double refund / double reversal / double restore stok.
- Setiap perubahan akibat overdue harus meninggalkan jejak (audit trail).

---

### Level 7 — Security Hardening & Finalization (10 pts)

**Fitur & Requirement:**
- Cegah SQL Injection (parameterized query / ORM-safe).
- Cegah XSS pada input publik, khususnya review aplikasi.
- Validasi field wajib (email, phone, rating, qty, price, stock, nilai diskon).
- Logout benar-benar invalidasi session/token.
- Endpoint privat tidak bisa diakses hanya dengan mengubah route frontend.
- Active role diverifikasi di server-side untuk semua aksi Seller/Buyer/Driver/Admin.
- User tidak bisa akses/modifikasi resource milik user lain.
- Dokumentasi API (Swagger/OpenAPI/Postman), seed data/demo account 4 role,
  dokumentasi single-store checkout, aturan diskon & PPN, aturan earning driver,
  SLA overdue & cara simulasi waktu, catatan keamanan.

---

## 5. Aturan Bisnis Lintas Level (Global)

- 4 role: Admin, Seller, Buyer, Driver.
- Satu username non-admin bisa multi-role; wajib pilih active role tiap sesi.
- Otorisasi = active role, bukan seluruh role dimiliki.
- Guest: browse produk & review publik saja.
- Nama toko unik.
- Buyer wajib punya cart, wallet, alamat, checkout flow.
- Checkout = subtotal + diskon + ongkir + PPN 12% = total akhir.
- Diskon: Voucher & Promo.
- Metode pengiriman: Instant, Next Day, Regular.
- Setiap order menyimpan status history + timestamp.
- Seller wajib proses order sebelum Driver bisa ambil job.
- Driver: cari job → ambil job → konfirmasi selesai.
- Sistem mendukung auto refund/retur untuk order overdue.
- Tersedia mekanisme simulasi "hari berikutnya".
- Konten publik (review, komentar) harus aman dari input berbahaya.

**Alur status order utama (wajib tampil di UI):**
`Sedang Dikemas → Menunggu Pengirim → Sedang Dikirim → Pesanan Selesai`
(dengan cabang alternatif → `Dikembalikan` untuk kasus overdue)

**Aturan Cart:** single-store checkout — 1 cart hanya boleh berisi produk dari 1 toko.

## 6. Non-Functional Requirements

- Backend berbasis API (bebas framework/bahasa).
- Password harus di-hash, bukan plaintext.
- Autentikasi berbasis token/JWT/session dengan expiration yang wajar & terdokumentasi.
- Layout responsif desktop & mobile.
- Kode bersih, struktur project maintainable, pemisahan concern backend jelas.
- README lengkap: setup, env variable, cara buat akun admin, dokumentasi API,
  catatan keamanan.
- Git commit history bertahap (tidak di-squash).

## 7. Deliverables per Level (Ringkasan)

| Level | Output Utama |
|---|---|
| 1 | Public UI, auth, role selection, review publik, komponen reusable |
| 2 | Seller dashboard, CRUD produk, katalog terhubung backend |
| 3 | Wallet, alamat, cart single-store, checkout, riwayat order |
| 4 | Voucher/Promo, proses order Seller, laporan Buyer/Seller |
| 5 | Delivery job, take/confirm job, dashboard Driver |
| 6 | Dashboard Admin, manajemen voucher/promo, auto refund/retur, simulasi hari |
| 7 | Hardening keamanan, dokumentasi API & README final, demo end-to-end |

## 8. Kriteria Penilaian (Assessment Components)

1. Kelengkapan requirement tiap level
2. Ketepatan business rules & perilaku berbasis role
3. Kebersihan kode & struktur project
4. Desain API backend & separation of concerns
5. Responsivitas & usability UI
6. Kebenaran keamanan (auth, input handling, access control)
7. Kejelasan README & dokumentasi API
8. Kualitas demo end-to-end

**Bonus (25 pts):** UI kreatif & intuitif (10 pts), Deployment publik (15 pts).

## 9. Out of Scope (Level 1, akan hadir di level lanjutan)

- Perhitungan wallet balance/seller income/driver earning riil (baru placeholder di L1)
- Diskon riil (baru di L4)
- Delivery job riil (baru di L5)
- Admin dashboard penuh (baru di L6)
- Hardening keamanan formal (baru di L7)

---

*Dokumen ini disusun berdasarkan spesifikasi teknis SEAPEDIA — COMPFEST 18 Software
Engineering Academy. Lihat ERD_SEAPEDIA untuk struktur data pendukung.*
