# PHASE6_1_PRESET_INVENTORY.md
# Auvori — Authoritative Preset & Look Catalog Inventory

**Branch:** `feat/phase6.1-audit-integrity-hardening`
**Source of Truth:** `src/data/presets.ts`
**Audit Date:** `2026-11-27`

---

## 1. Authoritative Breakdown

Direct inspection of `PRESETS` in `src/data/presets.ts` confirms **27 total catalog entries** (**26 active presets/looks** + **1 `original` no-effect mode**):

| Catalog Group | Count | `recipeVersion` | `lookType` in Code | Entitlement | Notes |
|---|---:|---|---|---|---|
| Original / No-Effect Mode | 1 | `undefined` | `'essential'` | Free | `id: 'original'`, name `'Asli'` |
| Legacy Presets — Free Essential | 6 | `1` | `'essential'` | Free | `rosy-bokeh`..`midnight-clean` (includes `fuji-soft` w/ grain=10) |
| Legacy Presets — Pro Baseline | 13 | `1` | `'signature'` | Pro | `velvet-merona`..`cinematic-teal` (13 P0 Pro looks) |
| **Subtotal: Legacy Active Looks** | **19** | `1` | — | 6 Free / 13 Pro | Together with `original` (1), makes the 20 P0 catalog items |
| Signature Looks (P1) | 5 | `2` | `'signature'` | Pro | `porcelain-bloom`, `velvet-noir`, `hannam-daylight`, `amber-halation`, `silver-gelatin` |
| Adaptive Looks (P4/P5) | 2 | `3` | `'adaptive'` | Pro | `direct-flash` (P4), `night-cinema` (P5) |
| **Total `PRESETS` Array Entries** | **27** | — | — | **7 Free / 20 Pro** | **26 active looks + 1 Original mode** |

### Why Previous Phase 6 Reports Had Inconsistent Counts

1. **Code taxonomy vs. phase labels:** In `src/data/presets.ts`, `original` + 6 Free presets use `lookType: 'essential'`, while the 13 P0 Pro presets (`recipeVersion: 1`) AND the 5 P1 Signature Looks (`recipeVersion: 2`) share `lookType: 'signature'`. None of them use `lookType: 'legacy'`.
2. **Bug in `tests/run_p6_visual_quality_tests.py`:** Phase 6 filtered `(!p.lookType || p.lookType === 'legacy')`, yielding **0 legacy presets** on `sheet_01a` and `sheet_01b`, while lumping all 18 `lookType === 'signature'` items onto `sheet_02`.
3. **Inconsistent descriptions in `PHASE6_VISUAL_AUDIT.md`:** Phase 6 docs stated "20 legacy + 5 signature + 1 direct-flash adaptive = 26" (forgetting Night Cinema in the sum while listing it elsewhere), and Section 4 invented/misnamed presets not present in `src/data/presets.ts` (*Golden Desert*, *Low Light Street*, *Lunar Chrome*, *Analog Haze*, *Analog Archive* as a preset instead of a collection).

---

## 2. Complete Source-of-Truth Catalog (`src/data/presets.ts`)

