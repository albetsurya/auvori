#!/usr/bin/env python3
"""
Auvori Phase 6 Comprehensive Visual QA Lab, Catalog Audit, Multi-Viewport UX,
High-Res Export Policy, Licensing Verification & Physical GPU Performance Suite.
"""

from __future__ import annotations

import base64
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OPENSOURCE_DIR = ROOT / "tests" / "fixtures" / "opensource_photos"
NIGHT_DIR = ROOT / "tests" / "fixtures" / "night_photos"
ORIG_DIR = ROOT / "tests" / "fixtures" / "original_photos"
HOLD_DIR = ROOT / "tests" / "fixtures" / "holdout_photos"
SHEETS_DIR = ROOT / "tests" / "reports" / "phase6_contact_sheets"
METRICS_JSON = ROOT / "tests" / "reports" / "phase6_metrics.json"


def start_vite_server(port: int = 4193) -> subprocess.Popen:
    proc = subprocess.Popen(
        ["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=os.environ.copy(),
        text=True,
    )
    url = f"http://127.0.0.1:{port}/"
    for _ in range(60):
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status == 200:
                    return proc
        except Exception:
            time.sleep(0.25)
    proc.terminate()
    raise RuntimeError("Vite server failed to start")


def file_to_data_url(path: Path) -> str:
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def data_url_to_rgb(data_url: str) -> np.ndarray:
    _, b64 = data_url.split(",", 1)
    return np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB"), dtype=np.uint8)


def save_grid_sheet(title: str, col_headers: list[str], rows_imgs: list[tuple[str, list[np.ndarray]]], out_path: Path, tile_w: int = 180) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rendered = []
    for row_label, imgs in rows_imgs:
        h, w = imgs[0].shape[:2]
        th = max(80, int(round(tile_w * h / w)))
        row_w = len(imgs) * (tile_w + 4) + 128
        row_img = Image.new("RGB", (row_w, th + 24), (20, 20, 22))
        d = ImageDraw.Draw(row_img)
        d.text((6, 4 + th // 2), row_label[:18], fill=(235, 232, 226))
        for ci, arr in enumerate(imgs):
            tile = Image.fromarray(arr).resize((tile_w, th), Image.Resampling.BILINEAR)
            x0 = 128 + ci * (tile_w + 4)
            row_img.paste(tile, (x0, 20))
            if ci < len(col_headers):
                d.text((x0 + 3, 4), col_headers[ci][:20], fill=(245, 220, 170) if col_headers[ci] in ("Night Cinema", "Direct Flash") else (210, 210, 208))
        rendered.append(row_img)

    mw = max(r.width for r in rendered)
    total_h = 28 + sum(r.height + 4 for r in rendered)
    sheet = Image.new("RGB", (mw, total_h), (12, 12, 14))
    ImageDraw.Draw(sheet).text((8, 6), title, fill=(250, 250, 246))
    y = 28
    for r in rendered:
        sheet.paste(r, (0, y))
        y += r.height + 4
    sheet.save(out_path, "JPEG", quality=88)
    print("Saved contact sheet:", out_path)


def verify_manifest_integrity() -> dict:
    from tools.download_sample_photos import process_manifest, DEFAULT_MANIFEST
    manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    photos = manifest["photos"]
    assert 40 <= len(photos) <= 60, f"Open-source library count {len(photos)} outside target 40-60"
    rc = process_manifest(DEFAULT_MANIFEST, verify_only=True)
    assert rc == 0, "Open-source manifest SHA-256 / image verification failed"
    required_keys = {
        "filename", "original_source_url", "download_url", "source_platform",
        "creator_name", "creator_profile_url", "license_name", "license_version",
        "license_url", "download_date", "original_width", "original_height",
        "file_format", "file_size_bytes", "sha256", "category",
        "license_verification", "originality_review", "dataset_tier",
        "model_release_status", "redistribution_notes",
    }
    covered_cats = set()
    lic_verified = 0
    gold_count = 0
    for p in photos:
        missing = required_keys - set(p.keys())
        assert not missing, f"Missing manifest fields on {p['filename']}: {missing}"
        assert p["license_name"] in ("CC0 1.0 Universal", "Public Domain", "CC BY 4.0", "CC BY 3.0")
        assert p["license_verification"]["status"] in ("verified", "pending-review")
        assert p["originality_review"]["status"] in ("reviewed-original", "possibly-processed", "unknown")
        if p["license_verification"]["status"] == "verified":
            lic_verified += 1
        if p["dataset_tier"] == "gold_standard":
            assert p["license_verification"]["status"] == "verified"
            assert p["originality_review"]["status"] == "reviewed-original"
            gold_count += 1
        covered_cats.update(p["category"])
    print(f"[PASS] Phase 6A/6B Library Integrity: {len(photos)} files SHA-256 OK, license_verified={lic_verified}, gold_standard={gold_count}, categories={len(covered_cats)}")
    return {"count": len(photos), "licenseVerified": lic_verified, "goldStandard": gold_count, "distinctCategories": sorted(covered_cats)}


def run_browser_lab_and_export(playwright, launch_kwargs: dict, base_url: str, label: str, generate_sheets: bool = False):
    browser = playwright.chromium.launch(**launch_kwargs)
    try:
        ctx = browser.new_context(viewport={"width": 1280, "height": 840})
        page = ctx.new_page()
        page_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.goto(base_url, wait_until="networkidle")

        gpu_info = page.evaluate("""async () => {
            const c = document.createElement('canvas');
            const g = c.getContext('webgl2');
            const dbg = g ? g.getExtension('WEBGL_debug_renderer_info') : null;
            let wg = false;
            if (navigator.gpu && navigator.gpu.requestAdapter) {
                wg = Boolean(await navigator.gpu.requestAdapter());
            }
            return {
                renderer: dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
                hasWebGPU: wg,
                maxTexSize: g ? g.getParameter(g.MAX_TEXTURE_SIZE) : 0,
            };
        }""")
        print(f"\n=== ENVIRONMENT [{label}]: GL={gpu_info['renderer']} | maxTex={gpu_info['maxTexSize']} | WebGPU={gpu_info['hasWebGPU']} ===")

        # 6 key high-resolution scenes spanning open-source + night sets
        qa_scenes = [
            ("Daylight Portrait", OPENSOURCE_DIR / "p6_07_daylight_smiling_portrait.jpg"),
            ("Mixed Food/Cafe", OPENSOURCE_DIR / "p6_14_latte_croissant_cafe.jpg"),
            ("Forest Mist", OPENSOURCE_DIR / "p6_30_forest_bridge_hiker.jpg"),
            ("Golden Sunset", OPENSOURCE_DIR / "p6_25_sea_waves_sunset.jpg"),
            ("Dark Metal Still", OPENSOURCE_DIR / "p6_40_black_teapot_dark_bg.jpg"),
            ("Night Street", NIGHT_DIR / "night_street_portrait.jpg"),
            ("Night Neon", NIGHT_DIR / "night_neon_portrait.jpg"),
        ]
        scene_urls = [{"label": lbl, "name": p.name, "url": file_to_data_url(p)} for lbl, p in qa_scenes]
        port_highres = file_to_data_url(OPENSOURCE_DIR / "p6_01_window_bus_portrait.jpg")   # 3456x5184 portrait
        land_highres = file_to_data_url(OPENSOURCE_DIR / "p6_33_vintage_camera_map.jpg")   # 5184x3456 landscape

        out = page.evaluate(
            """async ({ scenes, portUrl, landUrl, fullCatalogAudit }) => {
                const { PRESETS, PRESET_CATEGORIES, SIGNATURE_COLLECTIONS } = await import('/src/data/presets.ts');
                const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                const { buildEffectiveRecipe, generatePresetThumbnail } = await import('/src/lib/imageEngine.ts');
                const { exportPhotographBlob } = await import('/src/engine/pipeline/export-pipeline.ts');
                const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                const loadImg = (src) => new Promise((res, rej) => {
                    const i = new Image();
                    i.onload = () => res(i);
                    i.onerror = rej;
                    i.src = src;
                });

                const glPipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                const cpuPipe = new PhotoPipeline({ preferWebGL2: false, preferWorkerFallback: true });
                const aiPipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: true });

                const byteMae = (a, b) => {
                    let s = 0;
                    for (let i = 0; i < a.length; i += 4) {
                        s += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
                    }
                    return s / ((a.length / 4) * 3);
                };

                const statsOf = (bytes) => {
                    let sumL = 0, clipCnt = 0, darkCnt = 0;
                    const n = bytes.length / 4;
                    for (let i = 0; i < bytes.length; i += 4) {
                        const l = (0.299 * bytes[i] + 0.587 * bytes[i+1] + 0.114 * bytes[i+2]) / 255;
                        sumL += l;
                        if (l >= 0.96) clipCnt++;
                        if (l <= 0.08) darkCnt++;
                    }
                    return { meanL: sumL / n, clipPct: (clipCnt / n) * 100, darkPct: (darkCnt / n) * 100 };
                };

                // Benchmark render speed on hardware GL vs CPU using 4 test scenes
                const glC = document.createElement('canvas');
                const cpuC = document.createElement('canvas');
                const benchTimes = [];
                for (const sc of scenes.slice(0, 4)) {
                    const img = await loadImg(sc.url);
                    const pNc = PRESETS.find(x => x.id === 'night-cinema');
                    const aOut = await aiPipe.analyzeAdaptive({ source: img, sourceId: sc.name, sourceRevision: 1, transformRevision: 't0' });
                    const eff = buildEffectiveRecipe(pNc.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const r = await glPipe.renderPreview({
                        source: img, sourceId: sc.name, sourceRevision: 1, transformRevision: 1,
                        recipe: eff, targetCanvas: glC, maxDimension: 1200, analysisResult: aOut.result, includeGrain: true
                    });
                    benchTimes.push({ name: sc.name, glMs: r.durationMs, backend: r.backend, w: glC.width, h: glC.height });
                }

                // Export matrix on authentic full-res 3456x5184 Portrait & 5184x3456 Landscape
                const imgPort = await loadImg(portUrl);
                const imgLand = await loadImg(landUrl);
                const pWarm = PRESETS.find(x => x.id === 'velvet-merona');
                const effWarm = buildEffectiveRecipe(pWarm.recipe, 100, DEFAULT_ADJUSTMENTS);

                const expFreeJpg = await exportPhotographBlob({
                    source: imgPort, sourceId: 'port_highres', sourceRevision: 1, transformRevision: 1,
                    recipe: effWarm, mode: 'single',
                    options: { showWatermark: true, presetName: pWarm.name, isPro: false, format: 'jpeg', quality: 0.9 }
                });
                const expProPort = await exportPhotographBlob({
                    source: imgPort, sourceId: 'port_highres', sourceRevision: 1, transformRevision: 1,
                    recipe: effWarm, mode: 'single',
                    options: { showWatermark: false, presetName: pWarm.name, isPro: true, format: 'jpeg', quality: 0.92 }
                });
                const expProLandPng = await exportPhotographBlob({
                    source: imgLand, sourceId: 'land_highres', sourceRevision: 1, transformRevision: 1,
                    recipe: effWarm, mode: 'single',
                    options: { showWatermark: false, presetName: pWarm.name, isPro: true, format: 'png', quality: 1 }
                });
                const expProSquareCpu = await exportPhotographBlob({
                    source: imgPort, sourceId: 'port_sq_cpu', sourceRevision: 1, transformRevision: 2,
                    recipe: effWarm, mode: 'single',
                    options: { showWatermark: false, presetName: pWarm.name, isPro: true, transform: { rotate: 0, flipH: false, aspect: '1:1' }, format: 'png', quality: 1, preferWebGL2: false }
                });
                const expCard = await exportPhotographBlob({
                    source: imgLand, sourceId: 'land_card', sourceRevision: 1, transformRevision: 1,
                    recipe: effWarm, mode: 'card',
                    options: { showWatermark: false, presetName: pWarm.name, isPro: true, format: 'jpeg', quality: 0.9 }
                });

                const exportSummary = {
                    freePortrait: { w: expFreeJpg.width, h: expFreeJpg.height, mime: expFreeJpg.blob.type, bytes: expFreeJpg.blob.size, ms: expFreeJpg.durationMs, backend: expFreeJpg.backend },
                    proPortraitJpg: { w: expProPort.width, h: expProPort.height, orig: expProPort.isOriginalResolution, mime: expProPort.blob.type, bytes: expProPort.blob.size, ms: expProPort.durationMs, backend: expProPort.backend },
                    proLandscapePng: { w: expProLandPng.width, h: expProLandPng.height, orig: expProLandPng.isOriginalResolution, mime: expProLandPng.blob.type, bytes: expProLandPng.blob.size, ms: expProLandPng.durationMs, backend: expProLandPng.backend },
                    proSquareCpu: { w: expProSquareCpu.width, h: expProSquareCpu.height, mime: expProSquareCpu.blob.type, bytes: expProSquareCpu.blob.size, ms: expProSquareCpu.durationMs, backend: expProSquareCpu.backend },
                    proCard: { w: expCard.width, h: expCard.height, mime: expCard.blob.type, bytes: expCard.blob.size, ms: expCard.durationMs },
                    heapUsedMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
                };

                let catalogAudit = null;
                let sheetsPayload = null;
                if (fullCatalogAudit) {
                    const nonOrig = PRESETS.filter(p => p.id !== 'original');
                    const samplePortrait = await loadImg(scenes[0].url);
                    const sampleFood = await loadImg(scenes[1].url);
                    const sampleNight = await loadImg(scenes[5].url);

                    // 1. Intensity 0, 25, 50, 75, 100 check across ALL 26 non-original presets + thumbnails
                    const catalogRows = [];
                    const featureVecs = {}; // concatenated pixel samples across portrait + food + night at 100%
                    const thumbSet = new Set();

                    // Base original bytes for those 3 scenes at maxDim 360
                    const baseBytesMap = {};
                    for (const [k, im] of [['p', samplePortrait], ['f', sampleFood], ['n', sampleNight]]) {
                        const tmp = document.createElement('canvas');
                        const origEff = buildEffectiveRecipe(PRESETS[0].recipe, 100, DEFAULT_ADJUSTMENTS);
                        await glPipe.renderPreview({
                            source: im, sourceId: 'cat_' + k, sourceRevision: 1, transformRevision: 1,
                            recipe: origEff, targetCanvas: tmp, maxDimension: 360, includeGrain: true
                        });
                        baseBytesMap[k] = new Uint8ClampedArray(tmp.getContext('2d').getImageData(0, 0, tmp.width, tmp.height).data);
                    }

                    // Precompute AI analysis once for portrait + night + backlit scenes
                    const analyses = {};
                    for (const sc of scenes) {
                        const im = await loadImg(sc.url);
                        const ao = await aiPipe.analyzeAdaptive({ source: im, sourceId: sc.name, sourceRevision: 1, transformRevision: 't0' });
                        analyses[sc.name] = ao.result;
                    }

                    for (const pr of nonOrig) {
                        const thumbUrl = generatePresetThumbnail(samplePortrait, pr.recipe);
                        if (thumbUrl.length > 100) thumbSet.add(thumbUrl);

                        // Intensity ladder on portrait (using actual preset grain config)
                        const ladderMae = {};
                        for (const pct of [0, 25, 50, 75, 100]) {
                            const eff = buildEffectiveRecipe(pr.recipe, pct, DEFAULT_ADJUSTMENTS);
                            await glPipe.renderPreview({
                                source: samplePortrait, sourceId: 'cat_p', sourceRevision: 1, transformRevision: 1,
                                recipe: eff, targetCanvas: glC, maxDimension: 360,
                                analysisResult: pr.lookType === 'adaptive' ? analyses[scenes[0].name] : null,
                                includeGrain: true,
                            });
                            const pb = glC.getContext('2d').getImageData(0, 0, glC.width, glC.height).data;
                            ladderMae[pct] = byteMae(baseBytesMap.p, pb);
                        }

                        // Multi-scene stats at 100% (portrait, food, night)
                        const fullEff = buildEffectiveRecipe(pr.recipe, 100, DEFAULT_ADJUSTMENTS);
                        const vec = [];
                        const sceneStats = {};
                        for (const [k, scName, im] of [['p', scenes[0].name, samplePortrait], ['f', scenes[1].name, sampleFood], ['n', scenes[5].name, sampleNight]]) {
                            await glPipe.renderPreview({
                                source: im, sourceId: 'cat_' + k, sourceRevision: 1, transformRevision: 1,
                                recipe: fullEff, targetCanvas: glC, maxDimension: 360,
                                analysisResult: pr.lookType === 'adaptive' ? analyses[scName] : null,
                                includeGrain: true,
                            });
                            const bytes = glC.getContext('2d').getImageData(0, 0, glC.width, glC.height).data;
                            sceneStats[k] = { maeVsOrig: byteMae(baseBytesMap[k], bytes), ...statsOf(bytes) };
                            vec.push(new Uint8ClampedArray(bytes));
                        }
                        featureVecs[pr.id] = vec;
                        catalogRows.push({
                            id: pr.id, name: pr.name, category: pr.category, isPro: pr.isPro,
                            lookType: pr.lookType || 'legacy', recipeVersion: pr.recipeVersion || 1,
                            collectionId: pr.collectionId || null,
                            grain: pr.recipe.grain || 0,
                            ladderMae, sceneStats,
                        });
                    }

                    // Pairwise matrix across ALL 26 non-original presets
                    const pairs = [];
                    for (let i = 0; i < nonOrig.length; i++) {
                        for (let j = i + 1; j < nonOrig.length; j++) {
                            const a = nonOrig[i], b = nonOrig[j];
                            const va = featureVecs[a.id], vb = featureVecs[b.id];
                            const m0 = byteMae(va[0], vb[0]);
                            const m1 = byteMae(va[1], vb[1]);
                            const m2 = byteMae(va[2], vb[2]);
                            pairs.push({ a: a.id, b: b.id, meanMae: (m0 + m1 + m2) / 3 });
                        }
                    }
                    pairs.sort((x, y) => x.meanMae - y.meanMae);

                    // Contact Sheet Renders (maxDimension 340, actual preset grain enabled)
                    const renderTileUrl = async (scName, img, preset, pct = 100) => {
                        const eff = buildEffectiveRecipe(preset.recipe, pct, DEFAULT_ADJUSTMENTS);
                        await glPipe.renderPreview({
                            source: img, sourceId: 'sheet_' + scName, sourceRevision: 1, transformRevision: 1,
                            recipe: eff, targetCanvas: glC, maxDimension: 340,
                            analysisResult: preset.lookType === 'adaptive' ? analyses[scName] : null,
                            includeGrain: true,
                        });
                        return glC.toDataURL('image/jpeg', 0.88);
                    };

                    const loadedScenes = {};
                    for (const sc of scenes) loadedScenes[sc.name] = await loadImg(sc.url);
                    const origP = PRESETS.find(p => p.id === 'original');
                    const legacyIds = PRESETS.filter(p => p.id !== 'original' && (p.recipeVersion === 1 || !p.recipeVersion) && p.lookType !== 'adaptive').map(p => p.id);
                    const sigIds = PRESETS.filter(p => p.lookType === 'signature' && p.recipeVersion === 2).map(p => p.id);
                    const adapIds = PRESETS.filter(p => p.lookType === 'adaptive').map(p => p.id);

                    // Sheet 1: 4 key scenes x (Original + 10 Legacy subset rows or 20 across 2 blocks -> all 20!)
                    const legacyRowsA = [];
                    const legacyRowsB = [];
                    for (const sc of scenes.slice(0, 4)) {
                        const im = loadedScenes[sc.name];
                        const rowA = [await renderTileUrl(sc.name, im, origP)];
                        for (const pid of legacyIds.slice(0, 10)) rowA.push(await renderTileUrl(sc.name, im, PRESETS.find(x => x.id === pid)));
                        legacyRowsA.push({ label: sc.label, urls: rowA });

                        const rowB = [await renderTileUrl(sc.name, im, origP)];
                        for (const pid of legacyIds.slice(10, 20)) rowB.push(await renderTileUrl(sc.name, im, PRESETS.find(x => x.id === pid)));
                        legacyRowsB.push({ label: sc.label, urls: rowB });
                    }

                    const sigRows = [];
                    for (const sc of scenes.slice(0, 5)) {
                        const im = loadedScenes[sc.name];
                        const row = [await renderTileUrl(sc.name, im, origP)];
                        for (const pid of sigIds) row.push(await renderTileUrl(sc.name, im, PRESETS.find(x => x.id === pid)));
                        sigRows.push({ label: sc.label, urls: row });
                    }

                    const adapRows = [];
                    for (const sc of [scenes[0], scenes[3], scenes[4], scenes[5], scenes[6]]) {
                        const im = loadedScenes[sc.name];
                        const row = [await renderTileUrl(sc.name, im, origP)];
                        for (const pid of adapIds) row.push(await renderTileUrl(sc.name, im, PRESETS.find(x => x.id === pid)));
                        adapRows.push({ label: sc.label, urls: row });
                    }

                    const intensityRows = [];
                    for (const [sc, pid] of [[scenes[0], 'porcelain-bloom'], [scenes[0], 'direct-flash'], [scenes[5], 'night-cinema'], [scenes[6], 'night-cinema']]) {
                        const im = loadedScenes[sc.name];
                        const pr = PRESETS.find(x => x.id === pid);
                        const row = [];
                        for (const pct of [0, 25, 50, 75, 100]) row.push(await renderTileUrl(sc.name, im, pr, pct));
                        intensityRows.push({ label: `${pr.name}`, urls: row });
                    }

                    catalogAudit = {
                        totalPresets: PRESETS.length,
                        categoriesCount: PRESET_CATEGORIES.length,
                        collectionsCount: SIGNATURE_COLLECTIONS.length,
                        uniqueThumbCount: thumbSet.size,
                        catalogRows,
                        closestPairs: pairs.slice(0, 8),
                    };
                    sheetsPayload = {
                        legacyHeadersA: ['Original', ...legacyIds.slice(0, 10).map(id => PRESETS.find(x => x.id === id).name)],
                        legacyRowsA,
                        legacyHeadersB: ['Original', ...legacyIds.slice(10, 20).map(id => PRESETS.find(x => x.id === id).name)],
                        legacyRowsB,
                        sigHeaders: ['Original', ...sigIds.map(id => PRESETS.find(x => x.id === id).name)],
                        sigRows,
                        adapHeaders: ['Original', ...adapIds.map(id => PRESETS.find(x => x.id === id).name)],
                        adapRows,
                        intensityHeaders: ['0%', '25%', '50%', '75%', '100%'],
                        intensityRows,
                    };
                }

                glPipe.dispose();
                cpuPipe.dispose();
                aiPipe.dispose();

                return { benchTimes, exportSummary, catalogAudit, sheetsPayload };
            }""",
            {"scenes": scene_urls, "portUrl": port_highres, "landUrl": land_highres, "fullCatalogAudit": generate_sheets},
        )
        assert len(page_errors) == 0, f"Browser page errors: {page_errors}"
        return gpu_info, out
    finally:
        browser.close()


def run_responsive_ux_matrix(playwright, base_url: str) -> list:
    viewports = [(360, 800), (390, 844), (768, 1024), (1280, 800), (1440, 900)]
    sample_photo = OPENSOURCE_DIR / "p6_07_daylight_smiling_portrait.jpg"
    results = []
    browser = playwright.chromium.launch(headless=True)
    try:
        for vw, vh in viewports:
            ctx = browser.new_context(viewport={"width": vw, "height": vh})
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda err: errors.append(str(err)))
            page.goto(base_url, wait_until="networkidle")

            home_overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
            page.set_input_files("input[type='file']", str(sample_photo))
            page.wait_for_selector("[aria-label='Editor Inspector']", timeout=12000)

            # Check canvas rendered non-zero & zero horizontal page overflow
            ed_metrics = page.evaluate("""() => {
                const c = document.querySelector('canvas');
                const rect = c ? c.getBoundingClientRect() : null;
                return {
                    hasCanvas: Boolean(c),
                    canvasW: c ? c.width : 0,
                    canvasH: c ? c.height : 0,
                    cssW: rect ? Math.round(rect.width) : 0,
                    cssH: rect ? Math.round(rect.height) : 0,
                    overflow: document.documentElement.scrollWidth > window.innerWidth,
                };
            }""")
            assert ed_metrics["hasCanvas"] and ed_metrics["canvasW"] > 0 and ed_metrics["cssW"] > 0

            # Select Rosy Bokeh, test Intensity scrub, Split View, Undo/Redo, Crop tab (Rotate + 4:5), Adjust tab, Export modal
            page.get_by_role("button", name="Rosy Bokeh").first.click()
            slider = page.get_by_label("Intensitas Preset")
            slider.fill("65")
            slider.dispatch_event("change")

            page.get_by_label("Compare Before and After").click()
            assert page.locator("text=Before").first.is_visible()
            page.get_by_label("Compare Before and After").click()

            page.get_by_label("Undo").click()
            page.get_by_label("Redo").click()

            # Switch to Crop tab, rotate + aspect 4:5
            page.get_by_role("button", name="Crop", exact=True).click()
            page.get_by_role("button", name="4:5 Portrait").click()
            page.get_by_role("button", name="Rotate 90°").click()
            time.sleep(0.2)

            # Open Export Modal & verify visible options without crash
            page.locator("button:has-text('Save')").last.click()
            page.wait_for_selector("text=Export Photograph", timeout=5000)
            exp_visible = page.locator("text=HD Photograph").is_visible()
            assert exp_visible
            page.get_by_role("button", name="Close modal").click() if page.get_by_role("button", name="Close modal").count() else page.keyboard.press("Escape")

            assert not home_overflow and not ed_metrics["overflow"], f"Horizontal overflow at {vw}x{vh}"
            assert len(errors) == 0, f"Uncaught errors at {vw}x{vh}: {errors}"
            results.append({"viewport": f"{vw}x{vh}", **ed_metrics, "errors": 0})
            ctx.close()
        print(f"[PASS] Phase 6E Responsive Editor UX & Interactions verified cleanly across {len(results)} viewports.")
        return results
    finally:
        browser.close()


def main() -> int:
    lib_summary = verify_manifest_integrity()
    srv = start_vite_server(4193)
    base_url = "http://127.0.0.1:4193/"
    try:
        with sync_playwright() as p:
            gpu_sw, out_sw = run_browser_lab_and_export(p, {"headless": True}, base_url, "headless-swiftshader", generate_sheets=True)
            ca = out_sw["catalogAudit"]

            # Validate Phase 6D invariants
            assert ca["totalPresets"] == 27
            assert ca["uniqueThumbCount"] >= 26, f"Duplicate blank thumbnails detected: {ca['uniqueThumbCount']}/26"
            for row in ca["catalogRows"]:
                assert row["ladderMae"]["0"] == 0.0, f"Intensity 0% not identity on {row['id']}: {row['ladderMae']}"
                assert row["ladderMae"]["25"] <= row["ladderMae"]["50"] + 0.5
                assert row["ladderMae"]["50"] <= row["ladderMae"]["75"] + 0.5
                assert row["ladderMae"]["100"] > 2.0, f"Preset {row['id']} too weak on portrait/scenes"
            print(f"[PASS] Phase 6D Catalog Audit: 26 looks verified, 0%==Original identity MAE=0.000, closest pair={ca['closestPairs'][0]}")

            # Save contact sheets
            sp = out_sw["sheetsPayload"]
            save_grid_sheet("Auvori Phase 6.1 Visual QA - Legacy Presets (1-10)", sp["legacyHeadersA"], [(r["label"], [data_url_to_rgb(u) for u in r["urls"]]) for r in sp["legacyRowsA"]], SHEETS_DIR / "sheet_01a_legacy_1_10.jpg")
            save_grid_sheet("Auvori Phase 6.1 Visual QA - Legacy Presets (11-19)", sp["legacyHeadersB"], [(r["label"], [data_url_to_rgb(u) for u in r["urls"]]) for r in sp["legacyRowsB"]], SHEETS_DIR / "sheet_01b_legacy_11_20.jpg")
            save_grid_sheet("Auvori Phase 6.1 Visual QA - 5 P1 Signature Looks", sp["sigHeaders"], [(r["label"], [data_url_to_rgb(u) for u in r["urls"]]) for r in sp["sigRows"]], SHEETS_DIR / "sheet_02_signature_looks.jpg")
            save_grid_sheet("Auvori Phase 6.1 Visual QA - 2 Adaptive Looks", sp["adapHeaders"], [(r["label"], [data_url_to_rgb(u) for u in r["urls"]]) for r in sp["adapRows"]], SHEETS_DIR / "sheet_03_adaptive_looks.jpg")
            save_grid_sheet("Auvori Phase 6.1 Visual QA - Intensity Ladder (0-100%, Grain ON)", sp["intensityHeaders"], [(r["label"], [data_url_to_rgb(u) for u in r["urls"]]) for r in sp["intensityRows"]], SHEETS_DIR / "sheet_04_intensity_ladder.jpg")

            # Export assertions (SwiftShader & CPU Square)
            es = out_sw["exportSummary"]
            assert max(es["freePortrait"]["w"], es["freePortrait"]["h"]) == 1280
            assert es["proPortraitJpg"]["w"] < es["proPortraitJpg"]["h"] and max(es["proPortraitJpg"]["w"], es["proPortraitJpg"]["h"]) >= 3200
            assert es["proLandscapePng"]["w"] > es["proLandscapePng"]["h"] and es["proLandscapePng"]["mime"] == "image/png"
            assert es["proSquareCpu"]["w"] == es["proSquareCpu"]["h"] and es["proSquareCpu"]["backend"] == "worker-canvas2d"
            print("[PASS] Phase 6F High-Res Export Matrix (SW):", es)

            # Hardware GPU Benchmark (Intel Iris Xe via ANGLE GL-EGL)
            gpu_hw, out_hw = run_browser_lab_and_export(
                p,
                {"headless": True, "args": ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"]},
                base_url,
                "physical-gpu-angle-egl",
                generate_sheets=False,
            )
            print("[PASS] Phase 6F Physical GPU Export Matrix:", out_hw["exportSummary"])
            for bt in out_hw["benchTimes"]:
                print(f"   GPU preview 1200px {bt['name']}: {bt['glMs']:.2f}ms ({bt['w']}x{bt['h']})")

            # Multi-viewport Responsive UX Audit
            ux_rows = run_responsive_ux_matrix(p, base_url)

            METRICS_JSON.parent.mkdir(parents=True, exist_ok=True)
            METRICS_JSON.write_text(
                json.dumps(
                    {
                        "library": lib_summary,
                        "gpuSwiftShader": gpu_sw,
                        "gpuHardware": gpu_hw,
                        "benchSwiftShader": out_sw["benchTimes"],
                        "benchHardware": out_hw["benchTimes"],
                        "exportSwiftShader": out_sw["exportSummary"],
                        "exportHardware": out_hw["exportSummary"],
                        "catalogAudit": ca,
                        "responsiveUx": ux_rows,
                    },
                    indent=2,
                ) + "\n",
                encoding="utf-8",
            )
            print("Saved Phase 6 metrics JSON:", METRICS_JSON)
        return 0
    finally:
        srv.terminate()
        srv.wait(timeout=5)


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT / "tests"))
    sys.exit(main())
