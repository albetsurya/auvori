# PHASE6_1_COVERAGE_REPORT.md
# Auvori — Phase 6.1E Stratified Visual Coverage Report

**Branch:** `feat/phase6.1-audit-integrity-hardening`
**Baseline Commit:** `643ab69`
**Audit Date:** `2026-11-27`
**Test Runner:** [`tests/run_p6_1_grain_and_coverage_tests.py`](tests/run_p6_1_grain_and_coverage_tests.py)

---

## 1. Dataset & Verification Pool Breakdown

Phase 6.1 enforces strict provenance separation between **open-source gold-standard originals**, **exploratory open-source candidates**, and **P3–P5 verified fixture libraries**:

| Source Library | Total Files | License Verified (`CC0-1.0` / Approved) | Originality `reviewed-original` | Used in Stratified Matrix | Role |
|---|---:|---:|---:|---:|---|
| `opensource_photos/gold_standard/` | 17 | 17 | 17 | 12 | Primary verified unedited open-source scenes |
| `opensource_photos/exploratory/` | 33 | 28 (`5` `pending-review`) | 0 (`30` `possibly-processed`, `3` `unknown`) | 2 (explicitly flagged) | Exploratory scenes (`p6_05` backlit flare, `p6_07` close-up portrait) |
| `tests/fixtures/original_photos/` (P3) | 14 | 14 | 14 | 2 | Close-up skin tones (`hijab_portrait.jpg`), true low-light portrait |
| `tests/fixtures/holdout_photos/` (P4) | 10 | 10 | 10 | 1 | Backlit portrait (`holdout_backlit_portrait.jpg`) |
| `tests/fixtures/night_photos/` (P5) | 12 | 12 | 12 | 4 | Night street, street neon, mixed café, night skyline |
| **Combined Verified Pool (`gold_standard` + P3–P5)** | **53** | **53** | **53** | **19 verified + 2 exploratory** | **All 16 photographic characteristics covered** |

---

## 2. 16-Characteristic Distribution Across Open-Source Library (50 Photos)

The 50 open-source photos in `tests/fixtures/opensource_photos/` span the 16 required Phase 6.1E photographic characteristics as follows:

