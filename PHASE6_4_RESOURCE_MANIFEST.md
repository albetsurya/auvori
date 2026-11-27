# Phase 6.4 Resource Manifest

## Mandatory Offline Pack

**Target**: Auto-prepare on first online visit or user action "Prepare for Offline"

**Total Size**: ~2.4 MB

### App Shell (Precache — `auvori-app-shell-v<BUILD_HASH>`)

| Resource | Size (gz) | Size (raw) | Cache Strategy |
|----------|-----------|------------|----------------|
| `index.html` | 0.59 KB | 1.16 KB | Precached |
| `assets/index-<hash>.css` | 7.67 KB | 40.36 KB | Precached |
| `assets/index-<hash>.js` | 112.17 KB | 387.70 KB | Precached |
| `assets/ai.worker-<hash>.js` | — | 20.89 KB | Precached |
| `assets/image.worker-<hash>.js` | — | 25.82 KB | Precached |
| `assets/ort.wasm.bundle.min-<hash>.js` | — | 77.34 KB | Precached |
| `assets/ort.jspi.bundle.min-<hash>.js` | — | 121.23 KB | Precached |
| `assets/ort-wasm-simd-threaded-<hash>.wasm` | — | 14.85 MB | Precached |
| `assets/ort-wasm-simd-threaded.jspi-<hash>.wasm` | — | 17.92 MB | Precached |
| `manifest.webmanifest` | — | 0.42 KB | Precached |
| `registerSW.js` | — | 0.13 KB | Precached |
| `icon.svg` | — | ~2 KB | Precached |

**Precache Total**: ~33.5 MB raw (32.8 MB is ONNX Runtime WASM bundles)

> **Note**: ONNX Runtime bundles are large but required for AI inference. They are precached by VitePWA because they're in the build output. The actual AI models (.onnx) are separate.

### Static Images (Runtime Cache — `auvori-static-assets-v<BUILD_HASH>`)

#### Collection Covers (4 files)
| Path | Size | SHA-256 |
|------|------|---------|
| `/assets/collections/cover_rosy_portrait.webp` | 26,354 B | `a1b2c3...` |
| `/assets/collections/cover_velvet_series.webp` | 48,418 B | `d4e5f6...` |
| `/assets/collections/cover_seoul_editorial.webp` | 20,202 B | `789abc...` |
| `/assets/collections/cover_analog_archive.webp` | 81,390 B | `def012...` |

**Subtotal**: 176,364 B (~172 KB)

#### Signature Look Previews (5 files)
| Path | Size | SHA-256 |
|------|------|---------|
| `/assets/signature-looks/look_porcelain_bloom.webp` | 24,672 B | `...` |
| `/assets/signature-looks/look_velvet_noir.webp` | 19,950 B | `...` |
| `/assets/signature-looks/look_hannam_daylight.webp` | 39,016 B | `...` |
| `/assets/signature-looks/look_amber_halation.webp` | 63,572 B | `...` |
| `/assets/signature-looks/look_silver_gelatin.webp` | 54,890 B | `...` |

**Subtotal**: 202,100 B (~197 KB)

#### Signature Look Sources (5 files)
| Path | Size | SHA-256 |
|------|------|---------|
| `/assets/signature-looks/source_porcelain_bloom.webp` | 69,292 B | `...` |
| `/assets/signature-looks/source_velvet_noir.webp` | 104,584 B | `...` |
| `/assets/signature-looks/source_hannam_daylight.webp` | 89,392 B | `...` |
| `/assets/signature-looks/source_amber_halation.webp` | 96,650 B | `...` |
| `/assets/signature-looks/source_silver_gelatin.webp` | 65,382 B | `...` |

**Subtotal**: 425,300 B (~415 KB)

#### Studio Sample Thumbnails (10 files)
| Path | Size | SHA-256 |
|------|------|---------|
| `/assets/studio-samples/thumb_daylight_portrait.webp` | 18,768 B | `...` |
| `/assets/studio-samples/thumb_indoor_portrait.webp` | 16,454 B | `...` |
| `/assets/studio-samples/thumb_deep_skin.webp` | 23,168 B | `...` |
| `/assets/studio-samples/thumb_cafe_interior.webp` | 6,810 B | `...` |
| `/assets/studio-samples/thumb_food.webp` | 30,732 B | `...` |
| `/assets/studio-samples/thumb_night_street.webp` | 16,612 B | `...` |
| `/assets/studio-samples/thumb_neon.webp` | 20,594 B | `...` |
| `/assets/studio-samples/thumb_analog_scene.webp` | 28,038 B | `...` |
| `/assets/studio-samples/thumb_monochrome.webp` | 5,622 B | `...` |

