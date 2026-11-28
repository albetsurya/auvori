# Phase 6.4 Offline QA — Test Scenarios & Results

## Test Environment

- **Branch**: `feat/phase6.4-offline-first`
- **Base SHA**: `706a645b1cc2c217eb15919273918d8a9cb183c0`
- **Implementation Commit**: `7aa9aea`
- **Correction Commit**: uncommitted working-tree change to `src/App.tsx` (see "Defect Found and Corrected")
- **Build**: Production (`npm run build`) → `vite preview --port 4174`
- **Browser**: Google Chrome for Testing 159.0.8154.6 (Playwright 1.65.1 bundled Chromium), headed, Linux x86_64
- **Profile**: isolated persistent profile at `/tmp/auvori-phase64-verify`
- **Network control**: `context.set_offline(true)` after mandatory offline preparation
- **Test Date**: 2026-11-28
- **Method**: automated Playwright real locator interactions (file input, button clicks, keyboard on range inputs). No synthetic event dispatch. No sleep used as persistence proof.

---

## Defect Found and Corrected

### Symptom

IndexedDB stayed empty after edits, and the "Saved on this device" indicator never appeared.

### Root Cause

`src/App.tsx` created the autosave scheduler with an empty dependency array:

```ts
const scheduleAutosave = useCallback((patch) => {
  ...
  autosaveTimeoutRef.current = window.setTimeout(() => { performAutosave(); }, 800);
  ...
}, []); // captured the mount-time performAutosave closure
```

The captured `performAutosave` closure always had `sourceImage === null`, so the guard
`if (!currentProjectIdRef.current && !sourceImage) return;` returned before
`setSaveStatus('saving')` and before any IndexedDB call. This was not a Playwright or React
synthetic-event limitation.

### Correction (smallest safe change)

- Added `performAutosaveRef` holding the latest callback.
- Timers call `performAutosaveRef.current()`.
- The ref is updated with `useEffect(() => { performAutosaveRef.current = performAutosave; }, [performAutosave])`.

No test tolerances, presets, renderers, AI weights, entitlement, or golden baselines were changed.

---

## Scenario A — Initial Online Preparation

### Results

| Check | Status | Notes |
|-------|--------|-------|
| SW registration | PASSED | Active service worker |
| App shell precache | PASSED | 45 entries in `workbox-precache-v2-http://localhost:4174/` |
| Static images cached | PASSED | 32 entries in `auvori-static-assets-v1.0.0-timestamp` |
| Offline readiness UI | PASSED | Prepare action completed |

Precache total: 46 entries / 34,452 KiB. The two ONNX WASM variants (14.8 MB and 17.9 MB) dominate.

---

## Scenario B — Offline Cold Restart

| Route | Load | Nav | Direct refresh |
|-------|------|-----|----------------|
| `/` | PASSED | PASSED | PASSED |
| `/presets` | PASSED | PASSED | PASSED |
| `/discover` | PASSED | PASSED | PASSED |
| `/profile` | PASSED | PASSED | PASSED |

Offline page title: `Auvori — Personal Photo Styling Studio`.

---

## Scenario C — Photo Editing Offline

Automated with a local 800×600 PNG. Editing, preset application, intensity changes, manual
adjustments, compare, undo/redo and export all work with the network disabled. No network
request occurs during editing.

---

## Scenario D — IndexedDB Persistence and Recovery

**Result: PASSED**

### Procedure

1. Prepare mandatory offline resources, then disable network.
2. Import local photograph (`qa-persistence.png`, 800×600, 2,789 bytes).
3. Apply `rosy-bokeh`.
4. Change intensity 85 → 60.
5. Set Exposure to +10.
6. Wait for the application confirmation "Saved on this device".
7. Inspect the committed IndexedDB records.
8. Reload while offline.
9. Verify automatic recovery, continue editing (intensity → 40), confirm a second save.
10. Export the restored project.
11. Close the browser, reopen the same profile offline.

### Results

| Check | Status | Observed |
|-------|--------|----------|
| Save confirmation | PASSED | "Saved on this device" after 0.8 s |
| IndexedDB database | PASSED | `auvori-projects`, version 1 |
| Stores | PASSED | `projects`, `images`, `history`, `offlineState` |
| Project record | PASSED | `6ea8dc09-b053-43a6-9619-fd6a1dc57b33` |
| Source image record | PASSED | `53f260e9-ff46-4f03-b865-00903a97d2bd` |
| Source Blob | PASSED | 2,789 bytes, `image/png`, 800×600, SHA-256 stored |
| Preset persisted | PASSED | `activePresetId = rosy-bokeh` |
| Intensity persisted | PASSED | `intensity = 60` |
| History persisted | PASSED | 45 snapshot records |
| Transaction completion | PASSED | `createProject` resolves only from `tx.oncomplete`; records were read back afterwards |
| Reload recovery (offline) | PASSED | Canvas restored, "Rosy Bokeh" and 60% shown |
| Second save after further edit | PASSED | `intensity = 40`, `updatedAt` advanced |
| Export after recovery | PASSED | `auvori-rosy-bokeh.jpg`, 13,863 bytes, JPEG magic `ffd8` |
| Browser restart recovery | PASSED | Closed and reopened same profile offline; project restored |

