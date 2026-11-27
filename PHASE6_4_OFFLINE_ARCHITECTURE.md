# Phase 6.4 Offline Architecture

## Service Worker Design

### Tooling
- **Generator**: `vite-plugin-pwa` v0.20.5 → Workbox `generateSW`
- **Output**: `dist/sw.js` + `dist/workbox-<hash>.js`
- **Registration**: `registerType: 'autoUpdate'` (client-side auto-update with user prompt)

### Cache Versioning Strategy

| Cache Name | Purpose | Versioning | Cleanup Trigger |
|------------|---------|------------|-----------------|
| `auvori-app-shell-v<BUILD_HASH>` | Precached app shell (HTML, JS, CSS, fonts, icons) | Build hash from Vite manifest | New SW activation |
| `auvori-static-assets-v<BUILD_HASH>` | Production images (studio samples, signature looks, collection covers) | Build hash | New SW activation |
| `auvori-ai-models-v1` | AI model files (.onnx, .wasm, .mjs, .bin, .json) | Fixed v1 (models pinned by manifest) | Manual or version bump |
| `auvori-runtime-v1` | ONNX Runtime WASM/JSPI bundles | Fixed v1 | New SW activation |

**Rule**: Never mix incompatible JS/CSS versions. Each deployment gets unique cache names via build hash. Old caches deleted only after new SW activates successfully.

### Precaching (App Shell)

**Strategy**: `precacheManifest` from Workbox — all Vite build outputs with content hashes.

**Included**:
- `index.html`
- All `assets/index-<hash>.js` / `index-<hash>.css`
- `assets/ai.worker-<hash>.js`
- `assets/image.worker-<hash>.js`
- `assets/ort-wasm-<hash>.js` / `ort-wasm-simd-threaded-<hash>.wasm`
- `assets/ort.jspi-<hash>.js` / `ort-wasm-simd-threaded.jspi-<hash>.wasm`
- `manifest.webmanifest`
- `icon.svg`
- `registerSW.js`

**Excluded**: Development HMR, WebSocket, sourcemaps.

### Static Asset Caching (Production Images)

**Strategy**: Separate cache `auvori-static-assets-v<BUILD_HASH>` with `CacheFirst`.

**Resources** (Phase 6.3 assets):
```
/assets/collections/cover_rosy_portrait.webp          (26 KB)
/assets/collections/cover_velvet_series.webp          (48 KB)
/assets/collections/cover_seoul_editorial.webp        (20 KB)
/assets/collections/cover_analog_archive.webp         (81 KB)
/assets/signature-looks/look_porcelain_bloom.webp     (25 KB)
/assets/signature-looks/look_velvet_noir.webp         (20 KB)
/assets/signature-looks/look_hannam_daylight.webp     (39 KB)
/assets/signature-looks/look_amber_halation.webp      (64 KB)
/assets/signature-looks/look_silver_gelatin.webp      (55 KB)
/assets/signature-looks/source_porcelain_bloom.webp   (69 KB)
/assets/signature-looks/source_velvet_noir.webp       (105 KB)
/assets/signature-looks/source_hannam_daylight.webp   (89 KB)
/assets/signature-looks/source_amber_halation.webp    (97 KB)
/assets/signature-looks/source_silver_gelatin.webp    (65 KB)
/assets/studio-samples/sample_daylight_portrait.webp  (86 KB)
/assets/studio-samples/sample_indoor_portrait.webp    (62 KB)
/assets/studio-samples/sample_deep_skin.webp          (92 KB)
/assets/studio-samples/sample_cafe_interior.webp      (51 KB)
/assets/studio-samples/sample_food.webp               (112 KB)
/assets/studio-samples/sample_night_street.webp       (81 KB)
/assets/studio-samples/sample_neon.webp               (112 KB)
/assets/studio-samples/sample_analog_scene.webp       (166 KB)
/assets/studio-samples/sample_monochrome.webp         (59 KB)
/assets/studio-samples/thumb_daylight_portrait.webp   (19 KB)
/assets/studio-samples/thumb_indoor_portrait.webp     (16 KB)
/assets/studio-samples/thumb_deep_skin.webp           (23 KB)
/assets/studio-samples/thumb_cafe_interior.webp       (7 KB)
/assets/studio-samples/thumb_food.webp                (31 KB)
/assets/studio-samples/thumb_night_street.webp        (17 KB)
/assets/studio-samples/thumb_neon.webp                (21 KB)
/assets/studio-samples/thumb_analog_scene.webp        (28 KB)
/assets/studio-samples/thumb_monochrome.webp          (6 KB)
```

**Total**: ~1.7 MB (thumbnails + full images)

**Cache Strategy**: `CacheFirst` — serve from cache, update in background. No expiration (static content).

### AI Model Caching

**Cache**: `auvori-ai-models-v1` (existing, managed by `ai-models.ts`)

**Strategy**: `CacheFirst` with SHA-256 verification on every read.

**Resources**:
```
/models/face_detection_yunet_2026may.onnx             (230 KB)
/models/human_segmentation_pphumanseg_2023mar.onnx    (6.2 MB)
/models/u2netp.onnx                                   (4.6 MB)
```

