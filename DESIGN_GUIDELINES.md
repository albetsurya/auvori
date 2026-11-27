# AUVORI — Design System & Product UI Guidelines

Version 1.0 · November 2026

**Brand statement:** *Your moments, in your own tone.*  
Auvori adalah personal photo styling studio yang membantu pengguna memberikan karakter visual pada foto melalui preset, filter, dan pengaturan fotografi yang intuitif.

**Design philosophy:** *Less interface, more expression.*

---

## 01. Brand Foundation

### 1.1 Brand Positioning
| Aspek | Pedoman |
| --- | --- |
| Product | Photo editing & preset application |
| Positioning | Personal aesthetic photo studio |
| Personality | Elegant, warm, expressive |
| Visual identity | Warm editorial minimalism |
| Experience | Effortless photo styling |
| Target audience | Gen Z dan young adults |
| Platform | Mobile-first |

### 1.2 Brand Personality
1. **Elegant** — Tidak berisik, tidak terlalu banyak dekorasi.
2. **Warm** — Warna dan interaksi terasa ramah.
3. **Artistic** — Terinspirasi dunia fotografi dan editorial.
4. **Intuitive** — Pengguna tidak perlu belajar lama untuk mengedit.
5. **Expressive** — Memberikan kebebasan berekspresi melalui warna dan tone.

### 1.3 Design Principles
1. **Photography first** — Foto harus selalu menjadi elemen visual paling dominan.
2. **Quiet sophistication** — Gunakan elemen minimalis dan hindari dekorasi tanpa fungsi.
3. **Functional beauty** — Setiap komponen menarik sekaligus mudah digunakan.
4. **Consistent experience** — Semua halaman memakai bahasa visual yang sama.
5. **Effortless editing** — Editing terasa cepat, intuitif, dan memberi feedback langsung.

---

## 02. Visual Identity

### 2.1 Color System
**Primary palette**
- **Ivory:** `#F7F3ED` (65% background utama)
- **Sand:** `#E6D9C9` (surface sekunder & border default)
- **Taupe:** `#B28B70` (supporting warm accent & dark-mode primary action)
- **Mocha:** `#755846` (CTA utama & active state)
- **Ink:** `#28231F` (teks utama)

**Semantic palette** (hanya untuk status, bukan dekorasi)
- **Success:** `#52765E`
- **Warning:** `#B47B3C`
- **Error:** `#A6534D`
- **Info:** `#71839A`

### 2.2 Typography
- **Display / Editorial Headings:** `Cormorant Garamond`
- **UI, Body, Labels, Angka Adjustment:** `Plus Jakarta Sans` (Regular 400, Medium 500, Semibold 600, Bold 700)
- Jangan gunakan serif untuk tombol, angka adjustment, atau label kontrol editor.

| Style | Size | Weight |
| --- | --- | --- |
| Display | 36 px | Regular |
| H1 | 30 px | Medium |
| H2 | 24 px | Semibold |
| H3 | 20 px | Semibold |
| Body large | 16 px | Regular |
| Body | 14 px | Regular |
| Caption | 12 px | Regular |
| Micro label | 10 px | Medium |

---

## 03. Layout & Spacing System
Sistem 8-point grid (`space-1: 4px` hingga `space-12: 48px`).
- **Screen padding:** `20 px`
- **Max mobile-oriented width:** `480 px` (adaptif pada tablet/desktop)
- **Header height:** `56–64 px`
- **Bottom navigation:** `68–76 px + safe area` (nonaktif saat masuk Photo Editor kontekstual)
- **Radius:** XS `4px`, MD `12px`, LG `16px`, XL `20px`, 2XL `24px`, Pill `999px`

---

## 04. Component Design System
- **Buttons:** Primary (Mocha, 52px, r14), Secondary (Transparent + Sand border, 48px, r14), Soft (Sand, 48px, r14), Ghost (Transparent, 40px, r12), Icon (44px, r12), Destructive (Error, 48px, r14).
- **Cards:** Border tipis `#E6D9C9`, shadow ringan `--shadow-card`, tanpa dekorasi berlebih.
- **Chips & Badges:** Filter chips pill `34–38px`; Status badges `6–8px` radius untuk `PRO`, `Pro Cam`, `Viral`, `Top`.
- **Inputs:** `48px` height, `12px` radius, `14px` horizontal padding, Sand border, Mocha focus border.
- **Sliders:** Track `4–5px`, Thumb `18px`, Mocha active track, Sand inactive track, nilai rata kanan, real-time preview.
- **Icons:** Lucide outline konsisten, stroke `1.75–2px` (`24px` nav, `20px` control, `16px` inline metadata).
- **Modals & Bottom Sheets:** Top radius `24px`, bottom `0px`, handle `36×4px`, padding `24px`, overlay `rgba(0,0,0,0.4)`, animasi `250–300ms`.

---

## 05. Photography & Image Direction
- **Karakter:** Natural lighting, soft shadows, warm neutral colors, muted saturation, organic composition, subtle film grain, natural skin tones, editorial framing.
- **Rasio:** Hero/Preset/Discover `4:5`, Collection cover `5:4`, Profile `1:1`, Editor preview `Original / Adaptive`.

---

## 06. Iconic Product Experience & IA
- **Mobile Navigation:** `Home`, `Presets`, `Discover`, `Profile` (ditambah entry point edit foto).
- **Photo Editor (Kontekstual):** Top toolbar (`Back`, `Undo`, `Redo`, `Compare`, `Export`), Preview Canvas (fit/fill, pinch-to-zoom, press-and-hold Before/After), Bottom Panel (kategori, carousel preset dengan favorite & active Mocha border, intensity slider, adjustment tools, crop/rotate).

---

## 07–10. Motion, States, Accessibility & Dark Mode
- **Motion:** `100–150ms` press, `180–220ms` tab/card, `250–300ms` sheet/preset crossfade, hormati `prefers-reduced-motion`.
- **States:** Loading skeleton, Empty state dengan ilustrasi ringan + CTA, Error + retry, Success confirmation, Offline banner.
- **Accessibility:** Minimal touch target `44×44px`, focus-visible ring, konfirmasi sebelum membuang perubahan.
- **Dark Mode (Opsional):** Background `#1F1C19`, Surface `#2B2622`, Elevated `#38302A`, Text `#F7F3ED`, Secondary `#C5B7A9`, Primary Action `#B28B70`, Border `#4B4037`. Preview foto di editor tidak pernah diberi tint dark mode.

---

## 11–15. Design Tokens & Brand Voice
- **Single source of truth** CSS tokens di `src/index.css` & `tailwind.config.js`.
- **Microcopy:** *Make today beautiful.*, *Create your look*, *Find your signature tone.*, *Your favorites will live here.*, *Ready to save?*, *Beautifully done.*, *Preparing your photo...* (dipadukan dengan istilah lokal yang jelas untuk alur pembayaran Lynk.id).