**Subtotal**: 166,798 B (~163 KB)

#### Studio Sample Full Images (10 files)
| Path | Size | SHA-256 |
|------|------|---------|
| `/assets/studio-samples/sample_daylight_portrait.webp` | 85,510 B | `...` |
| `/assets/studio-samples/sample_indoor_portrait.webp` | 62,048 B | `...` |
| `/assets/studio-samples/sample_deep_skin.webp` | 92,354 B | `...` |
| `/assets/studio-samples/sample_cafe_interior.webp` | 51,302 B | `...` |
| `/assets/studio-samples/sample_food.webp` | 112,394 B | `...` |
| `/assets/studio-samples/sample_night_street.webp` | 81,138 B | `...` |
| `/assets/studio-samples/sample_neon.webp` | 112,474 B | `...` |
| `/assets/studio-samples/sample_analog_scene.webp` | 166,002 B | `...` |
| `/assets/studio-samples/sample_monochrome.webp` | 58,500 B | `...` |

**Subtotal**: 821,722 B (~802 KB)

### Static Images Total
- **Thumbnails + Full**: ~1.7 MB
- **All Static Assets**: ~1.7 MB

---

## Optional AI Offline Pack

**Target**: User-initiated download from Resource Manager

### AI Models (Cache Storage — `auvori-ai-models-v1`)

| Model | File | Size | SHA-256 |
|-------|------|------|---------|
| YuNet | `/models/face_detection_yunet_2026may.onnx` | 229,738 B | `ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0` |
| PP-HumanSeg | `/models/human_segmentation_pphumanseg_2023mar.onnx` | 6,163,938 B | `552d8a984054e59b5d773d24b9b12022b22046ceb2bbc4c9aaeaceb36a9ddf24` |
| U²-Netp | `/models/u2netp.onnx` | 4,574,861 B | `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` |

**Models Total**: ~10.97 MB

### ONNX Runtime (Precache — already in app shell)

| Bundle | Size |
|--------|------|
| `ort-wasm-simd-threaded.wasm` | 14.85 MB |
| `ort-wasm-simd-threaded.jspi.wasm` | 17.92 MB |
| JS glue (`ort.wasm.bundle.min.js` + `ort.jspi.bundle.min.js`) | ~200 KB |

**Runtime Total**: ~32.9 MB (both WASM variants precached)

> **Optimization**: Only download the WASM variant needed for the user's browser. Detect WebGPU+JSPI support first.

### AI Worker Script
| Resource | Size |
|----------|------|
| `ai.worker-<hash>.js` | ~21 KB (already precached) |

### AI Pack Download Size Scenarios

| Scenario | Models | Runtime | Total |
|----------|--------|---------|-------|
| WebGPU+JSPI supported | 11 MB | 18 MB (JSPI WASM) | ~29 MB |
| WASM only (fallback) | 11 MB | 15 MB (SIMD threaded) | ~26 MB |
| Models already cached | 0 MB | 0 MB | 0 MB |

---

## Storage Estimates

### Cache Storage
| Cache | Est. Size | Persistent? |
|-------|-----------|-------------|
| `auvori-app-shell-v<hash>` | 33.5 MB | Best-effort |
| `auvori-static-assets-v<hash>` | 1.7 MB | Best-effort |
| `auvori-ai-models-v1` | 11 MB | Best-effort |
| **Total (mandatory)** | **35.2 MB** | — |
| **Total (with AI pack)** | **~46–64 MB** | — |

### IndexedDB (User Projects)
| Item | Est. Size |
|------|-----------|
| Project metadata | ~2 KB each |
| Source image (JPEG 12MP) | 3–8 MB each |
| History (50 snapshots) | ~10 KB |
| **Per project** | **3–8 MB** |

### Quota Guidance
- **Typical quota**: 50–80% of free disk space (Chrome), ~1-2 GB (Safari)
- **Persistent storage**: Up to full quota if granted
- **Best-effort**: Evicted under pressure

---

## Checksums (Production)

All checksums verified at build time via `public/assets/attribution/production_asset_manifest.json`.

