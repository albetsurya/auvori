# PHASE6_REPORT.md
# Auvori — Phase 6 Visual Quality Assurance, Open-Source Photo Library & Product Polish (Synchronized in Phase 6.1)

**Branch:** `feat/phase6.1-audit-integrity-hardening` (hardening Phase 6 commit `643ab69`)
**Phase 5 Baseline SHA:** `372485ad072d6911c24a9265abb793714c1f180a`
**Report Date:** `2026-11-27`
**Status:** ✅ COMPLETE (Audit-hardened & synchronized in Phase 6.1)

---

## 1. Objective

Phase 6 and its Phase 6.1 hardening pass cover:
1. **Curating & auditing a 50-photo open-source sample library** (`tests/fixtures/opensource_photos/`) with independent license verification, visual originality review, and SHA-256 verification.
2. **Running reproducible visual QA** across all **27 catalog entries** (**26 active looks**: 19 Legacy + 5 P1 Signature + 2 Adaptive, plus 1 Original mode) with real preset grain enabled.
3. **Verifying product readiness & P0–P5 preservation** across WebGL2 SwiftShader, Intel Iris Xe physical GPU, Worker Canvas2D fallback, 5 responsive viewports, and export limits without modifying any rendering formula.

---

## 2. Baseline Protection

| Item | Status |
|---|---|
| 19 Legacy Preset formulas (+ `original`) | ✅ Unchanged |
| 5 Signature Look formulas (P1) | ✅ Unchanged |
| Direct Flash & Night Cinema formulas (P4/P5) | ✅ Unchanged |
| Tone Curve / 3-Way Color Grading / Relighting | ✅ Unchanged |
| YuNet / PP-HumanSeg / U²-Netp models & checksums | ✅ Unchanged |
| Free/Pro entitlements / Cloudflare D1 / Lynk.id | ✅ Unchanged |
| P0 (36) & P1 (30) golden baselines | ✅ No drift (MAE `0.0000`) |

---

## 3. Open-Source Photo Library (Audited Summary)

| Metric | Phase 6.1 Audited Value | Report Reference |
|---|---|---|
| Total open-source files | **50** | [`manifest.json`](tests/fixtures/opensource_photos/manifest.json) |
| File & SHA-256 integrity | **50 / 50 PASS** | [`PHASE6_1_REGRESSION_REPORT.md`](PHASE6_1_REGRESSION_REPORT.md) |
| License `verified` (`CC0-1.0`) | **45 / 50** | [`PHASE6_1_LICENSE_VERIFICATION.md`](PHASE6_1_LICENSE_VERIFICATION.md) |
| License `pending-review` | **5 / 50** (`p6_18`, `p6_34`, `p6_35`, `p6_42`, `p6_45`) | [`PHASE6_1_LICENSE_VERIFICATION.md`](PHASE6_1_LICENSE_VERIFICATION.md) |
| Originality `reviewed-original` | **17 / 50** | [`PHASE6_1_ORIGINALITY_AUDIT.md`](PHASE6_1_ORIGINALITY_AUDIT.md) |
| Originality `possibly-processed` / `unknown` | **30** `possibly-processed`, **3** `unknown` | [`PHASE6_1_ORIGINALITY_AUDIT.md`](PHASE6_1_ORIGINALITY_AUDIT.md) |
| `gold_standard/` partition | **17** (both `verified` + `reviewed-original`) | `tests/fixtures/opensource_photos/gold_standard/` |
| `exploratory/` partition | **33** (candidates only) | `tests/fixtures/opensource_photos/exploratory/` |

---

## 4. Visual QA & Regression Results (Synchronized Live Results)

| Suite / Check | Result | Key Metrics | Evidence |
|---|---|---|---|
| `npm run build` | ✅ **PASS** | `1.66s`, `1624` modules | [`build.log`](tests/reports/phase6_1/regression_logs/build.log) |
| P0 Legacy Baseline | ✅ **PASS** | `36` golden MAE `0.0000`, GPU/CPU MAE `0.275/255` | [`p0.log`](tests/reports/phase6_1/regression_logs/p0.log) |
| P1 Signature Looks | ✅ **PASS** | `30` golden MAE `0.0000`, GPU/CPU MAE `0.270/255` | [`p1.log`](tests/reports/phase6_1/regression_logs/p1.log) |
| P3 Adaptive Analysis | ✅ **PASS** | `14` photos ONNX WASM + offline cache + tamper check | [`p3.log`](tests/reports/phase6_1/regression_logs/p3.log) |
| P4 Direct Flash | ✅ **PASS** | `24` photos GPU/CPU MAE `0.022/255`, Iris Xe `19.65 ms` | [`p4_revalidation.log`](tests/reports/phase6_1/regression_logs/p4_revalidation.log) |
| P5 Night Cinema | ✅ **PASS** | `36` photos GPU/CPU MAE `0.025/255`, Iris Xe `23.50 ms` | [`p5.log`](tests/reports/phase6_1/regression_logs/p5.log) |
| P6 Visual QA & UX | ✅ **PASS** | `26` active looks `0%` identity, 5 viewports 0 errors, Iris Xe `61.3–196.0 ms` | [`p6.log`](tests/reports/phase6_1/regression_logs/p6.log) |
| P6.1 Integrity & Grain/Coverage | ✅ **PASS** | `50/50` SHA-256, `0` gold leaks, `15×5` grain QA, `4` stratified sheets | [`PHASE6_1_REPORT.md`](PHASE6_1_REPORT.md) |

---

## 5. Known Limitations & Deferred Items

| Item | Status | Notes |
|---|---|---|
| Physical WebGPU acceleration | **BLOCKED / DEFERRED** | Intel Iris Xe on Linux ANGLE/EGL reports `WebGPU=False`; WebGL2 & WASM fallback verified |
| 5 `pending-review` Unsplash photos | **OPEN** | Confined to `exploratory/` (earliest Wayback snapshot post-dates June 5, 2017 CC0 cutoff) |
| Human model release verification | **NOTED** | CC0 covers copyright only; personality rights documented per entry in `manifest.json` |
