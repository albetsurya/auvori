#!/usr/bin/env python3
"""
Auvori Phase 4 Direct Flash Comprehensive Verification, Quantitative Metrics,
Holdout Evaluation, GPU Hardware Benchmark & Editor UX Suite.
"""

import argparse
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
ORIG_DIR = ROOT / "tests" / "fixtures" / "original_photos"
HOLD_DIR = ROOT / "tests" / "fixtures" / "holdout_photos"
SCRATCH_EVAL = Path(
    "/home/albet-surya-kembara/.agyw/homes/akun-ketiga/.gemini/antigravity-cli/brain/f1d5875b-917f-4648-b689-c82db92ef1dc/scratch/eval_p4"
)


def start_vite_server(port: int = 4189) -> subprocess.Popen:
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


def load_photos(folder: Path) -> dict:
    return {
        p.name: f"data:image/jpeg;base64,{base64.b64encode(p.read_bytes()).decode('ascii')}"
        for p in sorted(folder.glob("*.jpg"))
    }


def data_url_to_rgb(data_url: str) -> np.ndarray:
    _, b64 = data_url.split(",", 1)
    return np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB"), dtype=np.uint8)


def rgb_to_hue_deg(rgb: np.ndarray) -> np.ndarray:
    f = rgb.astype(np.float32) / 255.0
    mx = f.max(axis=2)
    mn = f.min(axis=2)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = f[:, :, 0], f[:, :, 1], f[:, :, 2]
    h = np.zeros_like(mx)
    m_r = mx == r
    m_g = (~m_r) & (mx == g)
    m_b = (~m_r) & (~m_g)
    h[m_r] = np.mod((g[m_r] - b[m_r]) / d[m_r], 6.0)
    h[m_g] = (b[m_g] - r[m_g]) / d[m_g] + 2.0
    h[m_b] = (r[m_b] - g[m_b]) / d[m_b] + 4.0
    return (h * 60.0) % 360.0


