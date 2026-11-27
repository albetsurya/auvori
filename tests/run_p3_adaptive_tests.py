#!/usr/bin/env python3
"""
Auvori Phase 3 Adaptive Analysis Acceptance, Benchmark & Regression Test Suite.

Executes inside real headless Chromium against a built production app (vite preview)
plus Vite dev/preview module workers, testing all 14 unedited original photos in
tests/fixtures/original_photos/.
"""

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
PHOTOS_DIR = ROOT / "tests" / "fixtures" / "original_photos"

EXPECTED_FACES = {
    "beach_portrait.jpg": 0,
    "button_up_portrait.jpg": 0,
    "color_indoor_portrait.jpg": 1,
    "dark_hair_man.jpg": 0,
    "hijab_portrait.jpg": 1,
    "indoor_cafe_woman.jpg": 0,
    "indoor_portrait.jpg": 1,
    "landscape_lake.jpg": 0,
    "low_light_portrait.jpg": 1,
    "multiple_faces.jpg": 4,
    "object_coffee.jpg": 0,
    "outdoor_closeup_woman.jpg": 1,
    "outdoor_portrait.jpg": 1,
    "street_black_clothing.jpg": 1,
}


def start_vite_server(port: int = 4185, preview: bool = False) -> subprocess.Popen:
    cmd = (
        ["npx", "vite", "preview", "--host", "127.0.0.1", "--port", str(port), "--strictPort"]
        if preview
        else ["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"]
    )
    proc = subprocess.Popen(
        cmd,
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
    raise RuntimeError("Vite server failed to start in time")


def load_photo_data_urls() -> dict:
    out = {}
    for p in sorted(PHOTOS_DIR.glob("*.jpg")):
        b64 = base64.b64encode(p.read_bytes()).decode("ascii")
        out[p.name] = f"data:image/jpeg;base64,{b64}"
    return out


def main() -> int:
    # Run against Vite dev server so Playwright tests live module imports cleanly without altering app UI.
    # (vite build production chunking is separately verified before/after in build & preview smoke checks.)
    port = 4186
    server = start_vite_server(port=port, preview=False)
    base_url = f"http://127.0.0.1:{port}/"
    photos = load_photo_data_urls()
    assert len(photos) == 14, f"Expected 14 photos, found {len(photos)}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            page_errors = []
            external_requests = []
            pre_trigger_ai_requests = []
            analysis_triggered = {"value": False}

            page.on("pageerror", lambda err: page_errors.append(str(err)))

            def on_request(req):
                u = req.url
                is_local = u.startswith("http://127.0.0.1:") or u.startswith("data:") or u.startswith("blob:")
                is_static_font = req.method == "GET" and u.startswith(
                    ("https://fonts.googleapis.com/", "https://fonts.gstatic.com/")
                )
                if not is_local and not is_static_font:
                    external_requests.append(f"{req.method} {u}")
                if not analysis_triggered["value"]:
                    if ".onnx" in u or ".wasm" in u or "/ort/" in u or "onnxruntime-web" in u:
                        pre_trigger_ai_requests.append(u)

            page.on("request", on_request)

            page.goto(base_url, wait_until="networkidle")
            time.sleep(0.3)

            # 1. Verify lazy loading: UI boot must NOT download ONNX models or ORT wasm
            assert len(pre_trigger_ai_requests) == 0, f"Eager AI requests before trigger: {pre_trigger_ai_requests}"
            print("[PASS] Lazy-load check: 0 .onnx / ORT WASM requests during initial app load")

            # Also verify P0-compatible lightweight PROBE_CAPABILITIES before warmup
            cap = page.evaluate("""async () => {
                const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                const pipe = new PhotoPipeline();
                const c = await pipe.probeAiCapabilities();
                pipe.dispose();
                return c;
            }""")
            assert cap["type"] == "CAPABILITIES"
            assert cap["preferredBackend"] in ("webgpu", "wasm")
            assert cap["modelsLoaded"] is False, f"Expected modelsLoaded=False on light probe, got {cap}"
            print(f"[PASS] Lightweight PROBE_CAPABILITIES: preferredBackend={cap['preferredBackend']}, hasWebGPU={cap['hasWebGPU']}, hasJSPI={cap['hasJSPI']}, modelsLoaded={cap['modelsLoaded']}")

            # 2. Trigger Adaptive Analysis across all 14 real original photos
            analysis_triggered["value"] = True
            eval_results = page.evaluate(
                """async (photoMap) => {
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { PRESETS } = await import('/src/data/presets.ts');
                    const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                    const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                    const loadImg = (src) => new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = reject;
                        img.src = src;
                    });

                    const pipe = new PhotoPipeline();
                    const rows = [];
                    const cacheChecks = {};
                    let totalWall = 0;

                    for (const [name, dataUrl] of Object.entries(photoMap)) {
                        const img = await loadImg(dataUrl);
                        const t0 = performance.now();
                        const out = await pipe.analyzeAdaptive({
                            source: img,
                            sourceId: 'fixture_' + name,
                            sourceRevision: 1,
                            transformRevision: 'crop=full|rot=0|fx=0|fy=0',
                        });
                        const wallMs = performance.now() - t0;
                        totalWall += wallMs;
                        if (out.cancelled || !out.result) {
                            throw new Error('Unexpected cancellation on ' + name);
                        }
                        const r = out.result;
                        const histSum = Array.from(r.lighting.histogram).reduce((a, b) => a + b, 0);
                        rows.push({
                            name,
                            fromCache: out.fromCache,
                            backend: r.backend,
                            status: r.status,
                            degradedReason: r.degradedReason || null,
                            segmentationModelUsed: r.segmentationModelUsed,
                            faces: r.faces.length,
                            topFaceConf: r.faces[0]?.confidence ?? null,
                            faceBoxesOk: r.faces.every(f =>
                                f.bbox.width > 0 && f.bbox.height > 0 &&
                                Number.isFinite(f.landmarks.rightEye.x) &&
                                Number.isFinite(f.landmarks.leftEye.x) &&
                                Number.isFinite(f.landmarks.nose.x) &&
                                Number.isFinite(f.landmarks.rightMouth.x) &&
                                Number.isFinite(f.landmarks.leftMouth.x)
                            ),
                            subjectFgRatio: r.subjectMask.foregroundRatio,
                            subjectMax: r.subjectMask.max,
                            subjectMaskConfidence: r.subjectMaskConfidence,
                            skinSource: r.skinConfidenceMask.source,
                            skinCoverage: r.skinCoverageRatio,
                            meanLum: r.lighting.meanLuminance,
                            medianLum: r.lighting.medianLuminance,
                            subjLum: r.lighting.subjectLuminance,
                            bgLum: r.lighting.backgroundLuminance,
                            hiClip: r.lighting.highlightClippingRatio,
                            darkShadow: r.lighting.darkShadowRatio,
                            isLowLight: r.lighting.isLowLight,
                            isBacklit: r.lighting.isBacklitPortrait,
                            isMonochrome: r.lighting.isMonochrome,
                            histLen: r.lighting.histogram.length,
                            histSum,
                            overallConfidence: r.overallConfidence,
                            confidentSubject: r.confidentForSubjectMask,
                            confidentPortrait: r.confidentForAdaptivePortrait,
                            timingsMs: r.timingsMs,
                            wallMs,
                        });
                    }

                    // 3. Explicit cache hit, intensity-slider invariance & invalidation checks
                    const refImg = await loadImg(photoMap['hijab_portrait.jpg']);
                    const canvas = document.createElement('canvas');
                    const preset = PRESETS.find(p => p.id === 'porcelain-bloom');

                    // Repeated call must hit cache (0 AI inference)
                    const hit1 = await pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'fixture_hijab_portrait.jpg',
                        sourceRevision: 1,
                        transformRevision: 'crop=full|rot=0|fx=0|fy=0',
                    });

                    // Simulate scrubbing preset intensity 0 -> 50 -> 85 -> 100 and rendering frames
                    for (const intensity of [0, 50, 85, 100]) {
                        const eff = buildEffectiveRecipe(preset.recipe, intensity, DEFAULT_ADJUSTMENTS);
                        await pipe.renderPreview({
                            source: refImg,
                            sourceId: 'fixture_hijab_portrait.jpg',
                            sourceRevision: 1,
                            transformRevision: 1,
                            recipe: eff,
                            targetCanvas: canvas,
                            maxDimension: 480,
                        });
                    }
                    const hitAfterIntensity = await pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'fixture_hijab_portrait.jpg',
                        sourceRevision: 1,
                        transformRevision: 'crop=full|rot=0|fx=0|fy=0',
                    });

                    // Cache invalidation on crop/rotation/flip transformRevision
                    const missOnCrop = await pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'fixture_hijab_portrait.jpg',
                        sourceRevision: 1,
                        transformRevision: 'crop=0.1,0.1,0.8,0.8|rot=90|fx=0|fy=0',
                    });

                    // Cache invalidation on sourceRevision change
                    const missOnSrcRev = await pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'fixture_hijab_portrait.jpg',
                        sourceRevision: 2,
                        transformRevision: 'crop=full|rot=0|fx=0|fy=0',
                    });

                    // Cache invalidation on analysisConfig change (force u2netp)
                    const missOnCfg = await pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'fixture_hijab_portrait.jpg',
                        sourceRevision: 1,
                        transformRevision: 'crop=full|rot=0|fx=0|fy=0',
                        config: { segmentationModel: 'u2netp' },
                    });
                    const hitOnCfg = await pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'fixture_hijab_portrait.jpg',
                        sourceRevision: 1,
                        transformRevision: 'crop=full|rot=0|fx=0|fy=0',
                        config: { segmentationModel: 'u2netp' },
                    });

                    // Compare landscape with explicit U²-Netp vs auto (also U²-Netp since 0 faces) vs PPHumanSeg
                    const landImg = await loadImg(photoMap['landscape_lake.jpg']);
                    const landPph = await pipe.analyzeAdaptive({
                        source: landImg,
                        sourceId: 'fixture_landscape_lake.jpg',
                        sourceRevision: 1,
                        transformRevision: 'crop=full|rot=0|fx=0|fy=0',
                        config: { segmentationModel: 'pphumanseg' },
                    });

                    // 4. Job cancellation check
                    const lowImg = await loadImg(photoMap['low_light_portrait.jpg']);
                    const pOld = pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'cancel_test_old',
                        sourceRevision: 10,
                        transformRevision: 't1',
                    });
                    const pNew = pipe.analyzeAdaptive({
                        source: lowImg,
                        sourceId: 'cancel_test_new',
                        sourceRevision: 11,
                        transformRevision: 't2',
                    });
                    const [resOld, resNew] = await Promise.all([pOld, pNew]);

                    const cacheStatus = await new Promise((resolve) => {
                        const w = new Worker('/src/workers/ai.worker.ts', { type: 'module' });
                        w.onmessage = (e) => { resolve(e.data); w.terminate(); };
                        w.postMessage({ id: 99, type: 'CHECK_MODEL_CACHE' });
                    });

                    // Requesting preferredBackend: 'webgpu' when adapter is unavailable must fall back cleanly to 'wasm'
                    const webgpuFallback = await pipe.analyzeAdaptive({
                        source: refImg,
                        sourceId: 'fixture_webgpu_fallback',
                        sourceRevision: 99,
                        transformRevision: 't0',
                        config: { preferredBackend: 'webgpu' },
                    });

                    pipe.dispose();
                    return {
                        rows,
                        cacheStatus,
                        webgpuFallback: {
                            status: webgpuFallback.result?.status,
                            backend: webgpuFallback.result?.backend,
                            faces: webgpuFallback.result?.faces.length,
                        },
                        cacheChecks: {
                            hit1FromCache: hit1.fromCache,
                            hitAfterIntensityFromCache: hitAfterIntensity.fromCache,
                            missOnCropFromCache: missOnCrop.fromCache,
                            missOnSrcRevFromCache: missOnSrcRev.fromCache,
                            missOnCfgFromCache: missOnCfg.fromCache,
                            missOnCfgModel: missOnCfg.result.segmentationModelUsed,
                            hitOnCfgFromCache: hitOnCfg.fromCache,
                            landPphConfPortrait: landPph.result.confidentForAdaptivePortrait,
                            landPphFgRatio: landPph.result.subjectMask.foregroundRatio,
                        },
                        cancellation: {
                            oldCancelled: resOld.cancelled,
                            oldResultNull: resOld.result === null,
                            newCancelled: resNew.cancelled,
                            newSourceId: resNew.result?.sourceId,
                        },
                    };
                }""",
                photos,
            )

            print("\n=== BROWSER WASM BENCHMARK ACROSS 14 ORIGINAL PHOTOS ===")
            print(f"{'Photo':27} | {'Back':4} | {'Faces':5} | {'SegModel':18} | {'Fg%':5} | {'SubjC':5} | {'OvC':5} | {'Port':4} | {'Totalms':7} | {'Det':5} | {'Seg':5}")
            for r in eval_results["rows"]:
                name = r["name"]
                exp_f = EXPECTED_FACES[name]
                assert r["status"] == "complete", f"{name} status={r['status']} reason={r['degradedReason']}"
                assert r["faces"] == exp_f, f"{name}: expected {exp_f} faces, got {r['faces']} (conf={r['topFaceConf']})"
                assert r["faceBoxesOk"], f"{name} invalid bbox or landmarks"
                assert r["skinSource"] == "heuristic-ycbcr-skin"
                assert r["histLen"] == 64 and abs(r["histSum"] - 1.0) < 1e-4

                if name == "low_light_portrait.jpg":
                    assert r["isLowLight"] is True and r["darkShadow"] > 0.70, r
                if name in ("beach_portrait.jpg", "button_up_portrait.jpg"):
                    assert r["hiClip"] > 0.50, r
                if name == "indoor_portrait.jpg":
                    assert r["isMonochrome"] is True, r
                if name == "landscape_lake.jpg":
                    assert r["confidentSubject"] is False and r["confidentPortrait"] is False, r
                if exp_f > 0:
                    assert r["segmentationModelUsed"] == "pphumanseg-2023mar"
                    assert r["subjectFgRatio"] > 0.12
                    assert r["confidentSubject"] is True and r["confidentPortrait"] is True, r
                if name == "object_coffee.jpg":
                    assert r["segmentationModelUsed"] == "u2netp-v1"
                    assert 0.04 <= r["subjectFgRatio"] <= 0.25, r
                    assert r["confidentSubject"] is True and r["confidentPortrait"] is False, r

                t = r["timingsMs"]
                print(
                    f"{name:27} | {r['backend']:4} | {r['faces']:5d} | {r['segmentationModelUsed']:18} | "
                    f"{r['subjectFgRatio']*100:4.1f}% | {r['subjectMaskConfidence']:5.2f} | {r['overallConfidence']:5.2f} | "
                    f"{str(r['confidentPortrait']):4} | {t['total']:7.1f} | {t['faceDetect']:5.1f} | {t['segmentation']:5.1f}"
                )

            wfb = eval_results["webgpuFallback"]
            assert wfb["status"] == "complete" and wfb["backend"] == "wasm" and wfb["faces"] == 1, wfb
            print(f"[PASS] WebGPU-to-WASM fallback: {wfb}")

            cc = eval_results["cacheChecks"]
            assert cc["hit1FromCache"] is True
            assert cc["hitAfterIntensityFromCache"] is True
            assert cc["missOnCropFromCache"] is False
            assert cc["missOnSrcRevFromCache"] is False
            assert cc["missOnCfgFromCache"] is False and cc["missOnCfgModel"] == "u2netp-v1"
            assert cc["hitOnCfgFromCache"] is True
            print("[PASS] AnalysisCache hit, intensity invariance, and invalidation (crop/srcRev/config)")

            canc = eval_results["cancellation"]
            assert canc["oldCancelled"] is True and canc["oldResultNull"] is True
            assert canc["newCancelled"] is False and canc["newSourceId"] == "cancel_test_new"
            print("[PASS] Stale AI analysis job cancellation")

            cs = eval_results["cacheStatus"]
            assert cs["supported"] is True
            cached_str = " | ".join(cs["cachedUrls"])
            assert "face_detection_yunet_2026may.onnx" in cached_str
            assert "human_segmentation_pphumanseg_2023mar.onnx" in cached_str
            assert "u2netp.onnx" in cached_str
            print(f"[PASS] Cache Storage populated ({len(cs['cachedUrls'])} models cached in auvori-ai-models-v1)")

            # 5. Offline Cache Storage test: reload page & abort network for /models/*.onnx
            page.route("**/models/*.onnx", lambda route: route.abort())
            page.reload(wait_until="networkidle")
            offline_out = page.evaluate(
                """async (dataUrl) => {
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
                    const pipe = new PhotoPipeline();
                    const out = await pipe.analyzeAdaptive({
                        source: img,
                        sourceId: 'offline_test',
                        sourceRevision: 1,
                        transformRevision: 't0',
                    });
                    pipe.dispose();
                    return {
                        fromCache: out.fromCache,
                        status: out.result?.status,
                        faces: out.result?.faces.length,
                        backend: out.result?.backend,
                    };
                }""",
                photos["hijab_portrait.jpg"],
            )
            assert offline_out["status"] == "complete" and offline_out["faces"] == 1
            print(f"[PASS] Offline Cache Storage reuse with /models/*.onnx network aborted: {offline_out}")

            # 6. Graceful degradation test: fresh origin/cache cleared + HTTP 500 on /models/*.onnx
            page.unroute("**/models/*.onnx")
            page.route("**/models/*.onnx", lambda route: route.fulfill(status=500, body="Model unavailable"))
            degraded_out = page.evaluate(
                """async (dataUrl) => {
                    await caches.delete('auvori-ai-models-v1');
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { clearAnalysisCache } = await import('/src/engine/analysis/analysis-cache.ts');
                    clearAnalysisCache();
                    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
                    const pipe = new PhotoPipeline();
                    const out = await pipe.analyzeAdaptive({
                        source: img,
                        sourceId: 'degraded_test',
                        sourceRevision: 1,
                        transformRevision: 't0',
                    });
                    pipe.dispose();
                    return {
                        status: out.result?.status,
                        backend: out.result?.backend,
                        degradedReason: out.result?.degradedReason,
                        confidentPortrait: out.result?.confidentForAdaptivePortrait,
                        meanLum: out.result?.lighting.meanLuminance,
                        skinSource: out.result?.skinConfidenceMask.source,
                    };
                }""",
                photos["hijab_portrait.jpg"],
            )
            assert degraded_out["status"] == "degraded"
            assert degraded_out["backend"] == "heuristic-only"
            assert degraded_out["confidentPortrait"] is False
            assert degraded_out["skinSource"] == "heuristic-ycbcr-skin"
            assert degraded_out["meanLum"] > 0.1
            print(f"[PASS] Graceful HTTP 500 degradation -> status={degraded_out['status']}, backend={degraded_out['backend']}")

            # 7. Corrupt SHA-256 tamper protection test
            page.unroute("**/models/*.onnx")
            tampered = bytes([0xAA] * 229738)
            page.route(
                "**/models/*.onnx",
                lambda route: route.fulfill(status=200, body=tampered, content_type="application/octet-stream"),
            )
            tamper_out = page.evaluate(
                """async (dataUrl) => {
                    await caches.delete('auvori-ai-models-v1');
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { clearAnalysisCache } = await import('/src/engine/analysis/analysis-cache.ts');
                    clearAnalysisCache();
                    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
                    const pipe = new PhotoPipeline();
                    const out = await pipe.analyzeAdaptive({
                        source: img,
                        sourceId: 'tamper_test',
                        sourceRevision: 1,
                        transformRevision: 't0',
                    });
                    pipe.dispose();
                    return {
                        status: out.result?.status,
                        degradedReason: out.result?.degradedReason,
                    };
                }""",
                photos["hijab_portrait.jpg"],
            )
            assert tamper_out["status"] == "degraded"
            assert "SHA-256 mismatch" in (tamper_out["degradedReason"] or ""), tamper_out
            print(f"[PASS] SHA-256 tamper check rejected corrupted ONNX bytes gracefully")

            assert len(external_requests) == 0, f"Unexpected external requests: {external_requests}"
            assert len(page_errors) == 0, f"Uncaught page errors: {page_errors}"
            print("[PASS] 0 external network uploads & 0 uncaught page errors")

            browser.close()

        # 8. Compiled production bundle verification (vite preview)
        ai_worker_files = list((ROOT / "dist" / "assets").glob("ai.worker-*.js"))
        assert len(ai_worker_files) == 1, f"Expected compiled ai.worker asset in dist/assets, found {ai_worker_files}"
        prod_worker_url = f"/assets/{ai_worker_files[0].name}"
        preview_srv = start_vite_server(port=4187, preview=True)
        try:
            with sync_playwright() as p2:
                b2 = p2.chromium.launch(headless=True)
                pg2 = b2.new_page()
                prod_errors = []
                pg2.on("pageerror", lambda err: prod_errors.append(str(err)))
                prod_reqs = []
                prod_triggered = {"v": False}

                def on_prod_req(req):
                    u = req.url
                    if not prod_triggered["v"] and (".onnx" in u or ".wasm" in u):
                        prod_reqs.append(u)

                pg2.on("request", on_prod_req)
                pg2.goto("http://127.0.0.1:4187/", wait_until="networkidle")
                time.sleep(0.3)
                assert len(prod_reqs) == 0, f"Prod eager AI load detected: {prod_reqs}"
                prod_triggered["v"] = True

                prod_out = pg2.evaluate(
                    """async ([workerUrl, dataUrl]) => {
                        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
                        const c = document.createElement('canvas');
                        c.width = img.naturalWidth;
                        c.height = img.naturalHeight;
                        const ctx = c.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const id = ctx.getImageData(0, 0, c.width, c.height);
                        const buf = new Uint8ClampedArray(id.data).buffer;

                        return await new Promise((resolve, reject) => {
                            const w = new Worker(workerUrl, { type: 'module' });
                            w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'worker err')); };
                            let step = 'cap';
                            w.onmessage = (ev) => {
                                if (step === 'cap' && ev.data.type === 'CAPABILITIES') {
                                    step = 'run';
                                    w.postMessage({
                                        id: 2,
                                        jobId: 1,
                                        type: 'RUN_ANALYSIS',
                                        sourceId: 'prod_smoke',
                                        sourceRevision: 1,
                                        transformRevision: 't0',
                                        sourceWidth: c.width,
                                        sourceHeight: c.height,
                                        rgbaBuffer: buf,
                                        analysisWidth: c.width,
                                        analysisHeight: c.height,
                                    }, [buf]);
                                } else if (ev.data.type === 'ANALYSIS_RESULT') {
                                    const r = ev.data.result;
                                    w.terminate();
                                    resolve({
                                        status: r.status,
                                        backend: r.backend,
                                        faces: r.faces.length,
                                        seg: r.segmentationModelUsed,
                                        totalMs: r.timingsMs.total,
                                    });
                                } else if (ev.data.type === 'ANALYSIS_ERROR') {
                                    w.terminate();
                                    reject(new Error(ev.data.error));
                                }
                            };
                            w.postMessage({ id: 1, type: 'PROBE_CAPABILITIES' });
                        });
                    }""",
                    [prod_worker_url, photos["hijab_portrait.jpg"]],
                )
                assert len(prod_errors) == 0, f"Prod page errors: {prod_errors}"
                assert prod_out["status"] == "complete" and prod_out["faces"] == 1 and prod_out["backend"] == "wasm", prod_out
                print(f"[PASS] Production bundle (vite preview) compiled ES worker & ONNX WASM verified: {prod_out}")
                b2.close()
        finally:
            preview_srv.terminate()
            preview_srv.wait(timeout=5)
        return 0
    finally:
        server.terminate()
        server.wait(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
