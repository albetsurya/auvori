# Phase 6.4 Offline QA — Test Scenarios & Results

## Test Environment
- **Branch**: `feat/phase6.4-offline-first`
- **Base SHA**: `706a645b1cc2c217eb15919273918d8a9cb183c0`
- **Build**: Production (`npm run build`)
- **Test Tool**: Playwright / Chrome DevTools / Manual

---

## Scenario A — Initial Online Preparation

### Steps
1. Clear site data (cookies, cache, IndexedDB, service worker) in isolated Chrome profile
2. Open `https://auvori.app` (or `npm run preview`) online
3. Wait for service worker installation complete
4. Click "Prepare Auvori for Offline Use" (mandatory pack)
5. Verify all mandatory resources cached
6. Record download sizes

### Expected
- SW registers successfully
- Precaches: app shell (~33.5 MB raw)
- Runtime caches: static images (~1.7 MB)
- Offline readiness shows "Ready"
- No console errors

### Results
| Check | Status | Notes |
|-------|--------|-------|
| SW registration | ⏳ Pending | |
| App shell precache | ⏳ Pending | |
| Static images cached | ⏳ Pending | |
| Offline readiness UI | ⏳ Pending | |
| Download size recorded | ⏳ Pending | |

---

## Scenario B — Offline Cold Restart

### Steps
1. Complete Scenario A
2. Close all tabs
3. Disable network (Chrome DevTools → Network → Offline)
4. Reopen `https://auvori.app`
5. Reload root route (`/`)
6. Navigate: Home → Presets → Discover → Profile
7. Direct refresh on each route (Cmd+R)

### Expected
- App loads from SW cache
- All routes accessible offline
- No 404 on direct refresh
- Offline banner shows

### Results
| Route | Load | Nav | Refresh | Notes |
|-------|------|-----|---------|-------|
| `/` | ⏳ | ⏳ | ⏳ | |
| `/presets` | ⏳ | ⏳ | ⏳ | |
| `/discover` | ⏳ | ⏳ | ⏳ | |
| `/profile` | ⏳ | ⏳ | ⏳ | |

---

## Scenario C — Photo Editing Offline

### Steps
1. Complete Scenario B (app open offline)
2. Click "Open a Photo" → select local JPEG
3. Apply Free preset: `rosy-bokeh`
4. Apply Signature Look: `porcelain-bloom` (if Pro unlocked)
5. Adjust intensity: 85 → 50 → 100
6. Use Before/After (hold)
7. Use Undo/Redo
8. Crop to 4:5, rotate 90°, flip
9. Adjust manual: exposure +20, temperature -15
10. Export JPEG (single)
11. Export PNG (before/after card)
12. Verify exported files open correctly

### Expected
- Photo loads from File API (no network)
- All presets apply locally
- Before/After works
- Undo/Redo restores exact state
- Transform operations work
- Export produces valid image files
- No network requests during editing

### Results
| Action | Works | Notes |
|--------|-------|-------|
| Local photo open | ⏳ | |
| Free preset apply | ⏳ | |
| Signature Look apply | ⏳ | |
| Intensity adjust | ⏳ | |
| Before/After | ⏳ | |
| Undo/Redo | ⏳ | |
| Crop/Rotate/Flip | ⏳ | |
| Manual adjustments | ⏳ | |
| JPEG export | ⏳ | |
| PNG export | ⏳ | |
| Zero network requests | ⏳ | Verify in DevTools Network |

---

## Scenario D — Draft Recovery

### Steps
1. Online: Open photo, apply `velvet-noir`, intensity 70, exposure +10
2. Wait for autosave confirmation ("Saved on this device")
3. Force reload (Cmd+Shift+R)
4. Verify: photo restored, preset `velvet-noir`, intensity 70, exposure +10
5. Continue editing: change to `hannam-daylight`, intensity 90
6. Wait for autosave
7. Close tab, reopen offline
8. Verify state persists
9. Export → verify result

### Interrupted Save Test
1. Start editing large photo
2. Disconnect network mid-autosave (simulate)
3. Reload
4. Verify: either last complete save or clear error (no corruption)

### Results
| Test | Status | Notes |
|------|--------|-------|
| Basic recovery | ⏳ | |
| History restored | ⏳ | |
| Continue editing | ⏳ | |
| Export after recovery | ⏳ | |
| Interrupted save | ⏳ | |

---

## Scenario E — Studio Samples

### Steps
1. Offline: Open Gallery Picker → "Try a Studio Sample"
2. Verify all 10 thumbnails load
3. Click each sample → verify full image opens in editor
4. Apply suggested preset for each
5. Export each
6. Verify correct image + preset combination

### Sample × Preset Matrix
| Sample | Suggested Preset | Thumbnail | Full Image | Export |
|--------|------------------|-----------|------------|--------|
| Daylight Portrait | rosy-bokeh | ⏳ | ⏳ | ⏳ |
| Indoor Portrait | porcelain-bloom | ⏳ | ⏳ | ⏳ |
| Studio Skin Tones | velvet-merona | ⏳ | ⏳ | ⏳ |
| Café Interior | seoul-cafe | ⏳ | ⏳ | ⏳ |
| Food Scene | warm-latte | ⏳ | ⏳ | ⏳ |
| Night Street | gangnam-glass | ⏳ | ⏳ | ⏳ |
| Neon | neon-shibuya | ⏳ | ⏳ | ⏳ |
| Analog Scene | portra-400 | ⏳ | ⏳ | ⏳ |
| Monochrome | mono-leica | ⏳ | ⏳ | ⏳ |
| Deep Skin | velvet-merona | ⏳ | ⏳ | ⏳ |

