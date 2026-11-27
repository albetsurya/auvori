# Phase 6.4 Offline-First Application & Local Editing Continuity

## Verified Base

- **Base SHA**: `706a645b1cc2c217eb15919273918d8a9cb183c0`
- **Base Branch**: `main` (merged Phase 6.3)
- **Phase 6.4 Branch**: `feat/phase6.4-offline-first`
- **Verification**: Phase 6.3 commit `beb684d2f490b304c62a0f4be3caa249ba8bed72` confirmed as ancestor of `origin/main`
- **Working Tree**: Clean at branch creation

## Architecture Audit Summary

### Existing PWA & Service Worker
- **Tooling**: `vite-plugin-pwa` v0.20.5 with Workbox `generateSW`
- **Registration**: `autoUpdate` mode
- **Precache**: JS/CSS/HTML/SVG/PNG/WOFF2 (659 KiB, 11 entries)
- **Runtime Caching**: AI models (`auvori-ai-models-v1`) — CacheFirst, 30-day expiry, 24 entries max
- **Manifest**: Valid, `display: standalone`, SVG icon (maskable), theme/background `#F2F2ED`

### Editor State Management
- **In-Memory Only**: `sourceImage`, `history` (EditorSnapshot[]), `manual`, `intensity`, `transform`
- **History**: 100% in-memory, lost on reload
- **Recent Edits**: `localStorage` JSON with data URL thumbnails (~5 MB quota limit)
- **Favorites/Theme/Backdrop**: `localStorage` — survives reload

### AI Models (Adaptive Looks)
| Model | Size | SHA-256 | Cache |
|-------|------|---------|-------|
| YuNet (`yunet-2026may`) | 229 KB | `ebafce4e...` | Cache Storage (`auvori-ai-models-v1`) |
| PP-HumanSeg (`pphumanseg-2023mar`) | 6.16 MB | `552d8a98...` | Cache Storage |
| U²-Netp (`u2netp-v1`) | 4.57 MB | `309c8469...` | Cache Storage |
| ONNX Runtime WASM (SIMD threaded) | 14.8 MB | — | Precached via VitePWA |
| ONNX Runtime JSPI (WebGPU) | 17.9 MB | — | Precached via VitePWA |

- **Loading**: Lazy, on-demand via AI Worker (`ai.worker.ts`)
- **Verification**: SHA-256 enforced before caching
- **Fallback**: Heuristic-only signature fallback when models unavailable

### Rendering & Export
- **Primary**: WebGL2 (`webgl2.renderer.ts`)
- **Fallback**: Worker Canvas2D (`canvas2d.renderer.ts`, `image.worker.ts`)
- **Export**: `exportPhotographBlob` — fully local, no server calls
- **Thumbnail Generation**: Off-main-thread via image worker

### Entitlement & License
- **Storage**: `localStorage` (`auvori_license_v1`)
- **Verification**: Cloudflare Pages Function `/api/license/verify` (POST)
- **Demo Key**: `AUVORI-DEMO` works offline in dev
- **Pro Gating**: Enforced at export & preset selection — no client-side bypass

### Network Dependencies
| Feature | Online Required? | Notes |
|---------|------------------|-------|
| Initial app load | Yes (first visit) | Service worker installs on first load |
| License verification | Yes | POST to `/api/license/verify` |
| Lynk.id checkout | Yes | External payment |
| AI model download | Yes (first use) | Cached afterward in `auvori-ai-models-v1` |
| Studio Sample images | No | Served as static assets from `/public/assets/` |
| Signature Look previews | No | Static WebP assets |
| Collection covers | No | Static WebP assets |
| Photo editing (legacy presets) | No | Fully local |
| Photo export | No | Fully local |
| Recent Edits (localStorage) | No | Local only |

---

## Offline Capability Matrix (Target)