def compute_image_metrics(before_rgb: np.ndarray, after_gl: np.ndarray, after_cpu: np.ndarray, mask_rgba: np.ndarray):
    h, w = before_rgb.shape[:2]
    # Resize mask to image dimensions cleanly
    mask_pil = Image.fromarray(mask_rgba, mode="RGBA").resize((w, h), Image.Resampling.BILINEAR)
    m = np.array(mask_pil, dtype=np.float32) / 255.0
    subj = m[:, :, 0]
    skin = m[:, :, 2]

    bf = before_rgb.astype(np.float32) / 255.0
    af = after_gl.astype(np.float32) / 255.0
    lum_b = 0.299 * bf[:, :, 0] + 0.587 * bf[:, :, 1] + 0.114 * bf[:, :, 2]
    lum_a = 0.299 * af[:, :, 0] + 0.587 * af[:, :, 1] + 0.114 * af[:, :, 2]

    fg_sel = subj > 0.65
    bg_sel = subj < 0.20

    subj_lum_b = float(lum_b[fg_sel].mean()) if fg_sel.any() else float(lum_b.mean())
    subj_lum_a = float(lum_a[fg_sel].mean()) if fg_sel.any() else float(lum_a.mean())
    bg_lum_b = float(lum_b[bg_sel].mean()) if bg_sel.any() else float(lum_b.mean())
    bg_lum_a = float(lum_a[bg_sel].mean()) if bg_sel.any() else float(lum_a.mean())

    # Highlight check (>= 0.90 luminous highlights and >= 0.96 hard clip)
    clip_b = float((lum_b >= 0.96).mean() * 100.0)
    clip_a = float((lum_a >= 0.96).mean() * 100.0)

    # Dark shadow / black fabric detail retention (pixels with before lum <= 0.22 inside foreground subject)
    fg_dark_sel = (lum_b <= 0.22) & (subj >= 0.55)
    dark_sel = lum_b <= 0.22
    dark_std_b = float(lum_b[fg_dark_sel].std()) if fg_dark_sel.sum() > 25 else (float(lum_b[dark_sel].std()) if dark_sel.sum() > 25 else 0.0)
    dark_std_a = float(lum_a[fg_dark_sel].std()) if fg_dark_sel.sum() > 25 else (float(lum_a[dark_sel].std()) if dark_sel.sum() > 25 else 0.0)
    dark_floor_b = float(np.percentile(lum_b, 5))
    dark_floor_a = float(np.percentile(lum_a, 5))

    # Noise amplification in dark background shadows (Laplacian detail ratio where before lum <= 0.16 & non-fg)
    lap_b = np.abs(4 * lum_b[1:-1, 1:-1] - lum_b[:-2, 1:-1] - lum_b[2:, 1:-1] - lum_b[1:-1, :-2] - lum_b[1:-1, 2:])
    lap_a = np.abs(4 * lum_a[1:-1, 1:-1] - lum_a[:-2, 1:-1] - lum_a[2:, 1:-1] - lum_a[1:-1, :-2] - lum_a[1:-1, 2:])
    inner_dark_bg = (lum_b[1:-1, 1:-1] <= 0.16) & (subj[1:-1, 1:-1] <= 0.30)
    if inner_dark_bg.sum() > 100 and lap_b[inner_dark_bg].mean() > 1e-4:
        noise_amp = float(lap_a[inner_dark_bg].mean() / lap_b[inner_dark_bg].mean())
    else:
        noise_amp = 1.0

    # Skin tone preservation (only when meaningful skin pixels exist)
    sk_sel = (skin >= 0.45) & (subj >= 0.45)
    skin_hue_diff = 0.0
    skin_lum_delta = 0.0
    skin_chroma_ratio = 1.0
    if sk_sel.sum() > 40:
        hb = rgb_to_hue_deg(before_rgb)[sk_sel]
        ha = rgb_to_hue_deg(after_gl)[sk_sel]
        dh = np.abs(ha - hb)
        dh = np.minimum(dh, 360.0 - dh)
        skin_hue_diff = float(dh.mean())
        skin_lum_delta = float((lum_a[sk_sel] - lum_b[sk_sel]).mean())
        cb = (bf.max(axis=2) - bf.min(axis=2))[sk_sel].mean()
        ca = (af.max(axis=2) - af.min(axis=2))[sk_sel].mean()
        skin_chroma_ratio = float(ca / max(cb, 1e-4))

    # Halo check at mask boundary: 4-8px band right outside 0.25..0.55 vs delta inside & far bg
    # Compare positive luminance spike right outside edge minus far bg shift
    edge_band = (subj >= 0.12) & (subj <= 0.36)
    outer_bg = subj < 0.08
    if edge_band.sum() > 30 and outer_bg.sum() > 30:
        edge_delta = float((lum_a[edge_band] - lum_b[edge_band]).mean())
        outer_delta = float((lum_a[outer_bg] - lum_b[outer_bg]).mean())
        halo_excess = max(0.0, edge_delta - outer_delta)
    else:
        halo_excess = 0.0

    # GPU vs CPU Parity
    diff = np.abs(after_gl.astype(np.int16) - after_cpu.astype(np.int16))
    mae = float(diff.mean())
    rmse = float(np.sqrt((diff.astype(np.float32) ** 2).mean()))
    max_diff = int(diff.max())

    return {
        "subjLumDelta": subj_lum_a - subj_lum_b,
        "bgLumDelta": bg_lum_a - bg_lum_b,
        "clipBeforePct": clip_b,
        "clipAfterPct": clip_a,
        "darkStdRatio": dark_std_a / max(dark_std_b, 1e-4) if dark_std_b > 0 else 1.0,
        "darkP05Delta": dark_floor_a - dark_floor_b,
        "noiseAmpRatio": noise_amp,
        "skinPixels": int(sk_sel.sum()),
        "skinHueDiffDeg": skin_hue_diff,
        "skinLumDelta": skin_lum_delta,
        "skinChromaRatio": skin_chroma_ratio,
        "haloExcess": halo_excess,
        "gpuCpuMae": mae,
        "gpuCpuRmse": rmse,
        "gpuCpuMax": max_diff,
    }