Evidence: `tests/reports/phase6_4/scenario_d.json`, `scenario_d_e_run.json`,
`screenshots/d1_editor_offline.png` … `d5_after_browser_restart.png`.

---

## Scenario E — Studio Sample Offline Flow (Fixed)

**Result: PASSED**

Actual inventory from `src/lib/samplePhoto.ts` and the rendered DOM: **9 samples**. The earlier
report listed 10 because it treated "Studio Skin Tones" and "Deep Skin" as separate entries;
`real:deep_skin` is titled "Studio Skin Tones".

| # | Sample | Thumbnail | Full asset (offline) | Editor | Suggested preset |
|---|--------|-----------|----------------------|--------|------------------|
| 1 | Daylight Portrait | 400×500 WebP | 85,510 B WebP | PASSED | Rosy Bokeh |
| 2 | Indoor Portrait | 400×500 WebP | 62,048 B WebP | PASSED | Porcelain Bloom |
| 3 | Studio Skin Tones | 400×500 WebP | 92,354 B WebP | PASSED | Velvet Merona |
| 4 | Café Interior | 400×500 WebP | 51,302 B WebP | PASSED | Seoul Café |
| 5 | Food Scene | 400×500 WebP | 112,394 B WebP | PASSED | Warm Latte |
| 6 | Night Street | 400×500 WebP | 81,138 B WebP | PASSED | City Dusk |
| 7 | Neon Portrait | 400×500 WebP | 112,474 B WebP | PASSED | Neon Shibuya |
| 8 | Analog Scene | 400×500 WebP | 166,002 B WebP | PASSED | Kodak Gold |
| 9 | Monochrome Scene | 400×500 WebP | 58,500 B WebP | PASSED | Leica Mono |

All nine full assets returned HTTP 200 from the service worker cache with the network disabled.

### Fix Applied: Studio Sample Persistence

- **New function** `loadSampleWithBlob(sampleId, presetId?)`: fetches the original full-resolution sample asset via same-origin `fetch` (Service Worker cache satisfies the request offline), validates the Blob with `assertDecodableImage()`, then calls `loadImageIntoEditor` with `sourceType='studio-sample'` and `sourceAssetId=sampleId`.
- **Rewrote** `handleStartWithSample` to call `loadSampleWithBlob`.
- **Rewrote** `handleOpenRecentEdit` to fetch the sample Blob and pass `sourceType` / `sourceAssetId`.
- **IndexedDB schema** extended with additive fields `sourceType` (`'local-upload' | 'studio-sample'`) and `sourceAssetId` (sample ID) — no DB version bump required.
- **Autosave** now receives valid `sourceBlob` for samples, creates/persists `LocalProject` with metadata.
- **Failure path**: if fetch fails, `saveErrorKind='source'`, `saveStatus='failed'`, UI shows "Not saved — original asset unavailable" + Retry; never falsely reports "Saved".

### Full editing workflow (two representative samples)

| Sample | Preset applied | Intensity | Before/After | Undo/Redo | Save signal | Export |
|--------|----------------|-----------|--------------|-----------|-------------|--------|
| Daylight Portrait | Warm Latte | 70 | PASSED | PASSED | "Saved on this device" | `auvori-warm-latte.jpg`, 151,723 B, `ffd8` |
| Café Interior | Rosy Bokeh | 70 | PASSED | PASSED | "Saved on this device" | `auvori-rosy-bokeh.jpg`, 81,847 B, `ffd8` |

### Persistence verification (new)

| Check | Status | Observed |
|-------|--------|----------|
| All 9 samples create IndexedDB project | PASSED | `sourceType='studio-sample'`, `sourceAssetId` set, Blob stored |
| Correct preset persisted | PASSED | Matches `STUDIO_SAMPLES` suggested preset |
| Intensity, manual, history persisted | PASSED | Full undo/redo history in IndexedDB |
| Offline reload recovery | PASSED | Project restored, edits intact |
| Second save after further edit | PASSED | `updatedAt` advanced, history extended |
| Export after recovery | PASSED | JPEG valid |
| Browser restart recovery | PASSED | Project restored from IndexedDB |
| Failure path (asset deleted from Cache Storage) | PASSED | "Not saved — original asset unavailable" + Retry; no false "Saved" |

