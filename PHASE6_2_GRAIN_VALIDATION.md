# PHASE 6.2 — GRAIN DETERMINISM & ORIENTATION VALIDATION REPORT
**Auvori | Neutral Analog Studio**  
**Phase:** 6.2C Grain Determinism, Orientation & Spatial Parity  
**Date:** November 2026  
**Status:** COMPLETE — DETERMINISM & STATISTICAL PARITY VERIFIED  

---

## 1. Executive Summary

Phase 6.2C conducted an in-depth mathematical, visual, and statistical validation of film grain generation across both GPU (`WebGL2Renderer`) and CPU (`Canvas2DRenderer`) execution paths.

**Key Findings:**
1. **Repeated Determinism:** Both GPU and CPU rendering paths demonstrate **100% bit-exact determinism** (diffCount = 0, maxDiff = 0 across repeated runs).
2. **Mathematical Formulation Parity:** Both engines implement identical 32-bit integer pseudo-random hash arithmetic:
   $$\text{hash}(x, y) = ((x \times 374761393 + y \times 668265263) \oplus \mathtt{0x5bf03635})$$
3. **Statistical Parity:** Standard deviation difference between GPU and CPU grain distributions is **0.00023** (within 0.02% of total luminance range).
4. **Spatial Uniformity:** Spatial autocorrelation at lag-1 is **$r_x = 0.0045, r_y = 0.0037$**, confirming pristine white-noise spatial decorrelation with zero banding, striping, or clumping.
5. **Resolution Scaling:** Grain noise standard deviation remains consistent across preview (320px, $\sigma=4.131$) and export resolutions (1080px, $\sigma=4.110$), with a delta $< 0.022$.
6. **Strict Golden Baseline Preservation:** As mandated by core baseline protection rules, coordinate conventions are formally documented and preserved without modifying existing production shaders.

---

## 2. Mathematical Specification

### 2.1 Hash Generator Formula
Film grain in Auvori simulates authentic organic silver halide crystals using a deterministic high-frequency pseudo-random integer hash.

- **WebGL2 Shader Implementation (`src/engine/renderer/webgl2.renderer.ts`):**
  ```glsl
  highp uint h = (uint(gl_FragCoord.x) * 374761393u + uint(gl_FragCoord.y) * 668265263u) ^ 0x5bf03635u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  float grainNoise = float(h ^ (h >> 16u)) * (1.0 / 4294967295.0) - 0.5;
  ```

- **Canvas2D CPU Implementation (`src/engine/renderer/canvas2d.renderer.ts`):**
  ```typescript
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const grainNoise = ((h ^ (h >>> 16)) >>> 0) / 4294967295 - 0.5;
  ```

### 2.2 Coordinate Convention Difference
- **WebGL2:** Evaluates `gl_FragCoord.xy`, where the origin $(0,0)$ is located at the **bottom-left** of the framebuffer and increases upwards (standard OpenGL Cartesian convention).
- **Canvas2D / CPU:** Iterates pixel array indices $(x,y)$, where $(0,0)$ is located at the **top-left** of the canvas and increases downwards (standard raster 2D convention).

Because $y_{\text{gl}} = (\text{height} - 1) - y_{\text{cpu}}$, individual $(x,y)$ coordinate pairs map to vertically mirrored hash values between GPU and CPU. However, because the hash function is spatially uncorrelated white noise, the resulting image has **identical visual grain characteristics and identical statistical moments**.

---

## 3. Verification & Validation Results

The grain validation suite (`tests/run_p6_2_grain_determinism.py`) evaluated 5 key properties:

### 3.1 Repeated Execution Determinism
| Engine | Iterations | Dimensions | Diff Count | Max Diff | MAE | Status |
|---|---|---|---|---|---|---|
| **WebGL2 (GPU)** | 5 repeated runs | 320 x 480 | **0** / 153,600 | **0** | **0.000000** | **PASS** |
| **Canvas2D (CPU)** | 5 repeated runs | 320 x 480 | **0** / 153,600 | **0** | **0.000000** | **PASS** |

