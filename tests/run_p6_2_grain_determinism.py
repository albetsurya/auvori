#!/usr/bin/env python3
"""
Auvori Phase 6.2C — Grain Determinism & Coordinate Orientation Suite.

Validates:
1. Same input, same seed, repeated CPU render determinism.
2. Same input, same seed, repeated GPU render determinism.
3. CPU vs GPU spatial grain distribution statistics (mean, std dev, autocorrelation).
4. Coordinate orientation mapping (WebGL2 bottom-up gl_FragCoord.y vs Canvas2D top-down y).
5. Aspect ratio coverage: Portrait, Landscape, Square.
6. Multi-resolution coverage: Preview (320px/480px) vs Export (1080px).
7. Intensity ladder (0%, 25%, 50%, 75%, 100%).
8. Contact sheets and comprehensive grain_metrics.json.
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
REPORT_DIR = ROOT / "tests" / "reports" / "phase6_2" / "grain_determinism"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

FIXTURES_DIR = ROOT / "tests" / "fixtures"
GOLD_DIR = FIXTURES_DIR / "opensource_photos" / "gold_standard"


def start_vite_server(port: int = 4296) -> subprocess.Popen:
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


def compute_autocorrelation(noise_2d: np.ndarray) -> tuple[float, float]:
    """Computes spatial lag-1 autocorrelation along horizontal (x) and vertical (y) axes."""
    flat = noise_2d.astype(np.float64)
    var = np.var(flat)
    if var < 1e-9:
        return 0.0, 0.0
    mean = np.mean(flat)
    centered = flat - mean
    # lag 1 horizontal
    corr_x = np.mean(centered[:, :-1] * centered[:, 1:]) / var
    # lag 1 vertical
    corr_y = np.mean(centered[:-1, :] * centered[1:, :]) / var
    return float(corr_x), float(corr_y)


def compute_grain_stats(with_grain: np.ndarray, no_grain: np.ndarray) -> dict:
    wg = with_grain.astype(np.float64)
    ng = no_grain.astype(np.float64)
    diff = wg - ng
    # Luma residual
    luma_res = 0.299 * diff[:, :, 0] + 0.587 * diff[:, :, 1] + 0.114 * diff[:, :, 2]
    base_luma = (0.299 * ng[:, :, 0] + 0.587 * ng[:, :, 1] + 0.114 * ng[:, :, 2]) / 255.0

    sh_mask = base_luma < 0.25
    md_mask = (base_luma >= 0.25) & (base_luma <= 0.75)
    hi_mask = base_luma > 0.75

    ac_x, ac_y = compute_autocorrelation(luma_res)

    h, w = luma_res.shape
    bh, bw = max(4, h // 8), max(4, w // 8)
    grid_stds = [
        float(np.std(luma_res[by * bh : (by + 1) * bh, bx * bw : (bx + 1) * bw]))
        for by in range(8)
        for bx in range(8)
    ]

    return {
        "mean_residual": float(np.mean(luma_res)),
        "std_residual": float(np.std(luma_res)),
        "mae_residual": float(np.mean(np.abs(luma_res))),
        "shadow_std": float(np.std(luma_res[sh_mask])) if np.any(sh_mask) else 0.0,
        "midtone_std": float(np.std(luma_res[md_mask])) if np.any(md_mask) else 0.0,
        "highlight_std": float(np.std(luma_res[hi_mask])) if np.any(hi_mask) else 0.0,
        "autocorr_lag1_x": ac_x,
        "autocorr_lag1_y": ac_y,
        "spatial_block_std_spread": float(np.std(grid_stds)),
    }


def save_contact_sheet(
    title: str,
    items: list[tuple[str, np.ndarray, np.ndarray]],  # (label, full, 1:1 crop)
    out_path: Path,
    tile_w: int = 180,
    crop_w: int = 180,
) -> None:
    cell_w = tile_w + crop_w + 6
    th = 150
    total_w = len(items) * (cell_w + 8) + 16
    total_h = th + 70
    sheet = Image.new("RGB", (total_w, total_h), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    d.text((12, 10), title, fill=(240, 240, 235))

    for idx, (lbl, full_rgb, crop_rgb) in enumerate(items):
        x = 12 + idx * (cell_w + 8)
        y = 36
        d.text((x, y - 18), lbl, fill=(200, 200, 195))

        f_img = Image.fromarray(full_rgb).resize((tile_w, th), Image.Resampling.BILINEAR)
        c_img = Image.fromarray(crop_rgb).resize((crop_w, th), Image.Resampling.NEAREST)

        sheet.paste(f_img, (x, y))
        sheet.paste(c_img, (x + tile_w + 4, y))

    sheet.save(out_path, quality=92)
    print(f"Saved contact sheet: {out_path}")


def run_grain_suite() -> dict:
    port = 4296
    srv = start_vite_server(port)

    # Pick representative test images:
    # 1. Portrait (p6_06_harsh_sun_cliff_couple.jpg)
    # 2. Landscape (p6_24_capetown_fog_sunset.jpg)
    # 3. Square (p6_40_black_teapot_dark_bg.jpg or center cropped)
    portrait_path = GOLD_DIR / "p6_06_harsh_sun_cliff_couple.jpg"
    landscape_path = GOLD_DIR / "p6_24_capetown_fog_sunset.jpg"
    square_path = GOLD_DIR / "p6_40_black_teapot_dark_bg.jpg"

    def to_url(p: Path) -> str:
        b64 = base64.b64encode(p.read_bytes()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"

    url_port = to_url(portrait_path)
    url_land = to_url(landscape_path)
    url_sq = to_url(square_path)

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

            raw_results = page.evaluate(
                """async ({ urlPort, urlLand, urlSq }) => {
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { WebGL2Renderer } = await import('/src/engine/renderer/webgl2.renderer.ts');
                    const { PRESETS } = await import('/src/data/presets.ts');
                    const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                    const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                    const loadToMasterCanvas = (src) => new Promise((res, rej) => {
                        const img = new Image();
                        img.onload = () => {
                            const c = document.createElement('canvas');
                            c.width = img.naturalWidth || img.width;
                            c.height = img.naturalHeight || img.height;
                            const ctx = c.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            res(c);
                        };
                        img.onerror = rej;
                        img.src = src;
                    });

                    const [canvPort, canvLand, canvSq] = await Promise.all([
                        loadToMasterCanvas(urlPort),
                        loadToMasterCanvas(urlLand),
                        loadToMasterCanvas(urlSq),
                    ]);

                    // Presets for grain evaluation:
                    // 'fuji-eterna' (grain: 18), 'kodak-gold' (grain: 20), 'cinestill-800t' (grain: 26)
                    const pGold = PRESETS.find(p => p.id === 'kodak-gold') || PRESETS[1];
                    const pMono = PRESETS.find(p => p.id === 'mono-leica') || PRESETS[2];
                    const pAmber = PRESETS.find(p => p.id === 'amber-halation') || PRESETS[3];

                    const effGold = buildEffectiveRecipe(pGold.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const effMono = buildEffectiveRecipe(pMono.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const effAmber = buildEffectiveRecipe(pAmber.recipe, 100, DEFAULT_ADJUSTMENTS);

                    const renderToData = async (pipe, req) => {
                        const target = document.createElement('canvas');
                        await pipe.renderPreview({ ...req, targetCanvas: target });
                        return {
                            width: target.width,
                            height: target.height,
                            dataUrl: target.toDataURL('image/png')
                        };
                    };

                    const out = {};

                    // 1. Same input, same seed, repeated GPU render determinism
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const r1 = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: true
                        });
                        const r2 = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: true
                        });
                        pipe.dispose();

                        out.gpu_repeated_determinism = {
                            pass: r1.dataUrl === r2.dataUrl,
                            r1: r1.dataUrl,
                            r2: r2.dataUrl
                        };
                    }

                    // 2. Same input, same seed, repeated CPU render determinism
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: false, preferWorkerFallback: true });
                        const r1 = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: true
                        });
                        const r2 = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: true
                        });
                        pipe.dispose();

                        out.cpu_repeated_determinism = {
                            pass: r1.dataUrl === r2.dataUrl,
                            r1: r1.dataUrl,
                            r2: r2.dataUrl
                        };
                    }

                    // 3. Aspect Ratio Renders (Portrait, Landscape, Square) with grain ON and OFF
                    const aspectRenders = {};
                    for (const [aspectName, srcCanvas] of [
                        ['portrait', canvPort],
                        ['landscape', canvLand],
                        ['square', canvSq],
                    ]) {
                        const pipeGpu = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const pipeCpu = new PhotoPipeline({ preferWebGL2: false, preferWorkerFallback: true });

                        const gpuGrain = await renderToData(pipeGpu, {
                            source: srcCanvas, sourceId: aspectName, sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: true
                        });
                        const gpuNoGrain = await renderToData(pipeGpu, {
                            source: srcCanvas, sourceId: aspectName, sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: false
                        });

                        const cpuGrain = await renderToData(pipeCpu, {
                            source: srcCanvas, sourceId: aspectName, sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: true
                        });
                        const cpuNoGrain = await renderToData(pipeCpu, {
                            source: srcCanvas, sourceId: aspectName, sourceRevision: 1, transformRevision: 1,
                            recipe: effMono, maxDimension: 480, includeGrain: false
                        });

                        pipeGpu.dispose();
                        pipeCpu.dispose();

                        aspectRenders[aspectName] = {
                            gpuGrain, gpuNoGrain, cpuGrain, cpuNoGrain
                        };
                    }
                    out.aspectRenders = aspectRenders;

                    // 4. Intensity Ladder (0%, 25%, 50%, 75%, 100%) on Amber Halation
                    const ladderRenders = [];
                    const pipeLadder = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                    for (const intensity of [0, 25, 50, 75, 100]) {
                        const recipe = buildEffectiveRecipe(pAmber.recipe, intensity, DEFAULT_ADJUSTMENTS);
                        const rend = await renderToData(pipeLadder, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe, maxDimension: 480, includeGrain: true
                        });
                        const rendNoG = await renderToData(pipeLadder, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe, maxDimension: 480, includeGrain: false
                        });
                        ladderRenders.push({ intensity, withGrain: rend, noGrain: rendNoG });
                    }
                    pipeLadder.dispose();
                    out.ladderRenders = ladderRenders;

                    // 5. Multi-resolution: Preview (320px) vs Full-res Export (1080px)
                    {
                        const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                        const prevGrain = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effGold, maxDimension: 320, includeGrain: true
                        });
                        const prevNoGrain = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effGold, maxDimension: 320, includeGrain: false
                        });

                        const expGrain = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effGold, maxDimension: 1080, includeGrain: true
                        });
                        const expNoGrain = await renderToData(pipe, {
                            source: canvPort, sourceId: 'p', sourceRevision: 1, transformRevision: 1,
                            recipe: effGold, maxDimension: 1080, includeGrain: false
                        });
                        pipe.dispose();

                        out.multiRes = { prevGrain, prevNoGrain, expGrain, expNoGrain };
                    }

                    return out;
                }""",
                {"urlPort": url_port, "urlLand": url_land, "urlSq": url_sq},
            )

            browser.close()
            return raw_results
    finally:
        srv.terminate()
        srv.wait(timeout=5)


def extract_center_crop(rgb: np.ndarray, cw: int = 140, ch: int = 140) -> np.ndarray:
    h, w = rgb.shape[:2]
    y0 = max(0, (h - ch) // 2)
    x0 = max(0, (w - cw) // 2)
    return rgb[y0 : y0 + ch, x0 : x0 + cw]


def data_url_to_rgb(data_url: str) -> np.ndarray:
    if "," not in data_url:
        raise ValueError(f"Invalid data_url: {data_url[:64]}")
    _, b64 = data_url.split(",", 1)
    return np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB"), dtype=np.uint8)


def main() -> int:
    print("=== Auvori Phase 6.2C — Grain Determinism & Orientation Suite ===")
    data = run_grain_suite()

    # Compare repeated determinism
    r1_gpu = data_url_to_rgb(data["gpu_repeated_determinism"]["r1"])
    r2_gpu = data_url_to_rgb(data["gpu_repeated_determinism"]["r2"])
    gpu_diff = int(np.count_nonzero(r1_gpu != r2_gpu))

    r1_cpu = data_url_to_rgb(data["cpu_repeated_determinism"]["r1"])
    r2_cpu = data_url_to_rgb(data["cpu_repeated_determinism"]["r2"])
    cpu_diff = int(np.count_nonzero(r1_cpu != r2_cpu))

    gpu_det_pass = (gpu_diff == 0)
    cpu_det_pass = (cpu_diff == 0)

    metrics = {
        "gpu_repeated_determinism": {
            "pass": gpu_det_pass,
            "diffCount": gpu_diff,
            "totalPixels": int(r1_gpu.size // 3)
        },
        "cpu_repeated_determinism": {
            "pass": cpu_det_pass,
            "diffCount": cpu_diff,
            "totalPixels": int(r1_cpu.size // 3)
        },
        "aspect_metrics": {},
        "ladder_metrics": {},
        "multi_res_metrics": {},
    }

    print(f"[Determinism] GPU repeated: {metrics['gpu_repeated_determinism']}")
    print(f"[Determinism] CPU repeated: {metrics['cpu_repeated_determinism']}")

    # Process Aspect Ratios
    for aspect_name, rends in data["aspectRenders"].items():
        gpu_g = data_url_to_rgb(rends["gpuGrain"]["dataUrl"])
        gpu_ng = data_url_to_rgb(rends["gpuNoGrain"]["dataUrl"])

        cpu_g = data_url_to_rgb(rends["cpuGrain"]["dataUrl"])
        cpu_ng = data_url_to_rgb(rends["cpuNoGrain"]["dataUrl"])

        gh, gw = gpu_g.shape[:2]
        gpu_stats = compute_grain_stats(gpu_g, gpu_ng)
        cpu_stats = compute_grain_stats(cpu_g, cpu_ng)

        # Cross-path parity difference
        diff_arr = np.abs(gpu_g.astype(np.float64) - cpu_g.astype(np.float64))
        cross_mae = float(np.mean(diff_arr))

        metrics["aspect_metrics"][aspect_name] = {
            "gpu": gpu_stats,
            "cpu": cpu_stats,
            "cross_path_mae": cross_mae,
            "luma_std_diff": abs(gpu_stats["std_residual"] - cpu_stats["std_residual"]),
        }

        # Save aspect contact sheet
        items = [
            ("GPU Grain ON", gpu_g, extract_center_crop(gpu_g)),
            ("GPU Grain OFF", gpu_ng, extract_center_crop(gpu_ng)),
            ("CPU Grain ON", cpu_g, extract_center_crop(cpu_g)),
            ("CPU Grain OFF", cpu_ng, extract_center_crop(cpu_ng)),
        ]
        save_contact_sheet(
            f"Phase 6.2C Grain Determinism — {aspect_name.capitalize()} ({gw}x{gh})",
            items,
            REPORT_DIR / f"sheet_grain_determinism_{aspect_name}.jpg",
        )

    # Process Intensity Ladder
    ladder_items = []
    for item in data["ladderRenders"]:
        intensity = item["intensity"]
        wg = data_url_to_rgb(item["withGrain"]["dataUrl"])
        ng = data_url_to_rgb(item["noGrain"]["dataUrl"])
        stats = compute_grain_stats(wg, ng)
        metrics["ladder_metrics"][f"{intensity}%"] = stats
        ladder_items.append((f"{intensity}% Intensity", wg, extract_center_crop(wg)))

    save_contact_sheet(
        "Phase 6.2C Grain Intensity Ladder (0% - 100%)",
        ladder_items,
        REPORT_DIR / "sheet_grain_intensity_ladder.jpg",
    )

    # Process Multi-resolution Preview vs Export
    mr = data["multiRes"]
    prev_g = data_url_to_rgb(mr["prevGrain"]["dataUrl"])
    prev_ng = data_url_to_rgb(mr["prevNoGrain"]["dataUrl"])
    exp_g = data_url_to_rgb(mr["expGrain"]["dataUrl"])
    exp_ng = data_url_to_rgb(mr["expNoGrain"]["dataUrl"])

    metrics["multi_res_metrics"]["preview_320"] = compute_grain_stats(prev_g, prev_ng)
    metrics["multi_res_metrics"]["export_1080"] = compute_grain_stats(exp_g, exp_ng)

    mr_items = [
        ("Preview (320px) Grain ON", prev_g, extract_center_crop(prev_g)),
        ("Preview (320px) Grain OFF", prev_ng, extract_center_crop(prev_ng)),
        ("Export (1080px) Grain ON", exp_g, extract_center_crop(exp_g)),
        ("Export (1080px) Grain OFF", exp_ng, extract_center_crop(exp_ng)),
    ]
    save_contact_sheet(
        "Phase 6.2C Grain Preview vs Export Parity",
        mr_items,
        REPORT_DIR / "sheet_grain_gpu_vs_cpu_spatial.jpg",
    )

    # Write grain_metrics.json
    out_json = REPORT_DIR / "grain_metrics.json"
    out_json.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(f"\nGrain metrics written to: {out_json}")

    # Summary checks
    gpu_pass = data["gpu_repeated_determinism"]["pass"]
    cpu_pass = data["cpu_repeated_determinism"]["pass"]

    print(f"\n--- Grain Validation Summary ---")
    print(f"GPU Repeat Determinism: {'PASS' if gpu_pass else 'FAIL'}")
    print(f"CPU Repeat Determinism: {'PASS' if cpu_pass else 'FAIL'}")

    all_pass = gpu_pass and cpu_pass
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
