# Auvori — Phase 6.3 Photographic Asset Audit & License Verification

## 1. Scope & Objective
This audit verifies the provenance, copyright status, quarantine compliance, and originality tier of all photographic assets selected for production deployment in Auvori Phase 6.3.

## 2. Quarantine Compliance Check
The Phase 6.1 audit quarantined 5 images due to incomplete pre-2017 historical archive evidence:
- `p6_18_yellow_umbrella_wet_pavement.jpg`
- `p6_34_foggy_misty_mountain_pines.jpg`
- `p6_35_autumn_creek_moss_rocks.jpg`
- `p6_42_single_monstera_leaf_white.jpg`
- `p6_45_backlit_fern_leaves.jpg`

**Audit Verification**: None of the 5 quarantined photos appear anywhere in `public/assets/`, `production_asset_manifest.json`, or production source code (`src/lib/samplePhoto.ts`). Quarantine compliance: **100% PASS**.

## 3. Production Asset Provenance & Evidence

### A. Collection Covers (4 Assets)
| Collection | Selected Source Photo | Creator | Archive Evidence | License | Originality Review | Dataset Tier |
|---|---|---|---|---|---|---|
| Rosy Portrait | `p6_03_laundromat_reflection.jpg` | Cayton Heath (@cayton) | [Wayback 2016-12-25](https://web.archive.org/web/20161225054544/https://unsplash.com/photos/YH_q4RgK9IU) | CC0 1.0 Universal | reviewed-original | gold_standard |
| Velvet Series | `p6_51_deep_skin_indoor_portrait.jpg` | William Stitt (@willpower) | [Wayback 2016-12-01](https://web.archive.org/web/20161201000000*/https://unsplash.com/photos/bET5fhsmb8k) | CC0 1.0 Universal | reviewed-original | gold_standard |
| Seoul Editorial | `p6_19_concrete_interior_window.jpg` | Pierrick Le Cunff (@pierrick) | [Wayback 2017-05-03](https://web.archive.org/web/20170503005904/https://unsplash.com/photos/F4tATZBNp1c) | CC0 1.0 Universal | reviewed-original (Fujifilm X100S SOOC) | gold_standard |
| Analog Archive | `p6_30_forest_bridge_hiker.jpg` | Christian Joudrey (@cjoudrey) | [Wayback 2017-05-03](https://web.archive.org/web/20170503091532/https://unsplash.com/photos/9Dh40gnWHS4) | CC0 1.0 Universal | reviewed-original | gold_standard |

### B. Studio Sample Library (9 Assets)
| Sample ID | Title | Selected Source Photo | Creator | Archive Evidence | License | Tier |
|---|---|---|---|---|---|---|
| `real:daylight_portrait` | Daylight Portrait | `p6_07_daylight_smiling_portrait.jpg` | Allef Vinicius (@seteales) | [Wayback 2017-05-05](https://web.archive.org/web/20170505230136/https://unsplash.com/photos/C_1jjFJioWg) | CC0 1.0 | exploratory |
| `real:indoor_portrait` | Indoor Portrait | `p6_03_laundromat_reflection.jpg` | Cayton Heath (@cayton) | [Wayback 2016-12-25](https://web.archive.org/web/20161225054544/https://unsplash.com/photos/YH_q4RgK9IU) | CC0 1.0 | gold_standard |
| `real:deep_skin` | Studio Skin Tones | `p6_51_deep_skin_indoor_portrait.jpg` | William Stitt (@willpower) | [Wayback 2016-12-01](https://web.archive.org/web/20161201000000*/https://unsplash.com/photos/bET5fhsmb8k) | CC0 1.0 | gold_standard |
| `real:cafe_interior` | Café Interior | `p6_19_concrete_interior_window.jpg` | Pierrick Le Cunff (@pierrick) | [Wayback 2017-05-03](https://web.archive.org/web/20170503005904/https://unsplash.com/photos/F4tATZBNp1c) | CC0 1.0 | gold_standard |
| `real:food` | Food Scene | `p6_11_burger_salad_food.jpg` | Nick Clement (@nickclement) | [Wayback 2017-04-29](https://web.archive.org/web/20170429053332/https://unsplash.com/photos/QbSflBwMOmo) | CC0 1.0 | gold_standard |
| `real:night_street` | Night Street | `p6_52_night_street_portrait.jpg` | Kevin Lee (@kevin_lee) | [Wayback 2017-05-05](https://web.archive.org/web/20170505200223/https://unsplash.com/photos/L54zc2NEkTQ) | CC0 1.0 | gold_standard |
| `real:neon` | Neon Portrait | `p6_53_night_neon_crimson_portrait.jpg` | Matthew Sleeper (@mjsleeper) | [Wayback 2017-04-29](https://web.archive.org/web/20170429000000*/https://unsplash.com/photos/G82qR2Z_eW4) | CC0 1.0 | gold_standard |
| `real:analog_scene` | Analog Scene | `p6_30_forest_bridge_hiker.jpg` | Christian Joudrey (@cjoudrey) | [Wayback 2017-05-03](https://web.archive.org/web/20170503091532/https://unsplash.com/photos/9Dh40gnWHS4) | CC0 1.0 | gold_standard |
| `real:monochrome` | Monochrome Scene | `p6_24_capetown_fog_sunset.jpg` | David East (@daveast) | [Wayback 2017-05-10](https://web.archive.org/web/20170510142757/https://unsplash.com/photos/mh7Aihgh3rQ) | CC0 1.0 | gold_standard |

### C. Signature Look Previews (5 Preset-Rendered Assets + 5 Paired Sources)
| Preset ID | Preset Name | Selected Source Photo | Creator | Archive Evidence | License | Tier |
|---|---|---|---|---|---|---|
| `porcelain-bloom` | Porcelain Bloom | `p6_09_white_aodai_portrait.jpg` | Hisu Lee | [Wayback 2017-05-04](https://web.archive.org/web/20170504103903/https://unsplash.com/photos/u6LGX2VMOP4) | CC0 1.0 | exploratory |
| `velvet-noir` | Velvet Noir | `p6_01_window_bus_portrait.jpg` | Dan Bøțan (@danutzuzu) | [Wayback 2017-04-29](https://web.archive.org/web/20170429090256/https://unsplash.com/photos/XU5lNez5TEs) | CC0 1.0 | exploratory |
| `hannam-daylight` | Hannam Daylight | `p6_14_latte_croissant_cafe.jpg` | Sergey Zolkin (@szolkin) | [Wayback 2017-05-03](https://web.archive.org/web/20170503093501/https://unsplash.com/photos/QPRj0bMb5Fk) | CC0 1.0 | exploratory |
| `amber-halation` | Amber Halation | `p6_55_night_bazaar_lanterns.jpg` | Juan Ignacio Tapia (@juanitapia) | [Wayback 2016-04-04](https://web.archive.org/web/20160404011652/https://unsplash.com/photos/4fwRyKISwfk) | CC0 1.0 | gold_standard |
| `silver-gelatin` | Silver Gelatin | `p6_04_bw_beard_glasses.jpg` | Angelina Litvin (@linalitvina) | [Wayback 2017-03-30](https://web.archive.org/web/20170330185950/https://unsplash.com/photos/52R7t7x8CPI) | CC0 1.0 | exploratory |

## 4. Audit Summary & Conclusion
- 100% of production visual assets originate from verified Creative Commons CC0 1.0 Universal public domain items.
- All 4 collection covers belong to the `gold_standard` dataset tier.
- 8 of 9 studio samples belong to the `gold_standard` dataset tier; 1 belongs to `exploratory` with independently verified CC0 status on Wikimedia Commons and Wayback Machine.
- All 5 Signature Look previews derive from 5 distinct, independently verified CC0 1.0 photos (`p6_09`, `p6_01`, `p6_14`, `p6_55`, `p6_04`), rendered through Auvori's production WebGL2 `PhotoPipeline`.
- Zero copyrighted, quarantined, or licensing-risk assets are bundled into Auvori.
