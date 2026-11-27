# Phase 6.4 Security & Entitlement Review

## Threat Model

### Assets to Protect
1. **User photographs** — private, never leave device without explicit action
2. **Subscription status** — Pro entitlement must not be bypassable
3. **Payment data** — Lynk.id tokens, never cached
4. **Authentication credentials** — never stored in plaintext
5. **AI model integrity** — SHA-256 verified before execution

### Attack Vectors Considered
| Vector | Mitigation |
|--------|------------|
| Client-side Pro flag tampering | Server-verified license, no local bypass |
| Cache poisoning (SW) | SHA-256 verification, versioned caches |
| IndexedDB corruption | Transaction atomicity, schema validation |
| Model substitution | Pinned manifest + checksum verification |
| Private data leakage | No caching of authenticated responses |
| XSS via blob URLs | `revokeObjectURL`, CSP, no `eval` |

---

## API Cache Policy

### Cached (Safe, Public, Static)
| Pattern | Cache | Reason |
|---------|-------|--------|
| `GET /assets/**` | `CacheFirst` | Static images, versioned |
| `GET /models/**` | `CacheFirst` + verify | AI models, immutable |
| `GET /manifest.webmanifest` | Precached | PWA manifest |
| `GET /sw.js` | Browser SW cache | SW self-update |
| `GET /workbox-*.js` | Browser SW cache | Workbox runtime |

### Never Cached (Private, Dynamic, Mutating)
| Pattern | Strategy | Reason |
|---------|----------|--------|
| `POST /api/license/verify` | `NetworkOnly` | Contains email/device ID, returns license |
| `POST /api/checkout` | `NetworkOnly` | Payment initiation |
| `GET /api/user/*` | `NetworkOnly` | Private profile data |
| `POST /api/*` | `NetworkOnly` | All mutations |
| `GET /api/*` (authenticated) | `NetworkOnly` | Private data |

### Workbox Configuration (vite.config.ts)
```typescript
runtimeCaching: [
  // AI models - CacheFirst with verification in ai-models.ts
  {
    urlPattern: /\.(?:onnx|wasm|mjs|bin|json)$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'auvori-ai-models-v1',
      expiration: { maxEntries: 24, maxAgeSeconds: 60*60*24*30 }
    }
  },
  // Static images - CacheFirst
  {
    urlPattern: /\/assets\/images\/.*\.(?:webp|png|jpg|svg)$/i,
    handler: 'CacheFirst',
    options: { cacheName: 'auvori-static-assets-v<hash>' }
  },
  // Navigation - NetworkFirst with offline fallback
  {
    urlPattern: ({ request }) => request.mode === 'navigate',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'auvori-navigation-v<hash>',
      networkTimeoutSeconds: 3
    }
  }
]
```

**Critical**: No `StaleWhileRevalidate` or `NetworkFirst` for authenticated endpoints.

---

## Offline Entitlement Behavior

### Current Implementation
- License stored in `localStorage` (`auvori_license_v1`)
- Verified via `POST /api/license/verify` (requires network)
- Demo key `AUVORI-DEMO` works offline in dev mode only
- Pro gating: `license.isPro` checked at export & preset selection

### Offline Rules (Phase 6.4)
1. **No new offline entitlement mechanism** — existing license persists in localStorage
2. **If Pro verified online → works offline** until license expires or app update
3. **If never verified → Free only offline** — no bypass
4. **License expiry** — checked on next online verification (not enforced offline)
5. **App update** — new SW activation clears nothing; license persists in localStorage

### Pro Features Offline
| Feature | Offline Available? | Condition |
|---------|-------------------|-----------|
| Signature Looks (5) | ✅ Yes | If `license.isPro === true` |
| High-res export | ✅ Yes | If `license.isPro === true` |
| No watermark | ✅ Yes | If `license.isPro === true` |
| Adaptive AI (Direct Flash) | ⚠️ Optional pack | If Pro + AI pack installed |
| Adaptive AI (Night Cinema) | ⚠️ Optional pack | If Pro + AI pack installed |
| License verification | ❌ No | Requires network |
| Purchase/Upgrade | ❌ No | Requires network |

### Security Guarantee
> **No code path allows `license.isPro = true` without server verification (except `AUVORI-DEMO` in `import.meta.env.DEV`).**

---

## Local Photo Privacy

### Data Flow
```
User selects file → File API → Blob URL → HTMLImageElement → Editor
                                          ↓
                              IndexedDB (LocalProject + LocalImage)
                                          ↓
                              Export → Blob → Download (user device)
```

### Guarantees
1. **No upload** — `exportPhotographBlob` uses local pipeline only
2. **No telemetry** — no analytics, no error reporting with image data
3. **No background sync** — IndexedDB never synced to server
4. **User control** — explicit "Open a Photo" action required
5. **Deletion** — "Clear Cache" doesn't touch projects; explicit project delete required

