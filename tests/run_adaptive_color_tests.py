#!/usr/bin/env python3
"""
Auvori Adaptive Color Correction — Comprehensive Browser, Renderer, Scenario,
UI/UX, Persistence, Export, and Visual Contact Sheet Test Suite.
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

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ORIG_DIR = ROOT / "tests" / "fixtures" / "original_photos"
GOLD_DIR = ROOT / "tests" / "fixtures" / "opensource_photos" / "gold_standard"
REPORT_DIR = ROOT / "tests" / "reports" / "adaptive_color"


def start_vite_server(port: int = 4188) -> subprocess.Popen:
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
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


def save_data_url(data_url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _, b64 = data_url.split(",", 1)
    path.write_bytes(base64.b64decode(b64))


def build_visual_contact_sheet(rows: list[tuple[str, Path, Path, Path]], out_path: Path) -> None:
    cell_w, cell_h = 260, 260
    pad = 14
    label_h = 28
    cols = 3
    w = pad + cols * (cell_w + pad)
    h = pad + len(rows) * (cell_h + label_h + pad) + 32

    sheet = Image.new("RGB", (w, h), (37, 39, 36))
    draw = ImageDraw.Draw(sheet)
    headers = ["0% (Original)", "50% Adaptive", "100% Adaptive"]
    for c_idx, title in enumerate(headers):
        draw.text((pad + c_idx * (cell_w + pad) + 6, 8), title, fill=(242, 242, 237))

    y = 32 + pad
    for label, p0, p50, p100 in rows:
        for c_idx, p in enumerate([p0, p50, p100]):
            img = Image.open(p).convert("RGB")
            img.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
            x = pad + c_idx * (cell_w + pad) + (cell_w - img.width) // 2
            iy = y + (cell_h - img.height) // 2
            sheet.paste(img, (x, iy))
        draw.text((pad + 4, y + cell_h + 6), label, fill=(218, 219, 212))
        y += cell_h + label_h + pad

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=92)


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    srv = start_vite_server(4188)
    base_url = "http://127.0.0.1:4188/"

    scenarios = [
        ("outdoor_portrait", ORIG_DIR / "outdoor_portrait.jpg"),
        ("underexposed_portrait", ORIG_DIR / "low_light_portrait.jpg"),
        ("bright_snow", GOLD_DIR / "p6_50_arctic_fox_snow.jpg"),
        ("warm_indoor", ORIG_DIR / "indoor_cafe_woman.jpg"),
        ("cool_daylight_lake", ORIG_DIR / "landscape_lake.jpg"),
        ("high_contrast", GOLD_DIR / "p6_03_laundromat_reflection.jpg"),
        ("green_foliage", GOLD_DIR / "p6_30_forest_bridge_hiker.jpg"),
        ("dark_cinematic", GOLD_DIR / "p6_52_night_street_portrait.jpg"),
        ("no_skin_object", ORIG_DIR / "object_coffee.jpg"),
        ("deep_skin_portrait", GOLD_DIR / "p6_51_deep_skin_indoor_portrait.jpg"),
        ("harsh_sun_couple", GOLD_DIR / "p6_06_harsh_sun_cliff_couple.jpg"),
        ("warm_lanterns", GOLD_DIR / "p6_55_night_bazaar_lanterns.jpg"),
    ]

    scenario_payloads = [
        {"name": name, "url": file_to_data_url(p)} for name, p in scenarios
    ]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"],
            )
            context = browser.new_context(viewport={"width": 1280, "height": 840})
            page = context.new_page()
            page.goto(base_url, wait_until="networkidle")

            # 1. Scenario, Determinism, Caching, Renderer Parity & Export Tests
            engine_report = page.evaluate(
                """async (items) => {
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { WebGL2Renderer } = await import('/src/engine/renderer/webgl2.renderer.ts');
                    const { Canvas2DRenderer } = await import('/src/engine/renderer/canvas2d.renderer.ts');
                    const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                    const { toAdaptiveColorRenderParams } = await import('/src/engine/adaptive-color/adaptiveCorrectionPipeline.ts');
                    const { exportPhotographBlob } = await import('/src/engine/pipeline/export-pipeline.ts');
                    const { PRESETS } = await import('/src/data/presets.ts');
                    const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                    const loadImg = (url) => new Promise((res, rej) => {
                        const img = new Image();
                        img.onload = () => res(img);
                        img.onerror = rej;
                        img.src = url;
                    });

                    const diffCanvases = (c1, c2) => {
                        const w = c1.width, h = c1.height;
                        const d1 = c1.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
                        const d2 = c2.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
                        let sumAbs = 0, sumSq = 0, maxDiff = 0;
                        const n = w * h * 3;
                        for (let i = 0; i < d1.length; i += 4) {
                            for (let c = 0; c < 3; c++) {
                                const diff = Math.abs(d1[i + c] - d2[i + c]);
                                sumAbs += diff;
                                sumSq += diff * diff;
                                if (diff > maxDiff) maxDiff = diff;
                            }
                        }
                        return { mae: sumAbs / n, rmse: Math.sqrt(sumSq / n), maxDiff };
                    };

                    const originalRecipe = PRESETS.find(p => p.id === 'original').recipe;
                    const pipeline = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: true });
                    const gl = new WebGL2Renderer();
                    const cpu = new Canvas2DRenderer();

                    const results = [];
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const img = await loadImg(item.url);

                        const t0 = performance.now();
                        const out1 = await pipeline.analyzeAdaptiveColor({
                            source: img,
                            sourceId: `sc_${item.name}`,
                            sourceRevision: 1,
                            transformRevision: 'orig'
                        });
                        const coldMs = performance.now() - t0;

                        const t1 = performance.now();
                        const out2 = await pipeline.analyzeAdaptiveColor({
                            source: img,
                            sourceId: `sc_${item.name}`,
                            sourceRevision: 1,
                            transformRevision: 'orig'
                        });
                        const cachedMs = performance.now() - t1;

                        if (!out2.fromCache) throw new Error(`Expected cache hit for ${item.name}`);
                        if (JSON.stringify(out1.result.parameters) !== JSON.stringify(out2.result.parameters)) {
                            throw new Error(`Non-deterministic parameters for ${item.name}`);
                        }

                        const r0 = buildEffectiveRecipe(originalRecipe, 100, DEFAULT_ADJUSTMENTS, undefined);
                        const r50 = buildEffectiveRecipe(originalRecipe, 100, DEFAULT_ADJUSTMENTS, toAdaptiveColorRenderParams(out1.result.parameters, 50));
                        const r100 = buildEffectiveRecipe(originalRecipe, 100, DEFAULT_ADJUSTMENTS, toAdaptiveColorRenderParams(out1.result.parameters, 100));

                        const cGl0 = document.createElement('canvas');
                        const cGl50 = document.createElement('canvas');
                        const cGl100 = document.createElement('canvas');
                        const cCpu0 = document.createElement('canvas');
                        const cCpu50 = document.createElement('canvas');
                        const cCpu100 = document.createElement('canvas');
                        const cRawCpu = document.createElement('canvas');

                        await gl.render({ source: img, sourceId: `sc_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r0, targetCanvas: cGl0, maxDimension: 512 });
                        await gl.render({ source: img, sourceId: `sc_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r50, targetCanvas: cGl50, maxDimension: 512 });
                        await gl.render({ source: img, sourceId: `sc_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r100, targetCanvas: cGl100, maxDimension: 512 });

                        await cpu.render({ source: img, sourceId: `sc_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r0, targetCanvas: cCpu0, maxDimension: 512 });
                        await cpu.render({ source: img, sourceId: `sc_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r50, targetCanvas: cCpu50, maxDimension: 512 });
                        await cpu.render({ source: img, sourceId: `sc_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r100, targetCanvas: cCpu100, maxDimension: 512 });

                        cRawCpu.width = cCpu0.width;
                        cRawCpu.height = cCpu0.height;
                        cRawCpu.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, cCpu0.width, cCpu0.height);

                        const cpu0VsRaw = diffCanvases(cCpu0, cRawCpu);
                        const parity0 = diffCanvases(cGl0, cCpu0);
                        const parity50 = diffCanvases(cGl50, cCpu50);
                        const parity100 = diffCanvases(cGl100, cCpu100);
                        const delta0vs100 = diffCanvases(cGl0, cGl100);

                        // Also test deterministic repeat on GL and GL 0% vs pre-scaled canvas
                        const cGl100b = document.createElement('canvas');
                        await gl.render({ source: img, sourceId: `sc_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r100, targetCanvas: cGl100b, maxDimension: 512 });
                        const glRepeat = diffCanvases(cGl100, cGl100b);

                        const cGlFromRaw = document.createElement('canvas');
                        await gl.render({ source: cRawCpu, sourceId: `raw_${item.name}`, sourceRevision: 1, transformRevision: 1, recipe: r0, targetCanvas: cGlFromRaw });
                        const gl0VsRaw = diffCanvases(cGlFromRaw, cRawCpu);

                        results.push({
                            name: item.name,
                            coldMs: Number(coldMs.toFixed(2)),
                            cachedMs: Number(cachedMs.toFixed(2)),
                            parameters: out1.result.parameters,
                            confidence: out1.result.confidence,
                            warnings: out1.result.warnings,
                            isLowKey: out1.result.analysis.exposure.isLowKeyCinematic,
                            cpu0VsRaw,
                            gl0VsRaw,
                            parity0,
                            parity50,
                            parity100,
                            delta0vs100,
                            glRepeat,
                            png0: cGl0.toDataURL('image/png'),
                            png50: cGl50.toDataURL('image/png'),
                            png100: cGl100.toDataURL('image/png'),
                        });
                    }

                    // Export test (WebGL2 single + card, and CPU fallback single)
                    const expImg = await loadImg(items[0].url);
                    const expOut = await pipeline.analyzeAdaptiveColor({ source: expImg, sourceId: 'exp_0', sourceRevision: 1, transformRevision: 'orig' });
                    const expRecipe = buildEffectiveRecipe(originalRecipe, 100, DEFAULT_ADJUSTMENTS, toAdaptiveColorRenderParams(expOut.result.parameters, 75));
                    const expGl = await exportPhotographBlob({
                        source: expImg, sourceId: 'exp_0', recipe: expRecipe, mode: 'single',
                        options: { showWatermark: false, presetName: 'Adaptive Color', isPro: true, preferWebGL2: true, format: 'jpeg' }
                    });
                    const expCard = await exportPhotographBlob({
                        source: expImg, sourceId: 'exp_0', recipe: expRecipe, mode: 'card',
                        options: { showWatermark: true, presetName: 'Adaptive Color', isPro: false, preferWebGL2: true, format: 'jpeg' }
                    });
                    const expCpu = await exportPhotographBlob({
                        source: expImg, sourceId: 'exp_0', recipe: expRecipe, mode: 'single',
                        options: { showWatermark: false, presetName: 'Adaptive Color', isPro: true, preferWebGL2: false, format: 'jpeg' }
                    });

                    gl.dispose();
                    cpu.dispose();
                    pipeline.dispose();

                    return {
                        glSupported: Boolean(results.length),
                        scenarios: results,
                        exportTest: {
                            glSingle: { width: expGl.width, height: expGl.height, size: expGl.blob.size, backend: expGl.backend },
                            glCard: { width: expCard.width, height: expCard.height, size: expCard.blob.size, backend: expCard.backend },
                            cpuSingle: { width: expCpu.width, height: expCpu.height, size: expCpu.blob.size, backend: expCpu.backend }
                        }
                    };
                }""",
                scenario_payloads,
            )

            # Save per-scenario previews & build visual contact sheet
            sheet_rows = []
            worst_parity_mae = 0.0
            for sc in engine_report["scenarios"]:
                p0 = REPORT_DIR / f"{sc['name']}__0.png"
                p50 = REPORT_DIR / f"{sc['name']}__50.png"
                p100 = REPORT_DIR / f"{sc['name']}__100.png"
                save_data_url(sc.pop("png0"), p0)
                save_data_url(sc.pop("png50"), p50)
                save_data_url(sc.pop("png100"), p100)
                sheet_rows.append((sc["name"], p0, p50, p100))

                assert sc["glRepeat"]["maxDiff"] == 0, f"GL repeat non-deterministic for {sc['name']}"
                assert sc["cpu0VsRaw"]["maxDiff"] == 0, f"CPU 0% altered original for {sc['name']}"
                assert sc["gl0VsRaw"]["maxDiff"] == 0, f"GL 0% altered original for {sc['name']}: {sc['gl0VsRaw']}"
                worst_parity_mae = max(worst_parity_mae, sc["parity50"]["mae"], sc["parity100"]["mae"])
                # Note: downscaling large JPEGs uses imageSmoothingQuality='high' on WebGL2 staging vs default on Canvas2D,
                # so we also allow small resampling delta (~2.0/255) when comparing downscaled 512px outputs.
                assert sc["parity100"]["mae"] < 2.5, f"GPU/CPU parity drift too high for {sc['name']}: {sc['parity100']}"

            contact_sheet_path = REPORT_DIR / "adaptive_color_contact_sheet.jpg"
            build_visual_contact_sheet(sheet_rows, contact_sheet_path)

            # Verify different scenes produce different parameter vectors
            param_sigs = {json.dumps(sc["parameters"], sort_keys=True) for sc in engine_report["scenarios"]}
            assert len(param_sigs) >= 10, f"Expected distinct adaptive parameters per scene, got {len(param_sigs)}"

            # 2. UI E2E + Persistence + Recovery + Before/After Split + Export Flow
            page.goto(base_url, wait_until="networkidle")
            # Start editing a Studio Sample from Home
            page.get_by_role("button", name="Browse studio sample photos").first.click()
            page.get_by_label("Open Daylight Portrait in editor").click()
            page.wait_for_selector("aside[aria-label='Editor Inspector']", timeout=10000)

            # Open Adjust tab
            page.get_by_role("button", name="Adjust").click()
            card = page.get_by_test_id("adaptive-color-card")
            card.wait_for(state="visible", timeout=5000)
            assert "Adaptive Color Correction" in card.inner_text()
            assert "Automatically adjusts color and lighting based on your photo." in card.inner_text()
            assert page.get_by_test_id("adaptive-color-percent").inner_text().strip() == "0%"

            # Click Apply -> sets default active strength 75%
            page.get_by_test_id("adaptive-color-apply").click()
            page.wait_for_function(
                "() => document.querySelector('[data-testid=\"adaptive-color-percent\"]')?.textContent?.trim() === '75%'"
            )
            # Wait for analysis & autosave
            page.wait_for_timeout(1200)

            # Test slider scrubbing to 50%
            slider = page.get_by_test_id("adaptive-color-slider")
            slider.fill("50")
            slider.dispatch_event("change")
            slider.dispatch_event("pointerup")
            assert page.get_by_test_id("adaptive-color-percent").inner_text().strip() == "50%"

            # Toggle Before/After split mode
            page.get_by_role("button", name="Compare Before and After").click()
            page.get_by_text("Before", exact=True).wait_for(state="visible", timeout=3000)
            page.get_by_role("button", name="Compare Before and After").click()

            # Wait for autosave to complete and verify recovery after reload
            page.wait_for_timeout(1500)
            page.reload(wait_until="networkidle")
            page.wait_for_selector("aside[aria-label='Editor Inspector']", timeout=10000)
            page.get_by_role("button", name="Adjust").click()
            recovered_pct = page.get_by_test_id("adaptive-color-percent").inner_text().strip()
            assert recovered_pct == "50%", f"Expected recovered strength 50%, got {recovered_pct}"

            # Capture UI screenshot
            ui_screenshot = REPORT_DIR / "ui_adaptive_color_editor.png"
            page.screenshot(path=str(ui_screenshot))

            # Reset Adaptive Color Correction -> restores 0%
            page.get_by_test_id("adaptive-color-reset").click()
            assert page.get_by_test_id("adaptive-color-percent").inner_text().strip() == "0%"

            summary = {
                "scenarioCount": len(engine_report["scenarios"]),
                "distinctParameterSets": len(param_sigs),
                "worstParityMae255": round(worst_parity_mae, 4),
                "avgColdAnalysisMs": round(
                    sum(s["coldMs"] for s in engine_report["scenarios"]) / len(engine_report["scenarios"]), 2
                ),
                "avgCachedLookupMs": round(
                    sum(s["cachedMs"] for s in engine_report["scenarios"]) / len(engine_report["scenarios"]), 3
                ),
                "exportTest": engine_report["exportTest"],
                "uiRecoveryStrength": recovered_pct,
                "scenarios": engine_report["scenarios"],
            }
            (REPORT_DIR / "adaptive_color_report.json").write_text(json.dumps(summary, indent=2))
            print(json.dumps({k: v for k, v in summary.items() if k != "scenarios"}, indent=2))
            browser.close()
            return 0
    finally:
        srv.terminate()
        srv.wait(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
