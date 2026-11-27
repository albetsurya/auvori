# Auvori — Phase 6.3 Production Visual Asset Catalog

This catalog enumerates all visual assets bundled into `public/assets/` for Phase 6.3 production deployment.

## 1. Signature Collection Covers (`public/assets/collections/`)

| Filename | Dimensions | Aspect Ratio | Byte Size | SHA-256 Hash | Source Photograph | Focal Point / Treatment |
|---|---|---|---|---|---|---|
| `cover_rosy_portrait.webp` | 800×640 | 5:4 | 26,354 B (25.7 KB) | `a6741d5cd3585c0539685ee86f39969ec9e9c4b230902ee1a7e22a8c1f9eb5ae` | `p6_03_laundromat_reflection.jpg` | `50% 30%` (Face & reflection) |
| `cover_velvet_series.webp` | 800×640 | 5:4 | 48,418 B (47.3 KB) | `e4db48b31de55068fca363e0be3d2f2c0dc529bc0508498466e5d0f8ecb7bc25` | `p6_51_deep_skin_indoor_portrait.jpg` | `50% 25%` (Deep skin tones) |
| `cover_seoul_editorial.webp` | 800×640 | 5:4 | 20,202 B (19.7 KB) | `c83bc849059b5d9716ebfe088af43db9b12e28a1d54c0b2fcdfa51376e4314bc` | `p6_19_concrete_interior_window.jpg` | `50% 50%` (Architectural window) |
| `cover_analog_archive.webp` | 800×640 | 5:4 | 81,390 B (79.5 KB) | `702b32e8fdc1d2d70e6194a298496cf958a6d3748e18dc50f55c27d595d83604` | `p6_30_forest_bridge_hiker.jpg` | `50% 50%` (Bridge & misty forest) |

**Total Collection Covers Size**: 176,364 B (~172.2 KB)

---

## 2. Studio Sample Library (`public/assets/studio-samples/`)

### Full Resolution (Max Dimension ≤ 1200 px)
| Sample ID | Filename | Dimensions | Byte Size | SHA-256 Hash | Suggested Preset |
|---|---|---|---|---|---|
| `real:daylight_portrait` | `sample_daylight_portrait.webp` | 1200×800 | 85,510 B (83.5 KB) | `a268c73e6e080e38e71c045f42087549873371d4eb5bf97c9d4ded1d1b09ec4f` | `rosy-bokeh` |
| `real:indoor_portrait` | `sample_indoor_portrait.webp` | 799×1200 | 62,048 B (60.6 KB) | `d36b8edc9143bfb3d61fd317104ea578b8877227191332400a18d833096d9f0f` | `porcelain-bloom` |
| `real:deep_skin` | `sample_deep_skin.webp` | 1200×800 | 92,354 B (90.2 KB) | `f22a15aaf0a267f5e1e2c0d5487f4e85cfb545786d469baedc51fdd17926eaea` | `velvet-merona` |
| `real:cafe_interior` | `sample_cafe_interior.webp` | 1200×800 | 51,302 B (50.1 KB) | `e41874b8a82264ef5dcd91745397bbd128a1f91da995fa988ce0f82670c9af37` | `seoul-cafe` |
| `real:food` | `sample_food.webp` | 1200×797 | 112,394 B (109.8 KB) | `1a22a999b8349dd009bc546aa693d20347105f8166e0c986da9c3768c772b5c2` | `warm-latte` |
| `real:night_street` | `sample_night_street.webp` | 1200×960 | 81,138 B (79.2 KB) | `af0a65328e4cd25fc003ddc52422bd19621e056f75a9185fd55624bbc75d7339` | `midnight-clean` |
| `real:neon` | `sample_neon.webp` | 1029×1200 | 112,474 B (109.8 KB) | `83f46a25c75f266b8efb1ad6e0af345fcb73c8f62ce1c93b46845fbc82674015` | `neon-shibuya` |
| `real:analog_scene` | `sample_analog_scene.webp` | 1200×800 | 166,002 B (162.1 KB) | `dff4695b56c0811416fad84b100bd4b7ef0f397d1b22c08502bc744405f224f3` | `kodak-gold` |
| `real:monochrome` | `sample_monochrome.webp` | 1200×800 | 58,500 B (57.1 KB) | `cd095fd15b8eff878ef6f0b0d8bef4024fc57f3f4e34f727f20e1690268a16ac` | `mono-leica` |

**Total Full Sample Payload**: 821,722 B (~802.5 KB)

