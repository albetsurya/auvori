# PHASE6_1_REGRESSION_REPORT.md
# Auvori — Phase 6.1I Full Regression & Revalidation Report

**Branch:** `feat/phase6.1-audit-integrity-hardening`
**Baseline Commit SHA:** `643ab69f7bb79e0821828233680f01e33139ca5b`
**Execution Date:** `2026-11-27` (14:43–14:48 WIB / +07:00)

---

## 1. Environments & Hardware

| Environment Label | Graphics / Runtime Stack | WebGPU | Max Texture |
|---|---|---|---|
| **Software CI-Equivalent** | Chromium Headless + ANGLE / Vulkan 1.3.0 (`SwiftShader Device (Subzero)`) + ONNX Runtime Web WASM | ❌ `false` | `8192px` |
| **Physical Hardware GPU** | Chromium Headless + ANGLE (`Intel, Mesa Intel(R) Iris(R) Xe Graphics (ADL GT2), OpenGL ES 3.2`) | ❌ `false` | `16384px` |

> [!NOTE]
> Physical WebGPU acceleration remains **BLOCKED / DEFERRED** because Mesa ANGLE/EGL on this Linux test host reports `navigator.gpu.requestAdapter() === null`. WASM execution via `onnxruntime-web` and WebGL2 hardware acceleration via Intel Iris Xe passed all tests.

---

## 2. Suite-by-Suite Execution Matrix

