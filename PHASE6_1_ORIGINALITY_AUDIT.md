# PHASE6_1_ORIGINALITY_AUDIT.md
# Auvori — Phase 6.1B Visual Originality & EXIF Audit Report

**Branch:** `feat/phase6.1-audit-integrity-hardening`
**Baseline Commit:** `643ab69`
**Audit Date:** `2026-11-27`
**Methodology:** Direct manual visual inspection of full-library grids (`sheet_1..5`) + high-resolution 2×2 close-up review sheets (`closeup_01..08`), paired with EXIF metadata and tonal black/white-point indicators.

---

## 1. Key Finding: Phase 6 Originality Overclaim Corrected

Phase 6 marked all 50 open-source photos as `"verified-original"` / `"visually-inspected-unedited"` based on SHA-256 download integrity.
Phase 6.1 visual + EXIF inspection found that **33 of 50 photos cannot enter the `gold_standard/` verified-original set**:
- **8 photos** carry explicit mobile preset software tags in EXIF (`VSCO` / `VSCOcam`: `p6_10`, `p6_14`, `p6_22`, `p6_23`, `p6_36`, `p6_45`, `p6_47`, `p6_48`).
- **4 photos** carry other non-RAW/mobile editor or computational HDR tags (`Snapseed` `p6_16`, `Pixelmator` `p6_37`, `iSee` `p6_12`, `HDR+` `p6_28`).
- **18 additional photos** exhibit visible post-processing upon visual inspection: monochrome B&W conversions (`p6_04`, `p6_08`, `p6_34`), heavy lifted matte blacks (`p6_05` min=20, `p6_18` min=33, `p6_31` min=43), compressed whites (`p6_26` max=220), dark corner vignettes / skin smoothing / stylized color grading (`p6_01`, `p6_02`, `p6_07`, `p6_09`, `p6_13`, `p6_15`, `p6_17`, `p6_27`, `p6_32`, `p6_33`, `p6_41`).
- **3 photos** (`p6_25`, `p6_35`, `p6_42`) are marked `unknown` due to stripped camera EXIF plus ambiguous tonal/monochrome characteristics.
- **17 photos** passed BOTH `license_verification.status == "verified"` AND `originality_review.status == "reviewed-original"` and were placed in `tests/fixtures/opensource_photos/gold_standard/`.

| Classification | Count | Partition |
|---|---:|---|
| `reviewed-original` | 17 | All 17 also license-verified -> **`gold_standard/` (17)** |
| `possibly-processed` | 30 | **`exploratory/`** |
| `unknown` | 3 | **`exploratory/`** |
| `rejected` | 0 | None |
| Total `gold_standard/` | 17 | `tests/fixtures/opensource_photos/gold_standard/` |
| Total `exploratory/` | 33 | `tests/fixtures/opensource_photos/exploratory/` |

---

## 2. Per-Photo Visual Originality & EXIF Table (All 50 Photos)

