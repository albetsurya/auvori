#!/usr/bin/env python3
"""
Auvori Phase 6.2A — WebGL2 Renderer State Leakage & Determinism Test Runner.

Executes Tests A through G on WebGL2Renderer:
  Test A — Identical repeated rendering (hasBokeh enabled)
  Test B — Interleaved rendering (Render A -> Render B -> Render A)
  Test C — Feature toggling (Bokeh ON -> Bokeh OFF -> Bokeh ON)
  Test D — Preset switching (Legacy -> Signature -> Direct Flash -> Night Cinema -> Legacy)
  Test E — Resolution switching (Preview -> Full-res -> Preview)
  Test F — Renderer lifecycle (Instance 1 -> Dispose -> Instance 2)
  Test G — Error recovery (Controlled failure -> Reuse -> Valid render)

Principle: Same Input + Same Configuration + Same Renderer State = Same Output (MAE = 0.000 / maxDiff = 0).
"""

from __future__ import annotations

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
GOLD_DIR = ROOT / "tests" / "fixtures" / "opensource_photos" / "gold_standard"
ORIG_DIR = ROOT / "tests" / "fixtures" / "original_photos"
NIGHT_DIR = ROOT / "tests" / "fixtures" / "night_photos"
REPORT_DIR = ROOT / "tests" / "reports" / "phase6_2"


def start_vite_server(port: int = 4196) -> subprocess.Popen:
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