### Static Assets (from manifest)
```json
{
  "version": "6.3",
  "assets": {
    "collections/cover_rosy_portrait.webp": "sha256:...",
    "collections/cover_velvet_series.webp": "sha256:...",
    "collections/cover_seoul_editorial.webp": "sha256:...",
    "collections/cover_analog_archive.webp": "sha256:...",
    "signature-looks/look_porcelain_bloom.webp": "sha256:...",
    "signature-looks/look_velvet_noir.webp": "sha256:...",
    "signature-looks/look_hannam_daylight.webp": "sha256:...",
    "signature-looks/look_amber_halation.webp": "sha256:...",
    "signature-looks/look_silver_gelatin.webp": "sha256:...",
    "signature-looks/source_porcelain_bloom.webp": "sha256:...",
    "signature-looks/source_velvet_noir.webp": "sha256:...",
    "signature-looks/source_hannam_daylight.webp": "sha256:...",
    "signature-looks/source_amber_halation.webp": "sha256:...",
    "signature-looks/source_silver_gelatin.webp": "sha256:...",
    "studio-samples/sample_daylight_portrait.webp": "sha256:...",
    "studio-samples/sample_indoor_portrait.webp": "sha256:...",
    "studio-samples/sample_deep_skin.webp": "sha256:...",
    "studio-samples/sample_cafe_interior.webp": "sha256:...",
    "studio-samples/sample_food.webp": "sha256:...",
    "studio-samples/sample_night_street.webp": "sha256:...",
    "studio-samples/sample_neon.webp": "sha256:...",
    "studio-samples/sample_analog_scene.webp": "sha256:...",
    "studio-samples/sample_monochrome.webp": "sha256:...",
    "studio-samples/thumb_daylight_portrait.webp": "sha256:...",
    "studio-samples/thumb_indoor_portrait.webp": "sha256:...",
    "studio-samples/thumb_deep_skin.webp": "sha256:...",
    "studio-samples/thumb_cafe_interior.webp": "sha256:...",
    "studio-samples/thumb_food.webp": "sha256:...",
    "studio-samples/thumb_night_street.webp": "sha256:...",
    "studio-samples/thumb_neon.webp": "sha256:...",
    "studio-samples/thumb_analog_scene.webp": "sha256:...",
    "studio-samples/thumb_monochrome.webp": "sha256:..."
  }
}
```

### AI Models (from `ai-models.ts`)
```typescript
'yunet-2026may': {
  sha256: 'ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0',
  fileSizeBytes: 229738
},
'pphumanseg-2023mar': {
  sha256: '552d8a984054e59b5d773d24b9b12022b22046ceb2bbc4c9aaeaceb36a9ddf24',
  fileSizeBytes: 6163938
},
'u2netp-v1': {
  sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
  fileSizeBytes: 4574861
}
```

---

## Installation Status Tracking

Persisted in IndexedDB `offlineState` store:

```typescript
{
  key: 'mandatoryPack',
  mandatoryPack: {
    status: 'ready',
    progress: 100,
    totalBytes: 35200000,
    completedBytes: 35200000,
    lastUpdated: '2026-11-27T...',
    error: undefined
  },
  aiPack: {
    status: 'not-downloaded',
    progress: 0,
    totalBytes: 29000000,
    completedBytes: 0,
    lastUpdated: '2026-11-27T...',
    error: undefined,
    modelVersions: {}
  },
  storage: {
    estimate: { usage: 42000000, quota: 1500000000 },
    persistent: true,
    lastChecked: '2026-11-27T...'
  }
}
```

---

## Download Priority

1. **Mandatory Pack** (auto, background):
   - App shell (Workbox precache)
   - Static images (runtime cache, parallel)
2. **AI Pack** (user-initiated):
   - Models first (smallest to largest: YuNet → U²-Netp → PP-HumanSeg)
   - Runtime WASM variant (detected per browser)
   - Warmup verification

---

## Verification Checklist

- [ ] All mandatory resources cached after "Prepare for Offline"
- [ ] SHA-256 matches for every static asset
- [ ] SHA-256 matches for every AI model
- [ ] Navigation fallback works offline
- [ ] AI pack downloads and verifies
- [ ] Warmup succeeds on cached models
- [ ] Storage estimate updates
- [ ] Persistent storage requested
- [ ] Old caches cleaned on SW update
- [ ] IndexedDB never touched by SW cleanup