### Network

- 615 total requests across the run.
- 8 non-local requests, all Google Fonts CSS/WOFF2, which fail offline and fall back to system fonts.
- 0 remote image requests, 0 backend uploads.

Evidence: `tests/reports/phase6_4/scenario_e.json`, `scenario_d_e_run.json`,
`screenshots/e1_sample_library_offline.png`, `e2_first_sample_editor.png`, `e3_edit_*.png`.

---

## Scenario F — Adaptive AI Offline

Not exercised in this task. Documented limitation. Code paths for SHA-256 verification and the
"Signature Fallback · Offline Mode" label are unchanged.

---

## Scenario G — Network-Dependent Features

Not re-executed in this task. Code inspection confirms `/api/*` is `NetworkOnly` and denylisted
from the navigation fallback. No Pro bypass via `localStorage` or IndexedDB.

---

## Scenario H — Storage Management

Runtime storage-safety test (same persistent profile, online):

| Check | Status | Evidence |
|-------|--------|----------|
| Storage estimate | PASSED | Reported by OfflineResourceManager |
| "Clear Offline Caches (keeps projects)" | PASSED | Confirmation shown; project ID preserved |
| Caches after clear | PASSED | `workbox-precache-v2` rebuilt to 45 entries |
| "Delete All Local Data" confirmation | PASSED | Two distinct confirms required |
| Cancelling the second confirm | PASSED | Project and image records preserved |
| Persistent storage | NOT GRANTED | Requires user gesture + secure context |

Evidence: `tests/reports/phase6_4/storage_safety.json`.

---

## Scenario I — Service Worker Updates

Untested. Requires deploying a new version. Documented limitation.

---

## Scenario J — Complete Offline Journey

Covered by Scenarios B, D and E: offline cold start, local import, edit, confirmed save, reload
recovery, browser restart recovery, sample library, sample editing and export.

---

## Regression Suite Results

| Suite | Status | Exit code |
|-------|--------|-----------|
| TypeScript (`npx tsc --noEmit`) | PASSED | 0 |
| Production build (`npm run build`) | PASSED | 0 (46 precache entries) |
| P0.1 golden baseline (CPU) | PASSED | 0 (36 cases, MAE=0.0000) |
| P0.2 GPU vs CPU parity | PASSED | 0 (worst MAE=0.107/255) |
| P0.3 worker pipeline | PASSED | 0 |
| P0.4 export | PASSED | 0 |
| UI E2E (studio + export + URL) | PASSED | 0 |
| UI E2E fallback (no WebGL2) | PASSED | 0 |
| P1 signature looks | PASSED | 0 |
| P3 adaptive | PASSED | 0 |
| P4 Direct Flash | PASSED | 0 |
| P5 Night Cinema | PASSED | 0 |
| P6 visual quality | PASSED | 0 |
| P6.1 dataset + grain/coverage | PASSED | 0 |
| P6.2 cross-path, grain, renderer determinism | PASSED | 0 |
| Phase 6.3 asset integrity | PASSED | 0 |
| Phase 6.3 collection mapping | PASSED | 0 |
| Phase 6.3 signature looks UI | PASSED | 0 |

Golden baselines unchanged. Test tolerances unchanged.

---

## Known Issues & Limitations

1. **Studio Sample sessions now persist to IndexedDB** with original Blob and metadata (FIXED in Scenario E).
2. Both WASM variants are precached (32.8 MB).
3. Autosave debounce (800 ms) plus max delay (5 s) can lose up to 5 s of edits on crash.
4. Persistent storage is not auto-granted.
5. Adaptive AI offline pack not exercised.
6. Cross-browser compatibility untested (Chromium 159 Linux only).
7. Service worker deployment/update lifecycle untested.
8. Google Fonts requests fail offline and fall back to system fonts.

---

## Final Readiness Decision

### **READY FOR MERGE**

All mandatory gates pass with direct passing evidence:

- IndexedDB persistence: committed project, image Blob, preset, intensity, manual adjustment and
  history records; offline reload recovery; second save; browser restart recovery; export.
- Studio Sample offline persistence: all 9 samples load and open in the editor offline with the correct
  suggested preset; original Blob obtained via `fetch` (SW cache); IndexedDB project created with
  `sourceType='studio-sample'`, `sourceAssetId`, preset, intensity, manual, history; two representative
  samples complete editing, Before/After, Undo/Redo, reload recovery, second save, browser restart
  recovery, and export.
- Failure path verified: deleting a sample asset from Cache Storage while offline → app shows
  "Not saved — original asset unavailable" + Retry; never falsely reports "Saved".

All regression suites pass; golden baselines unchanged.
