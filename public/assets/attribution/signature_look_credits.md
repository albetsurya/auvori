# Auvori — Signature Looks Preview Photo Credits & License Manifest

All source photographs used to generate Auvori's Signature Look previews are authentic, license-verified under **Creative Commons CC0 1.0 Universal Public Domain Dedication**, and processed through Auvori's production WebGL2 `PhotoPipeline` engine at 100% preset recipe intensity.

## Signature Looks (5 Preset-Rendered Photographic Previews)

| Preset ID | Preset Name | Preview Asset Path | Source Photograph | Creator | License | Verification Archive | Renderer & Intensity |
|---|---|---|---|---|---|---|---|
| `porcelain-bloom` | Porcelain Bloom | `/assets/signature-looks/look_porcelain_bloom.webp` | `p6_09_white_aodai_portrait.jpg` | Hisu Lee | CC0 1.0 Universal | [Wayback Proof 2017-05-04](https://web.archive.org/web/20170504103903/https://unsplash.com/photos/u6LGX2VMOP4) | `PhotoPipeline.renderPreview` (`webgl2`), intensity 100%, grain enabled |
| `velvet-noir` | Velvet Noir | `/assets/signature-looks/look_velvet_noir.webp` | `p6_01_window_bus_portrait.jpg` | Dan Bøțan (`@danutzuzu`) | CC0 1.0 Universal | [Wayback Proof 2017-04-29](https://web.archive.org/web/20170429090256/https://unsplash.com/photos/XU5lNez5TEs) | `PhotoPipeline.renderPreview` (`webgl2`), intensity 100%, grain enabled |
| `hannam-daylight` | Hannam Daylight | `/assets/signature-looks/look_hannam_daylight.webp` | `p6_14_latte_croissant_cafe.jpg` | Sergey Zolkin (`@szolkin`) | CC0 1.0 Universal | [Wayback Proof 2017-05-03](https://web.archive.org/web/20170503093501/https://unsplash.com/photos/QPRj0bMb5Fk) | `PhotoPipeline.renderPreview` (`webgl2`), intensity 100%, grain enabled |
| `amber-halation` | Amber Halation | `/assets/signature-looks/look_amber_halation.webp` | `p6_55_night_bazaar_lanterns.jpg` | Juan Ignacio Tapia (`@juanitapia`) | CC0 1.0 Universal | [Wayback Proof 2016-04-04](https://web.archive.org/web/20160404011652/https://unsplash.com/photos/4fwRyKISwfk) | `PhotoPipeline.renderPreview` (`webgl2`), intensity 100%, grain enabled |
| `silver-gelatin` | Silver Gelatin | `/assets/signature-looks/look_silver_gelatin.webp` | `p6_04_bw_beard_glasses.jpg` | Angelina Litvin (`@linalitvina`) | CC0 1.0 Universal | [Wayback Proof 2017-03-30](https://web.archive.org/web/20170330185950/https://unsplash.com/photos/52R7t7x8CPI) | `PhotoPipeline.renderPreview` (`webgl2`), intensity 100%, grain enabled |

## Implementation Notes
- Each Signature Look preview (`look_*.webp`) is generated directly by Auvori's production `PhotoPipeline` (`WebGL2Renderer`) using the untouched preset recipe from `src/data/presets.ts` at 100% intensity with deterministic grain enabled.
- Unedited source WebP counterparts (`source_*.webp`, max 1200 px) are stored alongside the rendered previews for Before/After comparison and direct "Try in Editor" loading.
- Zero pending-review (`p6_18`, `p6_34`, `p6_35`, `p6_42`, `p6_45`) or test-fixture paths are used in production.
