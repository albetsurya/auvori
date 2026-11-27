# PHASE6_ATTRIBUTION.md
# Auvori — Phase 6 License & Attribution Summary

**Branch:** `feat/phase6-visual-quality-polish`
**Report Date:** 2026-11-27
**Maintainer:** Auvori / Neutral Analog Studio

---

## 1. License Policy

Auvori uses photographic test fixtures and open-source sample photos exclusively from sources with the following license types:

| License | Commercial Use | Attribution Required | Share-Alike | Status |
|---------|---------------|---------------------|-------------|--------|
| CC0 1.0 Universal | ✅ Yes | ❌ No | ❌ No | ✅ Approved |
| Public Domain | ✅ Yes | ❌ No | ❌ No | ✅ Approved |
| CC BY 2.0 | ✅ Yes | ✅ Yes | ❌ No | ✅ Approved (with attribution) |
| CC BY-SA 3.0 | ✅ Yes | ✅ Yes | ⚠️ Share-Alike | ✅ Approved (test fixture only, not redistributed) |
| CC BY-SA 4.0 | ✅ Yes | ✅ Yes | ⚠️ Share-Alike | ✅ Approved (test fixture only, not redistributed) |
| CC BY-NC / BY-ND | ❌ No | — | — | 🚫 Excluded |

---

## 2. Phase 6 / 6.1 Open-Source Photo Library (50 Photos)

**Source:** Wikimedia Commons — Unsplash Archive
**Declared License:** CC0 1.0 Universal (all 50 entries)
**License Verification Audit (Phase 6.1A):**
- **45 photos verified CC0-1.0:** Confirmed via pre-`2017-06-05` Wayback Machine HTML gallery snapshot and/or passed Wikimedia Commons `{{LicenseReview}}` (verified against `https://web.archive.org/web/20170505000000id_/https://unsplash.com/license`).
- **5 photos `pending-review`:** `p6_18_white_exterior_arch.jpg`, `p6_34_smartwatch_minimal_desk.jpg`, `p6_35_living_room_window.jpg`, `p6_42_minimal_black_coffee_white.jpg`, `p6_45_backlit_fern_leaves.jpg` (listed in `Category:Images from Unsplash (review needed)` with earliest Wayback snapshot post-dating Unsplash's June 5, 2017 license change; excluded from `gold_standard/`).
**Attribution required:** Optional for CC0; full creator attribution retained in manifest and `ATTRIBUTION.md`.

Full per-photo attribution, license evidence, and originality review are in:
- [`tests/fixtures/opensource_photos/ATTRIBUTION.md`](tests/fixtures/opensource_photos/ATTRIBUTION.md)
- [`PHASE6_1_LICENSE_VERIFICATION.md`](PHASE6_1_LICENSE_VERIFICATION.md)
- [`PHASE6_1_ORIGINALITY_AUDIT.md`](PHASE6_1_ORIGINALITY_AUDIT.md)

### Summary Statistics

| Metric | Value |
|--------|-------|
| Total photos | 50 |
| SHA-256 / File Integrity verified | ✅ 50 / 50 |
| License verified (`CC0-1.0`) | 45 / 50 |
| License `pending-review` | 5 / 50 (excluded from `gold_standard/`) |
| Visual Originality `reviewed-original` | 17 / 50 (`gold_standard/`) |
| Visual Originality `possibly-processed` / `unknown` | 33 / 50 (30 `possibly-processed`, 3 `unknown` -> `exploratory/`) |
| Distinct categories covered | 45 |
| Photos with identifiable people | Multiple — model release status documented |
| Download date range | 2026-11 |

> [!CAUTION]
> Photos containing identifiable people are CC0 for **copyright purposes** only. CC0 does not cover personality rights or model release. The `model_release_status` field in `tests/fixtures/opensource_photos/manifest.json` documents the per-photo status. **Do not use photos with identifiable people in commercial advertising or marketing materials without independent model release verification.**

### Category Coverage (45 of 45 distinct categories)

architecture, backlit portrait, beach, black object on dark background, black-and-white original, close-up portrait, cloudy daylight, coffee, colored LED lighting, dark clothing portrait, deep shadows, flowers, food, forest, glass objects, golden-hour photography, harsh sunlight portrait, high dynamic range, human subject with complex background, indoor café, indoor plants, indoor window-light portrait, landscape daylight, landscape sunset, low-light portrait, metallic objects, mixed color temperature portrait, mixed tungsten and daylight, multiple faces, multiple subjects, natural daylight portrait, outdoor portrait, pet photography, portrait, product photography, reflective objects, restaurant lighting, small subject in large environment, street photography, strong highlights, tabletop objects, urban street, white clothing portrait, white object on bright background, window-lit interior

---

## 3. Existing Test Fixture Photos (36 Photos)

The existing P0–P5 test fixture libraries retain their original attribution:

| Library | Count | License Types | Attribution File |
|---------|-------|---------------|-----------------|
| `original_photos/` | 14 | CC0, CC BY 2.0, Public Domain | `tests/fixtures/original_photos/ATTRIBUTION.md` |
| `holdout_photos/` | 10 | CC0, CC BY 2.0, CC BY-SA 3.0/4.0 | `tests/fixtures/holdout_photos/ATTRIBUTION.md` |
| `night_photos/` | 12 | CC0, CC BY 2.0, CC BY-SA | `tests/fixtures/night_photos/ATTRIBUTION.md` |

---

## 4. AI Model Attributions

| Model | License | Attribution |
|-------|---------|-------------|
| YuNet (face detection) | Apache 2.0 | OpenCV / ShiQi Yu et al. |
| PP-HumanSeg (segmentation) | Apache 2.0 | PaddlePaddle Authors |
| U²-Netp (salient object) | Apache 2.0 | Qin et al. (2020) |
| ONNX Runtime Web | MIT | Microsoft |

---

## 5. Third-Party Software Attribution

| Package | License | Usage |
|---------|---------|-------|
| React | MIT | UI framework |
| Vite | MIT | Build tool |
| TypeScript | Apache 2.0 | Type checking |
| Tailwind CSS | MIT | Styling |
| Lucide React | ISC | Icon library |
| vite-plugin-pwa | MIT | PWA generation |
| Playwright | Apache 2.0 | E2E testing |
| Pillow (PIL) | HPND | Test image processing |
| NumPy | BSD | Test numerical ops |

---

## 6. No Excluded Licenses & Audit Transparency

A full audit of all 86 test photos (50 Phase 6 open-source + 36 P3–P5 fixtures) confirms:

- ✅ 0 photos with CC BY-NC license
- ✅ 0 photos with CC BY-ND license
- ✅ 0 photos sourced from watermarked or stock-only platforms
- ✅ 0 photos with SHA-256 mismatch (`50/50` open-source files verified)
- ⚠️ **5 open-source photos marked `pending-review`** (`p6_18`, `p6_34`, `p6_35`, `p6_42`, `p6_45`) because their Wikimedia Commons pages show `Category:Images from Unsplash (review needed)` and their earliest Wayback archive post-dates Unsplash's June 5, 2017 CC0 cutoff; excluded from `gold_standard/` (`17` verified originals) and confined to `exploratory/`.