def run_determinism_suite() -> dict:
    srv = start_vite_server(4196)
    base_url = "http://127.0.0.1:4196/"

    photo_a_path = GOLD_DIR / "p6_03_laundromat_reflection.jpg"
    photo_b_path = GOLD_DIR / "p6_06_harsh_sun_cliff_couple.jpg"
    photo_night_path = NIGHT_DIR / "night_street_portrait.jpg"

    photo_a_url = file_to_data_url(photo_a_path)
    photo_b_url = file_to_data_url(photo_b_path)
    photo_night_url = file_to_data_url(photo_night_path)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"],
            )
            ctx = browser.new_context(viewport={"width": 1280, "height": 860})
            page = ctx.new_page()
            page_errors = []
            page.on("pageerror", lambda err: page_errors.append(str(err)))
            page.goto(base_url, wait_until="networkidle")

            results = page.evaluate(
                """async ({ urlA, urlB, urlNight }) => {
                    const { PRESETS } = await import('/src/data/presets.ts');
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                    const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                    const loadImg = (src) => new Promise((res, rej) => {
                        const img = new Image();
                        img.onload = () => res(img);
                        img.onerror = rej;
                        img.src = src;
                    });

                    const [imgA, imgB, imgNight] = await Promise.all([
                        loadImg(urlA),
                        loadImg(urlB),
                        loadImg(urlNight),
                    ]);

                    const pRosy = PRESETS.find(p => p.id === 'rosy-bokeh');
                    const pPorcelain = PRESETS.find(p => p.id === 'porcelain-bloom');
                    const pSeoul = PRESETS.find(p => p.id === 'seoul-cafe');
                    const pDirectFlash = PRESETS.find(p => p.id === 'direct-flash');
                    const pNightCinema = PRESETS.find(p => p.id === 'night-cinema');

                    const effRosy = buildEffectiveRecipe(pRosy.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const effPorcelain = buildEffectiveRecipe(pPorcelain.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const effSeoul = buildEffectiveRecipe(pSeoul.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const effDF = buildEffectiveRecipe(pDirectFlash.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const effNC = buildEffectiveRecipe(pNightCinema.recipe, 100, DEFAULT_ADJUSTMENTS);

                    // AI analyses
                    const aiPipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                    const analysisA = (await aiPipe.analyzeAdaptive({ source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 't0' })).result;
                    const analysisB = (await aiPipe.analyzeAdaptive({ source: imgB, sourceId: 'imgB', sourceRevision: 1, transformRevision: 't0' })).result;
                    const analysisNight = (await aiPipe.analyzeAdaptive({ source: imgNight, sourceId: 'imgNight', sourceRevision: 1, transformRevision: 't0' })).result;
                    aiPipe.dispose();

                    const compareBuffers = (b1, b2) => {
                        if (b1.length !== b2.length) return { pass: false, error: 'length mismatch: ' + b1.length + ' vs ' + b2.length };
                        let diffCount = 0;
                        let sumDiff = 0;
                        let maxDiff = 0;
                        for (let i = 0; i < b1.length; i++) {
                            const d = Math.abs(b1[i] - b2[i]);
                            if (d > 0) {
                                diffCount++;
                                sumDiff += d;
                                if (d > maxDiff) maxDiff = d;
                            }
                        }
                        const mae = b1.length > 0 ? sumDiff / b1.length : 0;
                        return {
                            diffCount,
                            maxDiff,
                            mae,
                            totalPixels: b1.length / 4,
                            pass: diffCount === 0 && maxDiff === 0
                        };
                    };

                    const renderToBytes = async (pipe, req) => {
                        const target = document.createElement('canvas');
                        await pipe.renderPreview({ ...req, targetCanvas: target });
                        const ctx = target.getContext('2d');
                        return new Uint8ClampedArray(ctx.getImageData(0, 0, target.width, target.height).data);
                    };

                    const suite = {};

                    // Test A — Identical repeated rendering on same WebGL2Renderer instance
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const bytes1 = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        const bytes2 = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        const bytes3 = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effPorcelain, maxDimension: 480, includeGrain: false
                        });
                        const bytes4 = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effPorcelain, maxDimension: 480, includeGrain: false
                        });
                        pipe.dispose();

                        suite.testA_rosy = compareBuffers(bytes1, bytes2);
                        suite.testA_porcelain = compareBuffers(bytes3, bytes4);
                    }

                    // Test B — Interleaved rendering (A -> B -> A)
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const aFirst = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        await renderToBytes(pipe, {
                            source: imgB, sourceId: 'imgB', sourceRevision: 1, transformRevision: 1,
                            recipe: effPorcelain, maxDimension: 480, includeGrain: false
                        });
                        const aSecond = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        pipe.dispose();

                        suite.testB_interleaved = compareBuffers(aFirst, aSecond);
                    }

                    // Test C — Feature toggling (Bokeh ON -> Bokeh OFF -> Bokeh ON)
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const effNoBokeh = { ...effRosy, bgBokeh: 0 };
                        const onFirst = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effNoBokeh, maxDimension: 480, includeGrain: false
                        });
                        const onSecond = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        pipe.dispose();

                        suite.testC_featureToggle = compareBuffers(onFirst, onSecond);
                    }

                    // Test D — Preset switching (Legacy -> Signature -> Direct Flash -> Night Cinema -> Legacy)
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const legFirst = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effSeoul, maxDimension: 480, includeGrain: false
                        });
                        await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effPorcelain, maxDimension: 480, includeGrain: false
                        });
                        await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effDF, analysisResult: analysisA, maxDimension: 480, includeGrain: false
                        });
                        await renderToBytes(pipe, {
                            source: imgNight, sourceId: 'imgNight', sourceRevision: 1, transformRevision: 1,
                            recipe: effNC, analysisResult: analysisNight, maxDimension: 480, includeGrain: false
                        });
                        const legSecond = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effSeoul, maxDimension: 480, includeGrain: false
                        });
                        pipe.dispose();

                        suite.testD_presetSwitch = compareBuffers(legFirst, legSecond);
                    }

                    // Test E — Resolution switching (Preview -> Full-res -> Preview)
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });

                        // Master canvas
                        const masterCanvas = document.createElement('canvas');
                        masterCanvas.width = imgA.naturalWidth || imgA.width;
                        masterCanvas.height = imgA.naturalHeight || imgA.height;
                        masterCanvas.getContext('2d').drawImage(imgA, 0, 0);

                        const c1 = document.createElement('canvas');
                        await pipe.renderPreview({
                            source: masterCanvas, sourceId: 'mcA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 320, includeGrain: false,
                            targetCanvas: c1
                        });
                        const b1 = new Uint8ClampedArray(c1.getContext('2d').getImageData(0,0,c1.width,c1.height).data);

                        const cMid = document.createElement('canvas');
                        await pipe.renderPreview({
                            source: masterCanvas, sourceId: 'mcA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 960, includeGrain: false,
                            targetCanvas: cMid
                        });

                        const c2 = document.createElement('canvas');
                        await pipe.renderPreview({
                            source: masterCanvas, sourceId: 'mcA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 320, includeGrain: false,
                            targetCanvas: c2
                        });
                        const b2 = new Uint8ClampedArray(c2.getContext('2d').getImageData(0,0,c2.width,c2.height).data);

                        pipe.dispose();

                        suite.testE_resolutionSwitch = compareBuffers(b1, b2);
                    }

                    // Test F — Renderer lifecycle (Instance 1 -> Dispose -> Instance 2)
                    {
                        const pipe1 = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const out1 = await renderToBytes(pipe1, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        pipe1.dispose();

                        const pipe2 = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const out2 = await renderToBytes(pipe2, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        pipe2.dispose();

                        suite.testF_lifecycle = compareBuffers(out1, out2);
                    }

                    // Test G — Error recovery (Controlled failure / invalid input -> reuse -> valid render)
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const validFirst = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });

                        // Trigger controlled error: empty 0x0 canvas or invalid source
                        try {
                            const dummyZero = document.createElement('canvas');
                            dummyZero.width = 0;
                            dummyZero.height = 0;
                            await renderToBytes(pipe, {
                                source: dummyZero, sourceId: 'zero', sourceRevision: 1, transformRevision: 1,
                                recipe: effRosy, maxDimension: 480, includeGrain: false
                            });
                        } catch (e) {
                            // expected handled error
                        }

                        const validSecond = await renderToBytes(pipe, {
                            source: imgA, sourceId: 'imgA', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, includeGrain: false
                        });
                        pipe.dispose();

                        suite.testG_errorRecovery = compareBuffers(validFirst, validSecond);
                    }

                    return suite;
                }""",
                {"urlA": photo_a_url, "urlB": photo_b_url, "urlNight": photo_night_url},
            )

            browser.close()
            return results
    finally:
        srv.terminate()
        srv.wait(timeout=5)


def main() -> int:
    print("=== Auvori Phase 6.2A — WebGL2 Renderer Determinism Suite ===")
    results = run_determinism_suite()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = REPORT_DIR / "renderer_determinism_report.json"
    out_file.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")

    all_pass = True
    for test_name, res in results.items():
        pass_str = "PASS" if res.get("pass") else "FAIL"
        print(f"[{pass_str}] {test_name}: diffCount={res.get('diffCount')} maxDiff={res.get('maxDiff')} MAE={res.get('mae', 0):.6f}")
        if not res.get("pass"):
            all_pass = False

    print(f"\nOverall Determinism: {'PASS' if all_pass else 'FAIL'}")
    print(f"Report written to: {out_file}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
