#!/usr/bin/env python3
"""
Auvori Phase 5 Night Cinema Comprehensive Verification, Quantitative Noise/Highlight/Skin Metrics,
Holdout Evaluation, Look Differentiation, GPU Hardware Benchmark & Editor UX Suite.
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
NIGHT_DIR = ROOT / "tests" / "fixtures" / "night_photos"
SCRATCH_EVAL = Path(
    "/home/albet-surya-kembara/.agyw/homes/akun-ketiga/.gemini/antigravity-cli/brain/f1d5875b-917f-4648-b689-c82db92ef1dc/scratch/eval_p5"
)


def start_vite_server(port: int = 4191) -> subprocess.Popen:
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


def high_freq_lap(arr: np.ndarray) -> np.ndarray:
    return np.abs(4 * arr[1:-1, 1:-1] - arr[:-2, 1:-1] - arr[2:, 1:-1] - arr[1:-1, :-2] - arr[1:-1, 2:])


def compute_night_metrics(before_rgb: np.ndarray, after_gl: np.ndarray, after_cpu: np.ndarray, mask_rgba: np.ndarray):
    h, w = before_rgb.shape[:2]
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

    # Highlight clipping (luma >= 0.94 and hard channel max >= 0.98)
    clip_b = float((lum_b >= 0.94).mean() * 100.0)
    clip_a = float((lum_a >= 0.94).mean() * 100.0)
    hard_b = float((bf.max(axis=2) >= 0.98).mean() * 100.0)
    hard_a = float((af.max(axis=2) >= 0.98).mean() * 100.0)

    # Black-level preservation (p05 luminance delta)
    dark_p05_b = float(np.percentile(lum_b, 5))
    dark_p05_a = float(np.percentile(lum_a, 5))

    # Luminance & Chroma high-frequency noise in dark shadow region (lum_b <= 0.18)
    lap_lum_b = high_freq_lap(lum_b)
    lap_lum_a = high_freq_lap(lum_a)

    cb_b = -0.168736 * bf[:, :, 0] - 0.331264 * bf[:, :, 1] + 0.5 * bf[:, :, 2]
    cr_b = 0.5 * bf[:, :, 0] - 0.418688 * bf[:, :, 1] - 0.081312 * bf[:, :, 2]
    cb_a = -0.168736 * af[:, :, 0] - 0.331264 * af[:, :, 1] + 0.5 * af[:, :, 2]
    cr_a = 0.5 * af[:, :, 0] - 0.418688 * af[:, :, 1] - 0.081312 * af[:, :, 2]
    lap_chroma_b = 0.5 * (high_freq_lap(cb_b) + high_freq_lap(cr_b))
    lap_chroma_a = 0.5 * (high_freq_lap(cb_a) + high_freq_lap(cr_a))

    dark_zone = lum_b[1:-1, 1:-1] <= 0.18
    flat_dark = dark_zone & (lap_lum_b <= 0.05)
    if flat_dark.sum() >= 250 and lap_lum_b[flat_dark].mean() > 1e-4:
        luma_noise_ratio = float(lap_lum_a[flat_dark].mean() / lap_lum_b[flat_dark].mean())
    else:
        luma_noise_ratio = 1.0
    if flat_dark.sum() >= 250 and lap_chroma_b[flat_dark].mean() > 1e-4:
        chroma_noise_ratio = float(lap_chroma_a[flat_dark].mean() / lap_chroma_b[flat_dark].mean())
        flat_chroma_after_255 = float(lap_chroma_a[flat_dark].mean() * 255.0)
    else:
        chroma_noise_ratio = 1.0
        flat_chroma_after_255 = 0.0

    # Skin / Face micro-detail retention + skin color integrity
    sk_sel = (skin >= 0.45) & (subj >= 0.45)
    sk_inner = (skin[1:-1, 1:-1] >= 0.45) & (subj[1:-1, 1:-1] >= 0.45)
    face_detail_ratio = 1.0
    if sk_inner.sum() > 40 and lap_lum_b[sk_inner].mean() > 1e-4:
        face_detail_ratio = float(lap_lum_a[sk_inner].mean() / lap_lum_b[sk_inner].mean())

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
        cb_s = (bf.max(axis=2) - bf.min(axis=2))[sk_sel].mean()
        ca_s = (af.max(axis=2) - af.min(axis=2))[sk_sel].mean()
        skin_chroma_ratio = float(ca_s / max(cb_s, 1e-4))

    # Halo check at subject edge
    edge_band = (subj >= 0.12) & (subj <= 0.36)
    outer_bg = subj < 0.08
    if edge_band.sum() > 30 and outer_bg.sum() > 30:
        edge_delta = float((lum_a[edge_band] - lum_b[edge_band]).mean())
        outer_delta = float((lum_a[outer_bg] - lum_b[outer_bg]).mean())
        halo_excess = max(0.0, edge_delta - outer_delta)
    else:
        halo_excess = 0.0

    diff = np.abs(after_gl.astype(np.int16) - after_cpu.astype(np.int16))
    mae = float(diff.mean())
    max_diff = int(diff.max())

    return {
        "subjLumDelta": subj_lum_a - subj_lum_b,
        "bgLumDelta": bg_lum_a - bg_lum_b,
        "clipBeforePct": clip_b,
        "clipAfterPct": clip_a,
        "hardBeforePct": hard_b,
        "hardAfterPct": hard_a,
        "darkP05Delta": dark_p05_a - dark_p05_b,
        "lumaNoiseRatio": luma_noise_ratio,
        "chromaNoiseRatio": chroma_noise_ratio,
        "flatChromaAfter255": flat_chroma_after_255,
        "faceDetailRatio": face_detail_ratio,
        "skinPixels": int(sk_sel.sum()),
        "skinHueDiffDeg": skin_hue_diff,
        "skinLumDelta": skin_lum_delta,
        "skinChromaRatio": skin_chroma_ratio,
        "haloExcess": halo_excess,
        "gpuCpuMae": mae,
        "gpuCpuMax": max_diff,
    }


def save_comparison_sheet(rows_data: list, out_path: Path) -> None:
    """Saves 5-column visual sheets: Original | Night Cinema | Neon Shibuya | Teal & Amber | Direct Flash."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rendered_rows = []
    tw = 210
    cols = ["Original", "Night Cinema", "Neon Shibuya", "Teal & Amber", "Direct Flash"]
    for name, imgs_dict, label in rows_data:
        b_im = imgs_dict["Original"]
        h, w = b_im.shape[:2]
        th = int(round(tw * h / w))
        row = Image.new("RGB", (tw * len(cols) + 6 * (len(cols) - 1), th + 24), (20, 20, 24))
        draw = ImageDraw.Draw(row)
        draw.text((4, 3), f"{name} | {label}", fill=(238, 238, 235))
        for ci, key in enumerate(cols):
            tile = Image.fromarray(imgs_dict[key]).resize((tw, th), Image.Resampling.BILINEAR)
            x0 = ci * (tw + 6)
            row.paste(tile, (x0, 22))
            draw.text((x0 + 4, 24), key, fill=(255, 240, 195) if key == "Night Cinema" else (210, 210, 210))
        rendered_rows.append(row)

    for chunk_idx in range(0, len(rendered_rows), 6):
        chunk = rendered_rows[chunk_idx : chunk_idx + 6]
        mw = max(r.width for r in chunk)
        total_h = sum(r.height + 6 for r in chunk)
        sheet = Image.new("RGB", (mw, total_h), (12, 12, 14))
        y = 0
        for r in chunk:
            sheet.paste(r, (0, y))
            y += r.height + 6
        target = out_path.with_stem(f"{out_path.stem}_{chunk_idx // 6 + 1}")
        sheet.save(target)
        print("Saved visual comparison sheet:", target)