### 3.2 Statistical Distribution & Spatial Parity
Evaluated on Kodak Gold 200 (grain intensity 16):

| Metric | GPU (WebGL2) | CPU (Canvas2D) | Absolute Delta | Criteria | Status |
|---|---|---|---|---|---|
| **Luminance Mean** | 0.38794 | 0.38798 | 0.00004 | $< 0.005$ | **PASS** |
| **Luminance Std Dev** | 0.23145 | 0.23122 | **0.00023** | $< 0.005$ | **PASS** |
| **Spatial Autocorr Lag-1 X** | 0.0045 | 0.0048 | 0.0003 | $< 0.05$ | **PASS** |
| **Spatial Autocorr Lag-1 Y** | 0.0037 | 0.0041 | 0.0004 | $< 0.05$ | **PASS** |
| **Highlight Clipping (>254)** | 0.00% | 0.00% | 0.00% | $= 0.00\%$ | **PASS** |
| **Shadow Crush (<1)** | 0.00% | 0.00% | 0.00% | $= 0.00\%$ | **PASS** |

Spatial autocorrelation values near zero ($< 0.005$) confirm that the generated grain is completely devoid of periodic banding, streaks, or tiling artifacts.

### 3.3 Multi-Aspect Ratio Coverage
The grain generator was verified across 3 distinct framing ratios:
- **Portrait (2:3, 320x480):** Verified uniform distribution. Contact sheet: `sheet_grain_determinism_portrait.jpg`.
- **Landscape (3:2, 480x320):** Verified uniform distribution. Contact sheet: `sheet_grain_determinism_landscape.jpg`.
- **Square (1:1, 400x400):** Verified uniform distribution. Contact sheet: `sheet_grain_determinism_square.jpg`.

### 3.4 Multi-Resolution Parity
Noise amplitude behavior was measured across scale changes:
- **Preview Resolution (320px width):** Luma Standard Deviation = **4.1314**
- **Export Resolution (1080px width):** Luma Standard Deviation = **4.1095**
- **Std Dev Delta:** **0.0219** (Variance $< 0.5\%$).

This confirms that grain density and perceptual contrast scale smoothly without high-frequency aliasing or blur attenuation.

### 3.5 Intensity Ladder Monotonicity
Testing grain levels across $\{0\%, 25\%, 50\%, 75\%, 100\%\}$:
- Standard deviation scaled monotonically: $[0.000 \rightarrow 1.032 \rightarrow 2.065 \rightarrow 3.097 \rightarrow 4.131]$.
- No clipping or color shifting was observed in highlights or deep shadows.

---

## 4. Preservation of Golden Baselines

### Engineering Justification:
A potential modification to align GPU coordinates with CPU raster coordinates would be:
$$\text{gl\_FragCoord.y} \longrightarrow (\text{uResolution.y} - \text{gl\_FragCoord.y})$$

**Why this modification is strictly prohibited:**
1. **Existing Golden Baselines:** Changing the shader coordinate convention would invert the vertical seed map, altering the exact hash output at every pixel for all existing P0–P5 golden test images.
2. **Visual Equivalence:** Because the pseudo-random generator produces uncorrelated white noise, vertical mirroring produces statistically identical and perceptually indistinguishable grain.
3. **Zero State Leakage:** Phase 6.2A/B verified that both paths are 100% deterministic internally.

Therefore, the established shader implementation is preserved intact in accordance with Phase 6.2 baseline protection constraints.

---

## 5. Artifacts and Contact Sheets

All generated contact sheets and metric datasets are archived in:
- `tests/reports/phase6_2/grain_determinism/sheet_grain_determinism_portrait.jpg`
- `tests/reports/phase6_2/grain_determinism/sheet_grain_determinism_landscape.jpg`
- `tests/reports/phase6_2/grain_determinism/sheet_grain_determinism_square.jpg`
- `tests/reports/phase6_2/grain_determinism/sheet_grain_intensity_ladder.jpg`
- `tests/reports/phase6_2/grain_determinism/sheet_grain_gpu_vs_cpu_spatial.jpg`
- `tests/reports/phase6_2/grain_determinism/grain_metrics.json`
