# PHASE6_1_REPORT.md
# Auvori — Phase 6.1 Audit Integrity & Visual Validation Hardening

**Branch:** `feat/phase6.1-audit-integrity-hardening`
**Baseline Commit SHA:** `643ab69f7bb79e0821828233680f01e33139ca5b`
**Audit Date:** `2026-11-27`
**Status:** ✅ COMPLETE (All P0–P6.1 regression & audit checks verified)

---

## 1. Executive Summary

Phase 6.1 audited every deliverable from Phase 6 (`643ab69`) without altering any production source code (`src/`), preset formulas, AI models, entitlements, backend schema, or P0–P5 golden baselines. The audit discovered and closed seven concrete integrity gaps:

1. **License verification over-reliance (`6.1A`):** Verified every Wikimedia Commons page and Wayback Machine archive individually. Confirmed **45/50** photos have pre-`2017-06-05` Unsplash CC0 evidence (`https://web.archive.org/web/20170505000000id_/https://unsplash.com/license`) or Wikimedia `{{LicenseReview}}`. Downgraded **5/50** (`p6_18`, `p6_34`, `p6_35`, `p6_42`, `p6_45`) to `pending-review` because their earliest Wayback archives post-date Unsplash's June 5, 2017 CC0 cutoff and Wikimedia lists them as `review needed`.
2. **Originality vs. SHA-256 conflation (`6.1B`):** Visual review of all 50 images + EXIF inspection found **8** explicit `VSCO`/`VSCOcam` edits, **4** other mobile/HDR+ edits (`Snapseed`, `Pixelmator`, `iSee`, `HDR+`), **18** additional B&W conversions / heavy black-point fades / vignettes / stylized grades (`30` total `possibly-processed`), and **3** `unknown` entries with stripped EXIF. Only **17/50** photos passed both license and originality checks and were partitioned into `tests/fixtures/opensource_photos/gold_standard/`, with the remaining **33** isolated in `exploratory/`.
3. **Separated integrity checks (`6.1C`):** Implemented [`tests/run_p6_1_dataset_integrity.py`](tests/run_p6_1_dataset_integrity.py) verifying file existence, readability, PIL image validity, extension/MIME match, dimensions, byte size, SHA-256, duplicate detection, unregistered files, and strict `gold_standard`/`exploratory` partition enforcement.
4. **Grain QA & contact sheet filter bug fix (`6.1D`):** Discovered two defects in `tests/run_p6_visual_quality_tests.py`:
   - `includeGrain: false` was hardcoded across all Phase 6 sheets and intensity ladders.
   - The filter `(!p.lookType || p.lookType === 'legacy')` returned **0 presets**, leaving `sheet_01a` and `sheet_01b` with only the `Original` column while lumping 18 presets into `sheet_02`.
   Both defects were fixed in `run_p6_visual_quality_tests.py`, and dedicated 1:1 grain crop contact sheets + quantitative metrics were built in [`tests/run_p6_1_grain_and_coverage_tests.py`](tests/run_p6_1_grain_and_coverage_tests.py).
5. **Stratified 16-characteristic visual coverage (`6.1E`):** Tested all 26 active presets across 21 stratified scenes spanning all 16 characteristics (explicitly documenting where P3–P5 verified fixtures supplement `opensource_photos` gaps in Night, Neon, Backlit, and Complex Skin Tones).
6. **P4 Direct Flash contradiction resolution (`6.1F`):** Executed [`tests/run_p4_direct_flash_tests.py`](tests/run_p4_direct_flash_tests.py) cleanly (`exit code 0`), replacing `pending` with live verified PASS evidence (`0.022/255` GPU/CPU MAE, `19.65 ms` Intel Iris Xe median).
7. **Authoritative catalog inventory & doc synchronization (`6.1G`/`6.1H`):** Extracted exact catalog from `src/data/presets.ts` (**27 total entries**: `1` Original + `19` Legacy + `5` P1 Signature + `2` Adaptive = `26` active looks), removed non-existent preset names from `PHASE6_VISUAL_AUDIT.md`, and synchronized all Phase 6 and 6.1 reports.