| # | ID | Name | Group | Category | Collection | Entitlement | `lookType` | `recipeVersion` | Grain | Bloom | Halation | Status |
|---:|---|---|---|---|---|---|---|---|---:|---:|---:|---|
| 01 | `original` | Asli | Original / No-Effect Mode | `cafe` | `—` | Free | `essential` | — | 0 | 0 | 0 | Active |
| 02 | `rosy-bokeh` | Rosy Bokeh | Legacy Preset (P0) | `portrait` | `rosy-portrait` | Free | `essential` | 1 | 0 | 0 | 0 | Active |
| 03 | `seoul-cafe` | Seoul Café | Legacy Preset (P0) | `cafe` | `seoul-editorial` | Free | `essential` | 1 | 0 | 0 | 0 | Active |
| 04 | `clean-day` | Clean Day | Legacy Preset (P0) | `korean` | `seoul-editorial` | Free | `essential` | 1 | 0 | 0 | 0 | Active |
| 05 | `warm-latte` | Warm Latte | Legacy Preset (P0) | `cafe` | `—` | Free | `essential` | 1 | 0 | 0 | 0 | Active |
| 06 | `fuji-soft` | Fuji Soft | Legacy Preset (P0) | `film` | `analog-archive` | Free | `essential` | 1 | 10 | 0 | 0 | Active |
| 07 | `midnight-clean` | City Dusk | Legacy Preset (P0) | `night` | `—` | Free | `essential` | 1 | 0 | 0 | 0 | Active |
| 08 | `velvet-merona` | Velvet Merona | Legacy Preset (P0) | `portrait` | `velvet-series` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 09 | `gangnam-glass` | Gangnam Glass | Legacy Preset (P0) | `korean` | `seoul-editorial` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 10 | `tokyo-milk` | Tokyo Milk | Legacy Preset (P0) | `korean` | `seoul-editorial` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 11 | `busan-breeze` | Busan Breeze | Legacy Preset (P0) | `korean` | `seoul-editorial` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 12 | `matcha-house` | Matcha House | Legacy Preset (P0) | `cafe` | `—` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 13 | `espresso-crisp` | Espresso Crisp | Legacy Preset (P0) | `cafe` | `velvet-series` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 14 | `brunch-glow` | Brunch Glow | Legacy Preset (P0) | `cafe` | `—` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 15 | `classic-chrome` | Classic Chrome | Legacy Preset (P0) | `film` | `analog-archive` | Pro | `signature` | 1 | 14 | 0 | 0 | Active |
| 16 | `kodak-gold` | Kodak Gold | Legacy Preset (P0) | `film` | `analog-archive` | Pro | `signature` | 1 | 16 | 0 | 0 | Active |
| 17 | `portra-400` | Portra Skin | Legacy Preset (P0) | `film` | `analog-archive` | Pro | `signature` | 1 | 11 | 0 | 0 | Active |
| 18 | `mono-leica` | Leica Mono | Legacy Preset (P0) | `film` | `analog-archive` | Pro | `signature` | 1 | 18 | 0 | 0 | Active |
| 19 | `neon-shibuya` | Neon Shibuya | Legacy Preset (P0) | `night` | `—` | Pro | `signature` | 1 | 0 | 0 | 0 | Active |
| 20 | `cinematic-teal` | Teal & Amber | Legacy Preset (P0) | `night` | `—` | Pro | `signature` | 1 | 9 | 0 | 0 | Active |
| 21 | `porcelain-bloom` | Porcelain Bloom | Signature Look (P1) | `portrait` | `rosy-portrait` | Pro | `signature` | 2 | 0 | 22 | 0 | Active |
| 22 | `velvet-noir` | Velvet Noir | Signature Look (P1) | `portrait` | `velvet-series` | Pro | `signature` | 2 | 8 | 12 | 0 | Active |
| 23 | `hannam-daylight` | Hannam Daylight | Signature Look (P1) | `korean` | `seoul-editorial` | Pro | `signature` | 2 | 0 | 14 | 0 | Active |
| 24 | `amber-halation` | Amber Halation | Signature Look (P1) | `film` | `analog-archive` | Pro | `signature` | 2 | 15 | 16 | 28 | Active |
| 25 | `silver-gelatin` | Silver Gelatin | Signature Look (P1) | `film` | `analog-archive` | Pro | `signature` | 2 | 14 | 18 | 0 | Active |
| 26 | `direct-flash` | Direct Flash | Adaptive Look (P4/P5) | `portrait` | `direct-flash` | Pro | `adaptive` | 3 | 5 | 8 | 0 | Active |
| 27 | `night-cinema` | Night Cinema | Adaptive Look (P4/P5) | `night` | `night-cinema` | Pro | `adaptive` | 3 | 0 | 12 | 7 | Active |

---

## 3. Auxiliary Catalog Structures in `src/data/presets.ts`

- `PRESET_CATEGORIES`: **8** filter tabs (`all`, `free`, `favorites`, `portrait`, `cafe`, `korean`, `film`, `night`).
- `SIGNATURE_COLLECTIONS`: **4** collections (`rosy-portrait`, `velvet-series`, `seoul-editorial`, `analog-archive`).
- `EDITORIAL_COLLECTIONS`: **4** editorial collections (`col-portrait`, `col-velvet`, `col-korean`, `col-film`).
- `DISCOVER_STORIES`: **3** stories (`story-rosy`, `story-cafe`, `story-film`).
