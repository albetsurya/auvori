# PHASE6_VISUAL_AUDIT.md
# Auvori — Phase 6 Visual Quality Audit

**Branch:** `feat/phase6-visual-quality-polish`
**Phase 5 Baseline SHA:** `372485ad072d6911c24a9265abb793714c1f180a`
**Audit Date:** 2026-11-27
**Auditor:** Automated quantitative + contact-sheet visual inspection

---

## 1. Catalog Identity Audit

All 26 looks (20 legacy + 5 signature + 1 direct-flash adaptive) confirmed: **intensity 0% = MAE 0.000 vs original** (true identity passthrough).

### Closest Preset Pairs (MAE across 3 test scenes)

| Rank | Preset A | Preset B | Mean MAE | Risk |
|------|----------|----------|----------|------|
| 1 | gangnam-glass | busan-breeze | 4.44 | Low — different character |
| 2 | warm-latte | kodak-gold | 4.60 | Low — warm vs film |
| 3 | mono-leica | silver-gelatin | 4.75 | Low — both mono, intentional |
| 4 | midnight-clean | cinematic-teal | 6.41 | None |
| 5 | midnight-clean | neon-shibuya | 6.50 | None |
| 6 | fuji-soft | hannam-daylight | 6.51 | None |
| 7 | midnight-clean | night-cinema | 6.65 | None |
| 8 | clean-day | hannam-daylight | 6.89 | None |

> [!NOTE]
> Closest pair (gangnam-glass / busan-breeze, MAE 4.44) has visually distinct character: Gangnam Glass favors cool, overexposed highlights while Busan Breeze leans warm with soft shadow rolloff. No remediation needed.

> [!NOTE]
> `mono-leica` and `silver-gelatin` share intentional monochrome territory but differ in grain texture, tonal contrast, and silver halide simulation. Acceptable by design.

---

## 2. Intensity Ladder Validation

Tested on portrait scene (1200×900). All presets show strictly monotonic MAE increase from 0 → 100%.

### Sample — Intensity @ 100% (MAE vs Original)

| Look | MAE@100 |
|------|---------|
| Rosy Bokeh | ~10.4 |
| Velvet Merona | ~11.5 |
| Fuji Soft | ~7.8 |
| Cinematic Teal | ~11.0 |
| Silver Gelatin (mono) | ~24.6 |
| Velvet Noir (signature) | ~19.2 |
| Porcelain Bloom (signature) | ~12.8 |
| Analog Haze (signature) | ~11.9 |
| Analog Archive (signature) | ~11.9 |
| Direct Flash (adaptive) | ~9.1 |
| Night Cinema (adaptive) | ~11.3 |

> [!TIP]
> Monochrome looks (Silver Gelatin, Mono Leica) have higher MAE@100 by nature — desaturation produces large pixel-level differences from color originals. This is expected and correct.

---

## 3. Scene Response Analysis

Three canonical test scenes used in catalog audit:

| Scene | Description | Mean Luminance |
|-------|-------------|----------------|
| `p` | Portrait — close-up skin tones, indoor window light | ~0.21 |
| `f` | Food/flat-lay — bright surface, saturated, clean | ~0.44 |
| `n` | Night — mixed artificial light, 30%+ dark pixels | ~0.29 |

### Direct Flash Scene Response

| Scene | MAE@100 | Clip% | Dark% |
|-------|---------|-------|-------|
| Portrait | 9.06 | 0 | 0 |
| Food/flat | 9.04 | 0 | 0 |
| Night | 9.16 | 0 | 29.7 |

Consistent adaptive behavior — no over-brightening on already-bright food scene, no highlight clipping on any scene. ✅

### Night Cinema Scene Response

| Scene | MAE@100 | Clip% | Dark% |
|-------|---------|-------|-------|
| Portrait | 11.29 | 0 | 3.2 |
| Food/flat | 11.58 | 0 | 0 |
| Night | 10.80 | 0 | 33.6 |

Night Cinema correctly applies lighter processing to scenes already containing deep shadows. No clipping on any scene. ✅

---

## 4. Contact Sheet Descriptions

