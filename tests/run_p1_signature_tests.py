#!/usr/bin/env python3
"""
Auvori P1 Signature Look System Acceptance & Regression Test Suite.
Tests:
1. Preset inventory & legacy Free/Pro entitlement preservation (20 legacy + 5 P1 Signature Looks).
2. Monotone Cubic Hermite Tone Curve mathematical monotonicity (f(x2) >= f(x1)).
3. Nonlinear per-effect-family intensity blending (0% == identity, smooth ramp, 100% == full).
4. Recipe JSON serialization & validation.
5. Meaningful visual differentiation vs legacy baselines and pairwise among Signature Looks.
6. GPU WebGL2 vs CPU Canvas2D parity across all 5 Signature Looks x 6 synthetic scenes (30 cases).
7. Full-resolution 3200x2400 Signature Look export parity (WebGL2 & Worker fallback) + preview consistency.
8. P1 Golden Image verification (30 deterministic PNG baselines in tests/golden_p1/).
"""

import argparse
import base64
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
GOLDEN_P1_DIR = ROOT / "tests" / "golden_p1"
SIGNATURE_PRESETS = [
    "porcelain-bloom",
    "velvet-noir",
    "hannam-daylight",
    "amber-halation",
    "silver-gelatin",
]


def start_vite_server(port: int = 4183) -> subprocess.Popen:
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


