#!/usr/bin/env python3
"""
Generate Phase 6.3 Signature Look photographic previews using Auvori's real
production WebGL2 PhotoPipeline in headless Chromium.
"""

import base64
import hashlib
import io
import json
import os
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
OPEN_DIR = ROOT / "tests" / "fixtures" / "opensource_photos"
OPEN_MANIFEST = OPEN_DIR / "manifest.json"
OUT_DIR = ROOT / "public" / "assets" / "signature-looks"
PROD_MANIFEST = ROOT / "public" / "assets" / "attribution" / "production_asset_manifest.json"

SIGNATURE_LOOK_MAP = [
    {
        "presetId": "porcelain-bloom",
        "presetName": "Porcelain Bloom",
        "sourcePhotoId": "p6_09",
        "sourceFilename": "p6_09_white_aodai_portrait.jpg",
        "outFilename": "look_porcelain_bloom.webp",
        "sourceOutFilename": "source_porcelain_bloom.webp",
        "objectPosition": "50% 25%",
        "rationale": "Soft cloudy-daylight portrait with delicate white garment highlights, rosy lotus bloom, and luminous skin detail."
    },
    {
        "presetId": "velvet-noir",
        "presetName": "Velvet Noir",
        "sourcePhotoId": "p6_01",
        "sourceFilename": "p6_01_window_bus_portrait.jpg",
        "outFilename": "look_velvet_noir.webp",
        "sourceOutFilename": "source_velvet_noir.webp",
        "objectPosition": "50% 35%",
        "rationale": "Moody window-lit bus portrait with sculpted deep interior shadows and warm natural skin midtones."
    },
    {
        "presetId": "hannam-daylight",
        "presetName": "Hannam Daylight",
        "sourcePhotoId": "p6_14",
        "sourceFilename": "p6_14_latte_croissant_cafe.jpg",
        "outFilename": "look_hannam_daylight.webp",
        "sourceOutFilename": "source_hannam_daylight.webp",
        "objectPosition": "50% 50%",
        "rationale": "Crisp Korean-style editorial café tabletop daylight scene with clean ceramic whites and balanced wood tones."
    },
    {
        "presetId": "amber-halation",
        "presetName": "Amber Halation",
        "sourcePhotoId": "p6_55",
        "sourceFilename": "p6_55_night_bazaar_lanterns.jpg",
        "outFilename": "look_amber_halation.webp",
        "sourceOutFilename": "source_amber_halation.webp",
        "objectPosition": "55% 50%",
        "rationale": "Warm tungsten lantern scene with glowing amber highlights, atmospheric haze, and deep teal-slate night sky."
    },
    {
        "presetId": "silver-gelatin",
        "presetName": "Silver Gelatin",
        "sourcePhotoId": "p6_04",
        "sourceFilename": "p6_04_bw_beard_glasses.jpg",
        "outFilename": "look_silver_gelatin.webp",
        "sourceOutFilename": "source_silver_gelatin.webp",
        "objectPosition": "50% 25%",
        "rationale": "Documentary close-up monochrome portrait showcasing fine tonal silver-gelatin separation, beard texture, and selenium highlights."
    }
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def start_vite(port: int = 4198) -> subprocess.Popen:
    proc = subprocess.Popen(
        ["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
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
    raise RuntimeError("Vite failed to start")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OPEN_MANIFEST, encoding="utf-8") as f:
        open_meta = json.load(f)
    photos_by_fn = {p["filename"]: p for p in open_meta["photos"]}

    with open(PROD_MANIFEST, encoding="utf-8") as f:
        prod_manifest = json.load(f)

    proc = start_vite(4198)
    entries = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"],
            )
            page = browser.new_page()
            page.goto("http://127.0.0.1:4198/", wait_until="networkidle")

            for idx, spec in enumerate(SIGNATURE_LOOK_MAP):
                src_path = OPEN_DIR / spec["sourceFilename"]
                assert src_path.exists(), f"Missing source: {src_path}"
                meta = photos_by_fn[spec["sourceFilename"]]
                lv = meta.get("license_verification", {})
                assert lv.get("status") == "verified", f"Unverified license: {spec['sourceFilename']}"

                src_sha = sha256_file(src_path)
                assert src_sha == meta["sha256"], f"Source SHA mismatch for {spec['sourceFilename']}"

                # Encode original photo as data URL (original file bytes)
                raw_bytes = src_path.read_bytes()
                b64 = base64.b64encode(raw_bytes).decode("ascii")
                data_url = f"data:image/jpeg;base64,{b64}"

                # Render using Auvori's real PhotoPipeline (WebGL2) with exact preset recipe & intensity=100
                res = page.evaluate("""async ({ dataUrl, presetId, idx }) => {
                    const { PRESETS } = await import('/src/data/presets.ts');
                    const { PhotoPipeline } = await import('/src/engine/pipeline/photo-pipeline.ts');
                    const { buildEffectiveRecipe } = await import('/src/lib/imageEngine.ts');
                    const { DEFAULT_ADJUSTMENTS } = await import('/src/types/index.ts');

                    const preset = PRESETS.find(p => p.id === presetId);
                    if (!preset) throw new Error('Preset not found: ' + presetId);

                    const img = await new Promise((resolve, reject) => {
                        const i = new Image();
                        i.onload = () => resolve(i);
                        i.onerror = reject;
                        i.src = dataUrl;
                    });

                    const pipe = new PhotoPipeline({ preferWebGL2: true, preferWorkerFallback: false });
                    const backend = pipe.getActiveBackend();
                    if (backend !== 'webgl2') {
                        pipe.dispose();
                        throw new Error('Expected webgl2 backend, got ' + backend);
                    }

                    const effectiveRecipe = buildEffectiveRecipe(preset.recipe, 100, DEFAULT_ADJUSTMENTS);
                    const canvas = document.createElement('canvas');
                    const renderInfo = await pipe.renderPreview({
                        source: img,
                        sourceId: 'sig_preview_' + idx,
                        sourceRevision: 1,
                        transformRevision: 1,
                        recipe: effectiveRecipe,
                        targetCanvas: canvas,
                        maxDimension: 720,
                        includeGrain: true
                    });
                    pipe.dispose();

                    return {
                        backend,
                        rendererUsed: renderInfo?.backend || backend,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        width: canvas.width,
                        height: canvas.height,
                        pngDataUrl: canvas.toDataURL('image/png')
                    };
                }""", {"dataUrl": data_url, "presetId": spec["presetId"], "idx": idx})

                png_bytes = base64.b64decode(res["pngDataUrl"].split(",", 1)[1])
                out_path = OUT_DIR / spec["outFilename"]
                with Image.open(io.BytesIO(png_bytes)) as rendered_im:
                    rendered_rgb = rendered_im.convert("RGB")
                    rendered_rgb.save(out_path, format="WEBP", quality=84, method=6)

                # Also save unedited source WebP (max 1200px) for Before/After & Try in Editor
                src_out_path = OUT_DIR / spec["sourceOutFilename"]
                with Image.open(src_path) as orig_im:
                    orig_rgb = orig_im.convert("RGB")
                    orig_rgb.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
                    orig_rgb.save(src_out_path, format="WEBP", quality=84, method=6)
                    src_out_w, src_out_h = orig_rgb.size

                out_sha = sha256_file(out_path)
                src_out_sha = sha256_file(src_out_path)

                entry = {
                    "assetId": f"sig:{spec['presetId']}",
                    "presetId": spec["presetId"],
                    "presetName": spec["presetName"],
                    "sourcePhotoId": spec["sourcePhotoId"],
                    "src": spec["sourceFilename"],
                    "sourceSha256": src_sha,
                    "creator": meta["creator_name"],
                    "creatorProfileUrl": meta.get("creator_profile_url", ""),
                    "sourceUrl": meta.get("original_source_url", ""),
                    "license": f"{meta.get('license_name', 'CC0 1.0 Universal')} ({lv.get('license_verified', 'CC0-1.0')})",
                    "licenseEvidence": lv.get("evidence_url", ""),
                    "attribution": f"Photo by {meta['creator_name']} via Wikimedia Commons / Unsplash (CC0 1.0 Universal)",
                    "out": spec["outFilename"],
                    "w": res["width"],
                    "h": res["height"],
                    "size": out_path.stat().st_size,
                    "sha256": out_sha,
                    "sourceAsset": spec["sourceOutFilename"],
                    "sourceAssetW": src_out_w,
                    "sourceAssetH": src_out_h,
                    "sourceAssetSize": src_out_path.stat().st_size,
                    "sourceAssetSha256": src_out_sha,
                    "presetRendered": True,
                    "rendererPath": f"PhotoPipeline.renderPreview ({res['rendererUsed']})",
                    "intensity": 100,
                    "includeGrain": True,
                    "objectPosition": spec["objectPosition"],
                    "rationale": spec["rationale"]
                }
                entries.append(entry)
                print(
                    f"Generated {spec['outFilename']} ({res['width']}x{res['height']}, "
                    f"{entry['size']/1024:.1f} KB, backend={res['rendererUsed']}) "
                    f"from {spec['sourceFilename']}"
                )

            browser.close()
    finally:
        proc.terminate()
        proc.wait()

    prod_manifest["generated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    prod_manifest["signatureLooks"] = entries
    with open(PROD_MANIFEST, "w", encoding="utf-8") as f:
        json.dump(prod_manifest, f, indent=2)
    print(f"Updated {PROD_MANIFEST} with {len(entries)} signatureLooks entries.")


if __name__ == "__main__":
    main()