---

## 2. Production Engine Observations (Preserved Without `src/` Modification)

Two subtle rendering behaviors were observed during Phase 6.1 automated validation and are documented transparently rather than patched in `src/` per strict baseline preservation rules:

1. **WebGL2 vs. Canvas2D grain hash Y-orientation (`0.683/255` MAE on `Amber Halation`):**
   `effects-composite.frag` and `color-grading.frag` seed spatial grain using `gl_FragCoord.x/y` (bottom-up inside FBOs before final `uFlipY = 1.0` screen blit), whereas `pixel-grade.ts` seeds using top-down `y`. Both render identical statistical midtone-weighted grain (`meanDiff = 0.042`, `stdDiff = 0.069`), while pixel-wise MAE rises to `0.683/255` when `grain=15` is active.
2. **Consecutive `WebGL2Renderer` renders with `bgBokeh > 0.5` (`0.037/255` MAE):**
   On a reused `WebGL2Renderer` instance, `this.bokehFboA.tex` stays bound to `TEXTURE2` from the prior `gradeProg` pass when the next frame's `bokehProg` (`uMode = 0`) draws into `bokehFboA`, creating a `0.037/255` MAE variation across consecutive `Rosy Bokeh` / `Porcelain Bloom` renders (`0.000/255` between fresh instances).

---

## 3. Deliverables Index

| # | Deliverable | Location |
|---:|---|---|
| 1 | Master Phase 6.1 Audit Report | [`PHASE6_1_REPORT.md`](PHASE6_1_REPORT.md) |
| 2 | License Verification Report | [`PHASE6_1_LICENSE_VERIFICATION.md`](PHASE6_1_LICENSE_VERIFICATION.md) |
| 3 | Visual Originality & EXIF Audit | [`PHASE6_1_ORIGINALITY_AUDIT.md`](PHASE6_1_ORIGINALITY_AUDIT.md) |
| 4 | Stratified Visual Coverage Report | [`PHASE6_1_COVERAGE_REPORT.md`](PHASE6_1_COVERAGE_REPORT.md) |
| 5 | Authoritative Preset Inventory | [`PHASE6_1_PRESET_INVENTORY.md`](PHASE6_1_PRESET_INVENTORY.md) |
| 6 | Full Regression & P4 Revalidation Report | [`PHASE6_1_REGRESSION_REPORT.md`](PHASE6_1_REGRESSION_REPORT.md) |
| 7 | Dataset Integrity Test Runner | [`tests/run_p6_1_dataset_integrity.py`](tests/run_p6_1_dataset_integrity.py) |
| 8 | Grain & Stratified Coverage Runner | [`tests/run_p6_1_grain_and_coverage_tests.py`](tests/run_p6_1_grain_and_coverage_tests.py) |
| 9 | Hardened Photo Manifest (`schema_version: 2`) | [`tests/fixtures/opensource_photos/manifest.json`](tests/fixtures/opensource_photos/manifest.json) |
| 10 | Updated Attribution Records | [`tests/fixtures/opensource_photos/ATTRIBUTION.md`](tests/fixtures/opensource_photos/ATTRIBUTION.md) & [`PHASE6_ATTRIBUTION.md`](PHASE6_ATTRIBUTION.md) |
| 11 | Grain Quality Contact Sheets & Metrics | [`tests/reports/phase6_1/grain_quality/`](tests/reports/phase6_1/grain_quality) |
| 12 | Dataset Integrity JSON Report | [`tests/reports/phase6_1/dataset_integrity_report.json`](tests/reports/phase6_1/dataset_integrity_report.json) |
| 13 | P4 & P0–P6.1 Verbatim Logs | [`tests/reports/phase6_1/regression_logs/`](tests/reports/phase6_1/regression_logs) |
| 14 | Synchronized Phase 6 Reports | [`PHASE6_REPORT.md`](PHASE6_REPORT.md), [`PHASE6_VISUAL_AUDIT.md`](PHASE6_VISUAL_AUDIT.md), [`PHASE6_PERFORMANCE_REPORT.md`](PHASE6_PERFORMANCE_REPORT.md) |
