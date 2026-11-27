# PHASE6_VISUAL_AUDIT.md
# Auvori — Phase 6 / 6.1 Visual Quality Audit

**Branch:** `feat/phase6.1-audit-integrity-hardening` (re-audited from `feat/phase6-visual-quality-polish`, `643ab69`)
**Audit Date:** `2026-11-27`
**Auditor:** Quantitative metrics (`tests/reports/phase6_metrics.json`, `grain_metrics.json`) + direct visual contact-sheet review (`sheet_01a`..`sheet_04`, `phase6_1/grain_quality/`, `phase6_1/stratified_coverage/`)

---

## 1. Catalog Identity & Distinctiveness Audit

All **26 active looks** (`19` Legacy + `5` P1 Signature + `2` Adaptive, plus `1` `Original` no-effect mode = `27` catalog entries in `src/data/presets.ts`) were audited with actual preset grain enabled (`includeGrain: true`):
- **Identity passthrough:** Intensity `0%` = **MAE `0.000` vs Original** across all 26 active looks.
- **No non-existent presets:** Previous draft misnamed presets and omitted active looks; all names below match `src/data/presets.ts`.

### Closest Preset Pairs (MAE across 3 canonical test scenes, `includeGrain: true`)

| Rank | Preset A | Preset B | Mean MAE | Risk |
|---:|---|---|---:|---|
| 1 | `gangnam-glass` (Gangnam Glass) | `busan-breeze` (Busan Breeze) | 4.44 | Low — distinct highlight/temperature character |
| 2 | `mono-leica` (Leica Mono) | `silver-gelatin` (Silver Gelatin) | 4.80 | Low — both monochrome by design, different tone curve + bloom + grain |
| 3 | `warm-latte` (Warm Latte) | `kodak-gold` (Kodak Gold) | 5.58 | Low — cafe warmth vs 35mm film curve + `grain=16` |
| 4 | `midnight-clean` (City Dusk) | `neon-shibuya` (Neon Shibuya) | 6.50 | None |
| 5 | `midnight-clean` (City Dusk) | `cinematic-teal` (Teal & Amber) | 6.54 | None |
| 6 | `midnight-clean` (City Dusk) | `night-cinema` (Night Cinema) | 6.65 | None |
| 7 | `fuji-soft` (Fuji Soft) | `hannam-daylight` (Hannam Daylight) | 6.70 | None |
| 8 | `clean-day` (Clean Day) | `hannam-daylight` (Hannam Daylight) | 6.89 | None |

---

## 2. Intensity Ladder Validation (with Grain Enabled)

Tested on `p6_07_daylight_smiling_portrait.jpg` (`360px` catalog ladder) and `p6_03_laundromat_reflection.jpg` (`560px` Phase 6.1D grain ladder). All 26 looks increase monotonically from `0%` → `100%`.

### Sample — Intensity @ 100% (`tests/reports/phase6_metrics.json`)

| Look | Tier | Recipe Grain | MAE@100 (Portrait) | Clip% |
|---|---|---:|---:|---:|
| Rosy Bokeh | Legacy Free | 0 | 16.65 | 0.00 |
| Fuji Soft | Legacy Free | 10 | 24.09 | 0.00 |
| Velvet Merona | Legacy Pro | 0 | 19.64 | 0.00 |
| Classic Chrome | Legacy Pro | 14 | 9.69 | 0.00 |
| Kodak Gold | Legacy Pro | 16 | 15.90 | 0.00 |
| Leica Mono (`mono-leica`) | Legacy Pro | 18 | 12.30 | 0.00 |
| Teal & Amber (`cinematic-teal`) | Legacy Pro | 9 | 9.62 | 0.00 |
| Porcelain Bloom | P1 Signature | 0 | 15.30 | 0.00 |
| Velvet Noir | P1 Signature | 8 | 21.91 | 0.00 |
| Hannam Daylight | P1 Signature | 0 | 22.50 | 0.00 |
| Amber Halation | P1 Signature | 15 | 8.71 | 0.00 |
| Silver Gelatin | P1 Signature | 14 | 12.03 | 0.00 |
| Direct Flash | P4 Adaptive | 5 | 9.09 | 0.00 |
| Night Cinema | P5 Adaptive | 0 | 11.29 | 0.00 |