### Results
| Check | Status |
|-------|--------|
| All thumbnails cached | ⏳ |
| All full images cached | ⏳ |
| Correct preset suggestion | ⏳ |
| Editor works | ⏳ |
| Export succeeds | ⏳ |

---

## Scenario F — Adaptive AI

### Test Matrix
| Condition | Direct Flash | Night Cinema | Expected Behavior |
|-----------|--------------|--------------|-------------------|
| AI pack installed + online | ⏳ | ⏳ | Full AI analysis |
| AI pack installed + offline | ⏳ | ⏳ | Full AI analysis (local models) |
| AI pack missing + online | ⏳ | ⏳ | Download + analyze |
| AI pack missing + offline | ⏳ | ⏳ | Signature fallback + clear label |
| Invalid model checksum | ⏳ | ⏳ | Fallback + error toast |
| Missing WASM runtime | ⏳ | ⏳ | Fallback + error toast |
| No WebGPU/JSPI | ⏳ | ⏳ | WASM path works |

### Verification Points
- [ ] Model download progress shown
- [ ] SHA-256 verified before use
- [ ] Warmup completes
- [ ] Offline inference produces identical results to online
- [ ] Fallback label: "Signature Fallback · Offline Mode"
- [ ] No silent substitution

### Results
| Test | Status |
|------|--------|
| AI pack download | ⏳ |
| Model verification | ⏳ |
| Offline inference | ⏳ |
| Fallback honesty | ⏳ |
| WASM path | ⏳ |

---

## Scenario G — Network-Dependent Features

### Steps (Offline)
1. Attempt login → verify clear error
2. Attempt Pro purchase → verify clear error
3. Attempt license verification → verify clear error
4. Attempt profile refresh → verify clear error
5. Verify editing session intact after each

### Expected
- No false success messages
- Current edit preserved
- No form data lost
- Clear "requires internet" messaging

### Results
| Feature | Error Shown | Edit Preserved |
|---------|-------------|----------------|
| Login | ⏳ | ⏳ |
| Purchase | ⏳ | ⏳ |
| License verify | ⏳ | ⏳ |
| Profile refresh | ⏳ | ⏳ |

---

## Scenario H — Storage Management

### Tests
1. `navigator.storage.estimate()` → shows usage/quota
2. `navigator.storage.persist()` → requests persistent
3. Fill storage (create many projects) → quota error handled
4. Delete project → space freed
5. "Clear Cache" → SW caches cleared, projects intact
6. Private browsing → fallback behavior

### Results
| Test | Status |
|------|--------|
| Storage estimate | ⏳ |
| Persistent request | ⏳ |
| Quota error handling | ⏳ |
| Project deletion | ⏳ |
| Clear cache safety | ⏳ |
| Private browsing | ⏳ |

---

## Scenario I — Service Worker Updates

### Tests
1. Deploy new version (change JS)
2. Online: verify update toast appears
3. During editing: update deferred until save
4. Offline: update not offered (no network)
5. Reload after update: new version active
6. Old caches cleaned
7. IndexedDB preserved

### Results
| Test | Status |
|------|--------|
| Update detection | ⏳ |
| Deferred during edit | ⏳ |
| Offline behavior | ⏳ |
| Clean activation | ⏳ |
| IndexedDB preserved | ⏳ |

---

## Scenario J — Browser Coverage

| Browser | OS | SW | IndexedDB | WASM | WebGPU | Status |
|---------|-----|----|-----------|------|--------|--------|
| Chrome 131 | Linux | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Chrome 131 | Android | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Safari 18 | iOS 18 | ⏳ | ⏳ | ⏳ | ❌ | ⏳ |
| Firefox 133 | Linux | ⏳ | ⏳ | ⏳ | ❌ | ⏳ |
| Edge 131 | Windows | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

### Platform Limitations Documented
- Safari: No WebGPU, no JSPI, no `persist()` without user gesture
- Firefox: No WebGPU in stable, WASM SIMD threads require COOP/COEP
- Private browsing: Cache Storage may be ephemeral, IndexedDB may be blocked

---

## Regression Suite (Existing)

Run after each major stage:
```bash
npm run build
python3 tests/run_p0_tests.py
```

### Required Pass
- [ ] P0.1 Golden baseline (CPU rendering)
- [ ] P0.2 GPU vs CPU parity
- [ ] P0.3 Worker pipeline
- [ ] P0.4 Export (Pro/Free/Card/CPU fallback)
- [ ] UI E2E (studio + export + URL lifecycle)
- [ ] UI E2E Fallback (full editing without WebGL2)

### Results
| Test | Status |
|------|--------|
| P0.1 Golden | ⏳ |
| P0.2 GPU/CPU | ⏳ |
| P0.3 Worker | ⏳ |
| P0.4 Export | ⏳ |
| UI E2E | ⏳ |
| UI E2E Fallback | ⏳ |

---

## Visual Evidence Collection

**Directory**: `tests/reports/phase6_4/`

| Subdirectory | Contents |
|--------------|----------|
| `online_preparation/` | SW install, pack download progress |
| `offline_startup/` | Cold restart screenshots |
| `offline_editing/` | Editing workflow offline |
| `local_projects/` | Project list, recovery, autosave |
| `studio_samples/` | All 10 samples thumbnails + full |
| `adaptive_ai/` | AI pack download, warmup, fallback |
| `storage/` | Estimate, persistent, quota |
| `service_worker/` | SW lifecycle, caches, update |
| `browser_compatibility/` | Per-browser screenshots |
| `regression_logs/` | Test execution logs |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Implementation | | | |
| QA Review | | | |
| Security Review | | | |
| Release Approval | | | |

**Final Readiness**: ⏳ Not yet evaluated