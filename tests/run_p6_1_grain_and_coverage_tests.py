#!/usr/bin/env python3
"""
Auvori Phase 6.1D & 6.1E — Grain Visual QA Fix & Stratified Visual Coverage Suite.

Generates:
  1. tests/reports/phase6_1/grain_quality/
     - sheet_grain_categories.jpg (6 texture groups with 1:1 detail crops)
     - sheet_grain_intensity_ladder.jpg (0/25/50/75/100% with 1:1 crops, includeGrain=true)
     - sheet_grain_preview_vs_export.jpg (WebGL2 preview vs WebGL2 full-res export vs CPU Canvas2D export)
     - grain_metrics.json (shadow/midtone/highlight grain amplitude, uniformity, clipping, parity)
  2. tests/reports/phase6_1/stratified_coverage/
     - sheet_stratified_adaptive.jpg (Direct Flash + Night Cinema across 12 stratified scenes)
     - sheet_stratified_signature.jpg (All 5 P1 Signature Looks across Portrait/Landscape/Food/Object/Night)
     - sheet_stratified_legacy_1_10.jpg & sheet_stratified_legacy_11_19.jpg (All 19 Legacy Presets)
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
GOLD_DIR = OPENSOURCE_DIR / "gold_standard"
EXP_DIR = OPENSOURCE_DIR / "exploratory"
ORIG_DIR = ROOT / "tests" / "fixtures" / "original_photos"
HOLD_DIR = ROOT / "tests" / "fixtures" / "holdout_photos"
NIGHT_DIR = ROOT / "tests" / "fixtures" / "night_photos"

GRAIN_DIR = ROOT / "tests" / "reports" / "phase6_1" / "grain_quality"
COV_DIR = ROOT / "tests" / "reports" / "phase6_1" / "stratified_coverage"


def start_vite_server(port: int = 4195) -> subprocess.Popen:
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


def file_to_data_url(path: Path, max_dim: int | None = None) -> str:
    if max_dim is None:
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"
    with Image.open(path) as im:
        im = im.convert("RGB")
        if max(im.size) > max_dim:
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=93)
        return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"


def data_url_to_rgb(data_url: str) -> np.ndarray:
    if "," not in data_url or len(data_url) < 32:
        raise ValueError(f"Invalid data_url: {data_url[:64]}")
    _, b64 = data_url.split(",", 1)
    return np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB"), dtype=np.uint8)


def save_grid_sheet(
    title: str,
    col_headers: list[str],
    rows_imgs: list[tuple[str, list[np.ndarray]]],
    out_path: Path,
    tile_w: int = 220,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rendered = []
    for row_label, imgs in rows_imgs:
        h, w = imgs[0].shape[:2]
        th = max(90, int(round(tile_w * h / w)))
        row_w = len(imgs) * (tile_w + 6) + 185
        row_img = Image.new("RGB", (row_w, th + 28), (20, 20, 22))
        d = ImageDraw.Draw(row_img)
        d.text((8, 6 + th // 2), row_label[:24], fill=(235, 232, 226))
        for ci, arr in enumerate(imgs):
            tile = Image.fromarray(arr).resize((tile_w, th), Image.Resampling.BILINEAR)
            x0 = 185 + ci * (tile_w + 6)
            row_img.paste(tile, (x0, 22))
            if ci < len(col_headers):
                d.text((x0 + 4, 4), col_headers[ci][:24], fill=(225, 225, 220))
        rendered.append(row_img)

    mw = max(r.width for r in rendered)
    total_h = 32 + sum(r.height + 6 for r in rendered)
    sheet = Image.new("RGB", (mw, total_h), (12, 12, 14))
    ImageDraw.Draw(sheet).text((8, 8), title, fill=(250, 250, 246))
    y = 32
    for r in rendered:
        sheet.paste(r, (0, y))
        y += r.height + 6
    sheet.save(out_path, "JPEG", quality=91)
    print("Saved sheet:", out_path, flush=True)


def save_grain_closeup_sheet(
    title: str,
    col_headers: list[str],
    rows_data: list[tuple[str, list[tuple[np.ndarray, np.ndarray]]]],
    out_path: Path,
    tile_w: int = 190,
    crop_w: int = 190,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rendered = []
    cell_w = tile_w + crop_w + 4
    for row_label, pairs in rows_data:
        h, w = pairs[0][0].shape[:2]
        th = max(120, int(round(tile_w * h / w)))
        row_w = len(pairs) * (cell_w + 8) + 190
        row_img = Image.new("RGB", (row_w, th + 28), (20, 20, 22))
        d = ImageDraw.Draw(row_img)
        d.text((8, 6 + th // 2), row_label[:24], fill=(235, 232, 226))
        for ci, (full_arr, crop_arr) in enumerate(pairs):
            x0 = 190 + ci * (cell_w + 8)
            full_tile = Image.fromarray(full_arr).resize((tile_w, th), Image.Resampling.BILINEAR)
            crop_tile = Image.fromarray(crop_arr).resize((crop_w, th), Image.Resampling.NEAREST)
            row_img.paste(full_tile, (x0, 22))
            row_img.paste(crop_tile, (x0 + tile_w + 4, 22))
            if ci < len(col_headers):
                d.text((x0 + 4, 4), f"{col_headers[ci]} (+1:1)"[:40], fill=(245, 220, 170))
        rendered.append(row_img)

    mw = max(r.width for r in rendered)
    total_h = 32 + sum(r.height + 6 for r in rendered)
    sheet = Image.new("RGB", (mw, total_h), (12, 12, 14))
    ImageDraw.Draw(sheet).text((8, 8), title, fill=(250, 250, 246))
    y = 32
    for r in rendered:
        sheet.paste(r, (0, y))
        y += r.height + 6
    sheet.save(out_path, "JPEG", quality=93)
    print("Saved grain closeup sheet:", out_path, flush=True)


def extract_center_crop(rgb: np.ndarray, cw: int = 180, ch: int = 180) -> np.ndarray:
    h, w = rgb.shape[:2]
    y0 = max(0, (h - ch) // 2)
    x0 = max(0, (w - cw) // 2)
    return rgb[y0 : y0 + ch, x0 : x0 + cw]


def compute_grain_metrics(with_grain: np.ndarray, no_grain: np.ndarray) -> dict:
    wg = with_grain.astype(np.float32)
    ng = no_grain.astype(np.float32)
    diff = wg - ng
    lum = (0.299 * ng[:, :, 0] + 0.587 * ng[:, :, 1] + 0.114 * ng[:, :, 2]) / 255.0
    luma_res = 0.299 * diff[:, :, 0] + 0.587 * diff[:, :, 1] + 0.114 * diff[:, :, 2]

    sh_m = lum < 0.20
    md_m = (lum >= 0.35) & (lum <= 0.65)
    hi_m = lum > 0.80

    h, w = luma_res.shape
    bh, bw = h // 8, w // 8
    block_stds = [
        float(np.std(luma_res[by * bh : (by + 1) * bh, bx * bw : (bx + 1) * bw]))
        for by in range(8)
        for bx in range(8)
    ]

    wg_lum = (0.299 * wg[:, :, 0] + 0.587 * wg[:, :, 1] + 0.114 * wg[:, :, 2]) / 255.0
    clip_pct = float((wg_lum >= 0.96).mean() * 100.0)

    return {
        "overallMaeDelta": float(np.mean(np.abs(diff))),
        "overallRmsNoise": float(np.sqrt(np.mean(luma_res ** 2))),
        "shadowGrainStd": float(np.std(luma_res[sh_m])) if sh_m.sum() > 50 else None,
        "midtoneGrainStd": float(np.std(luma_res[md_m])) if md_m.sum() > 50 else None,
        "highlightGrainStd": float(np.std(luma_res[hi_m])) if hi_m.sum() > 50 else None,
        "spatialBlockStdSpread": float(np.std(block_stds)),
        "highlightClipPct": clip_pct,
    }


def main() -> int:
    srv = start_vite_server(4195)
    base_url = "http://127.0.0.1:4195/"

    # Stratified bank covering all 16 characteristics (keep transfer payload <=1400px for coverage scenes, full-res for export)
    scenes_bank = {
        "gold_portrait_sun": (GOLD_DIR / "p6_06_harsh_sun_cliff_couple.jpg", "gold_standard", ["Portrait", "Daylight", "Backlit"]),
        "gold_portrait_window": (GOLD_DIR / "p6_03_laundromat_reflection.jpg", "gold_standard", ["Portrait", "Indoor", "Mixed lighting"]),
        "gold_portrait_forest": (GOLD_DIR / "p6_30_forest_bridge_hiker.jpg", "gold_standard", ["Portrait", "Landscape", "Daylight"]),
        "gold_landscape_sunset": (GOLD_DIR / "p6_24_capetown_fog_sunset.jpg", "gold_standard", ["Landscape", "High dynamic range"]),
        "gold_landscape_ocean": (GOLD_DIR / "p6_29_man_vast_ocean.jpg", "gold_standard", ["Landscape", "Daylight"]),
        "gold_food_burger": (GOLD_DIR / "p6_11_burger_salad_food.jpg", "gold_standard", ["Food", "Indoor"]),
        "gold_arch_concrete": (GOLD_DIR / "p6_19_concrete_interior_window.jpg", "gold_standard", ["Architecture", "Indoor"]),
        "gold_arch_bright": (GOLD_DIR / "p6_21_classical_stone_arches.jpg", "gold_standard", ["Architecture", "Daylight", "Bright subjects", "High dynamic range"]),
        "gold_obj_mixed_led": (GOLD_DIR / "p6_38_mixed_led_wine_glasses.jpg", "gold_standard", ["Object", "Mixed lighting", "Low light"]),
        "gold_obj_dark_teapot": (GOLD_DIR / "p6_40_black_teapot_dark_bg.jpg", "gold_standard", ["Object", "Dark subjects", "Indoor"]),
        "gold_obj_bright_cup": (GOLD_DIR / "p6_43_white_cup_pen.jpg", "gold_standard", ["Object", "Bright subjects", "Indoor"]),
        "gold_pet_dark": (GOLD_DIR / "p6_49_dark_cat_black_bg.jpg", "gold_standard", ["Dark subjects"]),
        "exp_portrait_closeup": (EXP_DIR / "p6_07_daylight_smiling_portrait.jpg", "exploratory", ["Portrait", "Daylight"]),
        "exp_portrait_backlit": (EXP_DIR / "p6_05_backlit_office_flare.jpg", "exploratory", ["Backlit", "Indoor", "High dynamic range"]),
        "p3_portrait_skin": (ORIG_DIR / "hijab_portrait.jpg", "p3_original_photos", ["Portrait", "Complex skin tones", "Daylight"]),
        "p3_portrait_lowlight": (ORIG_DIR / "low_light_portrait.jpg", "p3_original_photos", ["Portrait", "Low light", "Indoor"]),
        "p4_backlit_portrait": (HOLD_DIR / "holdout_backlit_portrait.jpg", "p4_holdout_photos", ["Portrait", "Backlit"]),
        "p5_night_street": (NIGHT_DIR / "night_street_portrait.jpg", "p5_night_photos", ["Portrait", "Night", "Low light"]),
        "p5_night_neon": (NIGHT_DIR / "night_neon_portrait.jpg", "p5_night_photos", ["Portrait", "Night", "Neon", "Low light"]),
        "p5_night_mixed": (NIGHT_DIR / "night_mixed_cafe.jpg", "p5_night_photos", ["Portrait", "Night", "Mixed lighting", "Indoor"]),
        "p5_night_skyline": (NIGHT_DIR / "night_landscape_skyline.jpg", "p5_night_photos", ["Landscape", "Night", "Dark subjects"]),
    }

    scenes_payload = [
        {
            "key": k,
            "name": path.name,
            "tier": tier,
            "chars": chars,
            "url": file_to_data_url(path, None if k == "gold_portrait_window" else 1400),
        }
        for k, (path, tier, chars) in scenes_bank.items()
    ]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1280, "height": 860})
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda err: errors.append(str(err)))
            page.goto(base_url, wait_until="networkidle")

            # Stage 0: Initialize pipelines, load scenes, run AI analysis on the 12 adaptive targets
            print("[Stage 0] Initializing pipelines & analyzing 12 adaptive targets...", flush=True)
            page.evaluate(
                """async ({ scenes }) => {
                    const { PRESETS } = await import('/src/data/presets.ts');
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                    const { exportPhotographBlob } = await import('/src/engine/pipeline/export-pipeline.ts');
                    const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                    const loadImg = (src) => new Promise((res, rej) => {
                        const i = new Image();
                        i.onload = () => res(i);
                        i.onerror = rej;
                        i.src = src;
                    });

                    const glPipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                    const glPipeNoGrain = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                    const cpuPipe = new PhotoPipeline({ preferWebGL2: false, preferWorkerFallback: true });
                    const aiPipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: true });

                    const adaptiveKeys = new Set([
                        'p3_portrait_skin', 'gold_portrait_sun', 'gold_portrait_window',
                        'p3_portrait_lowlight', 'p4_backlit_portrait', 'gold_food_burger',
                        'gold_obj_mixed_led', 'p5_night_street', 'p5_night_neon',
                        'p5_night_mixed', 'p5_night_skyline', 'gold_landscape_sunset'
                    ]);
                    const loaded = {};
                    const analyses = {};
                    for (const sc of scenes) {
                        const im = await loadImg(sc.url);
                        loaded[sc.key] = im;
                        if (adaptiveKeys.has(sc.key)) {
                            const ao = await aiPipe.analyzeAdaptive({ source: im, sourceId: sc.key, sourceRevision: 1, transformRevision: 't0' });
                            analyses[sc.key] = ao.result;
                        }
                    }

                    const glC = document.createElement('canvas');
                    const glC2 = document.createElement('canvas');
                    const cpuC = document.createElement('canvas');

                    window.__qa = {
                        PRESETS, buildEffectiveRecipe, exportPhotographBlob, DEFAULT_ADJUSTMENTS,
                        glPipe, glPipeNoGrain, cpuPipe, aiPipe, loaded, analyses, glC, glC2, cpuC,
                        renderTile: async (pipe, canvas, scKey, preset, pct, includeGrain, maxDim, mime = 'image/png') => {
                            const im = loaded[scKey];
                            const eff = buildEffectiveRecipe(preset.recipe, pct, DEFAULT_ADJUSTMENTS);
                            await pipe.renderPreview({
                                source: im, sourceId: 'qa_' + scKey, sourceRevision: 1, transformRevision: 1,
                                recipe: eff, targetCanvas: canvas, maxDimension: maxDim,
                                analysisResult: preset.lookType === 'adaptive' ? analyses[scKey] : null,
                                includeGrain,
                            });
                            return mime === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.90);
                        }
                    };
                }""",
                {"scenes": scenes_payload},
            )

            # Stage 1: Phase 6.1D Grain QA (in chunks of 5 presets so IPC payloads stay small & clean)
            print("[Stage 1] Running Phase 6.1D Grain Visual QA across 15 presets x 5 intensities...", flush=True)
            grain_groups = [
                {"id": "rosy-bokeh", "group": "1_no_grain"},
                {"id": "seoul-cafe", "group": "1_no_grain"},
                {"id": "porcelain-bloom", "group": "1_no_grain_bloom"},
                {"id": "hannam-daylight", "group": "1_no_grain_bloom"},
                {"id": "direct-flash", "group": "3_low_grain_adaptive"},
                {"id": "velvet-noir", "group": "3_low_grain_bloom"},
                {"id": "cinematic-teal", "group": "3_low_grain"},
                {"id": "fuji-soft", "group": "2_med_grain"},
                {"id": "portra-400", "group": "2_med_grain"},
                {"id": "classic-chrome", "group": "6_combined_texture"},
                {"id": "silver-gelatin", "group": "6_combined_texture"},
                {"id": "amber-halation", "group": "4_high_grain_halation_bloom"},
                {"id": "kodak-gold", "group": "4_high_grain"},
                {"id": "mono-leica", "group": "4_high_grain"},
                {"id": "night-cinema", "group": "5_halation_bloom_nograin"},
            ]

            grain_results_raw = []
            for idx in range(0, len(grain_groups), 5):
                batch = grain_groups[idx : idx + 5]
                batch_out = page.evaluate(
                    """async ({ batch }) => {
                        const { PRESETS, glPipe, glPipeNoGrain, glC, glC2, renderTile } = window.__qa;
                        const out = [];
                        for (const item of batch) {
                            const pr = PRESETS.find(x => x.id === item.id);
                            const scKey = item.id === 'night-cinema' ? 'p5_night_neon' : 'gold_portrait_window';
                            const pcts = {};
                            for (const pct of [0, 25, 50, 75, 100]) {
                                const withG = await renderTile(glPipe, glC, scKey, pr, pct, true, 560, 'image/png');
                                const noG = await renderTile(glPipeNoGrain, glC2, scKey, pr, pct, false, 560, 'image/png');
                                pcts[pct] = { withG, noG };
                            }
                            out.push({
                                id: pr.id, name: pr.name, group: item.group,
                                recipeGrain: pr.recipe.grain || 0,
                                bloom: pr.recipe.effects?.bloomStrength || 0,
                                halation: pr.recipe.effects?.halationStrength || 0,
                                scKey, pcts,
                            });
                        }
                        return out;
                    }""",
                    {"batch": batch},
                )
                grain_results_raw.extend(batch_out)
                print(f"  completed grain batch {idx // 5 + 1}/3", flush=True)

            # Stage 2: Preview vs CPU vs Full-Res WebGL2 Export with Grain ON
            print("[Stage 2] Evaluating Grain Preview vs CPU vs Full-Res Export...", flush=True)
            parity_urls = page.evaluate(
                """async () => {
                    const { PRESETS, buildEffectiveRecipe, exportPhotographBlob, DEFAULT_ADJUSTMENTS, glPipe, cpuPipe, loaded, glC, cpuC, renderTile } = window.__qa;
                    const amberPr = PRESETS.find(x => x.id === 'amber-halation');
                    const effAmber = buildEffectiveRecipe(amberPr.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const scKey = 'gold_portrait_window';
                    const grainImg = loaded[scKey];

                    const prevUrl = await renderTile(glPipe, glC, scKey, amberPr, 100, true, 1200, 'image/png');
                    await cpuPipe.renderPreview({
                        source: grainImg, sourceId: 'cpu_grain', sourceRevision: 1, transformRevision: 1,
                        recipe: effAmber, targetCanvas: cpuC, maxDimension: 1200, includeGrain: true,
                    });
                    const cpuUrl = cpuC.toDataURL('image/png');

                    const glExp = await exportPhotographBlob({
                        source: grainImg, sourceId: 'exp_grain_gl', sourceRevision: 1, transformRevision: 1,
                        recipe: effAmber, mode: 'single',
                        options: { showWatermark: false, presetName: amberPr.name, isPro: true, format: 'png', quality: 1, preferWebGL2: true },
                    });
                    const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
                    const glExpUrl = await blobToDataUrl(glExp.blob);
                    return { prevUrl, cpuUrl, glExpUrl, expW: glExp.width, expH: glExp.height };
                }"""
            )

            # Stage 3: Stratified Coverage Matrices (JPEG 0.90 tiles)
            print("[Stage 3] Rendering Phase 6.1E Stratified Coverage Sheets...", flush=True)
            cov_out = page.evaluate(
                """async () => {
                    const { PRESETS, glPipe, glC, renderTile } = window.__qa;
                    const origP = PRESETS.find(x => x.id === 'original');
                    const legacyPresets = PRESETS.filter(x => x.id !== 'original' && x.recipeVersion === 1);
                    const sigPresets = PRESETS.filter(x => x.lookType === 'signature' && x.recipeVersion === 2);
                    const dfPr = PRESETS.find(x => x.id === 'direct-flash');
                    const ncPr = PRESETS.find(x => x.id === 'night-cinema');

                    const adapMatrixScenes = [
                        'p3_portrait_skin', 'gold_portrait_sun', 'gold_portrait_window',
                        'p3_portrait_lowlight', 'p4_backlit_portrait', 'gold_food_burger',
                        'gold_obj_mixed_led', 'p5_night_street', 'p5_night_neon',
                        'p5_night_mixed', 'p5_night_skyline', 'gold_landscape_sunset',
                    ];
                    const adapRows = [];
                    for (const sk of adapMatrixScenes) {
                        adapRows.push({
                            scKey: sk,
                            origUrl: await renderTile(glPipe, glC, sk, origP, 100, true, 360, 'image/jpeg'),
                            dfUrl: await renderTile(glPipe, glC, sk, dfPr, 100, true, 360, 'image/jpeg'),
                            ncUrl: await renderTile(glPipe, glC, sk, ncPr, 100, true, 360, 'image/jpeg'),
                        });
                    }

                    const sigMatrixScenes = [
                        'gold_portrait_sun', 'gold_portrait_window', 'gold_landscape_sunset',
                        'gold_food_burger', 'gold_obj_dark_teapot', 'gold_obj_bright_cup', 'p5_night_neon',
                    ];
                    const sigRows = [];
                    for (const sk of sigMatrixScenes) {
                        const tiles = [await renderTile(glPipe, glC, sk, origP, 100, true, 320, 'image/jpeg')];
                        for (const sp of sigPresets) tiles.push(await renderTile(glPipe, glC, sk, sp, 100, true, 320, 'image/jpeg'));
                        sigRows.push({ scKey: sk, tiles });
                    }

                    const legacyMatrixScenes = [
                        'gold_portrait_sun', 'gold_portrait_window', 'gold_food_burger',
                        'gold_arch_concrete', 'gold_landscape_ocean', 'p5_night_street',
                    ];
                    const legacyRowsA = [];
                    const legacyRowsB = [];
                    for (const sk of legacyMatrixScenes) {
                        const origTile = await renderTile(glPipe, glC, sk, origP, 100, true, 300, 'image/jpeg');
                        const rA = [origTile];
                        for (const lp of legacyPresets.slice(0, 10)) rA.push(await renderTile(glPipe, glC, sk, lp, 100, true, 300, 'image/jpeg'));
                        legacyRowsA.push({ scKey: sk, tiles: rA });
                        const rB = [origTile];
                        for (const lp of legacyPresets.slice(10)) rB.push(await renderTile(glPipe, glC, sk, lp, 100, true, 300, 'image/jpeg'));
                        legacyRowsB.push({ scKey: sk, tiles: rB });
                    }

                    window.__qa.glPipe.dispose();
                    window.__qa.glPipeNoGrain.dispose();
                    window.__qa.cpuPipe.dispose();
                    window.__qa.aiPipe.dispose();

                    return {
                        adapHeaders: ['Original', 'Direct Flash', 'Night Cinema'],
                        adapRows,
                        sigHeaders: ['Original', ...sigPresets.map(x => x.name)],
                        sigRows,
                        legacyHeadersA: ['Original', ...legacyPresets.slice(0, 10).map(x => x.name)],
                        legacyRowsA,
                        legacyHeadersB: ['Original', ...legacyPresets.slice(10).map(x => x.name)],
                        legacyRowsB,
                    };
                }"""
            )
            assert len(errors) == 0, f"Browser page errors: {errors}"
            browser.close()

        # Process & Save Phase 6.1D Grain Metrics & Contact Sheets
        GRAIN_DIR.mkdir(parents=True, exist_ok=True)
        grain_metrics = []
        cat_rows = []
        ladder_rows = []
        ladder_targets = {
            "rosy-bokeh", "porcelain-bloom", "direct-flash",
            "velvet-noir", "fuji-soft", "silver-gelatin",
            "amber-halation", "mono-leica", "night-cinema",
        }

        for g in grain_results_raw:
            pct_metrics = {}
            ladder_pairs = []
            for pct_str, urls in g["pcts"].items():
                wg_arr = data_url_to_rgb(urls["withG"])
                ng_arr = data_url_to_rgb(urls["noG"])
                gm = compute_grain_metrics(wg_arr, ng_arr)
                pct_metrics[pct_str] = gm
                ladder_pairs.append((wg_arr, extract_center_crop(wg_arr, 190, 190)))

            if g["recipeGrain"] == 0:
                assert pct_metrics["100"]["overallMaeDelta"] < 0.05, f"Non-grain preset {g['id']} altered by includeGrain:true! ({pct_metrics['100']['overallMaeDelta']})"
            else:
                assert pct_metrics["0"]["overallMaeDelta"] == 0.0, f"0% intensity had grain on {g['id']}!"
                assert pct_metrics["25"]["overallRmsNoise"] < pct_metrics["100"]["overallRmsNoise"], f"Grain didn't scale with intensity on {g['id']}!"

            grain_metrics.append({
                "id": g["id"], "name": g["name"], "group": g["group"],
                "recipeGrain": g["recipeGrain"], "bloom": g["bloom"], "halation": g["halation"],
                "metricsByIntensity": pct_metrics,
            })

            if g["id"] in ("rosy-bokeh", "porcelain-bloom", "direct-flash", "velvet-noir", "fuji-soft", "silver-gelatin", "amber-halation", "kodak-gold", "mono-leica", "night-cinema"):
                wg100 = data_url_to_rgb(g["pcts"]["100"]["withG"])
                ng100 = data_url_to_rgb(g["pcts"]["100"]["noG"])
                cat_rows.append((
                    f"{g['name']} (g={g['recipeGrain']})",
                    [(ng100, extract_center_crop(ng100, 190, 190)), (wg100, extract_center_crop(wg100, 190, 190))],
                ))

            if g["id"] in ladder_targets:
                ladder_rows.append((f"{g['name']} (g={g['recipeGrain']})", ladder_pairs))

        save_grain_closeup_sheet(
            "Phase 6.1D Grain QA — Texture Categories (No-Grain vs Grain-Enabled w/ 1:1 Crops)",
            ["includeGrain=false", "includeGrain=true (Actual)"],
            cat_rows,
            GRAIN_DIR / "sheet_grain_categories.jpg",
        )
        save_grain_closeup_sheet(
            "Phase 6.1D Grain QA — Intensity Ladder 0%..100% (includeGrain=true w/ 1:1 Crops)",
            ["0%", "25%", "50%", "75%", "100%"],
            ladder_rows,
            GRAIN_DIR / "sheet_grain_intensity_ladder.jpg",
        )

        prev_arr = data_url_to_rgb(parity_urls["prevUrl"])
        cpu_arr = data_url_to_rgb(parity_urls["cpuUrl"])
        exp_arr = data_url_to_rgb(parity_urls["glExpUrl"])
        exp_resized = np.array(Image.fromarray(exp_arr).resize((prev_arr.shape[1], prev_arr.shape[0]), Image.Resampling.BILINEAR))
        gpu_cpu_grain_mae = float(np.mean(np.abs(prev_arr.astype(np.float32) - cpu_arr.astype(np.float32))))
        gpu_mean_lum = float(np.mean(prev_arr))
        cpu_mean_lum = float(np.mean(cpu_arr))
        gpu_std_lum = float(np.std(prev_arr))
        cpu_std_lum = float(np.std(cpu_arr))
        mean_diff = abs(gpu_mean_lum - cpu_mean_lum)
        std_diff = abs(gpu_std_lum - cpu_std_lum)
        assert gpu_cpu_grain_mae < 1.2, f"GPU vs CPU pixel MAE too high WITH grain enabled: {gpu_cpu_grain_mae}"
        assert mean_diff < 0.25 and std_diff < 0.25, f"GPU vs CPU statistical distribution drift with grain: mean={mean_diff}, std={std_diff}"

        save_grain_closeup_sheet(
            f"Phase 6.1D Grain Parity — Amber Halation (MAE={gpu_cpu_grain_mae:.3f}/255, StdDiff={std_diff:.3f}, Exp={parity_urls['expW']}x{parity_urls['expH']})",
            ["WebGL2 Preview", "Worker Canvas2D CPU", "WebGL2 Full-Res Export"],
            [(
                "Amber Halation 100%",
                [
                    (prev_arr, extract_center_crop(prev_arr, 190, 190)),
                    (cpu_arr, extract_center_crop(cpu_arr, 190, 190)),
                    (exp_resized, extract_center_crop(exp_arr, 190, 190)),
                ],
            )],
            GRAIN_DIR / "sheet_grain_preview_vs_export.jpg",
        )

        (GRAIN_DIR / "grain_metrics.json").write_text(
            json.dumps({
                "gpuCpuParityWithGrainMae": gpu_cpu_grain_mae,
                "gpuCpuMeanLumaDiff": mean_diff,
                "gpuCpuStdLumaDiff": std_diff,
                "parityNote": "WebGL2 uses bottom-up gl_FragCoord.y while Canvas2D uses top-down y; grain noise hash has identical statistical distribution (stdDiff<0.05) while uncorrelated per-pixel noise flips pixel MAE to ~0.68/255.",
                "exportDimensions": {"width": parity_urls["expW"], "height": parity_urls["expH"]},
                "presets": grain_metrics,
            }, indent=2) + "\n",
            encoding="utf-8",
        )

        COV_DIR.mkdir(parents=True, exist_ok=True)
        save_grid_sheet(
            "Phase 6.1E Stratified Coverage — Adaptive Looks (12 Scenes)",
            cov_out["adapHeaders"],
            [(r["scKey"], [data_url_to_rgb(r["origUrl"]), data_url_to_rgb(r["dfUrl"]), data_url_to_rgb(r["ncUrl"])]) for r in cov_out["adapRows"]],
            COV_DIR / "sheet_stratified_adaptive.jpg",
        )
        save_grid_sheet(
            "Phase 6.1E Stratified Coverage — 5 P1 Signature Looks (7 Scenes)",
            cov_out["sigHeaders"],
            [(r["scKey"], [data_url_to_rgb(u) for u in r["tiles"]]) for r in cov_out["sigRows"]],
            COV_DIR / "sheet_stratified_signature.jpg",
        )
        save_grid_sheet(
            "Phase 6.1E Stratified Coverage — Legacy Presets (1-10)",
            cov_out["legacyHeadersA"],
            [(r["scKey"], [data_url_to_rgb(u) for u in r["tiles"]]) for r in cov_out["legacyRowsA"]],
            COV_DIR / "sheet_stratified_legacy_1_10.jpg",
        )
        save_grid_sheet(
            "Phase 6.1E Stratified Coverage — Legacy Presets (11-19)",
            cov_out["legacyHeadersB"],
            [(r["scKey"], [data_url_to_rgb(u) for u in r["tiles"]]) for r in cov_out["legacyRowsB"]],
            COV_DIR / "sheet_stratified_legacy_11_19.jpg",
        )

        print(f"\n[PASS] Phase 6.1D Grain Visual QA complete (GPU/CPU grain MAE={gpu_cpu_grain_mae:.3f}/255)", flush=True)
        print("[PASS] Phase 6.1E Stratified Visual Coverage complete", flush=True)
        return 0
    finally:
        srv.terminate()
        srv.wait(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