| # | Characteristic | Open-Source `gold_standard` (17) | Open-Source `exploratory` (33) | P3–P5 Supplement Used | Representative Matrix Keys |
|---:|---|---:|---:|---|---|
| 1 | **Portrait** | 3 (`p6_03`, `p6_06`, `p6_30`) | 6 (`p6_01`, `p6_04`, `p6_07`, `p6_08`, `p6_09`, `p6_10`) | `hijab_portrait.jpg`, `low_light_portrait.jpg`, `night_street_portrait.jpg` | `gold_portrait_sun`, `gold_portrait_window`, `p3_portrait_skin`, `p5_night_street` |
| 2 | **Landscape** | 3 (`p6_24`, `p6_29`, `p6_30`) | 5 (`p6_25`, `p6_26`, `p6_27`, `p6_28`, `p6_31`) | `night_landscape_skyline.jpg` | `gold_landscape_sunset`, `gold_landscape_ocean`, `p5_night_skyline` |
| 3 | **Food** | 1 (`p6_11`) | 3 (`p6_12`, `p6_13`, `p6_14`) | — | `gold_food_burger` |
| 4 | **Architecture** | 3 (`p6_19`, `p6_20`, `p6_21`) | 3 (`p6_18`, `p6_22`, `p6_35`) | — | `gold_arch_concrete`, `gold_arch_bright` |
| 5 | **Object** | 6 (`p6_38`, `p6_39`, `p6_40`, `p6_43`, `p6_44`, `p6_46`) | 9 (`p6_15`–`p6_17`, `p6_32`–`p6_34`, `p6_37`, `p6_41`, `p6_42`) | — | `gold_obj_mixed_led`, `gold_obj_dark_teapot`, `gold_obj_bright_cup` |
| 6 | **Daylight** | 7 (`p6_06`, `p6_20`, `p6_21`, `p6_24`, `p6_29`, `p6_30`, `p6_50`) | 12 | `hijab_portrait.jpg` | `gold_portrait_sun`, `gold_landscape_ocean`, `gold_arch_bright` |
| 7 | **Indoor** | 7 (`p6_03`, `p6_11`, `p6_19`, `p6_39`, `p6_40`, `p6_43`, `p6_46`) | 10 | `low_light_portrait.jpg`, `night_mixed_cafe.jpg` | `gold_portrait_window`, `gold_food_burger`, `gold_arch_concrete`, `p5_night_mixed` |
| 8 | **Backlit** | 0 *(gap in `gold_standard`)* | 4 (`p6_02`, `p6_05`, `p6_10`, `p6_45`) | `holdout_backlit_portrait.jpg` | `p4_backlit_portrait`, `exp_portrait_backlit` |
| 9 | **Night** | 0 *(gap in `opensource_photos`)* | 0 | `night_street_portrait.jpg`, `night_neon_portrait.jpg`, `night_mixed_cafe.jpg`, `night_landscape_skyline.jpg` | `p5_night_street`, `p5_night_neon`, `p5_night_mixed`, `p5_night_skyline` |
| 10 | **Neon** | 0 *(gap in `opensource_photos`)* | 0 | `night_neon_portrait.jpg` | `p5_night_neon` |
| 11 | **Mixed lighting** | 2 (`p6_03`, `p6_38`) | 2 (`p6_12`, `p6_36`) | `night_mixed_cafe.jpg` | `gold_portrait_window`, `gold_obj_mixed_led`, `p5_night_mixed` |
| 12 | **Low light** | 4 (`p6_38`, `p6_40`, `p6_44`, `p6_49`) | 2 (`p6_02`, `p6_16`) | `low_light_portrait.jpg`, `night_street_portrait.jpg`, `night_neon_portrait.jpg` | `p3_portrait_lowlight`, `gold_obj_mixed_led`, `p5_night_street`, `p5_night_neon` |
| 13 | **High dynamic range** | 2 (`p6_21`, `p6_24`) | 4 (`p6_02`, `p6_05`, `p6_25`, `p6_28`) | `holdout_backlit_portrait.jpg` | `gold_landscape_sunset`, `gold_arch_bright`, `exp_portrait_backlit` |
| 14 | **Complex skin tones** | 0 *(gap in `opensource_photos`)* | 0 | `hijab_portrait.jpg` (+ P0/P1 `portrait-deep-skin` synthetic) | `p3_portrait_skin` |
| 15 | **Dark subjects** | 3 (`p6_40`, `p6_44`, `p6_49`) | 2 (`p6_02`, `p6_16`) | `night_landscape_skyline.jpg` | `gold_obj_dark_teapot`, `gold_pet_dark`, `p5_night_skyline` |
| 16 | **Bright subjects** | 3 (`p6_21`, `p6_43`, `p6_50`) | 4 (`p6_18`, `p6_31`, `p6_32`, `p6_42`) | — | `gold_arch_bright`, `gold_obj_bright_cup` |

---

## 3. Preset Coverage Matrix Verification (`tests/reports/phase6_1/stratified_coverage/`)