---

## 3. Adaptive Scene Response Analysis (`phase6_metrics.json`)

Canonical scenes: `p` = `p6_07_daylight_smiling_portrait.jpg`, `f` = `p6_14_latte_croissant_cafe.jpg`, `n` = `night_street_portrait.jpg`.

| Look | Portrait MAE / Clip% / Dark% | Food/Café MAE / Clip% | Night MAE / Dark% |
|---|---|---|---|
| **Direct Flash** (`direct-flash`) | 9.09 / 0.00% / 0.00% | 9.11 / 0.00% | 9.18 / 29.79% |
| **Night Cinema** (`night-cinema`) | 11.29 / 0.00% / 3.15% | 11.58 / 0.00% | 10.80 / 33.65% |

---

## 4. Phase 6.1 Corrected Contact Sheets & Grain Audit

Phase 6.1 fixed the Phase 6 `lookType === 'legacy'` filter bug and removed `includeGrain: false` overrides across all visual sheets:

- **`sheet_01a_legacy_1_10.jpg`**: `Original` + 10 Legacy Presets (`Rosy Bokeh`, `Seoul Café`, `Clean Day`, `Warm Latte`, `Fuji Soft`, `City Dusk`, `Velvet Merona`, `Gangnam Glass`, `Tokyo Milk`, `Busan Breeze`) across 4 scenes.
- **`sheet_01b_legacy_11_20.jpg`**: `Original` + 9 remaining Legacy Presets (`Matcha House`, `Espresso Crisp`, `Brunch Glow`, `Classic Chrome`, `Kodak Gold`, `Portra Skin`, `Leica Mono`, `Neon Shibuya`, `Teal & Amber`) across 4 scenes.
- **`sheet_02_signature_looks.jpg`**: `Original` + 5 P1 Signature Looks (`Porcelain Bloom`, `Velvet Noir`, `Hannam Daylight`, `Amber Halation`, `Silver Gelatin`) across 5 scenes.
- **`sheet_03_adaptive_looks.jpg`**: `Original` + `Direct Flash` + `Night Cinema` across 5 scenes.
- **`sheet_04_intensity_ladder.jpg`**: `0%` → `100%` (step `25%`) with grain enabled for `Porcelain Bloom`, `Direct Flash`, and `Night Cinema`.
- **`tests/reports/phase6_1/grain_quality/`**: 3 dedicated 1:1 crop sheets (`sheet_grain_categories.jpg`, `sheet_grain_intensity_ladder.jpg`, `sheet_grain_preview_vs_export.jpg`) + `grain_metrics.json`. Confirms `0.000` grain delta on grainless presets, monotonic grain RMS progression on all 10 grain presets, midtone-centered distribution (`Leica Mono`: shadow std `2.27` < midtone std `5.53` > highlight std `2.77`), and zero highlight clipping (`0.0%`).
- **`tests/reports/phase6_1/stratified_coverage/`**: 4 stratified coverage sheets covering all 26 active looks across 16 scene characteristics.

---

## 5. Issues & Observations Documented (No Formula Edits)

| Item | Severity | Details |
|---|---|---|
| Legacy `bgBokeh` on non-portrait landscapes | 🟢 Expected | Legacy presets (`Rosy Bokeh`, `Velvet Merona`) use heuristic oval masks when applied to landscapes; `Direct Flash` / `Night Cinema` avoid this via Phase 3 ONNX segmentation. |
| Grain Y-coordinate hash orientation (`GPU` vs `CPU`) | 🟢 Info | WebGL2 FBO uses bottom-up `gl_FragCoord.y` while Canvas2D uses top-down `y`, producing `0.683/255` pixel MAE on `Amber Halation` (`grain=15`) with identical noise statistics (`stdDiff = 0.069`). |
| Consecutive `hasBokeh` render drift in `WebGL2Renderer` | 🟡 Minor | Two consecutive `renderPreview` calls on the same `WebGL2Renderer` instance when `bgBokeh > 0.5` show `0.037/255` MAE due to `TEXTURE2` state across passes; not altered in `src/` under Phase 6.1 baseline preservation. |