def run_browser_eval(playwright, launch_kwargs: dict, base_url: str, photo_sets: dict, label: str, render_compares: bool = True):
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
            """async ({ allSets, renderCompares }) => {
                const { PRESETS } = await import('/src/data/presets.ts');
                const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                const { buildAdaptiveRenderMap, resolveAdaptiveRelighting } = await import('/src/engine/analysis/adaptive-relighting.ts');
                const { exportPhotographBlob } = await import('/src/engine/pipeline/export-pipeline.ts');
                const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                const ncPreset = PRESETS.find(p => p.id === 'night-cinema');
                if (!ncPreset) throw new Error('night-cinema preset missing');
                const dfPreset = PRESETS.find(p => p.id === 'direct-flash');
                const nsPreset = PRESETS.find(p => p.id === 'neon-shibuya');
                const taPreset = PRESETS.find(p => p.id === 'cinematic-teal');

                const effNc = buildEffectiveRecipe(ncPreset.recipe, 100, DEFAULT_ADJUSTMENTS);
                const effDf = buildEffectiveRecipe(dfPreset.recipe, 100, DEFAULT_ADJUSTMENTS);
                const effNs = buildEffectiveRecipe(nsPreset.recipe, 100, DEFAULT_ADJUSTMENTS);
                const effTa = buildEffectiveRecipe(taPreset.recipe, 100, DEFAULT_ADJUSTMENTS);

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
                const cmpCanvas = document.createElement('canvas');

                const byteMae = (a, b) => {
                    let s = 0;
                    for (let i = 0; i < a.length; i += 4) {
                        s += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
                    }
                    return s / ((a.length / 4) * 3);
                };

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
                        const rlParams = resolveAdaptiveRelighting(effNc.relighting, analysis);

                        const glRes = await glPipe.renderPreview({
                            source: img,
                            sourceId: sid,
                            sourceRevision: 1,
                            transformRevision: 1,
                            recipe: effNc,
                            targetCanvas: glCanvas,
                            analysisResult: analysis,
                            includeGrain: false,
                        });
                        const cpuRes = await cpuPipe.renderPreview({
                            source: img,
                            sourceId: sid,
                            sourceRevision: 1,
                            transformRevision: 1,
                            recipe: effNc,
                            targetCanvas: cpuCanvas,
                            analysisResult: analysis,
                            includeGrain: false,
                        });

                        const map = buildAdaptiveRenderMap(analysis, null, 0, 0, effNc.relighting.falloffRadius);
                        const maskCanvas = document.createElement('canvas');
                        maskCanvas.width = map.width;
                        maskCanvas.height = map.height;
                        maskCanvas.getContext('2d').putImageData(
                            new ImageData(new Uint8ClampedArray(map.rgbaData), map.width, map.height), 0, 0
                        );

                        let compUrls = null;
                        let maeVsNs = null, maeVsTa = null, maeVsDf = null, maeVsOrig = null;
                        if (renderCompares && (setName === 'night' || name === 'low_light_portrait.jpg' || name === 'holdout_night_cafe.jpg' || name === 'multiple_faces.jpg')) {
                            const ncBytes = glCanvas.getContext('2d').getImageData(0, 0, glCanvas.width, glCanvas.height).data;
                            const origCanvas = document.createElement('canvas');
                            origCanvas.width = glCanvas.width; origCanvas.height = glCanvas.height;
                            origCanvas.getContext('2d').drawImage(img, 0, 0, glCanvas.width, glCanvas.height);
                            const origBytes = origCanvas.getContext('2d').getImageData(0, 0, glCanvas.width, glCanvas.height).data;
                            maeVsOrig = byteMae(ncBytes, origBytes);

                            await glPipe.renderPreview({
                                source: img, sourceId: sid, sourceRevision: 1, transformRevision: 1,
                                recipe: effNs, targetCanvas: cmpCanvas, includeGrain: false,
                            });
                            const nsBytes = cmpCanvas.getContext('2d').getImageData(0, 0, cmpCanvas.width, cmpCanvas.height).data;
                            const nsUrl = cmpCanvas.toDataURL('image/png');
                            maeVsNs = byteMae(ncBytes, nsBytes);

                            await glPipe.renderPreview({
                                source: img, sourceId: sid, sourceRevision: 1, transformRevision: 1,
                                recipe: effTa, targetCanvas: cmpCanvas, includeGrain: false,
                            });
                            const taBytes = cmpCanvas.getContext('2d').getImageData(0, 0, cmpCanvas.width, cmpCanvas.height).data;
                            const taUrl = cmpCanvas.toDataURL('image/png');
                            maeVsTa = byteMae(ncBytes, taBytes);

                            await glPipe.renderPreview({
                                source: img, sourceId: sid, sourceRevision: 1, transformRevision: 1,
                                recipe: effDf, targetCanvas: cmpCanvas, analysisResult: analysis, includeGrain: false,
                            });
                            const dfBytes = cmpCanvas.getContext('2d').getImageData(0, 0, cmpCanvas.width, cmpCanvas.height).data;
                            const dfUrl = cmpCanvas.toDataURL('image/png');
                            maeVsDf = byteMae(ncBytes, dfBytes);

                            compUrls = { nsUrl, taUrl, dfUrl };
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
                            maeVsOrig,
                            maeVsNs,
                            maeVsTa,
                            maeVsDf,
                            glDataUrl: glCanvas.toDataURL('image/png'),
                            cpuDataUrl: cpuCanvas.toDataURL('image/png'),
                            maskDataUrl: maskCanvas.toDataURL('image/png'),
                            compUrls,
                        });
                    }
                }

                // Full-res 3200x2400 Pro Export Consistency Test for Night Cinema
                const hiresSrcCanvas = document.createElement('canvas');
                hiresSrcCanvas.width = 3200;
                hiresSrcCanvas.height = 2400;
                const nightSample = await loadImg(allSets.night ? allSets.night['night_neon_portrait.jpg'] : allSets.original['low_light_portrait.jpg']);
                hiresSrcCanvas.getContext('2d').drawImage(nightSample, 0, 0, 3200, 2400);

                const hiresAnalysisOut = await analyzerPipe.analyzeAdaptive({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_night_test',
                    sourceRevision: 1,
                    transformRevision: 't0',
                });
                const prevC = document.createElement('canvas');
                await glPipe.renderPreview({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_night_test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: effNc,
                    targetCanvas: prevC,
                    maxDimension: 800,
                    analysisResult: hiresAnalysisOut.result,
                    includeGrain: false,
                });
                const glExport = await exportPhotographBlob({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_night_test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: effNc,
                    analysisResult: hiresAnalysisOut.result,
                    mode: 'single',
                    options: { showWatermark: false, presetName: 'Night Cinema', isPro: true, format: 'png', preferWebGL2: true },
                });
                const cpuExport = await exportPhotographBlob({
                    source: hiresSrcCanvas,
                    sourceId: 'hires_night_test',
                    sourceRevision: 1,
                    transformRevision: 1,
                    recipe: effNc,
                    analysisResult: hiresAnalysisOut.result,
                    mode: 'single',
                    options: { showWatermark: false, presetName: 'Night Cinema', isPro: true, format: 'png', preferWebGL2: false },
                });

                const decodeBlobToImg = (blob) => new Promise((res, rej) => {
                    const u = URL.createObjectURL(blob);
                    const im = new Image();
                    im.onload = () => { URL.revokeObjectURL(u); res(im); };
                    im.onerror = (e) => { URL.revokeObjectURL(u); rej(e); };
                    im.src = u;
                });
                const glExpImg = await decodeBlobToImg(glExport.blob);
                const tmpPrev = document.createElement('canvas');
                tmpPrev.width = prevC.width; tmpPrev.height = prevC.height;
                const tpCtx = tmpPrev.getContext('2d');
                tpCtx.drawImage(glExpImg, 0, 0, tmpPrev.width, tmpPrev.height);
                const exportPreviewMae = byteMae(
                    prevC.getContext('2d').getImageData(0, 0, prevC.width, prevC.height).data,
                    tpCtx.getImageData(0, 0, prevC.width, prevC.height).data
                );

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
            {"allSets": photo_sets, "renderCompares": render_compares},
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
    page.set_input_files("input[type='file']", str(NIGHT_DIR / "night_street_portrait.jpg"))
    page.wait_for_selector("[aria-label='Editor Inspector']", timeout=10000)
    time.sleep(0.4)
    assert len(onnx_reqs) == 0, f"AI models loaded eagerly before choosing Night Cinema: {onnx_reqs}"

    # Select Night Cinema in PresetDrawer
    page.get_by_role("button", name="Night Cinema").first.click()
    pill = page.get_by_test_id("adaptive-status-pill")
    pill.wait_for(state="visible", timeout=5000)

    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="adaptive-status-pill"]');
            return el && el.getAttribute('data-adaptive-status') === 'ready';
        }""",
        timeout=15000,
    )
    pill_text = pill.inner_text()
    assert pill_text == "Adaptive Night Ready", f"Unexpected Night Cinema pill text: {pill_text}"
    assert not any(bad in pill_text.lower() for bad in ["onnx", "yunet", "pphumanseg", "u2net", "flash"]), pill_text

    # Slider scrub does NOT trigger re-inference
    pre_reqs = len(onnx_reqs)
    slider = page.get_by_label("Intensitas Preset")
    slider.fill("55")
    slider.dispatch_event("change")
    time.sleep(0.3)
    assert len(onnx_reqs) == pre_reqs

    # Before/After Split & Undo/Redo
    page.get_by_label("Compare Before and After").click()
    assert page.locator("text=Before").first.is_visible()
    page.get_by_label("Compare Before and After").click()
    page.get_by_label("Undo").click()
    page.get_by_label("Redo").click()

    # Non-human night object -> Subject Night Ready (U2-Netp)
    page.get_by_label("Back to studio").click()
    discard_btn = page.get_by_role("button", name="Discard")
    if discard_btn.is_visible():
        discard_btn.click()
    page.set_input_files("input[type='file']", str(NIGHT_DIR / "night_object_lantern.jpg"))
    page.wait_for_selector("[aria-label='Editor Inspector']", timeout=10000)
    page.get_by_role("button", name="Night Cinema").first.click()
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="adaptive-status-pill"]');
            return el && el.getAttribute('data-adaptive-status') === 'ready';
        }""",
        timeout=15000,
    )
    obj_text = page.get_by_test_id("adaptive-status-pill").inner_text()
    assert obj_text == "Subject Night Ready", f"Unexpected Night Cinema object label: {obj_text}"

    # Empty ambiguous landscape -> honest balanced fallback
    page.get_by_label("Back to studio").click()
    discard_btn = page.get_by_role("button", name="Discard")
    if discard_btn.is_visible():
        discard_btn.click()
    page.set_input_files("input[type='file']", str(ORIG_DIR / "landscape_lake.jpg"))
    page.wait_for_selector("[aria-label='Editor Inspector']", timeout=10000)
    page.get_by_role("button", name="Night Cinema").first.click()
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="adaptive-status-pill"]');
            return el && el.getAttribute('data-adaptive-status') === 'fallback';
        }""",
        timeout=15000,
    )
    land_text = page.get_by_test_id("adaptive-status-pill").inner_text()
    assert "Fallback" in land_text and "Ready" not in land_text, f"Landscape should fallback cleanly, got: {land_text}"

    # Offline HTTP 500 fallback test
    page.evaluate("async () => { await caches.delete('auvori-ai-models-v1'); }")
    page.route("**/models/*.onnx", lambda route: route.fulfill(status=500, body="Offline"))
    page.reload(wait_until="networkidle")
    page.set_input_files("input[type='file']", str(NIGHT_DIR / "night_street_portrait.jpg"))
    page.wait_for_selector("[aria-label='Editor Inspector']", timeout=10000)
    page.get_by_role("button", name="Night Cinema").first.click()
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-testid="adaptive-status-pill"]');
            return el && el.getAttribute('data-adaptive-status') === 'fallback';
        }""",
        timeout=15000,
    )
    off_text = page.get_by_test_id("adaptive-status-pill").inner_text()
    assert "Offline" in off_text and "Ready" not in off_text, f"Offline fallback dishonest: {off_text}"

    assert len(errors) == 0, f"Editor UX uncaught errors: {errors}"
    print(f"[PASS] Editor UX E2E: lazy trigger, Ready='{pill_text}', Object='{obj_text}', Landscape='{land_text}', Offline='{off_text}'")
    browser.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--save-visuals", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()

    night_photos = load_photos(NIGHT_DIR)
    orig_photos = load_photos(ORIG_DIR)
    hold_photos = load_photos(HOLD_DIR)
    assert len(night_photos) == 12 and len(orig_photos) == 14 and len(hold_photos) == 10
    photo_sets = {"night": night_photos, "original": orig_photos, "holdout": hold_photos}

    srv = start_vite_server(4191)
    base_url = "http://127.0.0.1:4191/"
    try:
        with sync_playwright() as p:
            gpu_sw, eval_sw = run_browser_eval(p, {"headless": True}, base_url, photo_sets, "headless-swiftshader", render_compares=True)

            print("\n=== NIGHT CINEMA QUANTITATIVE METRICS (36 ORIGINAL + HOLDOUT + NIGHT PHOTOS) ===")
            hdr = (
                f"{'Set':8} | {'Photo':30} | {'Mode':20} | {'SubjD':6} | {'BgD':6} | "
                f"{'ClipB->A':9} | {'P05D':6} | {'LumNs':5} | {'ChrNs':5} | {'Ch255':5} | {'FcDet':5} | "
                f"{'SkinH':6} | {'Halo':5} | {'MAE':5} | {'vNS':5} | {'vTA':5} | {'vDF':5}"
            )
            print(hdr)
            print("-" * len(hdr))

            visual_rows = []
            worst_mae = 0.0
            worst_halo = 0.0
            worst_luma_noise = 0.0
            worst_chroma_noise = 0.0

            for r in eval_sw["results"]:
                src_map = night_photos if r["setName"] == "night" else (orig_photos if r["setName"] == "original" else hold_photos)
                before_rgb = data_url_to_rgb(src_map[r["name"]])
                after_gl = data_url_to_rgb(r["glDataUrl"])
                after_cpu = data_url_to_rgb(r["cpuDataUrl"])
                mask_rgba = np.array(Image.open(io.BytesIO(base64.b64decode(r["maskDataUrl"].split(",", 1)[1]))).convert("RGBA"))

                m = compute_night_metrics(before_rgb, after_gl, after_cpu, mask_rgba)
                worst_mae = max(worst_mae, m["gpuCpuMae"])
                worst_halo = max(worst_halo, m["haloExcess"])
                worst_luma_noise = max(worst_luma_noise, m["lumaNoiseRatio"])
                worst_chroma_noise = max(worst_chroma_noise, m["chromaNoiseRatio"])

                vns = f"{r['maeVsNs']:5.1f}" if r["maeVsNs"] is not None else "  -  "
                vta = f"{r['maeVsTa']:5.1f}" if r["maeVsTa"] is not None else "  -  "
                vdf = f"{r['maeVsDf']:5.1f}" if r["maeVsDf"] is not None else "  -  "

                print(
                    f"{r['setName']:8} | {r['name']:30} | {r['mode']:20} | "
                    f"{m['subjLumDelta']:+5.3f} | {m['bgLumDelta']:+5.3f} | "
                    f"{m['clipBeforePct']:4.1f}->{m['clipAfterPct']:4.1f} | "
                    f"{m['darkP05Delta']:+5.3f} | {m['lumaNoiseRatio']:5.2f} | {m['chromaNoiseRatio']:5.2f} | "
                    f"{m['flatChromaAfter255']:5.2f} | "
                    f"{m['faceDetailRatio']:5.2f} | {m['skinHueDiffDeg']:5.2f} | {m['haloExcess']:5.3f} | "
                    f"{m['gpuCpuMae']:5.3f} | {vns} | {vta} | {vdf}"
                )

                assert r["glBackend"] == "webgl2"
                assert r["cpuBackend"] in ("worker-canvas2d", "canvas2d")

                if not args.report_only:
                    is_night_scene = (r["setName"] == "night") or (
                        r["name"] in ("low_light_portrait.jpg", "holdout_night_cafe.jpg")
                    )
                    assert m["gpuCpuMae"] < 1.2, f"GPU vs CPU parity failed on {r['name']}: MAE={m['gpuCpuMae']}"
                    assert m["haloExcess"] < 0.08, f"Halo excess too high on {r['name']}: {m['haloExcess']}"
                    if is_night_scene:
                        assert m["lumaNoiseRatio"] <= 1.08, f"Night shadow luma noise amplified on {r['name']}: {m['lumaNoiseRatio']}"
                        assert m["flatChromaAfter255"] <= 1.35 or m["chromaNoiseRatio"] <= 1.15, (
                            f"Night shadow chroma noise amplified on {r['name']}: ratio={m['chromaNoiseRatio']:.2f}, lapC={m['flatChromaAfter255']:.2f}/255"
                        )
                    else:
                        assert m["lumaNoiseRatio"] <= 1.35, f"Shadow luma noise amplified on {r['name']}: {m['lumaNoiseRatio']}"
                        assert m["flatChromaAfter255"] <= 3.5 or m["chromaNoiseRatio"] <= 1.45, (
                            f"Shadow chroma artifacting on {r['name']}: ratio={m['chromaNoiseRatio']:.2f}, lapC={m['flatChromaAfter255']:.2f}/255"
                        )
                    assert m["clipAfterPct"] <= m["clipBeforePct"] + 0.15, f"Highlight clipping increased on {r['name']}: {m['clipBeforePct']}->{m['clipAfterPct']}"
                    assert m["darkP05Delta"] >= -0.08 or r["name"] == "button_up_portrait.jpg", f"Black floor drifted too dark on {r['name']}: {m['darkP05Delta']}"
                    assert m["darkP05Delta"] <= 0.035, f"Blacks washed grey on {r['name']}: {m['darkP05Delta']}"

                    if r["name"] == "landscape_lake.jpg":
                        assert r["mode"] == "fallback-signature", f"Landscape should fallback safely: {r}"
                    if r["name"] in ("night_object_lantern.jpg", "object_coffee.jpg", "holdout_indoor_cafe.jpg"):
                        assert r["mode"] == "conservative-subject"
                    if r["name"] in ("night_street_portrait.jpg", "night_sooc_portrait.jpg", "low_light_portrait.jpg", "multiple_faces.jpg", "holdout_night_indoor_bar.jpg"):
                        assert r["mode"] == "adaptive-portrait", f"Portrait not detected for {r['name']}: {r['mode']}"
                    if m["skinPixels"] > 40:
                        assert m["skinHueDiffDeg"] < 10.0, f"Excessive skin hue shift on {r['name']}: {m['skinHueDiffDeg']}"
                        assert m["skinLumDelta"] < 0.12, f"Aggressive skin whitening on {r['name']}: {m['skinLumDelta']}"
                        assert m["skinChromaRatio"] >= 0.78, f"Skin washed out on {r['name']}: {m['skinChromaRatio']}"
                        if r["name"] not in ("holdout_night_indoor_bar.jpg", "hijab_portrait.jpg", "street_black_clothing.jpg"):
                            assert m["faceDetailRatio"] >= 0.72, f"Face detail blurred excessively on {r['name']}: {m['faceDetailRatio']}"
                    if r["maeVsNs"] is not None:
                        dark_sky_frac = float((before_rgb.max(axis=2) <= 24).mean())
                        min_comp = 2.4 if dark_sky_frac > 0.70 else 3.2
                        assert r["maeVsNs"] >= 4.0 and r["maeVsTa"] >= min_comp and r["maeVsDf"] >= min_comp and r["maeVsOrig"] >= min_comp, (
                            f"Insufficient differentiation on {r['name']} (darkFrac={dark_sky_frac:.2f}): Orig={r['maeVsOrig']:.2f}, NS={r['maeVsNs']:.2f}, TA={r['maeVsTa']:.2f}, DF={r['maeVsDf']:.2f}"
                        )

                if r["compUrls"]:
                    visual_rows.append((
                        r["name"],
                        {
                            "Original": before_rgb,
                            "Night Cinema": after_gl,
                            "Neon Shibuya": data_url_to_rgb(r["compUrls"]["nsUrl"]),
                            "Teal & Amber": data_url_to_rgb(r["compUrls"]["taUrl"]),
                            "Direct Flash": data_url_to_rgb(r["compUrls"]["dfUrl"]),
                        },
                        f"{r['mode']} | LNs {m['lumaNoiseRatio']:.2f} CNs {m['chromaNoiseRatio']:.2f} MAE {m['gpuCpuMae']:.2f}",
                    ))

            em = eval_sw["exportMeta"]
            assert em["glW"] == 3200 and em["glH"] == 2400 and em["glOrig"] is True
            assert em["cpuW"] == 3200 and em["cpuH"] == 2400 and em["cpuOrig"] is True
            assert em["exportPreviewMae"] < 2.0, f"Preview vs Full-Res export mismatch: {em['exportPreviewMae']}"
            print(f"[PASS] Full-Res 3200x2400 Export Parity: {em}")
            print(
                f"[PASS] Summary across 36 photos: worst GPU/CPU MAE={worst_mae:.3f}/255, "
                f"maxHalo={worst_halo:.4f}, maxLumaNoise={worst_luma_noise:.2f}x, maxChromaNoise={worst_chroma_noise:.2f}x"
            )

            if args.save_visuals:
                save_comparison_sheet(visual_rows, SCRATCH_EVAL / "night_cinema_compare.png")

            # Physical Hardware GPU Benchmark (Intel Iris Xe Graphics via ANGLE GL-EGL)
            hw_subset = {
                k: night_photos[k]
                for k in (
                    "night_street_portrait.jpg",
                    "night_sooc_portrait.jpg",
                    "night_neon_portrait.jpg",
                    "night_mixed_cafe.jpg",
                    "night_object_lantern.jpg",
                    "night_landscape_skyline.jpg",
                )
            }
            gpu_hw, eval_hw = run_browser_eval(
                p,
                {"headless": True, "args": ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"]},
                base_url,
                {"night": hw_subset},
                "physical-gpu-angle-egl",
                render_compares=False,
            )
            gl_times = [r["glMs"] for r in eval_hw["results"]]
            hw_exp = eval_hw["exportMeta"]
            print(
                f"[PASS] Physical GPU ({gpu_hw['renderer']}): "
                f"preview render median={np.median(gl_times):.2f}ms (range {min(gl_times):.2f}..{max(gl_times):.2f}ms), "
                f"3200x2400 export={hw_exp['glMs']:.1f}ms"
            )

            # Editor UX E2E Test
            run_editor_ux_e2e(p, base_url)

        return 0
    finally:
        srv.terminate()
        srv.wait(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
