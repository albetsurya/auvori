# Auvori — Phase 6.3 Signature Looks Photographic Preview QA

## 1. Overview
This report documents the completion of Phase 6.3 photographic preview integration for all **5 Signature Looks** in `src/data/presets.ts`, rendered through Auvori's production `PhotoPipeline` (`WebGL2Renderer`) and integrated into `HomeScreen.tsx`, `PresetsScreen.tsx`, and `PresetDetailModal.tsx`.

## 2. Signature Looks Inventory & Preview Mapping

| # | Preset ID | Name | Category | Collection | Source Photo | Creator | License & Archive Proof | Renderer Path | Intensity | Output Asset | Dimensions | Size | SHA-256 |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `porcelain-bloom` | Porcelain Bloom | `portrait` | `rosy-portrait` | `p6_09_white_aodai_portrait.jpg` | Hisu Lee | CC0 1.0 ([Wayback 2017-05-04](https://web.archive.org/web/20170504103903/https://unsplash.com/photos/u6LGX2VMOP4)) | `PhotoPipeline.renderPreview` (`webgl2`) | 100% + grain | `look_porcelain_bloom.webp` | 480×720 | 24,672 B (24.1 KB) | `6bc9275d6f91e3127fe04b9b367f884315dacdef8ed0c59b8d1e3b42ab962717` |
| 2 | `velvet-noir` | Velvet Noir | `portrait` | `velvet-series` | `p6_01_window_bus_portrait.jpg` | Dan Bøțan (`@danutzuzu`) | CC0 1.0 ([Wayback 2017-04-29](https://web.archive.org/web/20170429090256/https://unsplash.com/photos/XU5lNez5TEs)) | `PhotoPipeline.renderPreview` (`webgl2`) | 100% + grain | `look_velvet_noir.webp` | 480×720 | 19,950 B (19.5 KB) | `b61a35f7088a77286ae901403d49566f9ffd48132a52698f18b976929d111212` |
| 3 | `hannam-daylight` | Hannam Daylight | `korean` | `seoul-editorial` | `p6_14_latte_croissant_cafe.jpg` | Sergey Zolkin (`@szolkin`) | CC0 1.0 ([Wayback 2017-05-03](https://web.archive.org/web/20170503093501/https://unsplash.com/photos/QPRj0bMb5Fk)) | `PhotoPipeline.renderPreview` (`webgl2`) | 100% + grain | `look_hannam_daylight.webp` | 720×540 | 39,016 B (38.1 KB) | `584a84e75d205d9e7da8903eeb693d46bcb0c0fc5f8c82f5586c9df1c5b9ec34` |
| 4 | `amber-halation` | Amber Halation | `film` | `analog-archive` | `p6_55_night_bazaar_lanterns.jpg` | Juan Ignacio Tapia (`@juanitapia`) | CC0 1.0 ([Wayback 2016-04-04](https://web.archive.org/web/20160404011652/https://unsplash.com/photos/4fwRyKISwfk)) | `PhotoPipeline.renderPreview` (`webgl2`) | 100% + grain | `look_amber_halation.webp` | 720×480 | 63,572 B (62.1 KB) | `2592c119e43fbfbc90854788b398df3f09f49e5afe64c4cd43bb7ee36b947fcd` |
| 5 | `silver-gelatin` | Silver Gelatin | `film` | `analog-archive` | `p6_04_bw_beard_glasses.jpg` | Angelina Litvin (`@linalitvina`) | CC0 1.0 ([Wayback 2017-03-30](https://web.archive.org/web/20170330185950/https://unsplash.com/photos/52R7t7x8CPI)) | `PhotoPipeline.renderPreview` (`webgl2`) | 100% + grain | `look_silver_gelatin.webp` | 480×720 | 54,890 B (53.6 KB) | `6e02b720dfe75dae8b65d732cda0122f3871a7e5631c09fc5a87a75210590cf6` |

## 3. UI & Focal-Point Integration

- **Home Screen (`src/screens/HomeScreen.tsx`)**:
  - Updated `Signature Looks` section from the previous 4-item `RECOMMENDED_IDS` list to `SIGNATURE_LOOK_IDS` covering all 5 existing Signature Looks in `src/data/presets.ts` order (`porcelain-bloom`, `velvet-noir`, `hannam-daylight`, `amber-halation`, `silver-gelatin`).
  - Replaced synthetic canvas `renderStudioPresetPreview` calls (`'park'`, `'window'`, `'cafe'`) with direct static WebP previews via `getSignatureLookPreviewUrl(preset.id)` and intentional focal points via `getSignatureLookObjectPosition(preset.id)`:
    - `porcelain-bloom`: `50% 25%` (keeps face, conical hat, and lotus blossom uncropped)
    - `velvet-noir`: `50% 35%` (frames profile and window reflection cleanly)
    - `hannam-daylight`: `50% 50%` (centers latte art cup and café tabletop)
    - `amber-halation`: `55% 50%` (frames glowing tungsten market stalls and sky)
    - `silver-gelatin`: `50% 25%` (frames eyes, glasses, and white beard cleanly)
  - Also updated the Home Screen desktop hero visual pair (`Rosy Bokeh`, `Seoul Café`) from legacy synthetic `'park'`/`'cafe'` canvases to verified studio samples `'real:daylight_portrait'` and `'real:cafe_interior'`.
- **Presets Screen (`src/screens/PresetsScreen.tsx`) & Discover Screen (`src/screens/DiscoverScreen.tsx`)**:
  - Updated `PresetsScreen.tsx` to resolve every preset card via `getSignatureLookPreviewUrl(preset.id)` (for the 5 Signature Looks) or `getPresetSampleId(p.id, p.category)` (for all remaining 21 presets across every collection and category filter), with intentional portrait focal points (`50% 25%`), eliminating all procedural `'park'` / `'cafe'` / `'window'` canvas previews.
  - Updated `DiscoverScreen.tsx` to load real WebGL2 preset-rendered WebP previews (`look_*.webp`) and paired unedited source WebPs (`source_*.webp`) for Hold-to-Compare and "Try in Editor".
- **Preset Detail Modal (`src/components/PresetDetailModal.tsx`) & Editor Launch (`src/App.tsx`)**:
  - Uses `getPresetSampleId(preset.id, preset.category)` and `getSamplePhotoUrl(...)` for Before/After comparison and "Try in Editor", and updated `handleOpenRecentEdit` so zero UI entry points invoke `createSamplePhotoDataUrl`.

## 4. Visual & Responsive QA Verification

Executed `python3 tests/phase6_3_signature_looks.py` against live Vite + Playwright Chromium (WebGL2 enabled):
- Verified all 27 presets in `src/data/presets.ts` remain untouched (1 neutral original, 19 legacy, 5 Signature Looks, 2 Adaptive Looks).
- Verified all 5 Signature Look cards render `<img>` tags pointing to `/assets/signature-looks/look_*.webp` with `complete === true`, `naturalWidth > 0`, and zero `data:` synthetic URLs.
- Verified interactive favorite toggling, `PresetDetailModal` Before/After comparison (`source_porcelain_bloom.webp` ↔ `look_porcelain_bloom.webp`), and "Try in Editor" launch.
- Verified `PresetsScreen` across all collection and category filter chips (`Velvet Series`, `Seoul Editorial`, `Rosy Portrait`, `Analog Archive`, `Portrait`, `Café`, `Korean`, `Film`, `Night`, `All Looks`) and `DiscoverScreen` render authentic photographs (`presets_collection_velvet_series.png`, `presets_collection_seoul_editorial.png`, `discover_real_photos.png`).
- Captured responsive UI screenshots across 5 viewports under `tests/reports/phase6_3/signature_looks/`:
  - `home_signature_looks_360px.png` (2-column mobile grid)
  - `home_signature_looks_390px.png` (2-column mobile grid)
  - `home_signature_looks_430px.png` (2-column mobile grid)
  - `home_signature_looks_768px.png` (4-column tablet grid)
  - `home_signature_looks_1280px.png` (4-column desktop grid)
  - `signature_looks_section_complete.png`, `signature_look_detail_modal.png`, `signature_look_editor_porcelain_bloom.png`, and `sheet_signature_looks.jpg`.
