# Phase 6.4 Performance Report

## Baseline Metrics (Pre-Phase 6.4)

| Metric | Value | Notes |
|--------|-------|-------|
| Production build size (JS+CSS) | 428 KB gz / 1.1 MB raw | |
| ONNX Runtime WASM | 32.8 MB raw | Precached |
| Static images | 1.7 MB | Runtime cached |
| AI models | 11 MB | On-demand cached |
| Initial load (online, cached) | ~800 ms | SW controlled |
| Initial load (offline, cached) | ~400 ms | SW controlled |

---

## Offline Preparation Performance

### Mandatory Pack Download
| Phase | Expected Time (4G) | Expected Time (WiFi) | Size |
|-------|-------------------|---------------------|------|
| Service Worker install | 2–3 s | 1–2 s | 33.5 MB |
| Static images (parallel) | 3–5 s | 1–3 s | 1.7 MB |
| **Total** | **5–8 s** | **2–5 s** | **35.2 MB** |

### AI Pack Download (Optional)
| Scenario | Expected Time (4G) | Expected Time (WiFi) | Size |
|----------|-------------------|---------------------|------|
| WebGPU+JSPI | 15–25 s | 8–15 s | ~29 MB |
| WASM only | 12–20 s | 6–12 s | ~26 MB |

---

## Offline Startup Performance

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| SW-controlled navigation | < 500 ms | `performance.now()` in App.tsx |
| First paint (offline) | < 300 ms | Lighthouse / Web Vitals |
| Interactive (Home screen) | < 600 ms | `useEffect` mount time |
| Route transition (cached) | < 100 ms | SPA navigation |

---

## Image Loading Performance (Offline)

| Source | Cache | Expected Decode Time | Notes |
|--------|-------|---------------------|-------|
| Studio Sample thumbnail | `auvori-static-assets-v<hash>` | < 50 ms | WebP, 400×500 |
| Studio Sample full | `auvori-static-assets-v<hash>` | < 200 ms | WebP, max 1200px |
| Signature Look preview | `auvori-static-assets-v<hash>` | < 100 ms | WebP, 400×500 |
| Collection cover | `auvori-static-assets-v<hash>` | < 100 ms | WebP, varies |
| Local photo (File API) | — (Blob URL) | < 300 ms | Depends on file size |

---

## Editing Performance (Offline)

| Operation | Target | Notes |
|-----------|--------|-------|
| Preset thumbnail generation (24) | < 2 s | Worker batch, 260px |
| Intensity slider render | < 16 ms/frame | 60 fps target |
| Before/After switch | < 50 ms | Re-render |
| Undo/Redo | < 100 ms | History apply + render |
| Transform (crop/rotate) | < 200 ms | Source reprocess |
| Export (12 MP JPEG) | < 3 s | Pro: WebGL2, Free: Canvas2D |
| Export (24 MP JPEG Pro) | < 5 s | Full resolution |

---

## IndexedDB Performance

| Operation | Target (12 MP photo) | Notes |
|-----------|---------------------|-------|
| Project create (write Blob) | < 500 ms | Single transaction |
| Project load (read Blob) | < 300 ms | createObjectURL + Image decode |
| Autosave (update) | < 200 ms | Incremental |
| History replace (50 entries) | < 150 ms | Batch write |
| Storage estimate | < 50 ms | `navigator.storage.estimate()` |

---

## Memory Usage

| Component | Est. Heap | Notes |
|-----------|-----------|-------|
| App shell (JS) | 15–25 MB | React + bundles |
| Source image (12 MP RGBA) | 60 MB | 4000×3000 × 4 bytes |
| Edited canvas (1080p) | 5 MB | 1920×1080 × 4 bytes |
| WebGL2 textures | 20–40 MB | Depends on texture count |
| AI worker (models loaded) | 50–100 MB | WASM heap + model weights |
| IndexedDB (in-memory during tx) | Variable | Blob handling |

**Total (editing, no AI)**: ~100–150 MB
**Total (with AI models loaded)**: ~150–250 MB

---

## Network Requests (Offline Verification)

### Must Be Zero During Editing
- `/api/*` — none
- `/models/*` — none (if AI pack installed)
- `/assets/*` — all from cache
- `favicon.ico` — from cache
- WebSocket/HMR — none (production build)

### Allowed on Startup (if not fully prepared)
- `/manifest.webmanifest` — from precache
- `/sw.js` — from browser SW cache
- `/workbox-*.js` — from browser SW cache

---

## Battery & CPU Impact

| Scenario | CPU (idle) | CPU (editing) | Battery Impact |
|----------|------------|---------------|----------------|
| Offline, Home | < 1% | — | Negligible |
| Offline, editing (WebGL2) | — | 15–30% | Moderate |
| Offline, editing (Canvas2D fallback) | — | 25–40% | Higher |
| AI analysis (WASM) | — | 40–80% (burst) | High (short) |
| AI analysis (WebGPU) | — | 10–20% | Low |

---

## Storage Growth Over Time

| User Activity | IndexedDB Growth | Cache Storage Growth |
|---------------|------------------|---------------------|
| 1 project (12 MP) | +5 MB | 0 |
| 10 projects | +50 MB | 0 |
| 50 projects | +250 MB | 0 |
| AI pack installed | 0 | +11 MB (models) |
| SW update | 0 | +35 MB (new caches) → old cleaned |

---

## Benchmark Commands

```bash
# Production build
npm run build

# Preview production build
npm run preview

# Run P0 regression (includes performance checks)
python3 tests/run_p0_tests.py

# Lighthouse CI (offline mode)
npx lighthouse http://localhost:4173 --preset=desktop --budget-path=./lighthouse-budget.json

# Measure SW startup
# In DevTools: Performance → Record → Reload → Stop
# Look for "Service Worker" timing
```

---

## Lighthouse Budget (Target)

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:pwa": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 3000 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 4000 }],
        "interactive": ["warn", { "maxNumericValue": 5000 }],
        "total-byte-weight": ["warn", { "maxNumericValue": 2000000 }],
        "offline-startup": ["error", { "maxNumericValue": 1000 }]
      }
    }
  }
}
```

---

## Results (To Be Filled)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Mandatory pack download (WiFi) | < 5 s | ⏳ | ⏳ |
| Mandatory pack download (4G) | < 10 s | ⏳ | ⏳ |
| Offline cold start | < 500 ms | ⏳ | ⏳ |
| Route transition | < 100 ms | ⏳ | ⏳ |
| Thumbnail batch (24) | < 2 s | ⏳ | ⏳ |
| Export 12 MP JPEG | < 3 s | ⏳ | ⏳ |
| Project create | < 500 ms | ⏳ | ⏳ |
| Project load | < 300 ms | ⏳ | ⏳ |
| Autosave | < 200 ms | ⏳ | ⏳ |
| Zero network during edit | 0 | ⏳ | ⏳ |
| Lighthouse Performance | ≥ 0.9 | ⏳ | ⏳ |
| Lighthouse PWA | ≥ 0.9 | ⏳ | ⏳ |