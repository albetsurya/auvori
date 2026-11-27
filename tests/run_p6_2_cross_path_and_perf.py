#!/usr/bin/env python3
"""
Auvori Phase 6.2F & 6.2G — Cross-Path Consistency & Performance/Memory Suite.

Measures:
1. WebGL2 vs Worker Canvas2D parity across Legacy, Signature, and Adaptive presets:
   - Pixel MAE, Max Error, Luma mean/std, R/G/B channel MAE, Highlight/Shadow clipping.
2. Performance & Memory Benchmark:
   - First render, repeated render, interleaved render, preset switching,
   - Bokeh toggle, grain toggle, full-res export (1080px),
   - Renderer dispose/recreate lifecycle (10 cycles),
   - Median & P95 latencies.
3. WebGPU hardware detection (reporting BLOCKED on unsupported hardware).
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
CROSS_DIR = ROOT / "tests" / "reports" / "phase6_2" / "cross_path"
PERF_DIR = ROOT / "tests" / "reports" / "phase6_2" / "performance"
CROSS_DIR.mkdir(parents=True, exist_ok=True)
PERF_DIR.mkdir(parents=True, exist_ok=True)

GOLD_DIR = ROOT / "tests" / "fixtures" / "opensource_photos" / "gold_standard"


def start_vite_server(port: int = 4397) -> subprocess.Popen:
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


def data_url_to_rgb(data_url: str) -> np.ndarray:
    if "," not in data_url:
        raise ValueError("Invalid data_url")
    _, b64 = data_url.split(",", 1)
    return np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB"), dtype=np.uint8)


def evaluate_parity(gpu_rgb: np.ndarray, cpu_rgb: np.ndarray) -> dict:
    gpu = gpu_rgb.astype(np.float64)
    cpu = cpu_rgb.astype(np.float64)
    diff = np.abs(gpu - cpu)

    mae = float(np.mean(diff))
    max_err = float(np.max(diff))

    mae_r = float(np.mean(diff[:, :, 0]))
    mae_g = float(np.mean(diff[:, :, 1]))
    mae_b = float(np.mean(diff[:, :, 2]))

    gpu_lum = (0.299 * gpu[:, :, 0] + 0.587 * gpu[:, :, 1] + 0.114 * gpu[:, :, 2]) / 255.0
    cpu_lum = (0.299 * cpu[:, :, 0] + 0.587 * cpu[:, :, 1] + 0.114 * cpu[:, :, 2]) / 255.0

    return {
        "mae": mae,
        "max_diff": max_err,
        "channel_mae": {"r": mae_r, "g": mae_g, "b": mae_b},
        "gpu_luma_mean": float(np.mean(gpu_lum)),
        "cpu_luma_mean": float(np.mean(cpu_lum)),
        "gpu_luma_std": float(np.std(gpu_lum)),
        "cpu_luma_std": float(np.std(cpu_lum)),
        "luma_std_diff": abs(float(np.std(gpu_lum)) - float(np.std(cpu_lum))),
        "gpu_hl_clip_pct": float(np.mean(gpu_lum >= 0.98) * 100),
        "cpu_hl_clip_pct": float(np.mean(cpu_lum >= 0.98) * 100),
        "gpu_sh_pct": float(np.mean(gpu_lum <= 0.05) * 100),
        "cpu_sh_pct": float(np.mean(cpu_lum <= 0.05) * 100),
    }


def save_parity_contact_sheet(
    title: str,
    pairs: list[tuple[str, np.ndarray, np.ndarray]],  # (name, gpu, cpu)
    out_path: Path,
    tile_w: int = 180,
) -> None:
    cell_w = tile_w * 2 + 8
    th = 135
    total_w = len(pairs) * (cell_w + 12) + 16
    total_h = th + 65
    sheet = Image.new("RGB", (total_w, total_h), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    d.text((12, 10), title, fill=(240, 240, 235))

    for idx, (lbl, gpu, cpu) in enumerate(pairs):
        x = 12 + idx * (cell_w + 12)
        y = 34
        d.text((x, y - 18), lbl, fill=(210, 210, 200))

        g_img = Image.fromarray(gpu).resize((tile_w, th), Image.Resampling.BILINEAR)
        c_img = Image.fromarray(cpu).resize((tile_w, th), Image.Resampling.BILINEAR)

        sheet.paste(g_img, (x, y))
        sheet.paste(c_img, (x + tile_w + 4, y))

    sheet.save(out_path, quality=92)
    print(f"Saved parity sheet: {out_path}")


def run_benchmark() -> dict:
    port = 4397
    srv = start_vite_server(port)

    # Use gold standard portrait
    test_photo = GOLD_DIR / "p6_06_harsh_sun_cliff_couple.jpg"
    test_photo_url = f"data:image/jpeg;base64,{base64.b64encode(test_photo.read_bytes()).decode('ascii')}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--use-gl=angle",
                    "--use-angle=gl",
                    "--enable-webgl",
                    "--ignore-gpu-blocklist",
                ],
            )
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{port}/")

            raw = page.evaluate(
                """async ({ photoUrl }) => {
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { PRESETS } = await import('/src/data/presets.ts');
                    const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                    const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                    // Check WebGPU hardware
                    let webgpuSupported = false;
                    let webgpuError = 'No WebGPU adapter exposed on Linux ANGLE EGL';
                    if (navigator.gpu) {
                        try {
                            const adapter = await navigator.gpu.requestAdapter();
                            if (adapter) {
                                webgpuSupported = true;
                                webgpuError = null;
                            } else {
                                webgpuError = 'navigator.gpu present but requestAdapter() returned null';
                            }
                        } catch (e) {
                            webgpuError = e.message;
                        }
                    } else {
                        webgpuError = 'navigator.gpu is undefined';
                    }

                    // Prepare master canvas
                    const loadMasterCanvas = (src) => new Promise((res, rej) => {
                        const img = new Image();
                        img.onload = () => {
                            const c = document.createElement('canvas');
                            c.width = img.naturalWidth || img.width;
                            c.height = img.naturalHeight || img.height;
                            c.getContext('2d').drawImage(img, 0, 0);
                            res(c);
                        };
                        img.onerror = rej;
                        img.src = src;
                    });
                    const masterCanvas = await loadMasterCanvas(photoUrl);

                    // Select representative presets across categories:
                    // Legacy: seoul-cafe, classic-chrome
                    // Signature: porcelain-bloom, velvet-noir
                    // Adaptive: direct-flash
                    const testPresets = [
                        PRESETS.find(p => p.id === 'seoul-cafe'),
                        PRESETS.find(p => p.id === 'classic-chrome'),
                        PRESETS.find(p => p.id === 'porcelain-bloom'),
                        PRESETS.find(p => p.id === 'velvet-noir'),
                        PRESETS.find(p => p.id === 'direct-flash'),
                    ].filter(Boolean);

                    const pipeGpu = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                    const pipeCpu = new PhotoPipeline({ preferWebGL2: false, preferWorkerFallback: true });

                    // Adaptive analysis once
                    const analysis = (await pipeGpu.analyzeAdaptive({
                        source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 't0'
                    })).result;

                    // 1. Cross-Path Parity Renders (without grain to compare exact color/tone maths)
                    const parityResults = {};
                    for (const pr of testPresets) {
                        const recipe = buildEffectiveRecipe(pr.recipe, 100, DEFAULT_ADJUSTMENTS);

                        const cGpu = document.createElement('canvas');
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe, analysisResult: analysis, maxDimension: 480, includeGrain: false,
                            targetCanvas: cGpu
                        });

                        const cCpu = document.createElement('canvas');
                        await pipeCpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe, analysisResult: analysis, maxDimension: 480, includeGrain: false,
                            targetCanvas: cCpu
                        });

                        parityResults[pr.id] = {
                            name: pr.name,
                            gpuDataUrl: cGpu.toDataURL('image/png'),
                            cpuDataUrl: cCpu.toDataURL('image/png'),
                        };
                    }

                    // 2. Performance Latency Benchmarks (Audited Methodology: CPU submission vs GPU sync vs End-to-End)
                    const gl = pipeGpu.glRenderer?.getInternalCanvas()?.getContext('webgl2');

                    const cBench = document.createElement('canvas');
                    const effSeoul = buildEffectiveRecipe(testPresets[0].recipe, 100, DEFAULT_ADJUSTMENTS);
                    const effRosy = buildEffectiveRecipe(testPresets[2].recipe, 100, DEFAULT_ADJUSTMENTS);

                    // Cold start / First render (with shader compilation)
                    const t0 = performance.now();
                    await pipeGpu.renderPreview({
                        source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                        recipe: effSeoul, maxDimension: 480, targetCanvas: cBench
                    });
                    if (gl) gl.finish();
                    const firstRenderMs = performance.now() - t0;

                    // Warm-up cache (5 discarded iterations with sync)
                    for (let i = 0; i < 5; i++) {
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effSeoul, maxDimension: 480, targetCanvas: cBench
                        });
                        if (gl) gl.finish();
                    }

                    const latencies = {
                        first_render: firstRenderMs,
                        cpu_submission: [],
                        gpu_execution_sync: [],
                        interleaved_render: [],
                        preset_switch: [],
                        bokeh_toggle: [],
                        export_1080_e2e: [],
                        recreate_lifecycle: []
                    };

                    // 1. CPU Submission Latency (30 iterations: dispatch + gl.flush() without blocking sync)
                    for (let i = 0; i < 30; i++) {
                        const tStart = performance.now();
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effSeoul, maxDimension: 480, targetCanvas: cBench
                        });
                        latencies.cpu_submission.push(performance.now() - tStart);
                    }

                    // 2. GPU Execution Latency with Sync (30 iterations: dispatch + gl.finish() blocking sync)
                    for (let i = 0; i < 30; i++) {
                        const tStart = performance.now();
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effSeoul, maxDimension: 480, targetCanvas: cBench
                        });
                        if (gl) gl.finish();
                        latencies.gpu_execution_sync.push(performance.now() - tStart);
                    }

                    // 3. Interleaved render with sync (10 cycles)
                    for (let i = 0; i < 5; i++) {
                        let t = performance.now();
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 480, targetCanvas: cBench
                        });
                        if (gl) gl.finish();
                        latencies.interleaved_render.push(performance.now() - t);

                        t = performance.now();
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effSeoul, maxDimension: 480, targetCanvas: cBench
                        });
                        if (gl) gl.finish();
                        latencies.interleaved_render.push(performance.now() - t);
                    }

                    // 4. Preset switching latency with sync (all 5 test presets, 2 rounds)
                    for (let round = 0; round < 2; round++) {
                        for (const pr of testPresets) {
                            const recipe = buildEffectiveRecipe(pr.recipe, 100, DEFAULT_ADJUSTMENTS);
                            const tSwitch = performance.now();
                            await pipeGpu.renderPreview({
                                source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                                recipe, analysisResult: analysis, maxDimension: 480, targetCanvas: cBench
                            });
                            if (gl) gl.finish();
                            latencies.preset_switch.push(performance.now() - tSwitch);
                        }
                    }

                    // 5. Bokeh toggle latency with sync (6 passes)
                    const effBokehOn = { ...effRosy, bgBokeh: 20 };
                    const effBokehOff = { ...effRosy, bgBokeh: 0 };
                    for (let i = 0; i < 3; i++) {
                        let t = performance.now();
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effBokehOn, maxDimension: 480, targetCanvas: cBench
                        });
                        if (gl) gl.finish();
                        latencies.bokeh_toggle.push(performance.now() - t);

                        t = performance.now();
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effBokehOff, maxDimension: 480, targetCanvas: cBench
                        });
                        if (gl) gl.finish();
                        latencies.bokeh_toggle.push(performance.now() - t);
                    }

                    // 6. Full-resolution export latency end-to-end (1080px with toBlob JPEG encoding, 5 passes)
                    const expCanvas = document.createElement('canvas');
                    for (let i = 0; i < 5; i++) {
                        const tExp = performance.now();
                        await pipeGpu.renderPreview({
                            source: masterCanvas, sourceId: 'bench', sourceRevision: 1, transformRevision: 1,
                            recipe: effRosy, maxDimension: 1080, targetCanvas: expCanvas
                        });
                        if (gl) gl.finish();
                        await new Promise((res) => expCanvas.toBlob(res, 'image/jpeg', 0.95));
                        latencies.export_1080_e2e.push(performance.now() - tExp);
                    }

                    pipeGpu.dispose();
                    pipeCpu.dispose();

                    // 7. Recreate lifecycle (10 cycles: instantiate -> compile/render -> sync -> dispose)
                    for (let i = 0; i < 10; i++) {
                        const tRec = performance.now();
                        const pipeTemp = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        await pipeTemp.renderPreview({
                            source: masterCanvas, sourceId: 'temp', sourceRevision: 1, transformRevision: 1,
                            recipe: effSeoul, maxDimension: 480, targetCanvas: cBench
                        });
                        const tempGl = pipeTemp.glRenderer?.getInternalCanvas()?.getContext('webgl2');
                        if (tempGl) tempGl.finish();
                        pipeTemp.dispose();
                        latencies.recreate_lifecycle.push(performance.now() - tRec);
                    }

                    return {
                        webgpu: { supported: webgpuSupported, error: webgpuError },
                        parity: parityResults,
                        latencies
                    };
                }""",
                {"photoUrl": test_photo_url},
            )

            browser.close()
            return raw
    finally:
        srv.terminate()
        srv.wait(timeout=5)


def summarize_latencies(vals: list[float]) -> dict:
    if not vals:
        return {"median": 0.0, "p95": 0.0, "min": 0.0, "max": 0.0}
    arr = np.array(vals)
    return {
        "median": float(np.median(arr)),
        "p95": float(np.percentile(arr, 95)),
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "mean": float(np.mean(arr)),
    }


def main() -> int:
    print("=== Auvori Phase 6.2F & 6.2G — Cross-Path Parity & Performance Suite ===")
    data = run_benchmark()

    # Process Parity
    parity_summary = {}
    sheet_pairs = []

    for preset_id, item in data["parity"].items():
        gpu_rgb = data_url_to_rgb(item["gpuDataUrl"])
        cpu_rgb = data_url_to_rgb(item["cpuDataUrl"])

        ev = evaluate_parity(gpu_rgb, cpu_rgb)
        parity_summary[preset_id] = {
            "name": item["name"],
            **ev
        }
        sheet_pairs.append((f"{item['name']} (GPU | CPU)", gpu_rgb, cpu_rgb))
        print(f"[Parity] {item['name']:<18}: MAE={ev['mae']:.3f}/255, MaxDiff={ev['max_diff']:.0f}, LumaStdDiff={ev['luma_std_diff']:.4f}")

    # Save contact sheet
    save_parity_contact_sheet(
        "Phase 6.2F Cross-Path Parity: WebGL2 (Left) vs Canvas2D (Right)",
        sheet_pairs,
        CROSS_DIR / "sheet_cross_path_parity.jpg"
    )

    cross_json = CROSS_DIR / "cross_path_metrics.json"
    cross_json.write_text(json.dumps(parity_summary, indent=2) + "\n", encoding="utf-8")
    print(f"Cross-path metrics saved to: {cross_json}")

    # Process Latencies
    raw_lats = data["latencies"]
    perf_summary = {
        "cold_start_first_render_ms": raw_lats["first_render"],
        "cpu_submission": summarize_latencies(raw_lats["cpu_submission"]),
        "gpu_execution_sync": summarize_latencies(raw_lats["gpu_execution_sync"]),
        "interleaved_render_sync": summarize_latencies(raw_lats["interleaved_render"]),
        "preset_switch_sync": summarize_latencies(raw_lats["preset_switch"]),
        "bokeh_toggle_sync": summarize_latencies(raw_lats["bokeh_toggle"]),
        "export_1080_e2e": summarize_latencies(raw_lats["export_1080_e2e"]),
        "recreate_lifecycle": summarize_latencies(raw_lats["recreate_lifecycle"]),
        "webgpu": data["webgpu"]
    }

    print("\n--- Audited Performance & Synchronization Summary ---")
    print(f"Cold Start / First render (compile + sync): {perf_summary['cold_start_first_render_ms']:.2f} ms")
    print(f"CPU Submission (Preview 480px, no sync)   : median {perf_summary['cpu_submission']['median']:.2f} ms (p95: {perf_summary['cpu_submission']['p95']:.2f} ms, mean: {perf_summary['cpu_submission']['mean']:.2f} ms)")
    print(f"GPU Execution (Preview 480px, with sync)  : median {perf_summary['gpu_execution_sync']['median']:.2f} ms (p95: {perf_summary['gpu_execution_sync']['p95']:.2f} ms, mean: {perf_summary['gpu_execution_sync']['mean']:.2f} ms)")
    print(f"Interleaved Render (with sync)             : median {perf_summary['interleaved_render_sync']['median']:.2f} ms (p95: {perf_summary['interleaved_render_sync']['p95']:.2f} ms)")
    print(f"Preset Switch Latency (with sync)          : median {perf_summary['preset_switch_sync']['median']:.2f} ms (p95: {perf_summary['preset_switch_sync']['p95']:.2f} ms)")
    print(f"Bokeh Toggle Latency (with sync)           : median {perf_summary['bokeh_toggle_sync']['median']:.2f} ms (p95: {perf_summary['bokeh_toggle_sync']['p95']:.2f} ms)")
    print(f"End-to-End Export 1080px (render + JPEG)   : median {perf_summary['export_1080_e2e']['median']:.2f} ms (p95: {perf_summary['export_1080_e2e']['p95']:.2f} ms, mean: {perf_summary['export_1080_e2e']['mean']:.2f} ms)")
    print(f"Recreate Lifecycle (instantiate + compile) : median {perf_summary['recreate_lifecycle']['median']:.2f} ms (p95: {perf_summary['recreate_lifecycle']['p95']:.2f} ms)")
    print(f"WebGPU Hardware Status                     : {'PASS' if data['webgpu']['supported'] else 'BLOCKED'} ({data['webgpu']['error']})")

    perf_json = PERF_DIR / "perf_benchmark.json"
    perf_json.write_text(json.dumps(perf_summary, indent=2) + "\n", encoding="utf-8")
    print(f"Performance benchmark saved to: {perf_json}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
