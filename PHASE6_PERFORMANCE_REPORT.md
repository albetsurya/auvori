# PHASE6_PERFORMANCE_REPORT.md
# Auvori — Phase 6 / 6.1 Performance Report

**Branch:** `feat/phase6.1-audit-integrity-hardening` (verified against Phase 6 baseline `643ab69`)
**Report Date:** `2026-11-27`

---

## 1. GPU Environments Tested

| Environment | Renderer | WebGPU | Max Texture |
|---|---|---|---|
| **Software (CI-equivalent)** | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` | ❌ `false` | `8192px` |
| **Physical Hardware GPU** | `ANGLE (Intel, Mesa Intel(R) Iris(R) Xe Graphics (ADL GT2), OpenGL ES 3.2)` | ❌ `false` | `16384px` |

---

## 2. Preview Render Benchmarks (1200px Long-Edge, `includeGrain: true`)

Measured live via `python3 tests/run_p6_visual_quality_tests.py` (`tests/reports/phase6_metrics.json`, exit code `0`, 2026-11-27T14:47:17+07:00):

| Photo | SwiftShader (GL) | Intel Iris Xe (GL) | Speedup |
|---|---:|---:|---:|
| `p6_07_daylight_smiling_portrait.jpg` (1200×800) | 516.8 ms | 196.0 ms | **2.6×** |
| `p6_14_latte_croissant_cafe.jpg` (1200×900) | 307.8 ms | 73.2 ms | **4.2×** |
| `p6_30_forest_bridge_hiker.jpg` (1200×800) | 340.3 ms | 184.6 ms | **1.8×** |
| `p6_25_sea_waves_sunset.jpg` (1200×800) | 274.1 ms | 61.3 ms | **4.5×** |

---

## 3. Export Policy Validation (`p6.log` / `phase6_metrics.json`)

### Free Tier — 1280px Long-Edge Cap

| Backend | Input | Output | Mime | Size | Time |
|---|---|---|---|---:|---:|
| WebGL2 (SwiftShader) | 3456×5184 portrait | **853×1280** ✅ | `image/jpeg` | 107,463 B | 508.5 ms |
| WebGL2 (Intel Iris Xe) | 3456×5184 portrait | **853×1280** ✅ | `image/jpeg` | 114,625 B | 228.9 ms |

### Pro Tier — High-Resolution Export (`SAFE_MAX_EXPORT_DIM = 4096`)

| Format | Backend | Resolution | Mime | Size | Time (SW) | Time (GPU) |
|---|---|---|---:|---:|---:|---:|
| JPEG Portrait | WebGL2 | 2731×4096 | `image/jpeg` | 1,003,178 / 1,002,763 B | 2,508.1 ms | 332.3 ms |
| PNG Landscape | WebGL2 | 4096×2731 | `image/png` | 12,135,450 / 12,288,353 B | 2,897.5 ms | 536.1 ms |
| PNG Square (`1:1` crop) | Worker Canvas2D | 3456×3456 | `image/png` | 11,025,496 / 11,025,393 B | 4,175.2 ms | 4,456.6 ms |
| Before/After Card | WebGL2 | 3856×1578 | `image/jpeg` | 706,838 / 791,278 B | 774.9 ms | 102.3 ms |

---

## 4. Memory Profile

JS heap measured during full export matrix (`performance.memory.usedJSHeapSize`): **51.0 MB** (both SwiftShader and Intel Iris Xe runs).

---

## 5. Responsive UX Metrics (5 Viewports, `run_p6_visual_quality_tests.py`)

| Viewport | Canvas CSS Size | Canvas Buffer | Horizontal Overflow | JS Errors |
|---|---|---|---|---:|
| 360×800 | 336×224 px | 1080×720 | ❌ None | 0 |
| 390×844 | 366×244 px | 1080×720 | ❌ None | 0 |
| 768×1024 | 728×485 px | 1080×720 | ❌ None | 0 |
| 1280×800 | 848×565 px | 1080×720 | ❌ None | 0 |
| 1440×900 | 1008×672 px | 1080×720 | ❌ None | 0 |

---

## 6. P0–P5 Regression Results (Live Phase 6.1 Execution, `643ab69`)

| Suite | Cases | Worst GPU/CPU MAE | Golden Drift | Intel Iris Xe Median | Status | Log |
|---|---|---|---|---|---|---|
| **P0** — Legacy Baseline | 36 | 0.275/255 | 0.0000 | — | ✅ **PASS** | [`p0.log`](tests/reports/phase6_1/regression_logs/p0.log) |
| **P1** — 5 Signature Looks | 30 | 0.270/255 | 0.0000 | — | ✅ **PASS** | [`p1.log`](tests/reports/phase6_1/regression_logs/p1.log) |
| **P3** — Adaptive Analysis | 14 photos | — | — | — | ✅ **PASS** | [`p3.log`](tests/reports/phase6_1/regression_logs/p3.log) |
| **P4** — Direct Flash | 24 photos | 0.022/255 | — | **19.65 ms** (export 389.4 ms) | ✅ **PASS** | [`p4_revalidation.log`](tests/reports/phase6_1/regression_logs/p4_revalidation.log) |
| **P5** — Night Cinema | 36 photos | 0.025/255 | — | **23.50 ms** (export 257.4 ms) | ✅ **PASS** | [`p5.log`](tests/reports/phase6_1/regression_logs/p5.log) |

---

## 7. Build Performance (`build.log`)

```
npm run build (tsc && vite build)
Build time: 1.66s (1624 modules transformed)
Bundle: index-*.js  380.50 kB (gzip: 110.78 kB)
CSS:    index-*.css  39.83 kB (gzip: 7.59 kB)
PWA precache: 11 entries, 651.95 KiB
```