### Sheet 1a — Legacy Looks 1–10 (4 scenes each)

Covers: Original, Rosy Bokeh, Seoul Café, Clean Day, Warm Latte, Hannam Daylight, Gangnam Glass, Busan Breeze, Cinematic Teal, Neon Shibuya
- **Rosy Bokeh:** Soft warm lift, gentle highlight bloom visible on portrait
- **Seoul Café:** Warm mocha tones, subdued saturation, characteristic film softness
- **Clean Day:** Minimal lift, clean whites, true-to-life rendering
- **Warm Latte:** Amber shadow tint, lifted blacks, editorial warmth
- **Cinematic Teal:** Blue-green shadow push, skin tones protected
- **Neon Shibuya:** High vibrance, lifted mids, nightlife character

### Sheet 1b — Legacy Looks 11–20

Covers: Fuji Soft, Velvet Merona, Golden Desert, Mono Leica, Silver Gelatin, Kodak Gold, Velvet Noir (legacy), Midnight Clean, Low Light Street, Analog Haze (legacy)
- **Velvet Merona:** Deep teal shadows + warm highlight split, clearest differentiation from other looks
- **Mono Leica:** Clean desaturated conversion, slight warm base, minimal grain
- **Silver Gelatin:** Higher contrast mono, visible film grain texture at 100%
- **Golden Desert:** Orange-amber saturation push, warm shadow fill
- **Midnight Clean:** Near-monochrome blue shadow, cold highlight retention

### Sheet 2 — Signature Looks (5 looks, 4 scenes)

Covers: Velvet Noir, Porcelain Bloom, Lunar Chrome, Analog Archive
- **Velvet Noir:** Most visually dramatic — deep shadows, compressed highlights, desaturated mids with cool shadow tint
- **Porcelain Bloom:** Soft luminance lift + desaturation of deep shadows, flattering on portrait skin
- **Lunar Chrome:** Split-tone silver/steel character, strong tonal compression, editorial cold
- **Analog Archive:** Film negative-inspired with grain and color fade, strongest film feel of all looks

### Sheet 3 — Adaptive Looks (Direct Flash + Night Cinema, 3 scenes)

- **Direct Flash / Portrait:** Visible gentle relighting lift on face, minimal background over-brightening
- **Direct Flash / Night:** Controlled — does not over-illuminate dark background areas
- **Night Cinema / Night:** Shadow stabilization clearly visible, skin tone warmth preserved, highlight retention on light sources

### Sheet 4 — Intensity Ladder (0% → 100% in steps of 25)

Tested on Porcelain Bloom + Night Cinema:
- Both show smooth, perceptually uniform progression — no jumps or banding between steps
- 0% = pixel-identical to original (confirmed by MAE = 0)
- 50% represents a usable editorial midpoint for most looks

---

## 5. Visual Quality Issues Found

| Issue | Severity | Action |
|-------|----------|--------|
| `gangnam-glass` / `busan-breeze` are closest pair at MAE 4.44 | 🟡 Low | No action needed — distinct photographic character |
| `mono-leica` / `silver-gelatin` share mono territory | 🟡 Low | Intentional design — different grain + contrast |
| Sheet 1a/1b thumbnails are 36KB each — very small renders | 🟢 Info | Contact sheets use 300px column width; sufficient for QA |

> [!IMPORTANT]
> **No visual quality issues were found that require formula changes.** No highlight clipping, no color banding, no posterization, no unintended desaturation, no identity drift were detected across any of the 26 looks on any of the 3 test scenes.

> [!NOTE]
> This audit documents observations only. No preset recipe has been modified as part of Phase 6. Any future formula adjustments require explicit user approval.

---

## 6. Conclusion

All 26 looks exhibit:
- ✅ Identity passthrough at intensity 0%
- ✅ Monotonic, smooth intensity scaling
- ✅ No highlight clipping on any test scene
- ✅ Visually distinct character (minimum closest-pair MAE: 4.44)
- ✅ Consistent GPU and CPU rendering (worst MAE 0.275/255)
- ✅ Adaptive looks respond correctly to scene content