def save_visual_sheet(items: list, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for name, before_rgb, after_gl, label in items:
        h, w = before_rgb.shape[:2]
        tw, th = 260, int(round(260 * h / w))
        b_im = Image.fromarray(before_rgb).resize((tw, th), Image.Resampling.BILINEAR)
        a_im = Image.fromarray(after_gl).resize((tw, th), Image.Resampling.BILINEAR)
        row = Image.new("RGB", (tw * 2 + 8, th + 20), (22, 22, 24))
        row.paste(b_im, (0, 20))
        row.paste(a_im, (tw + 8, 20))
        ImageDraw.Draw(row).text((4, 3), f"{name} | {label}", fill=(240, 240, 238))
        rows.append(row)

    for chunk_idx in range(0, len(rows), 7):
        chunk = rows[chunk_idx : chunk_idx + 7]
        mw = max(r.width for r in chunk)
        th = sum(r.height + 4 for r in chunk)
        sheet = Image.new("RGB", (mw, th), (14, 14, 16))
        y = 0
        for r in chunk:
            sheet.paste(r, (0, y))
            y += r.height + 4
        target = out_path.with_stem(f"{out_path.stem}_{chunk_idx // 7 + 1}")
        sheet.save(target)
        print("Saved visual check:", target)


def run_browser_eval(playwright, launch_kwargs: dict, base_url: str, photo_sets: dict, label: str):
    browser = playwright.chromium.launch(**launch_kwargs)
    try:
        context = browser.new_context(viewport={"width": 1280, "height": 860})
        page = context.new_page()
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
                hasWebGPU: wg
            };
        }""")
        print(f"\n=== ENVIRONMENT [{label}]: GL={gpu_info['renderer']} | WebGPU={gpu_info['hasWebGPU']} ===")

        eval_out = page.evaluate(
            """async (allSets) => {
                const { PRESETS } = await import('/src/data/presets.ts');
                const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                const { buildAdaptiveRenderMap, resolveAdaptiveRelighting } = await import('/src/engine/analysis/adaptive-relighting.ts');
                const { exportPhotographBlob } = await import('/src/engine/pipeline/export-pipeline.ts');
                const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                const flashPreset = PRESETS.find(p => p.id === 'direct-flash');
                if (!flashPreset) throw new Error('direct-flash preset missing');
                const effectiveFlash = buildEffectiveRecipe(flashPreset.recipe, 100, DEFAULT_ADJUSTMENTS);
                const sigIds = ['porcelain-bloom', 'velvet-noir', 'hannam-daylight', 'amber-halation', 'silver-gelatin'];

                const loadImg = (src) => new Promise((res, rej) => {
                    const i = new Image();
                    i.onload = () => res(i);
                    i.onerror = rej;
                    i.src = src;
                });

                const glPipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                const cpuPipe = new PhotoPipeline({ preferWebGL2: false, preferWorkerFallback: true });
                const analyzerPipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: true });

                const results = [];
                const glCanvas = document.createElement('canvas');
                const cpuCanvas = document.createElement('canvas');

                for (const [setName, photos] of Object.entries(allSets)) {
                    for (const [name, dataUrl] of Object.entries(photos)) {
                        const img = await loadImg(dataUrl);
                        const sid = `${setName}_${name}`;
                        const aOut = await analyzerPipe.analyzeAdaptive({
                            source: img,
                            sourceId: sid,
                            sourceRevision: 1,
                            transformRevision: 't0',
                        });
                        const analysis = aOut.result;
                        const rlParams = resolveAdaptiveRelighting(effectiveFlash.relighting, analysis);

                        // Warm up / render WebGL2 & Worker CPU (includeGrain=false for deterministic parity math)
                        const glRes = await glPipe.renderPreview({
                            source: img,
                            sourceId: sid,
                            sourceRevision: 1,
                            transformRevision: 1,
                            recipe: effectiveFlash,
                            targetCanvas: glCanvas,
                            analysisResult: analysis,
                            includeGrain: false,
                        });
                        const cpuRes = await cpuPipe.renderPreview({
                            source: img,
                            sourceId: sid,
                            sourceRevision: 1,
                            transformRevision: 1,
                            recipe: effectiveFlash,
                            targetCanvas: cpuCanvas,
                            analysisResult: analysis,
                            includeGrain: false,
                        });

                        // Build mask visualization RGBA
                        const map = buildAdaptiveRenderMap(analysis, null, 0, 0, effectiveFlash.relighting.falloffRadius);
                        const maskCanvas = document.createElement('canvas');
                        maskCanvas.width = map.width;
                        maskCanvas.height = map.height;
                        const mCtx = maskCanvas.getContext('2d');
                        mCtx.putImageData(new ImageData(new Uint8ClampedArray(map.rgbaData), map.width, map.height), 0, 0);

                        // Differentiation check against 5 Signature Looks on first 3 diverse photos
                        let minSigMae = null;
                        if (name === 'hijab_portrait.jpg' || name === 'low_light_portrait.jpg' || name === 'holdout_backlit_sunset.jpg') {
                            const dfBytes = glCanvas.getContext('2d').getImageData(0, 0, glCanvas.width, glCanvas.height).data;
                            const otherCanvas = document.createElement('canvas');
                            minSigMae = 999;
                            for (const spid of sigIds) {
                                const sp = PRESETS.find(x => x.id === spid);
                                const effS = buildEffectiveRecipe(sp.recipe, 100, DEFAULT_ADJUSTMENTS);
                                await glPipe.renderPreview({
                                    source: img, sourceId: sid, sourceRevision: 1, transformRevision: 1,
                                    recipe: effS, targetCanvas: otherCanvas, includeGrain: false
                                });
                                const ob = otherCanvas.getContext('2d').getImageData(0, 0, otherCanvas.width, otherCanvas.height).data;
                                let sum = 0;
                                for (let i = 0; i < ob.length; i += 4) {
                                    sum += Math.abs(dfBytes[i] - ob[i]) + Math.abs(dfBytes[i+1] - ob[i+1]) + Math.abs(dfBytes[i+2] - ob[i+2]);
                                }
                                const m = sum / ((ob.length / 4) * 3);
                                if (m < minSigMae) minSigMae = m;
                            }
                        }

                        results.push({
                            setName,
                            name,
                            aiBackend: analysis.backend,
                            aiTotalMs: analysis.timingsMs.total,
                            segModel: analysis.segmentationModelUsed,
                            faces: analysis.faces.length,
                            mode: rlParams.mode,
                            statusLabel: rlParams.statusLabel,
                            glMs: glRes.durationMs,
                            glBackend: glRes.backend,
                            cpuMs: cpuRes.durationMs,
                            cpuBackend: cpuRes.backend,
                            minSigMae,
                            glDataUrl: glCanvas.toDataURL('image/png'),
                            cpuDataUrl: cpuCanvas.toDataURL('image/png'),
                            maskDataUrl: maskCanvas.toDataURL('image/png'),
                        });
                    }
                }

                // Full-res 3200x2400 Pro Export Consistency Test for Direct Flash
                const hiresSrcCanvas = document.createElement('canvas');
                hiresSrcCanvas.width = 3200;
                hiresSrcCanvas.height = 2400;
                const portraitSample = await loadImg(allSets.original['hijab_portrait.jpg']);
                const hCtx = hiresSrcCanvas.getContext('2d');
                hCtx.drawImage(portraitSample, 0, 0, 3200, 2400);

                const hiresAnalysisOut = await analyzerPipe.analyzeAdaptive({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_flash_test',
                    sourceRevision: 1,
                    transformRevision: 't0',
                });
                const prevC = document.createElement('canvas');
                await glPipe.renderPreview({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_flash_test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: effectiveFlash,
                    targetCanvas: prevC,
                    maxDimension: 800,
                    analysisResult: hiresAnalysisOut.result,
                    includeGrain: false,
                });
                const glExport = await exportPhotographBlob({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_flash_test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: effectiveFlash,
                    analysisResult: hiresAnalysisOut.result,
                    mode: 'single',
                    options: { showWatermark: false, presetName: 'Direct Flash', isPro: true, format: 'png', preferWebGL2: true },
                });
                const cpuExport = await exportPhotographBlob({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_flash_test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: effectiveFlash,
                    analysisResult: hiresAnalysisOut.result,
                    mode: 'single',
                    options: { showWatermark: false, presetName: 'Direct Flash', isPro: true, format: 'png', preferWebGL2: false },
                });

                // Measure preview vs full-res export consistency at 800x600
                const decodeBlobToImg = (blob) => new Promise((res, rej) => {
                    const u = URL.createObjectURL(blob);
                    const im = new Image();
                    im.onload = () => { URL.revokeObjectURL(u); res(im); };
                    im.onerror = (e) => { URL.revokeObjectURL(u); rej(e); };
                    im.src = u;
                });
                const glExpImg = await decodeBlobToImg(glExport.blob);
                const tmpPrev = document.createElement('canvas');
                tmpPrev.width = prevC.width;
                tmpPrev.height = prevC.height;
                const tpCtx = tmpPrev.getContext('2d');
                tpCtx.drawImage(glExpImg, 0, 0, tmpPrev.width, tmpPrev.height);
                const d1 = prevC.getContext('2d').getImageData(0, 0, prevC.width, prevC.height).data;
                const d2 = tpCtx.getImageData(0, 0, prevC.width, prevC.height).data;
                let expPrevMaeSum = 0;
                for (let i = 0; i < d1.length; i += 4) {
                    expPrevMaeSum += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i+1] - d2[i+1]) + Math.abs(d1[i+2] - d2[i+2]);
                }
                const exportPreviewMae = expPrevMaeSum / ((d1.length / 4) * 3);

                glPipe.dispose();
                cpuPipe.dispose();
                analyzerPipe.dispose();

                return {
                    results,
                    exportMeta: {
                        glW: glExport.width, glH: glExport.height, glOrig: glExport.isOriginalResolution, glBackend: glExport.backend, glMs: glExport.durationMs,
                        cpuW: cpuExport.width, cpuH: cpuExport.height, cpuOrig: cpuExport.isOriginalResolution, cpuBackend: cpuExport.backend, cpuMs: cpuExport.durationMs,
                        exportPreviewMae,
                    }
                };
            }""",
            photo_sets,
        )

        assert len(page_errors) == 0, f"Page errors: {page_errors}"
        return gpu_info, eval_out
    finally:
        browser.close()


def run_editor_ux_e2e(playwright, base_url: str) -> None:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    errors = []
    onnx_reqs = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.on("request", lambda r: onnx_reqs.append(r.url) if ".onnx" in r.url else None)

    page.goto(base_url, wait_until="networkidle")
    # Unlock Pro license locally via test license key shape? No, Direct Flash preview is unlocked even cleanly, OR check status pill directly on canvas!
    # Upload real portrait fixture into hidden input[type=file]
    page.set_input_files("input[type='file']", str(ORIG_DIR / "hijab_portrait.jpg"))
    page.wait_for_selector("[aria-label='Editor Inspector']", timeout=10000)
    time.sleep(0.4)
    assert len(onnx_reqs) == 0, f"AI models downloaded eagerly before selecting Direct Flash: {onnx_reqs}"

    # Select Direct Flash in PresetDrawer
    page.get_by_role("button", name="Direct Flash").first.click()
    pill = page.get_by_test_id("adaptive-status-pill")
    pill.wait_for(state="visible", timeout=5000)

    # Ensure status becomes 'ready' cleanly ("Adaptive Flash Ready") without technical jargon
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="adaptive-status-pill"]');
            return el && el.getAttribute('data-adaptive-status') === 'ready';
        }""",
        timeout=15000,
    )
    pill_text = pill.inner_text()
    assert pill_text == "Adaptive Flash Ready", f"Unexpected pill text: {pill_text}"
    assert not any(bad in pill_text.lower() for bad in ["onnx", "yunet", "pphumanseg", "u2net"]), pill_text

    # Scrub intensity slider -> confirm zero extra AI model loads and Undo/Redo & Before/After work
    pre_reqs = len(onnx_reqs)
    slider = page.get_by_label("Intensitas Preset")
    slider.fill("45")
    slider.dispatch_event("change")
    time.sleep(0.3)
    assert len(onnx_reqs) == pre_reqs

    # Toggle Split View & Undo/Redo
    page.get_by_label("Compare Before and After").click()
    assert page.locator("text=Before").first.is_visible()
    page.get_by_label("Compare Before and After").click()
    page.get_by_label("Undo").click()
    page.get_by_label("Redo").click()

    # Upload empty landscape -> switch to Direct Flash -> honest fallback status!
    page.get_by_label("Back to studio").click()
    discard_btn = page.get_by_role("button", name="Discard")
    if discard_btn.is_visible():
        discard_btn.click()
    page.set_input_files("input[type='file']", str(ORIG_DIR / "landscape_lake.jpg"))
    page.wait_for_selector("[aria-label='Editor Inspector']", timeout=10000)
    page.get_by_role("button", name="Direct Flash").first.click()
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="adaptive-status-pill"]');
            return el && el.getAttribute('data-adaptive-status') === 'fallback';
        }""",
        timeout=15000,
    )
    land_text = page.get_by_test_id("adaptive-status-pill").inner_text()
    assert "Fallback" in land_text and "Ready" not in land_text, f"Landscape should fallback cleanly, got: {land_text}"

    # Clear Cache Storage & block /models/*.onnx HTTP 500 -> reload -> select Direct Flash -> must show Offline Fallback, NEVER AI Ready!
    page.evaluate("async () => { await caches.delete('auvori-ai-models-v1'); }")
    page.route("**/models/*.onnx", lambda route: route.fulfill(status=500, body="Offline"))
    page.reload(wait_until="networkidle")
    page.set_input_files("input[type='file']", str(ORIG_DIR / "hijab_portrait.jpg"))
    page.wait_for_selector("[aria-label='Editor Inspector']", timeout=10000)
    page.get_by_role("button", name="Direct Flash").first.click()
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="adaptive-status-pill"]');
            return el && el.getAttribute('data-adaptive-status') === 'fallback';
        }""",
        timeout=15000,
    )
    off_text = page.get_by_test_id("adaptive-status-pill").inner_text()
    assert "Offline" in off_text and "Ready" not in off_text, f"Offline fallback status dishonest: {off_text}"

    assert len(errors) == 0, f"Editor UX uncaught errors: {errors}"
    print(f"[PASS] Editor UX E2E: lazy trigger, Ready='{pill_text}', Landscape='{land_text}', Offline='{off_text}', Before/After, Undo/Redo")
    browser.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--save-visuals", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()

    orig_photos = load_photos(ORIG_DIR)
    hold_photos = load_photos(HOLD_DIR)
    photo_sets = {"original": orig_photos, "holdout": hold_photos}
    assert len(orig_photos) == 14 and len(hold_photos) == 10

    srv = start_vite_server(4189)
    base_url = "http://127.0.0.1:4189/"
    try:
        with sync_playwright() as p:
            # 1. Standard headless SwiftShader + WASM run across all 24 photos
            gpu_sw, eval_sw = run_browser_eval(p, {"headless": True}, base_url, photo_sets, "headless-swiftshader")

            print("\n=== DIRECT FLASH QUANTITATIVE METRICS (24 ORIGINAL + HOLDOUT PHOTOS) ===")
            hdr = f"{'Set':7} | {'Photo':30} | {'Mode':20} | {'SubjD':6} | {'BgD':6} | {'ClipB->A':9} | {'SkinHue':7} | {'Halo':5} | {'NsAmp':5} | {'MAE':5} | {'GLms':5} | {'CPUms':5}"
            print(hdr)
            print("-" * len(hdr))

            visual_orig = []
            visual_hold = []
            worst_mae = 0.0
            worst_halo = 0.0
            worst_noise = 0.0

            for r in eval_sw["results"]:
                src_map = orig_photos if r["setName"] == "original" else hold_photos
                before_rgb = data_url_to_rgb(src_map[r["name"]])
                after_gl = data_url_to_rgb(r["glDataUrl"])
                after_cpu = data_url_to_rgb(r["cpuDataUrl"])
                mask_rgba = np.array(Image.open(io.BytesIO(base64.b64decode(r["maskDataUrl"].split(",", 1)[1]))).convert("RGBA"))

                m = compute_image_metrics(before_rgb, after_gl, after_cpu, mask_rgba)
                worst_mae = max(worst_mae, m["gpuCpuMae"])
                worst_halo = max(worst_halo, m["haloExcess"])
                worst_noise = max(worst_noise, m["noiseAmpRatio"])

                print(
                    f"{r['setName']:7} | {r['name']:30} | {r['mode']:20} | "
                    f"{m['subjLumDelta']:+5.3f} | {m['bgLumDelta']:+5.3f} | "
                    f"{m['clipBeforePct']:4.1f}->{m['clipAfterPct']:4.1f} | "
                    f"{m['skinHueDiffDeg']:6.2f}° | {m['haloExcess']:5.3f} | "
                    f"{m['noiseAmpRatio']:5.2f} | {m['gpuCpuMae']:5.3f} | "
                    f"{r['glMs']:5.1f} | {r['cpuMs']:5.1f}"
                )

                # Core Phase 4 correctness & quality invariants
                assert r["glBackend"] == "webgl2"
                assert r["cpuBackend"] in ("worker-canvas2d", "canvas2d")
                if not args.report_only:
                    assert m["gpuCpuMae"] < 1.2, f"GPU vs CPU parity failed on {r['name']}: MAE={m['gpuCpuMae']}"
                    assert m["haloExcess"] < 0.08, f"Halo excess too high on {r['name']}: {m['haloExcess']}"
                    assert m["noiseAmpRatio"] <= 1.38, f"Dark shadow noise amp too high on {r['name']}: {m['noiseAmpRatio']}"

                    if r["name"] == "landscape_lake.jpg":
                        assert r["mode"] == "fallback-signature"
                    if r["name"] in ("object_coffee.jpg", "holdout_indoor_cafe.jpg"):
                        assert r["mode"] == "conservative-subject"
                        assert m["skinPixels"] == 0, f"Non-human object should have 0 skin pixels: {m}"
                    if r["name"] == "low_light_portrait.jpg":
                        assert r["mode"] == "adaptive-portrait"
                        assert m["subjLumDelta"] > 0.015, f"Expected flash lift on low-light portrait: {m}"
                    if r["name"] in ("hijab_portrait.jpg", "street_black_clothing.jpg", "holdout_hijab.jpg", "holdout_color_portrait_2.jpg"):
                        assert r["mode"] == "adaptive-portrait"
                    if m["skinPixels"] > 40:
                        assert m["skinHueDiffDeg"] < 10.0, f"Excessive skin hue shift on {r['name']}: {m['skinHueDiffDeg']}"
                        assert m["skinLumDelta"] < 0.14, f"Aggressive skin whitening on {r['name']}: {m['skinLumDelta']}"
                        assert m["skinChromaRatio"] >= 0.80, f"Skin washed out on {r['name']}: {m['skinChromaRatio']}"
                    if r["minSigMae"] is not None:
                        assert r["minSigMae"] >= 4.0, f"Direct Flash too close to Signature Look on {r['name']}: minMAE={r['minSigMae']}"
                        print(f"   [diff vs 5 Signature Looks] {r['name']} minMAE={r['minSigMae']:.2f}/255")
                elif r["minSigMae"] is not None:
                    print(f"   [diff vs 5 Signature Looks] {r['name']} minMAE={r['minSigMae']:.2f}/255")

                lbl = f"{r['mode']} | Subj {m['subjLumDelta']:+.2f} Bg {m['bgLumDelta']:+.2f} MAE {m['gpuCpuMae']:.2f}"
                if r["setName"] == "original":
                    visual_orig.append((r["name"], before_rgb, after_gl, lbl))
                else:
                    visual_hold.append((r["name"], before_rgb, after_gl, lbl))

            em = eval_sw["exportMeta"]
            assert em["glW"] == 3200 and em["glH"] == 2400 and em["glOrig"] is True
            assert em["cpuW"] == 3200 and em["cpuH"] == 2400 and em["cpuOrig"] is True
            assert em["exportPreviewMae"] < 2.0, f"Preview vs Full-Res export mismatch: {em['exportPreviewMae']}"
            print(f"[PASS] Full-Res 3200x2400 Export Parity: {em}")
            print(f"[PASS] Summary across 24 photos: worst GPU/CPU MAE={worst_mae:.3f}/255, maxHalo={worst_halo:.4f}, maxNoiseAmp={worst_noise:.2f}x")

            if args.save_visuals:
                save_visual_sheet(visual_orig, SCRATCH_EVAL / "orig_direct_flash.png")
                save_visual_sheet(visual_hold, SCRATCH_EVAL / "holdout_direct_flash.png")

            # 2. Physical Hardware GPU Benchmark (Intel Iris Xe Graphics via ANGLE GL-EGL)
            gpu_hw, eval_hw = run_browser_eval(
                p,
                {"headless": True, "args": ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"]},
                base_url,
                {"original": {k: orig_photos[k] for k in ("hijab_portrait.jpg", "low_light_portrait.jpg", "street_black_clothing.jpg", "multiple_faces.jpg", "object_coffee.jpg", "landscape_lake.jpg")}},
                "physical-gpu-angle-egl",
            )
            gl_times = [r["glMs"] for r in eval_hw["results"]]
            hw_exp = eval_hw["exportMeta"]
            print(
                f"[PASS] Physical GPU ({gpu_hw['renderer']}): "
                f"preview render median={np.median(gl_times):.2f}ms (range {min(gl_times):.2f}..{max(gl_times):.2f}ms), "
                f"3200x2400 export={hw_exp['glMs']:.1f}ms"
            )

            # 3. Editor UX E2E Test
            run_editor_ux_e2e(p, base_url)

        return 0
    finally:
        srv.terminate()
        srv.wait(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
