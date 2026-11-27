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

## 2. Phase 6 Open-Source Photo Library (50 Photos)

**Source:** Wikimedia Commons — Unsplash CC0 Archive
**License:** CC0 1.0 Universal (all 50 photos)
**Attribution required:** No (CC0 waives all rights)

Full per-photo attribution is in:
[`tests/fixtures/opensource_photos/ATTRIBUTION.md`](tests/fixtures/opensource_photos/ATTRIBUTION.md)

### Summary Statistics

| Metric | Value |
|--------|-------|
| Total photos | 50 |
| License type | CC0 1.0 Universal (100%) |
| Source platform | Wikimedia Commons |
| Distinct categories covered | 45 |
| Photos with model release | Documented per-photo in manifest |
| Photos with identifiable people | Multiple — model release status documented |
| SHA-256 verified | ✅ All 50 |
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

## 6. No Excluded Licenses

A full audit of all 86 test photos (50 new + 36 existing) confirms:

- ✅ 0 photos with CC BY-NC license
- ✅ 0 photos with CC BY-ND license
- ✅ 0 photos with unknown or unverifiable license
- ✅ 0 photos sourced from watermarked or stock-only platforms
- ✅ 0 photos with SHA-256 mismatch (all verified on download and verify-only pass)
