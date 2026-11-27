# Auvori Phase 6.2 — Preset Inventory & Catalog Reconciliation

**Document Version:** 1.0  
**Phase:** Phase 6.2 — Rendering Determinism & Dataset Expansion  
**Source of Truth:** [`src/data/presets.ts`](file:///home/albet-surya-kembara/Documents/productivity/projects/auvori-app/src/data/presets.ts)  
**Status:** Approved & Reconciled  

---

## 1. Executive Summary & Inventory Reconciliation

This document provides the canonical, code-verified inventory of all presets, looks, and catalog entries in Auvori (Neutral Analog Studio).

### Canonical Totals

| Classification | Count | Details |
|---|:---:|---|
| **Total Catalog Entries** | **27** | All items defined in `PRESETS` array in `src/data/presets.ts` |
| **Active Stylized Looks** | **26** | Stylized looks applied to photographs (`original` excluded) |
| **Neutral Mode** | **1** | Passthrough look `original` ("Asli") with neutral baseline values |
| **Legacy Presets** | **19** | P0 base editorial presets (6 Free, 13 Pro) |
| **Signature Looks** | **5** | P1/P2 curated signature looks with tone curve & optical bloom/halation |
| **Adaptive Relighting Looks** | **2** | P4 Direct Flash & P5 Night Cinema with computer vision relighting |
| **Free Entitlement** | **7** | `original` (neutral) + 6 Free Legacy Presets |
| **Pro Entitlement** | **20** | 13 Pro Legacy + 5 Signature Looks + 2 Adaptive Looks |

---

## 2. Historical Discrepancy Resolution

### The "20 Legacy Presets" Ambiguity Explained

In earlier project documentation (Phases 0 through 5), reports intermittently referenced **"20 Legacy Presets"** while later audit documents (Phase 6 and 6.1) reported **"19 Legacy Presets"** and **"26 Active Looks"**.

1. **Initial Repository State (Commit `699e7bd`):**
   The `PRESETS` array originally contained exactly **20 entries**:
   - 1 neutral passthrough look: `original` ("Asli")
   - 19 stylized looks: `rosy-bokeh`, `seoul-cafe`, `clean-day`, `warm-latte`, `fuji-soft`, `midnight-clean`, `velvet-merona`, `gangnam-glass`, `tokyo-milk`, `busan-breeze`, `matcha-house`, `espresso-crisp`, `brunch-glow`, `classic-chrome`, `kodak-gold`, `portra-400`, `mono-leica`, `neon-shibuya`, and `cinematic-teal`.

2. **Root Cause of Ambiguity:**
   Early design documentation informally referred to the entire 20-item array as "20 presets". Because `original` does not apply any tone curves, color transformations, or visual grading, counting it as a "preset" created confusion when testing visual intensity ladders and presets.

3. **Definitive Reconciled Formula:**
   $$\text{Total Catalog Entries (27)} = 1 \text{ Original (Neutral)} + 19 \text{ Legacy} + 5 \text{ Signature} + 2 \text{ Adaptive}$$
   $$\text{Total Active Stylized Looks (26)} = 19 \text{ Legacy} + 5 \text{ Signature} + 2 \text{ Adaptive}$$
   $$\text{Total Free Items (7)} = 1 \text{ Original (Neutral)} + 6 \text{ Free Legacy}$$
   $$\text{Total Pro Items (20)} = 13 \text{ Pro Legacy} + 5 \text{ Signature} + 2 \text{ Adaptive}$$

No presets were deleted, renamed, or modified. The discrepancy was purely terminological.

---

## 3. Complete Preset Inventory Table

| ID | Name | Recipe Ver. | Type | Category | Collection | Entitlement | Runtime Registration | Active Status |
|---|---|:---:|---|---|---|:---:|:---:|:---:|
| `original` | Asli | v1.0 | Original | Café | None | None (Free) | Registered | Neutral (Passthrough) |
| `rosy-bokeh` | Rosy Bokeh | v1.0 | Legacy | Portrait | Rosy Portrait | Free | Registered | Active |
| `seoul-cafe` | Seoul Café | v1.0 | Legacy | Café | None | Free | Registered | Active |
| `clean-day` | Clean Day | v1.0 | Legacy | Korean | None | Free | Registered | Active |
| `warm-latte` | Warm Latte | v1.0 | Legacy | Café | None | Free | Registered | Active |
| `fuji-soft` | Fuji Soft | v1.0 | Legacy | Film | None | Free | Registered | Active |
| `midnight-clean` | City Dusk | v1.0 | Legacy | Night | None | Free | Registered | Active |
| `velvet-merona` | Velvet Merona | v1.0 | Legacy | Portrait | Velvet Series | Pro | Registered | Active |
| `gangnam-glass` | Gangnam Glass | v1.0 | Legacy | Korean | Seoul Editorial | Pro | Registered | Active |
| `tokyo-milk` | Tokyo Milk | v1.0 | Legacy | Korean | None | Pro | Registered | Active |
| `busan-breeze` | Busan Breeze | v1.0 | Legacy | Korean | None | Pro | Registered | Active |
| `matcha-house` | Matcha House | v1.0 | Legacy | Café | None | Pro | Registered | Active |
| `espresso-crisp` | Espresso Crisp | v1.0 | Legacy | Café | None | Pro | Registered | Active |
| `brunch-glow` | Brunch Glow | v1.0 | Legacy | Café | None | Pro | Registered | Active |
| `classic-chrome` | Classic Chrome | v1.0 | Legacy | Film | Analog Archive | Pro | Registered | Active |
| `kodak-gold` | Kodak Gold | v1.0 | Legacy | Film | None | Pro | Registered | Active |
| `portra-400` | Portra Skin | v1.0 | Legacy | Film | None | Pro | Registered | Active |
| `mono-leica` | Leica Mono | v1.0 | Legacy | Film | None | Pro | Registered | Active |
| `neon-shibuya` | Neon Shibuya | v1.0 | Legacy | Night | None | Pro | Registered | Active |
| `cinematic-teal` | Teal & Amber | v1.0 | Legacy | Night | None | Pro | Registered | Active |
| `porcelain-bloom` | Porcelain Bloom | v2.0 | Signature | Portrait | Rosy Portrait | Pro | Registered | Active |
| `velvet-noir` | Velvet Noir | v2.0 | Signature | Portrait | Velvet Series | Pro | Registered | Active |
| `hannam-daylight` | Hannam Daylight | v2.0 | Signature | Korean | Seoul Editorial | Pro | Registered | Active |
| `amber-halation` | Amber Halation | v2.0 | Signature | Film | Analog Archive | Pro | Registered | Active |
| `silver-gelatin` | Silver Gelatin | v2.0 | Signature | Film | None | Pro | Registered | Active |
| `direct-flash` | Direct Flash | v3.0 | Adaptive | Portrait | None | Pro | Registered | Active |
| `night-cinema` | Night Cinema | v3.0 | Adaptive | Night | None | Pro | Registered | Active |

---

## 4. UI Drawer & Screen Availability

1. **PresetsScreen (`src/components/PresetsScreen.tsx`):**
   - Displays all 27 entries organized by category filters (`all`, `free`, `portrait`, `cafe`, `korean`, `film`, `night`, `favorites`).
   - Free presets (6 looks + original) are freely accessible; Pro presets show badge and lock status when unauthenticated.

2. **PresetDrawer (`src/components/PresetDrawer.tsx`):**
   - Renders editorial collections (`Rosy Portrait`, `Velvet Series`, `Seoul Editorial`, `Analog Archive`) alongside single preset carousels.
   - All 26 active looks and `original` passthrough are wired to real-time WebGL2 / Canvas2D rendering.