### Code Audit Points
- [ ] `App.tsx:loadImageIntoEditor` — only `URL.createObjectURL(file)` or static asset URLs
- [ ] `ExportModal:handleDownload` — only `exportPhotographBlob` (local) → `URL.createObjectURL(blob)` → `a.download`
- [ ] `PhotoCanvas` — only renders to local canvas
- [ ] `PhotoPipeline` — no `fetch`/`XMLHttpRequest` in render path
- [ ] `ai.worker.ts` — only loads models from `/models/` (cached) or Cache Storage

---

## AI Model Verification

### Manifest Pinning
```typescript
// ai-models.ts:AI_MODEL_MANIFEST
'yunet-2026may': {
  url: '/models/face_detection_yunet_2026may.onnx',
  upstreamUrl: 'https://media.githubusercontent.com/media/opencv/opencv_zoo/eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4/...',
  pinnedCommit: 'eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4',
  fileSizeBytes: 229738,
  sha256: 'ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0'
}
```

### Verification Flow
1. Fetch model from `/models/...` (served by static host)
2. `verifyModelBytes()` checks:
   - Exact byte length match
   - SHA-256 digest match
3. Only on success: store in Cache Storage `auvori-ai-models-v1`
4. On cache read: re-verify before use
5. On mismatch: delete cache entry, re-fetch

### Supply Chain
- Models hosted on project's static hosting (not third-party CDN in production)
- `upstreamUrl` documented for audit
- `pinnedCommit` ties to specific GitHub commit
- No auto-update — manifest version bump required

---

## Storage Safety

### IndexedDB Isolation
- Origin-scoped (same-origin policy)
- No cross-origin access
- Private browsing: separate ephemeral storage

### User Data Deletion
| Action | IndexedDB | Cache Storage | localStorage |
|--------|-----------|---------------|--------------|
| "Clear Cache" (Settings) | ❌ No | ✅ Yes (SW caches) | ❌ No |
| "Delete Project" | ✅ Yes (project + image + history) | ❌ No | ❌ No |
| "Clear All Data" (Profile) | ✅ Yes (all stores) | ✅ Yes (all Auvori caches) | ✅ Yes (Auvori keys) |
| Browser "Clear Site Data" | ✅ Yes | ✅ Yes | ✅ Yes |

### Quota Protection
- Autosave checks `navigator.storage.estimate()` before write
- On `QuotaExceededError`: toast "Storage full — delete old projects", preserve existing
- Never auto-delete other projects

---

## Content Security Policy (Recommended)

```html
<meta http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' 'wasm-unsafe-eval';
    worker-src 'self' blob:;
    connect-src 'self' https://lynk.id https://*.cloudflareworkers.com;
    img-src 'self' data: blob:;
    style-src 'self' 'unsafe-inline';
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  ">
```

**Notes**:
- `'wasm-unsafe-eval'` required for ONNX Runtime WASM
- `blob:` for worker scripts and object URLs
- `connect-src` limited to known APIs

---

## Dependency Security

### Production Dependencies
| Package | Version | Risk | Notes |
|---------|---------|------|-------|
| `onnxruntime-web` | 1.31.1 | Low | Microsoft, widely used |
| `lucide-react` | 0.460.0 | Low | Icon library |
| `react` / `react-dom` | 18.3.1 | Low | Meta, maintained |

### Dev Dependencies (Not in Production Bundle)
| Package | Purpose |
|---------|---------|
| `vite-plugin-pwa` | SW generation |
| `workbox` | SW runtime |
| `typescript` | Type checking |
| `wrangler` | Cloudflare deploy |

### Supply Chain
- `package-lock.json` committed
- `allowScripts` configured for native builds
- No post-install scripts from untrusted packages

---

## Penetration Test Checklist (Manual)

- [ ] Tamper `localStorage.auvori_license_v1` → verify Pro not unlocked
- [ ] Inject fake license in IndexedDB → verify not used
- [ ] Modify SW cache → verify checksum fails, re-fetch
- [ ] Replace model file → verify SHA-256 mismatch, fallback
- [ ] Attempt `fetch('/api/license/verify')` offline → verify proper error
- [ ] Export with Pro preset while Free → verify watermark added
- [ ] Check DevTools Network during offline edit → verify zero requests
- [ ] Private browsing → verify graceful degradation
- [ ] Large file (50 MB) → verify memory handling
- [ ] Rapid autosave → verify no transaction conflicts

---

## Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| GDPR (Art. 25 - Privacy by Design) | ✅ Compliant | Local-only, no tracking |
| CCPA | ✅ Compliant | No sale of data |
| ePrivacy | ✅ Compliant | No cookies for tracking |
| COPPA | ✅ Compliant | No child-directed features |

---

## Security Sign-Off

| Reviewer | Role | Date | Status |
|----------|------|------|--------|
| | Implementation Lead | | ⏳ |
| | Security Engineer | | ⏳ |
| | Privacy Officer | | ⏳ |

**Overall**: ⏳ Pending implementation review