| Suite | Exact Command | Exit Code | Timestamp | Commit SHA | Result | Verbatim Log Path |
|---|---|---:|---|---|---|---|
| **Production Build** | `npm run build` | `0` | `2026-11-27T14:44:06+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`build.log`](tests/reports/phase6_1/regression_logs/build.log) |
| **P0 Legacy Baseline** | `python3 tests/run_p0_tests.py --mode p0-all` | `0` | `2026-11-27T14:44:11+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p0.log`](tests/reports/phase6_1/regression_logs/p0.log) |
| **P1 Signature Looks** | `python3 tests/run_p1_signature_tests.py --mode verify` | `0` | `2026-11-27T14:44:32+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p1.log`](tests/reports/phase6_1/regression_logs/p1.log) |
| **P3 Adaptive Analysis** | `python3 tests/run_p3_adaptive_tests.py` | `0` | `2026-11-27T14:44:44+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p3.log`](tests/reports/phase6_1/regression_logs/p3.log) |
| **P4 Direct Flash** | `python3 tests/run_p4_direct_flash_tests.py` | `0` | `2026-11-27T14:44:02+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p4_revalidation.log`](tests/reports/phase6_1/regression_logs/p4_revalidation.log) |
| **P5 Night Cinema** | `python3 tests/run_p5_night_cinema_tests.py` | `0` | `2026-11-27T14:45:02+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p5.log`](tests/reports/phase6_1/regression_logs/p5.log) |
| **P6 Visual Quality QA** | `python3 tests/run_p6_visual_quality_tests.py` | `0` | `2026-11-27T14:47:17+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p6.log`](tests/reports/phase6_1/regression_logs/p6.log) |
| **P6.1 Dataset Integrity** | `python3 tests/run_p6_1_dataset_integrity.py` | `0` | `2026-11-27T14:48:27+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p6_1_integrity.log`](tests/reports/phase6_1/regression_logs/p6_1_integrity.log) |
| **P6.1 Grain & Coverage** | `python3 tests/run_p6_1_grain_and_coverage_tests.py` | `0` | `2026-11-27T14:42:29+07:00` | `643ab69f7bb79e0821828233680f01e33139ca5b` | **PASS** | [`p6_1_grain_coverage.log`](tests/reports/phase6_1/regression_logs/p6_1_grain_coverage.log) |
| **WebGPU Hardware Path** | — | — | — | — | **BLOCKED** | Host ANGLE/EGL reports `WebGPU=False` |

---

## 3. Key Quantitative Evidence Per Suite

### Production Build (`tsc && vite build`)
- Modules transformed: `1624` in `1.66s`
- Output bundle: `index-*.js` (`380.50 kB`, gzip `110.78 kB`), `index-*.css` (`39.83 kB`, gzip `7.59 kB`), PWA precache `11` entries (`651.95 KiB`)

### P0 — Legacy Baseline (`run_p0_tests.py --mode p0-all`)
- Golden CPU baselines (`36` cases): worst MAE `0.0000`, worst maxDiff `0`, red artifacts `0`
- GPU vs CPU parity (`36` cases): worst MAE `0.275/255`, worst RMSE `0.834/255`, worst grainMAE `0.014/255`
- Catalog check: `presetCount: 27`, `freeCount: 6`, `proCount: 20`
- Full-res 3200×2400 Pro JPEG & Worker Canvas2D fallback + 1280px Free cap + UI E2E (`created: 28, revoked: 27`): **PASS**

### P1 — Signature Looks (`run_p1_signature_tests.py --mode verify`)
- Golden P1 baselines (`30` cases): worst MAE `0.0000`
- GPU vs CPU parity (`30` cases): worst MAE `0.270/255`, worst RMSE `0.658/255`, worst grainMAE `0.028/255`, red artifacts `0`
- Monotone tone curve stress (`257` configs): `0` violations
- Closest differentiation among Signature Looks vs baselines: `8.18` MAE (`silver-gelatin vs mono-leica`)

### P3 — Adaptive Analysis (`run_p3_adaptive_tests.py`)
- Lazy-load check: `0` `.onnx`/ORT WASM requests before AI trigger
- 14 original photos WASM inference: all `14` completed accurately (`hijab_portrait.jpg` 91.4ms / 1 face / `pphumanseg-2023mar`; `multiple_faces.jpg` 72.5ms / 4 faces)
- Offline Cache Storage reuse, HTTP 500 graceful fallback (`heuristic-only`), SHA-256 tamper rejection, compiled `vite preview` worker bundle (`641.5ms`): **PASS**

### P4 — Direct Flash Revalidation (`run_p4_direct_flash_tests.py`)
- **Resolves Phase 6 contradiction (`PASS` vs `pending`):** Re-executed end-to-end with `exit code 0`
- SwiftShader (`24` photos = `14` original + `10` holdout): worst GPU/CPU MAE `0.022/255`, max halo `0.0424`, max noise amp `1.07x`
- Full-res 3200×2400 export parity: GL `2098.1ms`, CPU `3963.7ms`, preview vs export MAE `0.839/255`
- Intel Iris Xe physical GPU: preview median **`19.65 ms`** (range `6.60..42.50 ms`), 3200×2400 export **`389.4 ms`**
- Editor UX E2E: lazy trigger, `Adaptive Flash Ready`, Landscape fallback, Offline fallback, Before/After, Undo/Redo: **PASS**

### P5 — Night Cinema (`run_p5_night_cinema_tests.py`)
- SwiftShader (`36` photos = `12` night + `14` original + `10` holdout): worst GPU/CPU MAE `0.025/255`, max halo `0.0412`, max luma noise `1.21x`, max chroma noise `2.44x`
- Full-res 3200×2400 export parity: GL `2193.0ms`, CPU `4830.5ms`, preview vs export MAE `0.350/255`
- Intel Iris Xe physical GPU: preview median **`23.50 ms`** (range `8.50..39.30 ms`), 3200×2400 export **`257.4 ms`**
- Editor UX E2E: `Adaptive Night Ready`, `Subject Night Ready`, Landscape & Offline fallbacks: **PASS**

### P6 & P6.1 — Visual QA, Dataset Integrity & Grain Audit
- `run_p6_visual_quality_tests.py` (fixed taxonomy + `includeGrain: true` + real contact sheets): **PASS** (26 active looks verified, `0% == Original` MAE `0.000`, 5 viewports responsive UX `0` overflow / `0` errors, Intel Iris Xe 1200px previews `61.3–196.0 ms`, Pro export `332.3–536.1 ms`)
- `run_p6_1_dataset_integrity.py`: **PASS** (`50/50` SHA-256 & image integrity, `45` license-verified, `5` pending-review, `17` `gold_standard`, `33` `exploratory`, `0` gold leaks)
- `run_p6_1_grain_and_coverage_tests.py`: **PASS** (15 presets × 5 intensities grain verification, `0.000` grain delta on non-grain presets, GPU/CPU statistical std diff `0.069`, 4 stratified contact sheets generated)
