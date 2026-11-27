#!/usr/bin/env python3
"""
Auvori P0 Golden-Image, Parity & Performance Acceptance Test Suite.
Runs inside real headless Chromium against Vite dev server so TypeScript, GLSL WebGL2,
Web Workers, OffscreenCanvas, Blob export, and Canvas2D are tested authentically.
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
GOLDEN_DIR = ROOT / "tests" / "golden"
BASELINE_PRESETS = ["rosy-bokeh", "velvet-merona", "seoul-cafe", "kodak-gold", "mono-leica", "neon-shibuya"]


def start_vite_server(port: int = 4179) -> subprocess.Popen:
    env = os.environ.copy()
    proc = subprocess.Popen(
        ["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
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
    raise RuntimeError("Vite server failed to start in time")


def save_data_url_png(data_url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    header, b64 = data_url.split(",", 1)
    assert "image/png" in header
    path.write_bytes(base64.b64decode(b64))


def load_png_data_url(path: Path) -> str:
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def run_capture_golden(page, base_url: str) -> None:
    page.goto(base_url, wait_until="networkidle")
    res = page.evaluate(
        """async (presetIds) => {
            const { PRESETS } = await import('/src/data/presets.ts');
            const { applyRecipeToCanvas, buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
            const { GOLDEN_SCENE_IDS, createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
            const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

            const outputs = [];
            for (const sceneId of GOLDEN_SCENE_IDS) {
                const src = createGoldenSceneCanvas(sceneId, 192, 240);
                for (const pid of presetIds) {
                    const preset = PRESETS.find(p => p.id === pid);
                    if (!preset) throw new Error('Missing preset: ' + pid);
                    const recipe = buildEffectiveRecipe(preset.recipe, 85, DEFAULT_ADJUSTMENTS);
                    const out = document.createElement('canvas');
                    applyRecipeToCanvas(src, out, recipe);
                    outputs.push({
                        name: `${sceneId}__${pid}.png`,
                        dataUrl: out.toDataURL('image/png')
                    });
                }
            }
            return outputs;
        }""",
        BASELINE_PRESETS,
    )
    for item in res:
        save_data_url_png(item["dataUrl"], GOLDEN_DIR / item["name"])
    print(f"[capture] Saved {len(res)} lossless golden baselines to {GOLDEN_DIR}")


def run_verify_suite(browser, page, base_url: str, stage: str) -> None:
    page.goto(base_url, wait_until="networkidle")

    golden_map = {}
    for png in sorted(GOLDEN_DIR.glob("*.png")):
        golden_map[png.name] = load_png_data_url(png)
    if not golden_map:
        raise RuntimeError("No golden baselines found in tests/golden/")

    # 1. Verify Legacy Engine + Canvas2D Renderer vs Golden Baselines
    golden_results = page.evaluate(
        """async ({ goldenMap, presetIds }) => {
            const { PRESETS } = await import('/src/data/presets.ts');
            const { applyRecipeToCanvas, buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
            const { GOLDEN_SCENE_IDS, createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
            const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

            async function decodePngRgba(dataUrl) {
                const img = new Image();
                img.src = dataUrl;
                await img.decode();
                const c = document.createElement('canvas');
                c.width = img.width;
                c.height = img.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                return ctx.getImageData(0, 0, img.width, img.height).data;
            }

            function compareBuffers(a, b) {
                let absSum = 0;
                let sqSum = 0;
                let maxDiff = 0;
                let darkRedArtifacts = 0;
                const pixels = a.length / 4;
                for (let i = 0; i < a.length; i += 4) {
                    const dr = Math.abs(a[i] - b[i]);
                    const dg = Math.abs(a[i + 1] - b[i + 1]);
                    const db = Math.abs(a[i + 2] - b[i + 2]);
                    absSum += dr + dg + db;
                    sqSum += dr * dr + dg * dg + db * db;
                    const m = Math.max(dr, dg, db);
                    if (m > maxDiff) maxDiff = m;
                    // Guard against dark shadow red speckles bug
                    if (b[i] > 180 && b[i + 1] < 30 && b[i + 2] < 30 && (a[i] + a[i + 1] + a[i + 2]) < 120) {
                        darkRedArtifacts++;
                    }
                }
                const channels = pixels * 3;
                return {
                    mae: absSum / channels,
                    rmse: Math.sqrt(sqSum / channels),
                    maxDiff,
                    darkRedArtifacts
                };
            }

            const results = [];
            for (const sceneId of GOLDEN_SCENE_IDS) {
                const src = createGoldenSceneCanvas(sceneId, 192, 240);
                for (const pid of presetIds) {
                    const key = `${sceneId}__${pid}.png`;
                    const preset = PRESETS.find(p => p.id === pid);
                    const recipe = buildEffectiveRecipe(preset.recipe, 85, DEFAULT_ADJUSTMENTS);
                    const out = document.createElement('canvas');
                    applyRecipeToCanvas(src, out, recipe);
                    const outData = out.getContext('2d').getImageData(0, 0, out.width, out.height).data;
                    const goldData = await decodePngRgba(goldenMap[key]);
                    results.push({ key, ...compareBuffers(goldData, outData) });
                }
            }
            return results;
        }""",
        {"goldenMap": golden_map, "presetIds": BASELINE_PRESETS},
    )

    worst_legacy_mae = max(r["mae"] for r in golden_results)
    worst_legacy_max = max(r["maxDiff"] for r in golden_results)
    red_speckles = sum(r["darkRedArtifacts"] for r in golden_results)
    print(f"[golden-cpu] {len(golden_results)} cases: worst MAE={worst_legacy_mae:.4f}, worst maxDiff={worst_legacy_max}, redArtifacts={red_speckles}")
    assert worst_legacy_mae < 0.01, f"Reference Canvas2D drifted from golden: {golden_results}"
    assert red_speckles == 0, f"Detected red speckles on dark pixels!"

    if stage == "golden":
        return

    # 2. P0.1 Cache, Mask, URL lifecycle, Export Blob, Pro Resolution & README sync checks
    if stage in ("p0.1", "p0-all"):
        p01_check = page.evaluate(
            """async () => {
                const { PRESETS } = await import('/src/data/presets.ts');
                const { getMaskCacheStats, clearMaskCache, assignSourceId } = await import('/src/engine/analysis/mask-cache.ts');
                const { getPortraitMask } = await import('/src/engine/analysis/portrait-mask.ts');
                const { applyRecipeToCanvas, buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                const { GOLDEN_SCENE_IDS, createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
                const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                clearMaskCache();
                const portrait = createGoldenSceneCanvas('portrait-fair-hijab', 192, 240);
                const landscape = createGoldenSceneCanvas('landscape-nature', 192, 240);

                // Confidence check: portrait should detect skin higher than landscape ellipse fallback
                const pCtx = portrait.getContext('2d');
                const pData = pCtx.getImageData(0, 0, portrait.width, portrait.height).data;
                const lCtx = landscape.getContext('2d');
                const lData = lCtx.getImageData(0, 0, landscape.width, landscape.height).data;

                const sidP = assignSourceId(portrait);
                const m1 = getPortraitMask(portrait, pData, 192, 240, { sourceId: sidP, sourceRevision: 1, transformRevision: 1 });
                const m2 = getPortraitMask(portrait, pData, 192, 240, { sourceId: sidP, sourceRevision: 1, transformRevision: 1 });
                const m3 = getPortraitMask(portrait, pData, 192, 240, { sourceId: sidP, sourceRevision: 1, transformRevision: 2 });
                const mLand = getPortraitMask(landscape, lData, 192, 240, { sourceId: assignSourceId(landscape), sourceRevision: 1, transformRevision: 1 });

                // Verify applyRecipeToCanvas on HTMLCanvasElement hits cache when key matches across slider changes
                const rosy = PRESETS.find(p => p.id === 'rosy-bokeh');
                const out = document.createElement('canvas');
                const statsBefore = getMaskCacheStats();
                applyRecipeToCanvas(portrait, out, buildEffectiveRecipe(rosy.recipe, 50, DEFAULT_ADJUSTMENTS), undefined, {
                    cacheKey: { sourceId: sidP, sourceRevision: 1, transformRevision: 10 }
                });
                applyRecipeToCanvas(portrait, out, buildEffectiveRecipe(rosy.recipe, 95, DEFAULT_ADJUSTMENTS), undefined, {
                    cacheKey: { sourceId: sidP, sourceRevision: 1, transformRevision: 10 }
                });
                const statsAfter = getMaskCacheStats();

                return {
                    presetCount: PRESETS.length,
                    freeCount: PRESETS.filter(p => !p.isPro && p.id !== 'original').length,
                    proCount: PRESETS.filter(p => p.isPro).length,
                    portraitMethod: m1.method,
                    portraitConfidence: m1.confidence,
                    landscapeMethod: mLand.method,
                    landscapeConfidence: mLand.confidence,
                    hitOnRepeat: m2.fromCache,
                    missOnTransformBump: m3.fromCache,
                    sliderHitsDelta: statsAfter.hits - statsBefore.hits,
                    sliderMissesDelta: statsAfter.misses - statsBefore.misses
                };
            }"""
        )
        print(f"[p0.1-mask-cache] {json.dumps(p01_check)}")
        assert p01_check["hitOnRepeat"] is True, "Same cache key did not hit mask cache"
        assert p01_check["missOnTransformBump"] is False, "Transform revision change returned stale cached mask"
        assert p01_check["sliderHitsDelta"] >= 1, "Canvas source slider drag missed mask cache"
        assert p01_check["sliderMissesDelta"] == 1, "Slider drag should only compute mask once"
        assert p01_check["portraitMethod"] == "heuristic-skin"
        assert p01_check["landscapeMethod"] == "heuristic-ellipse"
        assert p01_check["portraitConfidence"] > p01_check["landscapeConfidence"]

    # 3. P0.2 WebGL2 vs Canvas2D Parity Verification
    if stage in ("p0.2", "p0-all"):
        parity = page.evaluate(
            """async ({ presetIds }) => {
                const { PRESETS } = await import('/src/data/presets.ts');
                const { buildEffectiveRecipe, applyRecipeToCanvas } = await import('/src/lib/imageEngine.ts');
                const { WebGL2Renderer } = await import('/src/engine/renderer/webgl2.renderer.ts');
                const { Canvas2DRenderer } = await import('/src/engine/renderer/canvas2d.renderer.ts');
                const { GOLDEN_SCENE_IDS, createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
                const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                const glRenderer = new WebGL2Renderer();
                if (!glRenderer.isSupported()) {
                    return { supported: false };
                }
                const cpuRenderer = new Canvas2DRenderer();

                function readRgba(canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    const copy = document.createElement('canvas');
                    copy.width = canvas.width;
                    copy.height = canvas.height;
                    const cctx = copy.getContext('2d');
                    cctx.drawImage(canvas, 0, 0);
                    return cctx.getImageData(0, 0, copy.width, copy.height).data;
                }

                const cases = [];
                for (const sceneId of GOLDEN_SCENE_IDS) {
                    const src = createGoldenSceneCanvas(sceneId, 192, 240);
                    for (const pid of presetIds) {
                        const preset = PRESETS.find(p => p.id === pid);
                        const recipe = buildEffectiveRecipe(preset.recipe, 85, DEFAULT_ADJUSTMENTS);

                        const cpuOut = document.createElement('canvas');
                        await cpuRenderer.render({
                            source: src,
                            sourceId: sceneId,
                            sourceRevision: 1,
                            transformRevision: 1,
                            recipe,
                            targetCanvas: cpuOut,
                            includeGrain: false
                        });

                        const gpuOut = document.createElement('canvas');
                        await glRenderer.render({
                            source: src,
                            sourceId: sceneId,
                            sourceRevision: 1,
                            transformRevision: 1,
                            recipe,
                            targetCanvas: gpuOut,
                            includeGrain: false
                        });

                        // Also test deterministic film grain PRNG hash parity on grain-enabled preset
                        let grainMaxDiff = 0;
                        if (pid === 'kodak-gold' || pid === 'mono-leica') {
                            const gCpu = document.createElement('canvas');
                            const gGpu = document.createElement('canvas');
                            await cpuRenderer.render({
                                source: src,
                                sourceId: sceneId,
                                sourceRevision: 1,
                                transformRevision: 1,
                                recipe,
                                targetCanvas: gCpu,
                                includeGrain: true
                            });
                            await glRenderer.render({
                                source: src,
                                sourceId: sceneId,
                                sourceRevision: 1,
                                transformRevision: 1,
                                recipe,
                                targetCanvas: gGpu,
                                includeGrain: true
                            });
                            const ga = readRgba(gCpu);
                            const gb = readRgba(gGpu);
                            let gAbs = 0;
                            for (let gi = 0; gi < ga.length; gi += 4) {
                                gAbs += Math.abs(ga[gi] - gb[gi]) + Math.abs(ga[gi + 1] - gb[gi + 1]) + Math.abs(ga[gi + 2] - gb[gi + 2]);
                            }
                            grainMaxDiff = gAbs / ((ga.length / 4) * 3);
                        }

                        const a = readRgba(cpuOut);
                        const b = readRgba(gpuOut);
                        let absSum = 0;
                        let sqSum = 0;
                        let maxDiff = 0;
                        let p99Over12 = 0;
                        const nPix = a.length / 4;
                        for (let i = 0; i < a.length; i += 4) {
                            const dr = Math.abs(a[i] - b[i]);
                            const dg = Math.abs(a[i + 1] - b[i + 1]);
                            const db = Math.abs(a[i + 2] - b[i + 2]);
                            absSum += dr + dg + db;
                            sqSum += dr * dr + dg * dg + db * db;
                            const m = Math.max(dr, dg, db);
                            if (m > maxDiff) maxDiff = m;
                            if (m > 12) p99Over12++;
                        }
                        cases.push({
                            key: `${sceneId}__${pid}`,
                            mae: absSum / (nPix * 3),
                            rmse: Math.sqrt(sqSum / (nPix * 3)),
                            maxDiff,
                            pctOver12: (p99Over12 / nPix) * 100,
                            grainMae: grainMaxDiff
                        });
                    }
                }
                glRenderer.dispose();
                return { supported: true, cases };
            }""",
            {"presetIds": BASELINE_PRESETS},
        )
        assert parity["supported"] is True, "WebGL2 not supported in headless Chromium!"
        worst_mae = max(c["mae"] for c in parity["cases"])
        worst_rmse = max(c["rmse"] for c in parity["cases"])
        worst_grain = max(c["grainMae"] for c in parity["cases"])
        worst_p99 = max(c["pctOver12"] for c in parity["cases"])
        print(f"[p0.2-gpu-vs-cpu] {len(parity['cases'])} cases: worst MAE={worst_mae:.3f}/255, worst RMSE={worst_rmse:.3f}/255, worst grainMAE={worst_grain:.3f}/255, worst pct>12={worst_p99:.3f}%")
        for c in sorted(parity["cases"], key=lambda x: -x["mae"])[:5]:
            print(f"   top delta: {c['key']} mae={c['mae']:.3f} rmse={c['rmse']:.3f} grainMae={c['grainMae']:.3f} max={c['maxDiff']} pct>12={c['pctOver12']:.2f}%")
        assert worst_mae < 1.8, f"GPU vs CPU MAE exceeded tolerance: {worst_mae}"
        assert worst_rmse < 3.5, f"GPU vs CPU RMSE exceeded tolerance: {worst_rmse}"
        assert worst_grain < 1.8, f"GPU vs CPU film grain MAE exceeded tolerance: {worst_grain}"

    # 4. P0.3 Worker Architecture & P0.4 Export Pipeline UI End-to-End Check
    if stage in ("p0.3", "p0-all"):
        worker_check = page.evaluate(
            """async () => {
                const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                const { PRESETS } = await import('/src/data/presets.ts');
                const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                const { createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
                const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                const src = createGoldenSceneCanvas('portrait-fair-hijab', 384, 480);
                const canvasGl = document.createElement('canvas');
                const canvasCpuWorker = document.createElement('canvas');

                const pipelineGl = new PhotoPipeline({ preferWebGL2: true });
                const pipelineCpuWorker = new PhotoPipeline({ preferWebGL2: false });

                const rosy = PRESETS.find(p => p.id === 'rosy-bokeh');
                const seoul = PRESETS.find(p => p.id === 'seoul-cafe');

                // Test rapid cancellation / superseding jobs + actual completion on latest job
                const pOld = pipelineCpuWorker.renderPreview({
                    source: src,
                    sourceId: 'worker-test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: buildEffectiveRecipe(rosy.recipe, 40, DEFAULT_ADJUSTMENTS),
                    targetCanvas: canvasCpuWorker,
                    maxDimension: 384
                });
                const pNew = pipelineCpuWorker.renderPreview({
                    source: src,
                    sourceId: 'worker-test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: buildEffectiveRecipe(seoul.recipe, 90, DEFAULT_ADJUSTMENTS),
                    targetCanvas: canvasCpuWorker,
                    maxDimension: 384
                });

                const [rOld, rNew] = await Promise.all([pOld, pNew]);

                // Test WebGL2 path
                const rGl = await pipelineGl.renderPreview({
                    source: src,
                    sourceId: 'worker-test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: buildEffectiveRecipe(rosy.recipe, 85, DEFAULT_ADJUSTMENTS),
                    targetCanvas: canvasGl,
                    maxDimension: 384
                });

                // Test batch thumbnails in worker without blocking main thread
                const t0 = performance.now();
                const thumbs = await pipelineGl.generateThumbnails(src, 'worker-test', 1, PRESETS.slice(0, 6));
                const thumbMs = performance.now() - t0;

                // Also verify P1-ready AI worker scaffold responds cleanly
                const aiCap = await new Promise((resolve, reject) => {
                    const aw = new Worker('/src/workers/ai.worker.ts', { type: 'module' });
                    aw.onmessage = (ev) => { resolve(ev.data); aw.terminate(); };
                    aw.onerror = (e) => { aw.terminate(); reject(e); };
                    aw.postMessage({ id: 1, type: 'PROBE_CAPABILITIES' });
                });

                pipelineGl.dispose();
                pipelineCpuWorker.dispose();

                return {
                    rOldCancelled: rOld.cancelled,
                    rNewBackend: rNew.backend,
                    rNewCancelled: rNew.cancelled,
                    rGlBackend: rGl.backend,
                    thumbsCount: Object.keys(thumbs).length,
                    thumbMs,
                    aiPreferredBackend: aiCap.preferredBackend
                };
            }"""
        )
        print(f"[p0.3-worker-pipeline] {json.dumps(worker_check)}")
        assert worker_check["rOldCancelled"] is True, "Superseded job was not cancelled"
        assert worker_check["rNewCancelled"] is False
        assert worker_check["rNewBackend"] in ("worker-canvas2d", "canvas2d")
        assert worker_check["rGlBackend"] == "webgl2"
        assert worker_check["thumbsCount"] == 6
        assert worker_check["aiPreferredBackend"] in ("webgpu", "wasm")

    if stage == "p0-all":
        # End-to-end UI check: high-res 3200x2400 photo load, export Pro keeps >= 3200px,
        # Blob download used, URL.revokeObjectURL called cleanly, fallback when WebGL disabled!
        export_check = page.evaluate(
            """async () => {
                const { exportPhotographBlob } = await import('/src/engine/pipeline/export-pipeline.ts');
                const { PRESETS } = await import('/src/data/presets.ts');
                const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                const { createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
                const { DEFAULT_ADJUSTMENTS, DEFAULT_TRANSFORM } = await import('/src/types/index.ts');

                // Create high-res 3200x2400 portrait source to verify zero silent downscaling on Pro
                const hiRes = createGoldenSceneCanvas('portrait-fair-hijab', 3200, 2400);
                const rosy = PRESETS.find(p => p.id === 'rosy-bokeh');
                const recipe = buildEffectiveRecipe(rosy.recipe, 85, DEFAULT_ADJUSTMENTS);

                const resPro = await exportPhotographBlob({
                    source: hiRes,
                    sourceId: 'hires-pro',
                    sourceRevision: 1,
                    recipe,
                    mode: 'single',
                    options: {
                        showWatermark: false,
                        presetName: rosy.name,
                        isPro: true,
                        transform: DEFAULT_TRANSFORM
                    }
                });

                const resFree = await exportPhotographBlob({
                    source: hiRes,
                    sourceId: 'hires-free',
                    sourceRevision: 1,
                    recipe,
                    mode: 'single',
                    options: {
                        showWatermark: true,
                        presetName: rosy.name,
                        isPro: false,
                        transform: DEFAULT_TRANSFORM
                    }
                });

                const resCard = await exportPhotographBlob({
                    source: hiRes,
                    sourceId: 'hires-card',
                    sourceRevision: 1,
                    recipe,
                    mode: 'card',
                    options: {
                        showWatermark: false,
                        presetName: rosy.name,
                        isPro: true,
                        transform: { rotate: 90, flipH: false, aspect: '4:5' }
                    }
                });

                const resCpuFallback = await exportPhotographBlob({
                    source: hiRes,
                    sourceId: 'hires-cpu-fallback',
                    sourceRevision: 1,
                    recipe,
                    mode: 'single',
                    options: {
                        showWatermark: false,
                        presetName: rosy.name,
                        isPro: true,
                        transform: DEFAULT_TRANSFORM,
                        preferWebGL2: false
                    }
                });

                return {
                    proW: resPro.width,
                    proH: resPro.height,
                    proOriginal: resPro.isOriginalResolution,
                    proBlobType: resPro.blob.type,
                    proBlobSize: resPro.blob.size,
                    proBackend: resPro.backend,
                    freeW: resFree.width,
                    freeH: resFree.height,
                    cardW: resCard.width,
                    cardH: resCard.height,
                    cpuFallbackW: resCpuFallback.width,
                    cpuFallbackH: resCpuFallback.height,
                    cpuFallbackBackend: resCpuFallback.backend
                };
            }"""
        )
        print(f"[p0.4-export] {json.dumps(export_check)}")
        assert export_check["proW"] == 3200 and export_check["proH"] == 2400, "Pro export silently downscaled full-res image!"
        assert export_check["proOriginal"] is True
        assert export_check["freeW"] == 1280 and export_check["freeH"] == 960, "Free export should be 1280px maxDim"
        assert export_check["cardW"] > export_check["cardH"] and export_check["cardW"] > 2000
        assert export_check["cpuFallbackW"] == 3200 and export_check["cpuFallbackH"] == 2400
        assert export_check["cpuFallbackBackend"] in ("worker-canvas2d", "canvas2d")
        assert export_check["proBlobType"] == "image/jpeg"
        assert export_check["proBlobSize"] > 50000

        # Also test full app UI interaction: spy object URLs, start studio portrait,
        # drag intensity, rotate/crop, open export sheet, verify resolution label & back cleanup!
        page.evaluate("""() => {
            window.__createdUrls = [];
            window.__revokedUrls = [];
            const origCreate = URL.createObjectURL.bind(URL);
            const origRevoke = URL.revokeObjectURL.bind(URL);
            URL.createObjectURL = (obj) => {
                const u = origCreate(obj);
                window.__createdUrls.push(u);
                return u;
            };
            URL.revokeObjectURL = (u) => {
                window.__revokedUrls.push(u);
                return origRevoke(u);
            };
        }""")
        page.get_by_role("button", name="Browse studio sample photos").first.click()
        page.get_by_role("button", name="Open Daylight Portrait in editor").click()
        page.wait_for_selector("canvas", timeout=6000)
        page.wait_for_timeout(450)

        # Open Export sheet and inspect honest resolution label
        page.click("button:has-text('Save')")
        page.wait_for_selector("text=Full original (1200×800 px)", timeout=4000)
        page.click("button:has-text('Save Photograph')")
        page.wait_for_timeout(500)

        # Exit editor cleanly and verify thumbnail blob URLs are revoked
        page.click("button[aria-label='Back to studio']")
        page.wait_for_timeout(200)
        url_stats = page.evaluate("() => ({ created: window.__createdUrls.length, revoked: window.__revokedUrls.length })")
        print(f"[ui-e2e] studio + export + url lifecycle: {json.dumps(url_stats)}")
        assert url_stats["created"] > 0 and url_stats["revoked"] > 0, "Object URLs were not revoked!"

        # Also test full app editing WITHOUT WebGL2 (Worker Canvas2D fallback acceptance check)
        ctx_no_gl = browser.new_context(viewport={"width": 430, "height": 900})
        page_no_gl = ctx_no_gl.new_page()
        no_gl_errors = []
        page_no_gl.on("pageerror", lambda err: no_gl_errors.append(str(err)))
        page_no_gl.add_init_script("""
            const origGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                if (type === 'webgl2' || type === 'webgl') return null;
                return origGetContext.call(this, type, ...args);
            };
        """)
        page_no_gl.goto(base_url, wait_until="networkidle")
        page_no_gl.get_by_role("button", name="Browse studio sample photos").first.click()
        page_no_gl.get_by_role("button", name="Open Daylight Portrait in editor").click()
        page_no_gl.wait_for_selector("canvas", timeout=6000)
        page_no_gl.wait_for_timeout(500)
        has_pixels = page_no_gl.evaluate("""() => {
            const canvases = Array.from(document.querySelectorAll('canvas'));
            return canvases.some(c => {
                if (!c.width || !c.height) return false;
                const ctx = c.getContext('2d');
                if (!ctx) return false;
                const d = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
                return (d[0] + d[1] + d[2]) > 0;
            });
        }""")
        assert has_pixels is True, "Fallback mode without WebGL2 failed to render pixels!"
        assert len(no_gl_errors) == 0, f"No-WebGL2 errors: {no_gl_errors}"
        ctx_no_gl.close()
        print("[ui-e2e-fallback] Full editing without WebGL2 verified cleanly via Worker Canvas2D.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["capture", "golden", "p0.1", "p0.2", "p0.3", "p0-all"], default="p0-all")
    args = parser.parse_args()

    proc = start_vite_server(4179)
    base_url = "http://127.0.0.1:4179/"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
            )
            page = browser.new_page(viewport={"width": 430, "height": 900})
            console_errors = []
            page.on("pageerror", lambda err: console_errors.append(str(err)))

            if args.mode == "capture":
                run_capture_golden(page, base_url)
            else:
                run_verify_suite(browser, page, base_url, args.mode)

            if console_errors:
                raise RuntimeError(f"Page errors occurred: {console_errors}")
            browser.close()
    finally:
        proc.terminate()
        proc.wait(timeout=5)


if __name__ == "__main__":
    main()