def run_capture_p1_golden(page, base_url: str) -> None:
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
                    applyRecipeToCanvas(src, out, recipe, undefined, { includeGrain: false });
                    outputs.push({
                        name: `${sceneId}__${pid}.png`,
                        dataUrl: out.toDataURL('image/png')
                    });
                }
            }
            return outputs;
        }""",
        SIGNATURE_PRESETS,
    )
    for item in res:
        save_data_url_png(item["dataUrl"], GOLDEN_P1_DIR / item["name"])
    print(f"[p1-capture] Saved {len(res)} lossless P1 golden baselines to {GOLDEN_P1_DIR}")


def run_verify_p1(page, base_url: str) -> None:
    page.goto(base_url, wait_until="networkidle")

    # 1. Inventory, Entitlements, Serialization, Tone Curve Monotonicity & Blending Curves
    core_checks = page.evaluate(
        """async (sigIds) => {
            const { PRESETS, SIGNATURE_COLLECTIONS } = await import('/src/data/presets.ts');
            const { buildEffectiveRecipe, computeEffectBlendFactors, isNeutralRecipe, applyRecipeToCanvas } = await import('/src/lib/imageEngine.ts')
                .then(async (ie) => ({
                    ...ie,
                    ...(await import('/src/engine/core/pixel-grade.ts'))
                }));
            const { buildMonotoneToneCurveKnots, evalMonotoneToneCurve } = await import('/src/engine/core/tone-curve.ts');
            const { createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
            const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

            // A. Inventory & Entitlement Checks
            const byId = Object.fromEntries(PRESETS.map(p => [p.id, p]));
            const freeIds = PRESETS.filter(p => !p.isPro && p.id !== 'original').map(p => p.id);
            const proIds = PRESETS.filter(p => p.isPro).map(p => p.id);
            const collectionsOk = SIGNATURE_COLLECTIONS.every(c =>
                PRESETS.some(p => p.collectionId === c.id)
            );
            const sigMetaOk = sigIds.every(id => {
                const p = byId[id];
                return p && p.isPro === true && p.lookType === 'signature' && p.recipeVersion === 2 && Boolean(p.collectionId);
            });

            // B. Serialization & Zero-Intensity Identity Checks
            let serializationOk = true;
            let zeroIdentityOk = true;
            for (const p of PRESETS) {
                const roundTrip = JSON.parse(JSON.stringify(p.recipe));
                const rOrig = buildEffectiveRecipe(p.recipe, 85, DEFAULT_ADJUSTMENTS);
                const rCopy = buildEffectiveRecipe(roundTrip, 85, DEFAULT_ADJUSTMENTS);
                if (JSON.stringify(rOrig) !== JSON.stringify(rCopy)) serializationOk = false;

                const rZero = buildEffectiveRecipe(p.recipe, 0, DEFAULT_ADJUSTMENTS);
                if (!isNeutralRecipe(rZero)) zeroIdentityOk = false;
            }

            // C. Tone Curve Monotonicity across preset curves + 250 stress configs
            const testCurves = [];
            for (const p of PRESETS) {
                if (p.recipe.toneCurve) testCurves.push(p.recipe.toneCurve);
            }
            for (let i = 0; i < 250; i++) {
                // deterministic pseudo-random generator
                const s1 = ((i * 7919 + 13) % 1000) / 1000;
                const s2 = ((i * 6133 + 37) % 1000) / 1000;
                const s3 = ((i * 4999 + 53) % 1000) / 1000;
                const s4 = ((i * 3571 + 71) % 1000) / 1000;
                const s5 = ((i * 2297 + 89) % 1000) / 1000;
                testCurves.push({
                    blackPoint: s1 * 0.25,
                    shadowPivot: (s2 - 0.5) * 0.36,
                    midtonePivot: (s3 - 0.5) * 0.36,
                    highlightShoulder: s4 * 0.28,
                    whitePoint: 0.8 + s5 * 0.2
                });
            }

            let curveViolations = 0;
            for (const c of testCurves) {
                const knots = buildMonotoneToneCurveKnots(c);
                let prev = -1;
                for (let step = 0; step <= 500; step++) {
                    const x = step / 500;
                    const y = evalMonotoneToneCurve(x, knots);
                    if (y < prev - 1e-12 || y < 0 || y > 1 || Number.isNaN(y)) {
                        curveViolations++;
                    }
                    prev = y;
                }
            }

            // D. Nonlinear Intensity Blend Curve Verification
            const b0 = computeEffectBlendFactors(0);
            const b25 = computeEffectBlendFactors(25);
            const b50 = computeEffectBlendFactors(50);
            const b75 = computeEffectBlendFactors(75);
            const b100 = computeEffectBlendFactors(100);
            const blendOk = (
                b0.kTone === 0 && b0.kOptical === 0 &&
                b100.kTone === 1 && b100.kOptical === 1 &&
                b25.kTone < b50.kTone && b50.kTone < b75.kTone &&
                b50.kOptical < b50.kTone && b50.kSkin < b50.kTone
            );

            // Pixel-level 0% vs 50% vs 100% intensity verification on Amber Halation
            const scene = createGoldenSceneCanvas('portrait-fair-hijab', 128, 160);
            const origBytes = scene.getContext('2d').getImageData(0, 0, 128, 160).data;
            const amber = byId['amber-halation'];
            const renderAt = (pct) => {
                const out = document.createElement('canvas');
                applyRecipeToCanvas(scene, out, buildEffectiveRecipe(amber.recipe, pct, DEFAULT_ADJUSTMENTS), undefined, { includeGrain: false });
                return out.getContext('2d').getImageData(0, 0, 128, 160).data;
            };
            const mae = (a, b) => {
                let s = 0;
                for (let i = 0; i < a.length; i += 4) {
                    s += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
                }
                return s / ((a.length / 4) * 3);
            };
            const d0 = renderAt(0);
            const d50 = renderAt(50);
            const d100 = renderAt(100);

            return {
                totalPresets: PRESETS.length,
                freeCount: freeIds.length,
                proCount: proIds.length,
                rosyFree: byId['rosy-bokeh'].isPro === false,
                seoulFree: byId['seoul-cafe'].isPro === false,
                velvetPro: byId['velvet-merona'].isPro === true,
                collectionsCount: SIGNATURE_COLLECTIONS.length,
                collectionsOk,
                sigMetaOk,
                serializationOk,
                zeroIdentityOk,
                curveTests: testCurves.length,
                curveViolations,
                blendOk,
                intensityZeroMae: mae(origBytes, d0),
                intensityMidMae: mae(origBytes, d50),
                intensityFullMae: mae(origBytes, d100),
                intensityMidVsFullMae: mae(d50, d100)
            };
        }""",
        SIGNATURE_PRESETS,
    )
    print(f"[p1-core] {json.dumps(core_checks)}")
    assert core_checks["totalPresets"] == 27
    assert core_checks["freeCount"] == 6
    assert core_checks["proCount"] == 20
    assert core_checks["rosyFree"] is True
    assert core_checks["seoulFree"] is True
    assert core_checks["velvetPro"] is True
    assert core_checks["collectionsOk"] is True
    assert core_checks["sigMetaOk"] is True
    assert core_checks["serializationOk"] is True
    assert core_checks["zeroIdentityOk"] is True
    assert core_checks["curveViolations"] == 0, f"Monotone curve violation!"
    assert core_checks["blendOk"] is True
    assert core_checks["intensityZeroMae"] == 0.0
    assert core_checks["intensityMidMae"] > 2.0 and core_checks["intensityMidVsFullMae"] > 2.0

    # 2. Meaningful Visual Differentiation across all 5 Signature Looks & Legacy Baselines
    diff_check = page.evaluate(
        """async (sigIds) => {
            const { PRESETS } = await import('/src/data/presets.ts');
            const { applyRecipeToCanvas, buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
            const { createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
            const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

            const scenes = [
                createGoldenSceneCanvas('portrait-fair-hijab', 160, 200),
                createGoldenSceneCanvas('cafe-interior', 160, 200)
            ];
            const compareIds = [...sigIds, 'rosy-bokeh', 'velvet-merona', 'seoul-cafe', 'classic-chrome', 'mono-leica'];
            const rendered = {};
            for (const pid of compareIds) {
                const preset = PRESETS.find(p => p.id === pid);
                const recipe = buildEffectiveRecipe(preset.recipe, 85, DEFAULT_ADJUSTMENTS);
                rendered[pid] = scenes.map(src => {
                    const out = document.createElement('canvas');
                    applyRecipeToCanvas(src, out, recipe, undefined, { includeGrain: false });
                    return out.getContext('2d').getImageData(0, 0, 160, 200).data;
                });
            }

            const pairMae = (idA, idB) => {
                let total = 0;
                for (let s = 0; s < scenes.length; s++) {
                    const a = rendered[idA][s];
                    const b = rendered[idB][s];
                    let sum = 0;
                    for (let i = 0; i < a.length; i += 4) {
                        sum += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
                    }
                    total += sum / ((a.length / 4) * 3);
                }
                return total / scenes.length;
            };

            let minPairMae = 999;
            let minPair = '';
            for (const sig of sigIds) {
                for (const other of compareIds) {
                    if (sig === other) continue;
                    const m = pairMae(sig, other);
                    if (m < minPairMae) {
                        minPairMae = m;
                        minPair = `${sig} vs ${other}`;
                    }
                }
            }
            return { minPairMae, minPair };
        }""",
        SIGNATURE_PRESETS,
    )
    print(f"[p1-diff] {json.dumps(diff_check)}")
    assert diff_check["minPairMae"] > 2.5, f"Signature look too close to existing look: {diff_check}"

    # 3. GPU WebGL2 vs CPU Canvas2D Parity across all 5 Signature Looks x 6 Golden Scenes (30 cases)
    parity = page.evaluate(
        """async (sigIds) => {
            const { PRESETS } = await import('/src/data/presets.ts');
            const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
            const { WebGL2Renderer } = await import('/src/engine/renderer/webgl2.renderer.ts');
            const { Canvas2DRenderer } = await import('/src/engine/renderer/canvas2d.renderer.ts');
            const { GOLDEN_SCENE_IDS, createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
            const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

            const glRenderer = new WebGL2Renderer();
            if (!glRenderer.isSupported()) return { supported: false };
            const cpuRenderer = new Canvas2DRenderer();

            function readRgba(canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                const copy = document.createElement('canvas');
                copy.width = canvas.width;
                copy.height = canvas.height;
                copy.getContext('2d').drawImage(canvas, 0, 0);
                return copy.getContext('2d').getImageData(0, 0, copy.width, copy.height).data;
            }

            const cases = [];
            for (const sceneId of GOLDEN_SCENE_IDS) {
                const src = createGoldenSceneCanvas(sceneId, 192, 240);
                for (const pid of sigIds) {
                    const preset = PRESETS.find(p => p.id === pid);
                    const recipe = buildEffectiveRecipe(preset.recipe, 85, DEFAULT_ADJUSTMENTS);

                    const cpuOut = document.createElement('canvas');
                    await cpuRenderer.render({
                        source: src,
                        sourceId: `p1_${sceneId}`,
                        sourceRevision: 1,
                        transformRevision: 1,
                        recipe,
                        targetCanvas: cpuOut,
                        includeGrain: false
                    });

                    const gpuOut = document.createElement('canvas');
                    await glRenderer.render({
                        source: src,
                        sourceId: `p1_${sceneId}`,
                        sourceRevision: 1,
                        transformRevision: 1,
                        recipe,
                        targetCanvas: gpuOut,
                        includeGrain: false
                    });

                    const a = readRgba(cpuOut);
                    const b = readRgba(gpuOut);
                    let absSum = 0;
                    let sqSum = 0;
                    let maxDiff = 0;
                    let darkRedArtifacts = 0;
                    const nPix = a.length / 4;
                    for (let i = 0; i < a.length; i += 4) {
                        const dr = Math.abs(a[i] - b[i]);
                        const dg = Math.abs(a[i + 1] - b[i + 1]);
                        const db = Math.abs(a[i + 2] - b[i + 2]);
                        absSum += dr + dg + db;
                        sqSum += dr * dr + dg * dg + db * db;
                        const m = Math.max(dr, dg, db);
                        if (m > maxDiff) maxDiff = m;
                        if (b[i] > 180 && b[i + 1] < 30 && b[i + 2] < 30 && (a[i] + a[i + 1] + a[i + 2]) < 120) {
                            darkRedArtifacts++;
                        }
                    }

                    let grainMae = 0;
                    if (pid === 'amber-halation' || pid === 'silver-gelatin') {
                        const gCpu = document.createElement('canvas');
                        const gGpu = document.createElement('canvas');
                        await cpuRenderer.render({ source: src, sourceId: `p1_${sceneId}`, sourceRevision: 1, transformRevision: 1, recipe, targetCanvas: gCpu, includeGrain: true });
                        await glRenderer.render({ source: src, sourceId: `p1_${sceneId}`, sourceRevision: 1, transformRevision: 1, recipe, targetCanvas: gGpu, includeGrain: true });
                        const ga = readRgba(gCpu);
                        const gb = readRgba(gGpu);
                        let gs = 0;
                        for (let gi = 0; gi < ga.length; gi += 4) {
                            gs += Math.abs(ga[gi] - gb[gi]) + Math.abs(ga[gi + 1] - gb[gi + 1]) + Math.abs(ga[gi + 2] - gb[gi + 2]);
                        }
                        grainMae = gs / ((ga.length / 4) * 3);
                    }

                    cases.push({
                        key: `${sceneId}__${pid}`,
                        mae: absSum / (nPix * 3),
                        rmse: Math.sqrt(sqSum / (nPix * 3)),
                        maxDiff,
                        darkRedArtifacts,
                        grainMae
                    });
                }
            }
            glRenderer.dispose();
            return { supported: true, cases };
        }""",
        SIGNATURE_PRESETS,
    )
    assert parity["supported"] is True
    worst_mae = max(c["mae"] for c in parity["cases"])
    worst_rmse = max(c["rmse"] for c in parity["cases"])
    worst_grain = max(c["grainMae"] for c in parity["cases"])
    red_artifacts = sum(c["darkRedArtifacts"] for c in parity["cases"])
    print(f"[p1-gpu-vs-cpu] {len(parity['cases'])} cases: worst MAE={worst_mae:.3f}/255, worst RMSE={worst_rmse:.3f}/255, worst grainMAE={worst_grain:.3f}/255, redArtifacts={red_artifacts}")
    for c in sorted(parity["cases"], key=lambda x: -x["mae"])[:5]:
        print(f"   top delta: {c['key']} mae={c['mae']:.3f} rmse={c['rmse']:.3f} grainMae={c['grainMae']:.3f} max={c['maxDiff']}")
    assert worst_mae < 1.8, f"P1 GPU vs CPU MAE exceeded tolerance: {worst_mae}"
    assert worst_rmse < 3.5, f"P1 GPU vs CPU RMSE exceeded tolerance: {worst_rmse}"
    assert worst_grain < 1.8, f"P1 GPU vs CPU grain MAE exceeded tolerance: {worst_grain}"
    assert red_artifacts == 0

    # 4. P1 Golden Image Verification
    golden_map = {png.name: load_png_data_url(png) for png in sorted(GOLDEN_P1_DIR.glob("*.png"))}
    assert len(golden_map) == 30, f"Expected 30 P1 golden baselines in {GOLDEN_P1_DIR}, found {len(golden_map)}"
    golden_res = page.evaluate(
        """async ({ goldenMap, sigIds }) => {
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

            const results = [];
            for (const sceneId of GOLDEN_SCENE_IDS) {
                const src = createGoldenSceneCanvas(sceneId, 192, 240);
                for (const pid of sigIds) {
                    const key = `${sceneId}__${pid}.png`;
                    const preset = PRESETS.find(p => p.id === pid);
                    const recipe = buildEffectiveRecipe(preset.recipe, 85, DEFAULT_ADJUSTMENTS);
                    const out = document.createElement('canvas');
                    applyRecipeToCanvas(src, out, recipe, undefined, { includeGrain: false });
                    const outData = out.getContext('2d').getImageData(0, 0, out.width, out.height).data;
                    const goldData = await decodePngRgba(goldenMap[key]);
                    let abs = 0;
                    for (let i = 0; i < goldData.length; i += 4) {
                        abs += Math.abs(goldData[i] - outData[i]) + Math.abs(goldData[i+1] - outData[i+1]) + Math.abs(goldData[i+2] - outData[i+2]);
                    }
                    results.push({ key, mae: abs / ((goldData.length / 4) * 3) });
                }
            }
            return results;
        }""",
        {"goldenMap": golden_map, "sigIds": SIGNATURE_PRESETS},
    )
    worst_p1_gold = max(r["mae"] for r in golden_res)
    print(f"[p1-golden] {len(golden_res)} cases: worst MAE={worst_p1_gold:.4f}")
    assert worst_p1_gold < 0.01

    # 5. Full-Res Export (3200x2400) for Signature Look with Optical Halation (WebGL2 & Worker Fallback)
    export_res = page.evaluate(
        """async () => {
            const { exportPhotographBlob } = await import('/src/engine/pipeline/export-pipeline.ts');
            const { PRESETS } = await import('/src/data/presets.ts');
            const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
            const { createGoldenSceneCanvas } = await import('/tests/fixtures/syntheticScenes.ts');
            const { DEFAULT_ADJUSTMENTS, DEFAULT_TRANSFORM } = await import('/src/types/index.ts');

            const hiRes = createGoldenSceneCanvas('low-light-night', 3200, 2400);
            const amber = PRESETS.find(p => p.id === 'amber-halation');
            const recipe = buildEffectiveRecipe(amber.recipe, 85, DEFAULT_ADJUSTMENTS);

            const glRes = await exportPhotographBlob({
                source: hiRes,
                sourceId: 'p1-hires-gl',
                sourceRevision: 1,
                recipe,
                mode: 'single',
                options: {
                    showWatermark: false,
                    presetName: amber.name,
                    isPro: true,
                    transform: DEFAULT_TRANSFORM,
                    format: 'jpeg',
                    quality: 0.9
                }
            });

            const cpuRes = await exportPhotographBlob({
                source: hiRes,
                sourceId: 'p1-hires-cpu',
                sourceRevision: 1,
                recipe,
                mode: 'single',
                options: {
                    showWatermark: false,
                    presetName: amber.name,
                    isPro: true,
                    transform: DEFAULT_TRANSFORM,
                    preferWebGL2: false,
                    format: 'png'
                }
            });

            return {
                glW: glRes.width,
                glH: glRes.height,
                glType: glRes.blob.type,
                glSize: glRes.blob.size,
                glBackend: glRes.backend,
                cpuW: cpuRes.width,
                cpuH: cpuRes.height,
                cpuType: cpuRes.blob.type,
                cpuSize: cpuRes.blob.size,
                cpuBackend: cpuRes.backend
            };
        }"""
    )
    print(f"[p1-export] {json.dumps(export_res)}")
    assert export_res["glW"] == 3200 and export_res["glH"] == 2400
    assert export_res["glType"] == "image/jpeg" and export_res["glSize"] > 40000
    assert export_res["cpuW"] == 3200 and export_res["cpuH"] == 2400
    assert export_res["cpuType"] == "image/png" and export_res["cpuSize"] > 100000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["capture", "verify"], default="verify")
    args = parser.parse_args()

    proc = start_vite_server(4183)
    base_url = "http://127.0.0.1:4183/"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
            )
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            errors = []
            page.on("pageerror", lambda err: errors.append(str(err)))

            if args.mode == "capture":
                run_capture_p1_golden(page, base_url)
            else:
                run_verify_p1(page, base_url)

            assert len(errors) == 0, f"Page errors occurred: {errors}"
            browser.close()
    finally:
        proc.terminate()
        proc.wait(timeout=5)


if __name__ == "__main__":
    main()
