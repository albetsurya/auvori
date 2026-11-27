# Auvori — Phase 6.3 Studio Sample Library Quality Assurance

## 1. Overview
The Studio Sample Library introduces an instant experimentation mechanism for new and returning users. Users can tap "Try a Studio Sample" anywhere in the app and immediately jump into the editing workspace with a high-resolution, CC0-licensed photograph without uploading their own file.

## 2. Sample Assets Audit & Editor Flow

| Sample ID | Title | Scene Category | Suggested Preset | Full Asset Path | Thumb Asset Path | Verified Editor Entry Flow |
|---|---|---|---|---|---|---|
| `real:daylight_portrait` | Daylight Portrait | `portrait` | `rosy-bokeh` | `/assets/studio-samples/sample_daylight_portrait.webp` | `/assets/studio-samples/thumb_daylight_portrait.webp` | Loads 1200×800 image into canvas, selects `rosy-bokeh` at 85% intensity |
| `real:indoor_portrait` | Indoor Portrait | `portrait` | `porcelain-bloom` | `/assets/studio-samples/sample_indoor_portrait.webp` | `/assets/studio-samples/thumb_indoor_portrait.webp` | Loads 799×1200 vertical image into canvas, selects `porcelain-bloom` |
| `real:deep_skin` | Studio Skin Tones | `portrait` | `velvet-merona` | `/assets/studio-samples/sample_deep_skin.webp` | `/assets/studio-samples/thumb_deep_skin.webp` | Loads 1200×800 image into canvas, selects `velvet-merona` |
| `real:cafe_interior` | Café Interior | `interior` | `seoul-cafe` | `/assets/studio-samples/sample_cafe_interior.webp` | `/assets/studio-samples/thumb_cafe_interior.webp` | Loads 1200×800 image into canvas, selects `seoul-cafe` |
| `real:food` | Food Scene | `food` | `warm-latte` | `/assets/studio-samples/sample_food.webp` | `/assets/studio-samples/thumb_food.webp` | Loads 1200×797 image into canvas, selects `warm-latte` |
| `real:night_street` | Night Street | `night` | `midnight-clean` | `/assets/studio-samples/sample_night_street.webp` | `/assets/studio-samples/thumb_night_street.webp` | Loads 1200×960 image into canvas, selects `midnight-clean` |
| `real:neon` | Neon Portrait | `night` | `neon-shibuya` | `/assets/studio-samples/sample_neon.webp` | `/assets/studio-samples/thumb_neon.webp` | Loads 1029×1200 vertical image into canvas, selects `neon-shibuya` |
| `real:analog_scene` | Analog Scene | `film` | `kodak-gold` | `/assets/studio-samples/sample_analog_scene.webp` | `/assets/studio-samples/thumb_analog_scene.webp` | Loads 1200×800 image into canvas, selects `kodak-gold` |
| `real:monochrome` | Monochrome Scene | `landscape` | `mono-leica` | `/assets/studio-samples/sample_monochrome.webp` | `/assets/studio-samples/thumb_monochrome.webp` | Loads 1200×800 image into canvas, selects `mono-leica` |

## 3. Technical Verification & Error Resilience
1. **Single Entry Point Compatibility**: Selection triggers `handleStartWithSample(id, suggestedPresetId)`. For `RealSamplePhotoId`, it resolves the full WebP URL via `getSamplePhotoUrl(id)` and invokes `loadImageIntoEditor()`.
2. **Backward Compatibility**: Legacy sample IDs (`'cafe' | 'park' | 'window'`) continue to work seamlessly via `isRealSampleId()` type guard, returning legacy synthetic canvas data URLs for existing tests and Discover screen presets.
3. **Thumbnail Failure Fallback**: If a thumbnail network request fails, `StudioSampleLibrary` captures the error in local component state (`failedThumbs`) and renders a graceful placeholder tile with an `AlertCircle` icon, the sample title, and the scene category.
4. **Offline Resilience**: As static assets in Vite's public directory, sample assets are precached by the service worker or HTTP cached by Cloudflare Pages, functioning seamlessly in offline mode.
