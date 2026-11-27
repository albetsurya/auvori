# Auvori — Aplikasi Preset Foto 1-Klik (Cloudflare Pages + D1 + Lynk.id)

**Auvori** adalah aplikasi web/PWA preset foto *mobile-first* ala Meitu yang berjalan 100% di browser perangkat pengguna (tanpa upload foto ke server), dengan model **Free & Pro** terintegrasi pembayaran otomatis lewat **Webhook Lynk.id** dan **Cloudflare D1**.

## Fitur Utama
- **UX Geser Efek ala Meitu:** Strip thumbnail *live preview* langsung dari foto pengguna + 1 slider intensitas (0–100%) + mode *Atur Manual* opsional.
- **18 Preset Terkurasi (6 Gratis + 12 Pro):** Termasuk preset **Seoul Café** (*dehaze*, *cool cyan-teal shadows*, dan *skin-tone protection*), seri *Korean*, *Café*, *Fuji Film*, dan *Night*.
- **Before / After Interaktif:** Tekan dan tahan foto untuk mengintip foto asli, atau aktifkan mode *Split-View* geser kiri-kanan.
- **Ekspor HD & Kartu Viral Before/After:** Unduh foto HD bersih atau bingkai putih **SEBELUM / SESUDAH** siap unggah ke Threads, Instagram, dan TikTok.
- **Try Before Buy + Aktivasi Otomatis Lynk.id:** Semua efek Pro bisa dicoba langsung di layar; saat mau ekspor muncul modal checkout Lynk.id dan aktivasi instan memakai email pembelian.

## 1. Menjalankan Secara Lokal
```bash
npm install
npm run dev
```
Untuk mencoba mode **Pro** secara lokal tanpa backend D1, buka menu **Buka Pro → Sudah Beli? Aktifkan** lalu masukkan kode **`AUVORI-DEMO`**.

## 2. Setup Database Cloudflare D1
Pastikan kamu sudah login ke Wrangler (`npx wrangler login`):
```bash
npx wrangler d1 create auvori-db
```
Salin `database_id` yang muncul ke dalam file `wrangler.toml`, lalu jalankan migrasi tabel:
```bash
npx wrangler d1 execute auvori-db --remote --file=./schema.sql
```

## 3. Deploy ke Cloudflare Pages
1. Push folder proyek ini ke repository GitHub kamu.
2. Buka **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Isi konfigurasi build:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Masuk ke **Settings → Functions → D1 database bindings**, tambahkan binding:
   - Variable name: `DB`
   - D1 database: `auvori-db`
5. Masuk ke **Settings → Environment variables**, tambahkan:
   - `VITE_LYNK_CHECKOUT_URL`: URL produk Auvori Pro di Lynk.id kamu (mis. `https://lynk.id/username/auvori-pro`)
   - `LYNK_MERCHANT_KEY`: Merchant Key LIVE dari dashboard Lynk.id (simpan sebagai *Secret*)
   - `PRO_PRODUCT_KEYWORD`: `auvori` (opsional, agar webhook hanya mengaktifkan order produk yang mengandung kata `auvori`)

## 4. Hubungkan Webhook Lynk.id
1. Login ke Dashboard **Lynk.id → Settings → Integrations → Webhooks**.
2. Daftarkan Webhook URL:
   ```text
   https://domain-auvori-kamu.pages.dev/api/webhook/lynk
   ```
3. Pilih event **`order.paid`** / **`order.completed`** (Method: `POST`), lalu simpan.
4. Salin **Merchant Key** yang muncul di Lynk.id dan tempelkan ke Environment Variable `LYNK_MERCHANT_KEY` di Cloudflare Pages.

## 5. Isi Produk Digital di Lynk.id
Buat produk bertipe **Digital Product** dengan judul mengandung kata **Auvori** (misalnya: *Akses Auvori Pro Lifetime*). Pada konten yang diterima pembeli setelah bayar, isi:
1. **Link Aktivasi Langsung:** `https://domain-auvori-kamu.pages.dev/activate`
2. **Instruksi 3 Langkah:** Buka link → masukkan **email pembelian Lynk.id** → klik **Aktifkan Akses Pro** (otomatis tersimpan permanen, mendukung hingga 3 perangkat).