### Optimized Thumbnails (Target 400×500)
| Sample ID | Filename | Dimensions | Byte Size | SHA-256 Hash |
|---|---|---|---|---|
| `real:daylight_portrait` | `thumb_daylight_portrait.webp` | 400×267 | 18,768 B (18.3 KB) | `ade5b5098a314328212bb646f245722f6cfb7ad9b0852a8846c57c0066221b7a` |
| `real:indoor_portrait` | `thumb_indoor_portrait.webp` | 333×500 | 16,454 B (16.1 KB) | `e49a0050ff424c6d5a2211e8feedac0cf3a08ace8a6f8f8c5a3679bacacc2f2c` |
| `real:deep_skin` | `thumb_deep_skin.webp` | 400×267 | 23,168 B (22.6 KB) | `16c2a5368037a25beb6fb7a5817bc1f0ff7a510923e810aea49f31e1c2b6af72` |
| `real:cafe_interior` | `thumb_cafe_interior.webp` | 400×267 | 6,810 B (6.7 KB) | `3f709af6ae61a4416bac3f76422221c319077402aabb1a518c4b789323dd4c8c` |
| `real:food` | `thumb_food.webp` | 400×266 | 30,732 B (30.0 KB) | `7b2da288435cd10295aa7e10fdf5b0024caade912f5739a7c1cc113032b997e0` |
| `real:night_street` | `thumb_night_street.webp` | 400×320 | 16,612 B (16.2 KB) | `2a31d3f17d34d33ef78b11e410b6ad08a5d777f07591ce34b49dc1b824cea6bd` |
| `real:neon` | `thumb_neon.webp` | 343×500 | 20,594 B (20.1 KB) | `a99203ba79626a2ed5ecd27508e856c0c1d087b5428bde38c63e4858b643b1ec` |
| `real:analog_scene` | `thumb_analog_scene.webp` | 400×267 | 28,038 B (27.4 KB) | `7a407f2d55e1c80e1784767402b81930f6b4709c3135a6cbcde7169f2964d30e` |
| `real:monochrome` | `thumb_monochrome.webp` | 400×267 | 5,622 B (5.5 KB) | `cf28e04ee827c0592a9fe427e9daaa1a6591d6b95bf06cd251061ba6c8a530cb` |

**Total Thumbnails Payload**: 166,798 B (~162.9 KB)

---

## 3. Signature Looks Preset-Rendered Previews (`public/assets/signature-looks/`)

### Preset-Rendered Card Previews (`PhotoPipeline.renderPreview` WebGL2, Intensity 100%, Grain Enabled)
| Preset ID | Filename | Dimensions | Byte Size | SHA-256 Hash | Source Photo | Focal Point |
|---|---|---|---|---|---|---|
| `porcelain-bloom` | `look_porcelain_bloom.webp` | 480×720 | 24,672 B (24.1 KB) | `6bc9275d6f91e3127fe04b9b367f884315dacdef8ed0c59b8d1e3b42ab962717` | `p6_09_white_aodai_portrait.jpg` | `50% 25%` |
| `velvet-noir` | `look_velvet_noir.webp` | 480×720 | 19,950 B (19.5 KB) | `b61a35f7088a77286ae901403d49566f9ffd48132a52698f18b976929d111212` | `p6_01_window_bus_portrait.jpg` | `50% 35%` |
| `hannam-daylight` | `look_hannam_daylight.webp` | 720×540 | 39,016 B (38.1 KB) | `584a84e75d205d9e7da8903eeb693d46bcb0c0fc5f8c82f5586c9df1c5b9ec34` | `p6_14_latte_croissant_cafe.jpg` | `50% 50%` |
| `amber-halation` | `look_amber_halation.webp` | 720×480 | 63,572 B (62.1 KB) | `2592c119e43fbfbc90854788b398df3f09f49e5afe64c4cd43bb7ee36b947fcd` | `p6_55_night_bazaar_lanterns.jpg` | `55% 50%` |
| `silver-gelatin` | `look_silver_gelatin.webp` | 480×720 | 54,890 B (53.6 KB) | `6e02b720dfe75dae8b65d732cda0122f3871a7e5631c09fc5a87a75210590cf6` | `p6_04_bw_beard_glasses.jpg` | `50% 25%` |

**Total Signature Look Previews Payload**: 202,100 B (~197.4 KB)

### Paired Unedited Source Assets (for Before/After Comparison & Editor Launch, Max 1200 px)
| Preset ID | Filename | Dimensions | Byte Size | SHA-256 Hash |
|---|---|---|---|---|
| `porcelain-bloom` | `source_porcelain_bloom.webp` | 800×1200 | 69,292 B (67.7 KB) | `2ad3dab7e768b8cf480cdb4d2fef9c0aeb696fcd8986ba11fcc69787a00555e1` |
| `velvet-noir` | `source_velvet_noir.webp` | 800×1200 | 104,584 B (102.1 KB) | `4beafe0dfa9aaed94244849df2c1bdb6c49ea1f49ac9bd40134abea0bf369d8a` |
| `hannam-daylight` | `source_hannam_daylight.webp` | 1200×900 | 89,392 B (87.3 KB) | `3c835c4287a4fadc094100b5c4ce86e58e61abb38a2c8d2843a3d1616b59b462` |
| `amber-halation` | `source_amber_halation.webp` | 1200×800 | 96,650 B (94.4 KB) | `5d6148db0ebc669d277c7f7481589a6a4a1753d46e085a50534e799deb5ae53b` |
| `silver-gelatin` | `source_silver_gelatin.webp` | 800×1200 | 65,382 B (63.8 KB) | `34f0370158b31ea00d1390d440c1d36c5a0149d65dde2a94a11ba3603c8b55b6` |

**Total Signature Look Sources Payload**: 425,300 B (~415.3 KB)

---

## 4. Storage & Transmission Efficiency Summary
- **Initial Home Load Cost**: Loading the 4 Signature Collection covers (~172.2 KB) plus the 5 Signature Look previews (~197.4 KB) transfers ~369.6 KB total (with `loading="lazy"` and `decoding="async"`).
- **Studio Sample Library Load Cost**: Opening `StudioSampleLibrary` transfers ~162.9 KB for all 9 thumbnails.
- **Total Static Visual Footprint Added**: ~1.75 MB across all 32 production assets (4 collection covers + 9 sample fulls + 9 sample thumbs + 5 Signature Look previews + 5 Signature Look sources).
