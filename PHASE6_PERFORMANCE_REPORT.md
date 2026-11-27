# PHASE6_PERFORMANCE_REPORT.md
# Auvori — Phase 6 Performance Report

**Branch:** `feat/phase6-visual-quality-polish`
**Phase 5 Baseline SHA:** `372485ad072d6911c24a9265abb793714c1f180a`
**Report Date:** 2026-11-27

---

## 1. GPU Environments Tested

| Environment | Renderer | WebGPU | Max Texture |
|-------------|----------|--------|-------------|
| SwiftShader (CI-equivalent) | ANGLE / Vulkan 1.3.0 SwiftShader Device (Subzero) | ❌ | 8192px |
| Physical GPU | ANGLE / Intel Mesa Iris® Xe Graphics (ADL GT2) / OpenGL ES 3.2 | ❌ | 16384px |

---

## 2. Preview Render Benchmarks (1200px long-edge)

| Photo | SwiftShader | Intel Iris Xe | Speedup |
|-------|-------------|---------------|---------|
| p6_07 — Daylight portrait (1200×800) | 648 ms | 173 ms | **3.7×** |
| p6_14 — Latte/café (1200×900) | 355 ms | 65 ms | **5.5×** |
| p6_30 — Forest bridge hiker (1200×800) | 437 ms | 198 ms | **2.2×** |
| p6_25 — Sea waves sunset (1200×800) | 295 ms | 65 ms | **4.5×** |

> [!TIP]
> On real hardware (Intel Iris Xe), all previews render in **65–198 ms** — well under the 300 ms perceptible threshold. SwiftShader represents worst-case server-side or low-end CPU-only rendering.

---

## 3. Export Policy Validation

### Free Tier — 1280px Long-Edge Cap

| Backend | Input | Output | Mime | Size | Time |
|---------|-------|--------|------|------|------|
| WebGL2 (SwiftShader) | 2048×1366 portrait | **853×1280** ✅ | JPEG | 105 KB | 665 ms |
| WebGL2 (Intel Iris Xe) | 2048×1366 portrait | **853×1280** ✅ | JPEG | 112 KB | 216 ms |

Free tier correctly caps at 1280px long edge with hardware JPEG compression. ✅

### Pro Tier — Full Resolution Export

| Format | Backend | Resolution | Mime | Size | Time (SW) | Time (GPU) |
|--------|---------|------------|------|------|-----------|------------|
| JPEG Portrait | WebGL2 | 2731×4096 | image/jpeg | ~1.0 MB | 2945 ms | 357 ms |
| PNG Landscape | WebGL2 | 4096×2731 | image/png | ~12 MB | 3042 ms | 756 ms |
| PNG Square (crop) | Worker Canvas2D | 3456×3456 | image/png | ~11 MB | 4180 ms | 5542 ms |
| Before/After Card | WebGL2 | 3856×1578 | image/jpeg | 707–791 KB | 705 ms | 115 ms |

> [!NOTE]
> Square crop export routes to Worker Canvas2D (CPU) as expected — the WebGL2 path does not support arbitrary crop transforms on this configuration. CPU time (5.5s) is acceptable for a one-time Pro export.

> [!NOTE]
> PNG Landscape at 12 MB is lossless full-resolution — expected for a 4096×2731 color image.

---

## 4. Memory Profile

Heap used during full export sequence (SwiftShader): **51 MB** — well within browser limits for a PWA.

---

## 5. Responsive UX Metrics (5 Viewports)

| Viewport | Canvas CSS Size | Canvas Buffer | Horizontal Overflow | JS Errors |
|----------|----------------|---------------|---------------------|-----------|
| 360×800 (mobile S) | 336×224 px | 1080×720 | ❌ None | 0 |
| 390×844 (iPhone 14) | 366×244 px | 1080×720 | ❌ None | 0 |
| 768×1024 (iPad) | 728×485 px | 1080×720 | ❌ None | 0 |
| 1280×800 (laptop) | 848×565 px | 1080×720 | ❌ None | 0 |
| 1440×900 (desktop) | 1008×672 px | 1080×720 | ❌ None | 0 |

All viewports: ✅ no horizontal scroll, ✅ canvas renders, ✅ zero uncaught JS errors.

The editor canvas scales appropriately from 336px (mobile S) to 1008px (widescreen desktop), maintaining correct aspect ratio across all breakpoints.

---

## 6. P0–P5 Regression Suite Results (Phase 6 Branch)

| Suite | Cases | Worst GPU/CPU MAE | Golden Drift | Status |
|-------|-------|-------------------|--------------|--------|
| P0 — Legacy 20 presets | 36 | 0.275/255 | 0.0000 | ✅ PASS |
| P1 — Signature 5 looks | 30 | 0.270/255 | 0.0000 | ✅ PASS |
| P3 — Adaptive Analysis | 11 models | — | — | ✅ PASS |
| P4 — Direct Flash | (pending) | — | — | 🔄 |
| P5 — Night Cinema | 36 | — | 0.025/255 | ✅ PASS |

---

## 7. Build Performance

```
npm run build (Vite 5 + TypeScript)
Build time: 1.69s
Bundle: index-*.js  380.50 kB (gzip: 110.78 kB)
CSS:    index-*.css  39.83 kB (gzip: 7.59 kB)
PWA precache: 11 entries, 651.95 KiB
```

---

## 8. Conclusions

- **Preview latency** on real hardware: 65–198 ms (excellent)
- **Export latency** on real hardware: 115–756 ms for GPU paths (acceptable for one-shot export)
- **Export resolution policy:** Free 1280px cap ✅ / Pro full-res ✅ — both enforced correctly
- **Zero horizontal overflow** across all 5 tested viewports
- **Zero JS errors** during full editor workflow (open → preset → intensity → split → undo/redo → crop → export modal)
- **Memory footprint:** 51 MB heap during full export — healthy