**Verification**: `ai-models.ts:verifyModelBytes()` — size + SHA-256 match required before use.

**Warmup**: Optional via `WARMUP_MODELS` worker message.

### Navigation Fallback (SPA)

**Problem**: Direct refresh on `/presets`, `/discover`, `/profile`, `/editor` routes returns 404 offline.

**Solution**: Workbox `NavigationRoute` with `NetworkOnly` fallback to cached `index.html`.

```typescript
// vite.config.ts → workbox config
navigateFallback: '/index.html',
navigateFallbackDenylist: [
  /^\/api\//,
  /^\/models\//,
  /^\/assets\//,
  /\.webmanifest$/,
  /\.svg$/,
  /\.(?:js|css|png|woff2)$/
]
```

**Behavior**:
1. Navigation request → try network
2. If offline/fails → serve cached `index.html`
3. Client-side router handles route
4. Static asset requests → their own cache strategies (never get `index.html`)

### Service Worker Lifecycle

```
install → precache (app-shell + static-assets)
  ↓ success
activate → delete old caches (auvori-app-shell-v*, auvori-static-assets-v*)
  ↓ success
control → SW controls pages
  ↓ update found
waiting → new SW waits
  ↓ user accepts / skipWaiting
activate new → old caches cleaned
  ↓
clientsClaim → new SW takes control
```

**Update UX**: `autoUpdate` shows toast "Update available — tap to refresh" via `workbox-window` events.

**Safety**: Never `skipWaiting()` during active editing. `clientsClaim()` only after user confirms or safe idle.

### Cache Cleanup Rules

1. **Scope**: Only caches prefixed `auvori-`
2. **Preserve**: `auvori-ai-models-v1` (expensive to re-download)
3. **Preserve**: IndexedDB `auvori-projects` (user data — never touched by SW)
4. **Delete**: Old `auvori-app-shell-v*` and `auvori-static-assets-v*` after new activation

### Offline Request Handling Matrix

| Request Type | Strategy | Fallback |
|--------------|----------|----------|
| `GET /` (navigation) | NetworkFirst → cached index.html | Cached index.html |
| `GET /assets/*.js|css` | CacheFirst (precache) | — |
| `GET /assets/*.wasm|onnx` | CacheFirst (precache/ai-models) | — |
| `GET /assets/images/*` | CacheFirst (static-assets) | — |
| `GET /models/*.onnx` | CacheFirst (ai-models) + verify | — |
| `POST /api/license/verify` | NetworkOnly | Fail with message |
| `POST /api/checkout` | NetworkOnly | Fail with message |
| `GET /api/*` (private) | NetworkOnly | Fail with message |
| Other `GET` | NetworkFirst | Cached index.html (navigation) |

---

## Offline Resource Packs

### Mandatory Offline Pack (Auto-prepare)

**Trigger**: First online visit after SW install, or user action "Prepare for Offline"

**Contents**:
1. App shell (precache manifest)
2. All static images (studio samples, signature looks, collection covers)
3. Manifest + icons

**Size**: ~2.4 MB (app shell 0.66 MB + static images 1.7 MB)

**Verification**: All resources present in their respective caches after preparation.

### Optional AI Offline Pack (User-initiated)

**Trigger**: User taps "Download AI Models for Offline Use" in Resource Manager

**Contents**:
1. 3 ONNX models (~11 MB)
2. ONNX Runtime WASM SIMD threaded (~14.8 MB)
3. ONNX Runtime JSPI (~17.9 MB) — only if WebGPU+JSPI supported
3. AI worker script (`ai.worker-<hash>.js`)

**Size**: ~26–44 MB depending on WebGPU support

**Verification**: Each model SHA-256 verified after download. `WARMUP_MODELS` test run.

**Status States**:
- `not-downloaded` → `downloading` → `verifying` → `ready` | `failed`
- Persisted in IndexedDB `auvori-offline-state`

---

## IndexedDB Integration (Local Projects)

**Database**: `auvori-projects` (v1)

**Object Stores**:
| Store | Key | Indexes |
|-------|-----|---------|
| `projects` | `id` (string) | `updatedAt`, `sourceHash` |
| `images` | `id` (string) | `projectId` |
| `history` | `id` (auto-increment) | `projectId`, `timestamp` |
| `offlineState` | `key` (string) | — |

**Project Schema**:
```typescript
interface LocalProject {
  id: string;                    // uuid
  name: string;                  // user-editable
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
  sourceImageId: string;         // ref to images store
  sourceWidth: number;
  sourceHeight: number;
  sourceOrientation: number;     // EXIF orientation
  sourceMimeType: string;
  activePresetId: string;
  intensity: number;
  manual: ManualAdjustments;
  transform: ImageTransform;
  historyLength: number;         // number of history entries
  exportCount: number;
  schemaVersion: 1;
}
```

**Image Schema**:
```typescript
interface LocalImage {
  id: string;                    // uuid
  projectId: string;
  blob: Blob;                    // original photo
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  contentHash: string;           // SHA-256 for dedup
  createdAt: string;
}
```