| Feature | Offline Status | Resource Dependency |
|---------|----------------|---------------------|
| App Shell & Navigation | ✅ Fully offline after SW install | Precached bundles |
| Home Screen | ✅ Fully offline | Static assets cached |
| Presets Screen | ✅ Fully offline | Static assets cached |
| Signature Collections | ✅ Fully offline | Collection covers cached |
| Signature Looks (5) | ✅ Fully offline | Preview + source images cached |
| Discover (catalog) | ✅ Fully offline | Local metadata |
| Studio Sample Library | ✅ Fully offline | Thumbs + full images cached |
| Local Photo Import | ✅ Fully offline | File API, no network |
| Legacy Preset Application | ✅ Fully offline | Local rendering |
| Signature Look Application | ✅ Fully offline | Local rendering |
| Intensity Adjustment | ✅ Fully offline | Local state |
| Before/After | ✅ Fully offline | Local render |
| Undo/Redo | ✅ Fully offline | Local history |
| Crop/Rotate/Transform | ✅ Fully offline | Local state |
| Manual Adjustments | ✅ Fully offline | Local state |
| Export (JPEG/PNG) | ✅ Fully offline | Local pipeline |
| Local Project Persistence | 🔄 **To implement** | IndexedDB (new) |
| Session Recovery | 🔄 **To implement** | IndexedDB + autosave |
| Adaptive AI (Direct Flash) | ⚠️ Optional pack | Models + WASM + Worker |
| Adaptive AI (Night Cinema) | ⚠️ Optional pack | Models + WASM + Worker |
| License Verification | ❌ Online only | Server API |
| Pro Purchase | ❌ Online only | Lynk.id |
| Profile Sync | ❌ Online only | Server API |

---

## Implementation Plan

### Stage 0: Baseline Verification ✅ Complete
### Stage 1: Architecture Audit ✅ Complete
### Stage 2: Offline Capability Matrix ✅ Complete (above)
### Stage 3: Service Worker & Cache Enhancement
- Extend precache to cover ALL static assets (studio samples, signature looks, collection covers)
- Add navigation fallback for SPA routes
- Versioned cache names with safe cleanup
### Stage 4: Offline Resource Preparation UI
- Mandatory offline pack (app shell + all static images)
- Optional AI offline pack (models + WASM + worker scripts)
- Progress, verification, storage status
### Stage 5: Local Project Persistence (IndexedDB)
- `LocalProject` schema with image Blob storage
- Autosave with debounce + transaction safety
- Session recovery on reload
- Recent Edits backed by IndexedDB
### Stage 6: Offline Editing Hardening
- Ensure zero network requests during editing
- Verify export pipeline works offline
- Validate Before/After, Undo/Redo, transform
### Stage 7: Adaptive AI Offline Support
- Optional warmup/download UI
- Model verification before offline use
- Honest fallback status when pack missing
### Stage 8: UX & Resource Management
- Connectivity indicator (online/offline/preparing/ready)
- Offline resource manager in Profile/Settings
- Storage quota display
- Safe update lifecycle
### Stage 9: Automated & Browser QA
- All offline scenarios (A–J)
- Regression suite passes
### Stage 10: Security & Independent Review
- No Pro bypass
- No private data cached
- Photo privacy preserved
### Stage 11: Final Readiness Decision

---

## Deliverables

1. `PHASE6_4_REPORT.md` — This file
2. `PHASE6_4_OFFLINE_ARCHITECTURE.md` — SW design, cache strategies, fallback, versioning
3. `PHASE6_4_LOCAL_STORAGE.md` — IndexedDB schema, project persistence, autosave, migration
4. `PHASE6_4_RESOURCE_MANIFEST.md` — Mandatory/optional pack resources, sizes, checksums
5. `PHASE6_4_OFFLINE_QA.md` — Test scenarios A–J with results
6. `PHASE6_4_PERFORMANCE_REPORT.md` — Preparation size, startup, export latency, DB perf
7. `PHASE6_4_SECURITY_REVIEW.md` — API cache policy, entitlement, privacy, model verification
8. Visual evidence in `tests/reports/phase6_4/`
9. Test scripts using existing framework

---

## Known Limitations & Risks

1. **localStorage Recent Edits**: ~5 MB limit — data URL thumbnails consume quota quickly. IndexedDB migration required.
2. **No IndexedDB Yet**: Entire editing history & source images lost on reload. Critical gap.
3. **Service Worker Navigation Fallback**: Not yet configured — direct refresh on routes may 404 offline.
4. **AI Model Size**: ~22 MB total (models + WASM) — optional pack justified.
5. **No Persistent Storage Request**: Browser may evict Cache Storage under pressure.
6. **Cross-Origin Isolation**: Required for WebGPU/JSPI path — not guaranteed on all hosts.
7. **Private Browsing**: Cache Storage may be unavailable or quota severely limited.

---

## Next Steps

Begin Stage 3: Service Worker & Cache Enhancement.