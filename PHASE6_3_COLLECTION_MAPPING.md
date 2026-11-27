# Auvori — Phase 6.3 Signature Collection Showcase Mapping

## 1. Overview
Auvori features 4 curated Signature Collections designed to convey specific photographic aesthetics. In Phase 6.3, the placeholder canvas illustrations were retired, and each collection was assigned an authentic CC0 photograph that embodies its aesthetic identity.

## 2. Collection Showcase Mapping Table

| Collection ID | Title | Presets Count | Presets List | Assigned Cover Asset | Source Photo | Aesthetic Direction & Rationale |
|---|---|---|---|---|---|---|
| `rosy-portrait` | Rosy Portrait | 2 | `rosy-bokeh`, `porcelain-bloom` | `/assets/collections/cover_rosy_portrait.webp` | `p6_03_laundromat_reflection.jpg` | Luminous skin highlights, soft highlight roll-off, and gentle optical reflection. Features Cayton Heath's portrait of a woman reflected in a window. |
| `velvet-series` | Velvet Series | 3 | `velvet-merona`, `espresso-crisp`, `velvet-noir` | `/assets/collections/cover_velvet_series.webp` | `p6_51_deep_skin_indoor_portrait.jpg` | Rich tonal contrast, sculpted darks, and restrained saturation. Features William Stitt's indoor portrait highlighting deep, warm skin tones. |
| `seoul-editorial` | Seoul Editorial | 6 | `seoul-cafe`, `clean-day`, `gangnam-glass`, `tokyo-milk`, `busan-breeze`, `hannam-daylight` | `/assets/collections/cover_seoul_editorial.webp` | `p6_19_concrete_interior_window.jpg` | Neutral indoor highlights, tamed warm casts, and crisp architectural glass shadows. Features Pierrick Le Cunff's minimalist concrete interior shot. |
| `analog-archive` | Analog Archive | 7 | `fuji-soft`, `classic-chrome`, `kodak-gold`, `portra-400`, `mono-leica`, `amber-halation`, `silver-gelatin` | `/assets/collections/cover_analog_archive.webp` | `p6_30_forest_bridge_hiker.jpg` | Classic film curves, organic grain, and muted greenery. Features Christian Joudrey's atmospheric shot of a hiker on a steel suspension bridge surrounded by deep evergreen forest. |

## 3. Member Count Verification
The member count displayed on each collection card is computed dynamically at runtime in `HomeScreen.tsx`:
```tsx
const memberCount = PRESETS.filter((p) => p.collectionId === col.id).length;
```
- Rosy Portrait: 2 presets
- Velvet Series: 3 presets
- Seoul Editorial: 6 presets
- Analog Archive: 7 presets
Total presets covered: 18 presets (all 18 presets in these collections are verified in `src/data/presets.ts`).

## 4. UI Rendering Behavior
- **Aspect Ratio**: Cards maintain `aspect-[5/4]` containment.
- **Object Fit**: `object-cover w-full h-full`.
- **Focal Alignment**: Portrait collections (`rosy-portrait`, `velvet-series`) utilize `objectPosition: '50% 30%'` / `'50% 25%'` to maintain optimal facial framing across mobile and desktop viewports.
- **Card Selection**: Tapping a collection card navigates directly to `PresetsScreen` filtered by that collection.

## 5. Companion Signature Looks Preview Mapping
While Signature Collections represent the 4 curated collection groupings, the Home Screen also showcases all 5 individual P1 Signature Looks (`porcelain-bloom`, `velvet-noir`, `hannam-daylight`, `amber-halation`, `silver-gelatin`). Each Signature Look card uses its own distinct, WebGL2 preset-rendered photographic preview in `/assets/signature-looks/` — documented in [PHASE6_3_SIGNATURE_LOOKS_QA.md](./PHASE6_3_SIGNATURE_LOOKS_QA.md).