All **26 active presets/looks** (plus `Original`) were rendered with `includeGrain: true` (using each preset's actual recipe grain configuration):

| Look Group | Presets Covered | Stratified Test Scenes | Contact Sheet Artifact | Status |
|---|---|---|---|---|
| **Adaptive: Direct Flash** | `direct-flash` (1) | 12 scenes: Portrait daylight/skin (`p3_portrait_skin`, `gold_portrait_sun`), Window/indoor (`gold_portrait_window`), Low light (`p3_portrait_lowlight`), Backlit (`p4_backlit_portrait`), Food (`gold_food_burger`), Object/mixed LED (`gold_obj_mixed_led`), Night (`p5_night_street`, `p5_night_neon`, `p5_night_mixed`, `p5_night_skyline`), Landscape (`gold_landscape_sunset`) | [`sheet_stratified_adaptive.jpg`](tests/reports/phase6_1/stratified_coverage/sheet_stratified_adaptive.jpg) | ✅ Verified |
| **Adaptive: Night Cinema** | `night-cinema` (1) | Same 12 scenes covering Night, Neon, Low light, Mixed lighting, plus Portrait, Food, Object, Landscape fallback/non-night sanity | [`sheet_stratified_adaptive.jpg`](tests/reports/phase6_1/stratified_coverage/sheet_stratified_adaptive.jpg) | ✅ Verified |
| **Signature Looks (P1)** | `porcelain-bloom`, `velvet-noir`, `hannam-daylight`, `amber-halation`, `silver-gelatin` (5) | 7 scenes: Portrait (`gold_portrait_sun`, `gold_portrait_window`), Landscape (`gold_landscape_sunset`), Food (`gold_food_burger`), Object (`gold_obj_dark_teapot`, `gold_obj_bright_cup`), Night Neon (`p5_night_neon`) | [`sheet_stratified_signature.jpg`](tests/reports/phase6_1/stratified_coverage/sheet_stratified_signature.jpg) | ✅ Verified |
| **Legacy Presets (P0)** | All 19 active legacy presets (`rosy-bokeh`..`cinematic-teal`) | 6 stratified scenes: Portrait (`gold_portrait_sun`, `gold_portrait_window`), Food (`gold_food_burger`), Architecture (`gold_arch_concrete`), Landscape (`gold_landscape_ocean`), Night (`p5_night_street`) | [`sheet_stratified_legacy_1_10.jpg`](tests/reports/phase6_1/stratified_coverage/sheet_stratified_legacy_1_10.jpg), [`sheet_stratified_legacy_11_19.jpg`](tests/reports/phase6_1/stratified_coverage/sheet_stratified_legacy_11_19.jpg) | ✅ Verified |

---

## 4. Visual Audit Observations, Missing Combinations & Exclusions

### Missing Combinations Within `opensource_photos/` Alone
1. **Night & Neon (`Night`, `Neon`)**: Zero entries in the 50-photo Wikimedia/Unsplash CC0 library depict true night street or neon signage scenes. **Mitigation:** Covered directly using P5 verified fixtures (`night_street_portrait.jpg`, `night_neon_portrait.jpg`, `night_mixed_cafe.jpg`, `night_landscape_skyline.jpg`).
2. **Backlit & Complex Skin Tones in `gold_standard/`**: `p6_05` (backlit office flare) was downgraded to `exploratory/` due to lifted matte blacks (`min=20/255`), and `opensource_photos/` lacks dark/deep-skin close-up portraits (`p6_06` is sunlit Caucasian couple, `p6_09` had skin smoothing/glow). **Mitigation:** Backlit portrait and varied/deep skin tones are covered using P3/P4 verified originals (`hijab_portrait.jpg`, `holdout_backlit_portrait.jpg`) and P0/P1 synthetic `portrait-deep-skin`.

### Excluded Combinations (Intentional & Documented)
- **Full 50 × 27 = 1,350 exhaustive permutation render**: Excluded per Phase 6.1E stratified sampling policy; rendering all 33 `exploratory/` pre-filtered photos across all 27 presets adds no signal over representative stratified sampling and could confound preset color/tone QA with pre-baked VSCO/Snapseed/matte edits.
- **Unverified-license photos (`p6_18`, `p6_34`, `p6_35`, `p6_42`, `p6_45`)**: Excluded from `gold_standard/` benchmarks until pre-June-5-2017 CC0 proof or Wikimedia `{{LicenseReview}}` is established.

### Visual QA Findings on Stratified Contact Sheets
- **`Rosy Bokeh` and `Velvet Merona` on non-portrait landscape (`gold_landscape_ocean`)**: Legacy `bgBokeh > 0` uses heuristic oval focus masking, producing expected soft center-subject focus blur around the ocean hiker while `Direct Flash` and `Night Cinema` cleanly adapt via Phase 3 ONNX segmentation.
- **No highlight clipping (`0.00%`)** on daylight/food/portrait stratified renders (`phase6_metrics.json`), and clean highlight preservation on `p5_night_neon` (`Night Cinema` retains readable red neon lettering without channel blowout).