| # | Filename | Camera / EXIF | Software Indicator | License Status | Originality Status | Dataset Tier | Visual Review Notes |
|---:|---|---|---|---|---|---|---|
| 01 | `p6_01_window_bus_portrait.jpg` | Canon / Canon EOS 600D | `Adobe Photoshop Lightroom 5.7.1 (Windows)` | `verified` | **possibly-processed** | `exploratory` | Lifted black point (~7/255), muted cool-slate bus shadow grade; Lightroom 5.7.1 export. |
| 02 | `p6_02_window_silhouette.jpg` | SONY / ILCE-7S | `Adobe Photoshop Lightroom 6.7 (Macintosh)` | `verified` | **possibly-processed** | `exploratory` | Distinct teal/green color grading in wall shadows; Lightroom 6.7 export. |
| 03 | `p6_03_laundromat_reflection.jpg` | — / — | `None` | `verified` | **reviewed-original** | `gold_standard` | Natural window reflection, neutral whites, true black point (0), no obvious color cast or fade (EXIF stripped). |
| 04 | `p6_04_bw_beard_glasses.jpg` | — / — | `None` | `verified` | **possibly-processed** | `exploratory` | Monochrome B&W conversion (saturation 0), lifted toe (4/255), heightened beard clarity; EXIF stripped. |
| 05 | `p6_05_backlit_office_flare.jpg` | Canon / Canon EOS 5D Mark III | `Adobe Photoshop Camera Raw 7.2 (Windows)` | `verified` | **possibly-processed** | `exploratory` | Heavy lifted/faded shadow toe (min pixel 20/255) and low-contrast haze; Camera Raw 7.2. |
| 06 | `p6_06_harsh_sun_cliff_couple.jpg` | Canon / Canon EOS 70D | `Adobe Photoshop Lightroom 6.1.1 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Natural harsh daylight contrast, crisp shadows (black point 0), unretouched skin tones; Lightroom 6.1.1. |
| 07 | `p6_07_daylight_smiling_portrait.jpg` | Canon / Canon EOS 60D | `Adobe Photoshop Lightroom 6.0 (Windows)` | `verified` | **possibly-processed** | `exploratory` | Warm amber/brown foliage shadow shift with darkened corner vignette; Lightroom 6.0. |
| 08 | `p6_08_bw_studio_freckles.jpg` | Canon / Canon EOS 7D | `Adobe Photoshop Lightroom 5.7 (Macintosh)` | `verified` | **possibly-processed** | `exploratory` | Monochrome B&W conversion from Canon EOS 7D color sensor with lifted black point (7/255); Lightroom 5.7. |
| 09 | `p6_09_white_aodai_portrait.jpg` | — / — | `None` | `verified` | **possibly-processed** | `exploratory` | Apparent soft-focus glow and skin smoothing around face/lotus; EXIF stripped. |
| 10 | `p6_10_golden_crosswalk_street.jpg` | Canon / Canon EOS 60D | `VSCO` | `verified` | **possibly-processed** | `exploratory` | Third-party mobile preset applied (EXIF Software: VSCO); warm amber-teal split tone. |
| 11 | `p6_11_burger_salad_food.jpg` | FUJIFILM / FinePix X100 | `Digital Camera FinePix X100 Ver2.01` | `verified` | **reviewed-original** | `gold_standard` | Straight-out-of-camera Fujifilm FinePix X100 JPEG (Ver2.01); neutral whites, crisp contrast, natural color. |
| 12 | `p6_12_hibachi_restaurant_food.jpg` | — / — | `iSee` | `verified` | **possibly-processed** | `exploratory` | Third-party editor iSee (EXIF Software: iSee; zeroed camera EXIF); cool shadow cast and boosted reds. |
| 13 | `p6_13_croissant_sunlight.jpg` | FUJIFILM / X-A2 | `Adobe Photoshop Lightroom 5.0 (Windows)` | `verified` | **possibly-processed** | `exploratory` | Visible cyan-teal color grading in background bokeh shadows; Lightroom 5.0. |
| 14 | `p6_14_latte_croissant_cafe.jpg` | Apple / iPhone 5s | `VSCOcam` | `verified` | **possibly-processed** | `exploratory` | Third-party mobile preset applied (EXIF Software: VSCOcam); warm matte tone curve. |
| 15 | `p6_15_bridesmaid_bouquet.jpg` | Canon / Canon EOS DIGITAL REBEL XTi | `Adobe Photoshop CS5 Windows` | `verified` | **possibly-processed** | `exploratory` | Dark corner vignette and warm-brown shadow push (EXIF Software: Adobe Photoshop CS5 Windows). |
| 16 | `p6_16_dark_bg_flowers.jpg` | Canon / Canon EOS 60D | `Snapseed 2.17.150426759` | `verified` | **possibly-processed** | `exploratory` | Third-party mobile filter applied (EXIF Software: Snapseed 2.17); muted foliage & compressed whites (244). |
| 17 | `p6_17_vibrant_floral_macro.jpg` | Canon / Canon EOS 60D | `Adobe Photoshop Lightroom 5.0 (Macintosh)` | `verified` | **possibly-processed** | `exploratory` | Strong saturation push (mean HSV sat 163.8) and crushed teal-green shadows; Lightroom 5.0. |
| 18 | `p6_18_white_exterior_arch.jpg` | FUJIFILM / X-T2 | `Adobe Photoshop Lightroom 6.10 (Macintosh)` | `pending-review` | **possibly-processed** | `exploratory` | Heavy matte fade (min pixel 33/255) and cool cyan-blue highlight cast; Lightroom 6.10. |
| 19 | `p6_19_concrete_interior_window.jpg` | FUJIFILM / X100S | `Digital Camera X100S Ver1.03` | `verified` | **reviewed-original** | `gold_standard` | Straight-out-of-camera Fujifilm X100S JPEG (Ver1.03); neutral grey concrete and natural shadow rolloff. |
| 20 | `p6_20_curved_glass_arch.jpg` | NIKON CORPORATION / NIKON D750 | `Adobe Photoshop Lightroom 5.7.1 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Clean architectural glass reflection, neutral bright sky, true blacks (0); Nikon D750 / Lightroom 5.7.1. |
| 21 | `p6_21_classical_stone_arches.jpg` | Canon / Canon EOS 6D | `Adobe Photoshop Lightroom 6.1 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Natural stone architecture facade, neutral daylight balance, true blacks (0); Canon 6D / Lightroom 6.1. |
| 22 | `p6_22_tokyo_storefront_street.jpg` | NIKON CORPORATION / NIKON D810 | `VSCO` | `verified` | **possibly-processed** | `exploratory` | Third-party film preset applied (EXIF Software: VSCO); desaturated greens and warm highlights. |
| 23 | `p6_23_pedestrians_motion_street.jpg` | Apple / iPad | `VSCO` | `verified` | **possibly-processed** | `exploratory` | Third-party film preset applied (EXIF Software: VSCO); cool teal-slate street grade. |
| 24 | `p6_24_capetown_fog_sunset.jpg` | Canon / Canon EOS 60D | `Adobe Photoshop Lightroom 5.6 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Natural sunset horizon gradient, neutral white fog, crisp dark ridge (0); Canon 60D / Lightroom 5.6. |
| 25 | `p6_25_sea_waves_sunset.jpg` | — / — | `None` | `verified` | **unknown** | `exploratory` | EXIF metadata completely stripped; slight lifted black point (13/255) prevents confirming unedited origin. |
| 26 | `p6_26_cloudy_breaking_waves.jpg` | SONY / ILCE-7S | `Adobe Photoshop Lightroom 5.7.1 (Macintosh)` | `verified` | **possibly-processed** | `exploratory` | Compressed white ceiling (max pixel 220/255) and deep olive-teal water grading; Sony ILCE-7S / Lightroom 5.7.1. |
| 27 | `p6_27_sand_ripples_sun.jpg` | FUJIFILM / X100T | `Photos 1.2` | `verified` | **possibly-processed** | `exploratory` | High warm orange saturation (mean HSV sat 148.7); exported via Apple Photos 1.2. |
| 28 | `p6_28_hiker_vast_canyon.jpg` | LGE / Nexus 5 | `HDR+ 1.0.66106052` | `verified` | **possibly-processed** | `exploratory` | Computational multi-frame HDR+ tone mapping (EXIF Software: HDR+ 1.0) with lifted canyon shadows. |
| 29 | `p6_29_man_vast_ocean.jpg` | FUJIFILM / X-E1 | `Adobe Photoshop Lightroom 5.6 (Windows)` | `verified` | **reviewed-original** | `gold_standard` | Natural overcast coastal exposure, balanced sky and granite tones, true blacks (0); Fujifilm X-E1 / Lightroom 5.6. |
| 30 | `p6_30_forest_bridge_hiker.jpg` | Canon / Canon EOS 6D | `Adobe Photoshop Lightroom 6.5 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Natural sunlit forest greens, neutral steel bridge, full tonal range (0-255); Canon 6D / Lightroom 6.5. |
| 31 | `p6_31_snow_trees_overcast.jpg` | Canon / Canon EOS REBEL T3i | `Adobe Photoshop CC 2014 (Macintosh)` | `verified` | **possibly-processed** | `exploratory` | Heavy matte black-point lift (min pixel 43/255) washing out evergreen darks; Adobe Photoshop CC 2014. |
| 32 | `p6_32_retro_camera_white.jpg` | — / — | `Adobe Photoshop CC 2014 (Windows)` | `verified` | **possibly-processed** | `exploratory` | Photoshop CC 2014 export with camera EXIF stripped and noticeable corner vignetting on white table. |
| 33 | `p6_33_vintage_camera_map.jpg` | Canon / Canon EOS 100D | `Adobe Photoshop Lightroom 5.7.1 (Windows)` | `verified` | **possibly-processed** | `exploratory` | Subtle warm vintage map tone and visible edge darkening/vignette; Lightroom 5.7.1. |
| 34 | `p6_34_smartwatch_minimal_desk.jpg` | SONY / ILCE-6000 | `Adobe Photoshop CC 2015 (Macintosh)` | `pending-review` | **possibly-processed** | `exploratory` | Complete monochrome desaturation (mean HSV sat 0.2) and retouching; Adobe Photoshop CC 2015. |
| 35 | `p6_35_living_room_window.jpg` | — / — | `Adobe Photoshop CC 2015.5 (Macintosh)` | `pending-review` | **unknown** | `exploratory` | Camera EXIF stripped, exported via Adobe Photoshop CC 2015.5; bright interior without obvious heavy fade. |
| 36 | `p6_36_mixed_tungsten_loft.jpg` | Apple / iPhone 6s | `VSCO` | `verified` | **possibly-processed** | `exploratory` | Third-party film preset applied (EXIF Software: VSCO); warm-teal interior split. |
| 37 | `p6_37_desk_stationery_flatlay.jpg` | SONY / DSLR-A200 | `Pixelmator 2.1.4` | `verified` | **possibly-processed** | `exploratory` | Edited in Pixelmator 2.1.4 (EXIF Software) with strong warm magenta/pink cast and lifted black point (12/255). |
| 38 | `p6_38_mixed_led_wine_glasses.jpg` | Canon / Canon EOS 60D | `Adobe Photoshop Lightroom 5.7 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Authentic mixed candle & blue pool LED lighting, crisp specular highlights, true blacks (0); Canon 60D / Lightroom 5.7. |
| 39 | `p6_39_wine_bottle_window_glass.jpg` | Canon / Canon EOS 7D Mark II | `Adobe Photoshop Lightroom 6.6.1 (Windows)` | `verified` | **reviewed-original** | `gold_standard` | Natural window-lit interior glass/sofa tones, true blacks (0), clean white curtain; Canon 7D Mark II / Lightroom 6.6.1. |
| 40 | `p6_40_black_teapot_dark_bg.jpg` | Canon / Canon EOS 70D | `Adobe Photoshop Lightroom 6.3 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Clean low-key tabletop lighting, sharp cast-iron texture, natural tag colors, true blacks (0); Canon 70D / Lightroom 6.3. |
| 41 | `p6_41_wine_eyeglasses_book.jpg` | — / — | `None` | `verified` | **possibly-processed** | `exploratory` | Distinct cyan-teal color shift across white book pages and wood slats; EXIF stripped. |
| 42 | `p6_42_minimal_black_coffee_white.jpg` | — / — | `None` | `pending-review` | **unknown** | `exploratory` | EXIF metadata stripped; near-monochrome high-key composition makes capture vs edit ambiguous. |
| 43 | `p6_43_white_cup_pen.jpg` | NIKON CORPORATION / NIKON D750 | `Adobe Photoshop Lightroom 6.6.1 (Windows)` | `verified` | **reviewed-original** | `gold_standard` | Natural high-key studio lighting on ceramic cup, neutral whites (250), crisp detail; Nikon D750 / Lightroom 6.6.1. |
| 44 | `p6_44_mantis_dark_leaves.jpg` | — / — | `None` | `verified` | **reviewed-original** | `gold_standard` | Clean natural macro capture on dark foliage, neutral leaf greens, true blacks (0); EXIF stripped on Wikimedia. |
| 45 | `p6_45_backlit_fern_leaves.jpg` | NIKON CORPORATION / NIKON D3200 | `VSCO` | `pending-review` | **possibly-processed** | `exploratory` | Third-party film preset applied (EXIF Software: VSCO); lifted blacks (11) and compressed whites (239). |
| 46 | `p6_46_potted_cactus_window.jpg` | SONY / DSC-RX1 | `Adobe Photoshop Lightroom 5.3 (Macintosh)` | `verified` | **reviewed-original** | `gold_standard` | Natural window-lit botanical study, crisp spine & soil detail, neutral bright window (0-255); Sony DSC-RX1 / Lightroom 5.3. |
| 47 | `p6_47_cat_dog_golden_grass.jpg` | NIKON CORPORATION / NIKON D60 | `VSCO` | `verified` | **possibly-processed** | `exploratory` | Third-party film preset applied (EXIF Software: VSCO); pushed golden grass glow. |
| 48 | `p6_48_street_tabby_cat.jpg` | Apple / iPhone | `VSCO` | `verified` | **possibly-processed** | `exploratory` | Third-party film preset applied (EXIF Software: VSCO); muted cool greys & compressed highlights (244). |
| 49 | `p6_49_dark_cat_black_bg.jpg` | Canon / Canon EOS 500D | `None` | `verified` | **reviewed-original** | `gold_standard` | Straight-out-of-camera Canon EOS 500D JPEG (Software: None); crisp eyes/fur, natural darks (0-255). |
| 50 | `p6_50_arctic_fox_snow.jpg` | — / — | `None` | `verified` | **reviewed-original** | `gold_standard` | Commons Featured Picture cropped from Sony ILCE-7R original (300mm f/6.3 ISO 200); neutral snow white and natural coat. |