**History Schema**:
```typescript
interface LocalHistoryEntry {
  id: number;                    // auto-increment
  projectId: string;
  snapshot: EditorSnapshot;      // presetId, intensity, manual, transform
  timestamp: string;
  schemaVersion: 1;
}
```

**Offline State Schema**:
```typescript
interface OfflineState {
  key: string;                   // 'mandatoryPack' | 'aiPack' | 'storage'
  mandatoryPack: {
    status: 'pending' | 'downloading' | 'verifying' | 'ready' | 'failed';
    progress: number;            // 0–100
    totalBytes: number;
    completedBytes: number;
    lastUpdated: string;
    error?: string;
  };
  aiPack: {
    status: 'not-downloaded' | 'downloading' | 'verifying' | 'warming-up' | 'ready' | 'failed';
    progress: number;
    totalBytes: number;
    completedBytes: number;
    lastUpdated: string;
    error?: string;
    modelVersions: Record<string, string>;
  };
  storage: {
    estimate: { usage: number; quota: number } | null;
    persistent: boolean;
    lastChecked: string;
  };
}
```

---

## Autosave Design

### Triggers
- Preset change
- Intensity change (debounced 800ms)
- Manual adjustment change (debounced 800ms)
- Transform change (crop/rotate/flip)
- Export success
- Before unload (best-effort)

### Debounce Strategy
```typescript
// Per-field debounce, coalesced into single transaction
const AUTOSAVE_DEBOUNCE_MS = 800;
const AUTOSAVE_MAX_DELAY_MS = 5000; // force save after max delay
```

### Transaction Safety
1. Read current project
2. Create updated project object
3. Write in single transaction: `projects.put()` + `images.put()` (if new source) + `history.clear()` + `history.add()` × N
4. On success: update `updatedAt`, set `hasUnsavedChanges = false`
5. On quota error: show "Storage full — delete old projects" toast, preserve existing
6. On other error: keep `hasUnsavedChanges = true`, retry on next trigger

### Recovery on Load
1. Open IndexedDB
2. Load most recent project (`updatedAt` descending)
3. If exists: load source Blob → `createObjectURL` → `Image` → restore editor state
4. Restore history stack, set `historyIndex`
5. Set `hasUnsavedChanges = false`
6. If no project: start fresh

---

## Connectivity & Offline Status

### Detection Layers (Defense in Depth)

1. **`navigator.onLine`**: Hint only — fires on network interface change, not reachability
2. **Service Worker `controller.state`**: `'controlling'` = SW active
3. **Cache Availability**: Check `caches.match('/index.html')` for app shell
4. **Probe Request**: Lightweight `GET /api/health` (or `favicon.ico`) with 3s timeout
5. **User Action Failure**: Treat failed fetch as offline signal

### Status States

| State | Criteria | UI |
|-------|----------|----|
| `online` | Probe succeeds + `navigator.onLine` | "Auvori is online" |
| `offline` | Probe fails OR `navigator.onLine === false` | "You're offline. Editing available on this device." |
| `preparing` | Mandatory pack download in progress | "Preparing Auvori for offline use… X%" |
| `ready` | Mandatory pack verified in caches | "Auvori is ready to work offline" |
| `incomplete` | SW installed but mandatory pack missing | "Offline resources incomplete — tap to prepare" |
| `storage-unavailable` | `caches` or `indexedDB` denied | "Offline storage unavailable — data won't persist" |
| `update-available` | New SW waiting | "Update available — tap to refresh" |

---

## Update & Data Safety

### Update Flow
1. New SW detected (`controllerchange` or `workbox-window` event)
2. If editor has unsaved changes → defer `skipWaiting()`, show "Update ready — will apply after save"
3. If idle → `skipWaiting()` + `clientsClaim()` → reload
4. On reload: new SW active, old caches cleaned, IndexedDB preserved

### Data Safety Guarantees
- IndexedDB `auvori-projects` **never** deleted by SW cache cleanup
- `Clear Cache` action only removes SW caches, not IndexedDB
- User must explicitly confirm project deletion
- Active project cannot be deleted while editor open

---

## Browser Compatibility Notes

| Feature | Chrome/Edge | Firefox | Safari | Notes |
|---------|-------------|---------|--------|-------|
| Service Worker | ✅ | ✅ | ✅ | |
| Cache Storage | ✅ | ✅ | ✅ | |
| IndexedDB | ✅ | ✅ | ✅ | |
| `navigator.storage.persist()` | ✅ | ✅ | ⚠️ | Safari: requires user interaction |
| `navigator.storage.estimate()` | ✅ | ✅ | ✅ | |
| OffscreenCanvas | ✅ | ✅ | ✅ | Worker rendering |
| WebGPU + JSPI | ✅ (119+) | ❌ | ❌ | Fallback to WASM |
| WASM SIMD threads | ✅ | ✅ | ✅ | Requires COOP/COEP |
| `createImageBitmap` | ✅ | ✅ | ✅ | |
| File System Access API | ✅ | ❌ | ❌ | Optional enhancement |

**Fallback Chain**: WebGPU+JSPI → WASM SIMD threads → WASM single-thread → Canvas2D main thread