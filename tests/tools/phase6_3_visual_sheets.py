#!/usr/bin/env python3
"""
Generate visual QA contact sheets for Phase 6.3 production assets.
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
COLLECTIONS_DIR = os.path.join(REPO_ROOT, "public/assets/collections")
SAMPLES_DIR = os.path.join(REPO_ROOT, "public/assets/studio-samples")
SIG_LOOKS_DIR = os.path.join(REPO_ROOT, "public/assets/signature-looks")
REPORTS_DIR = os.path.join(REPO_ROOT, "tests/reports/phase6_3")

os.makedirs(os.path.join(REPORTS_DIR, "collections"), exist_ok=True)
os.makedirs(os.path.join(REPORTS_DIR, "studio_samples"), exist_ok=True)
os.makedirs(os.path.join(REPORTS_DIR, "signature_looks"), exist_ok=True)
os.makedirs(os.path.join(REPORTS_DIR, "performance"), exist_ok=True)
os.makedirs(os.path.join(REPORTS_DIR, "regression_logs"), exist_ok=True)

# 1. Collection Covers Contact Sheet
covers = [
    ("Rosy Portrait", "cover_rosy_portrait.webp"),
    ("Velvet Series", "cover_velvet_series.webp"),
    ("Seoul Editorial", "cover_seoul_editorial.webp"),
    ("Analog Archive", "cover_analog_archive.webp")
]

sheet_w = 1640
sheet_h = 1360
col_sheet = Image.new("RGB", (sheet_w, sheet_h), (24, 24, 24))
draw = ImageDraw.Draw(col_sheet)

# Header
draw.text((30, 20), "Auvori Phase 6.3 — Signature Collection Showcase Covers (800x640, WebP)", fill=(240, 240, 240))

for idx, (title, fname) in enumerate(covers):
    path = os.path.join(COLLECTIONS_DIR, fname)
    if os.path.exists(path):
        with Image.open(path) as im:
            thumb = im.copy()
            thumb.thumbnail((780, 580))
            col = idx % 2
            row = idx // 2
            x = 30 + col * 800
            y = 70 + row * 630
            col_sheet.paste(thumb, (x, y))
            draw.text((x + 10, y + thumb.height + 8), f"{title} — {fname} ({os.path.getsize(path)/1024:.1f} KB)", fill=(200, 200, 200))

col_sheet.save(os.path.join(REPORTS_DIR, "collections/sheet_collection_covers.jpg"), quality=90)
print("Saved collection covers sheet.")

# 2. Studio Samples Contact Sheet (3x3 grid)
samples = [
    ("Daylight Portrait", "sample_daylight_portrait.webp", "thumb_daylight_portrait.webp"),
    ("Indoor Portrait", "sample_indoor_portrait.webp", "thumb_indoor_portrait.webp"),
    ("Studio Skin Tones", "sample_deep_skin.webp", "thumb_deep_skin.webp"),
    ("Café Interior", "sample_cafe_interior.webp", "thumb_cafe_interior.webp"),
    ("Food Scene", "sample_food.webp", "thumb_food.webp"),
    ("Night Street", "sample_night_street.webp", "thumb_night_street.webp"),
    ("Neon Portrait", "sample_neon.webp", "thumb_neon.webp"),
    ("Analog Scene", "sample_analog_scene.webp", "thumb_analog_scene.webp"),
    ("Monochrome Scene", "sample_monochrome.webp", "thumb_monochrome.webp"),
]

sample_sheet = Image.new("RGB", (1260, 1560), (20, 20, 20))
sdraw = ImageDraw.Draw(sample_sheet)
sdraw.text((30, 20), "Auvori Phase 6.3 — Studio Sample Library (9 Curated CC0 Photographs)", fill=(240, 240, 240))

for idx, (title, full_f, thumb_f) in enumerate(samples):
    p = os.path.join(SAMPLES_DIR, thumb_f)
    if os.path.exists(p):
        with Image.open(p) as im:
            thumb = im.copy()
            thumb.thumbnail((380, 440))
            col = idx % 3
            row = idx // 3
            x = 30 + col * 400
            y = 60 + row * 490
            sample_sheet.paste(thumb, (x, y))
            full_p = os.path.join(SAMPLES_DIR, full_f)
            full_kb = os.path.getsize(full_p) / 1024 if os.path.exists(full_p) else 0
            thumb_kb = os.path.getsize(p) / 1024
            sdraw.text((x + 5, y + thumb.height + 6), f"{title}", fill=(240, 240, 240))
            sdraw.text((x + 5, y + thumb.height + 22), f"Full: {full_kb:.1f}KB | Thumb: {thumb_kb:.1f}KB", fill=(160, 160, 160))

sample_sheet.save(os.path.join(REPORTS_DIR, "studio_samples/sheet_studio_samples.jpg"), quality=90)
print("Saved studio samples sheet.")

# 2b. Signature Looks Contact Sheet (5 presets: Source vs Preset-Rendered WebGL2)
sig_looks = [
    ("Porcelain Bloom", "source_porcelain_bloom.webp", "look_porcelain_bloom.webp"),
    ("Velvet Noir", "source_velvet_noir.webp", "look_velvet_noir.webp"),
    ("Hannam Daylight", "source_hannam_daylight.webp", "look_hannam_daylight.webp"),
    ("Amber Halation", "source_amber_halation.webp", "look_amber_halation.webp"),
    ("Silver Gelatin", "source_silver_gelatin.webp", "look_silver_gelatin.webp"),
]

sig_sheet = Image.new("RGB", (920, 1860), (20, 20, 20))
sig_draw = ImageDraw.Draw(sig_sheet)
sig_draw.text((30, 20), "Auvori Phase 6.3 — Signature Looks (Unedited CC0 Source vs WebGL2 Preset-Rendered Preview)", fill=(240, 240, 240))

for idx, (title, src_f, look_f) in enumerate(sig_looks):
    y = 60 + idx * 355
    src_p = os.path.join(SIG_LOOKS_DIR, src_f)
    look_p = os.path.join(SIG_LOOKS_DIR, look_f)
    if os.path.exists(src_p) and os.path.exists(look_p):
        with Image.open(src_p) as s_im, Image.open(look_p) as l_im:
            s_thumb = s_im.copy()
            s_thumb.thumbnail((400, 300))
            l_thumb = l_im.copy()
            l_thumb.thumbnail((400, 300))
            sig_sheet.paste(s_thumb, (30, y))
            sig_sheet.paste(l_thumb, (470, y))
            sig_draw.text((30, y + s_thumb.height + 6), f"{title} — Original ({os.path.getsize(src_p)/1024:.1f} KB)", fill=(180, 180, 180))
            sig_draw.text((470, y + l_thumb.height + 6), f"{title} — WebGL2 Rendered ({os.path.getsize(look_p)/1024:.1f} KB)", fill=(240, 220, 150))

sig_sheet.save(os.path.join(REPORTS_DIR, "signature_looks/sheet_signature_looks.jpg"), quality=90)
print("Saved signature looks sheet.")

# 3. Performance Metrics
sig_look_bytes = sum(os.path.getsize(os.path.join(SIG_LOOKS_DIR, s[2])) for s in sig_looks)
sig_source_bytes = sum(os.path.getsize(os.path.join(SIG_LOOKS_DIR, s[1])) for s in sig_looks)
perf_metrics = {
    "total_production_assets": 4 + 9 + 9 + 5 + 5, # 4 covers + 9 full samples + 9 thumbs + 5 sig previews + 5 sig sources
    "collection_covers_total_bytes": sum(os.path.getsize(os.path.join(COLLECTIONS_DIR, c[1])) for c in covers),
    "studio_samples_full_total_bytes": sum(os.path.getsize(os.path.join(SAMPLES_DIR, s[1])) for s in samples),
    "studio_samples_thumbs_total_bytes": sum(os.path.getsize(os.path.join(SAMPLES_DIR, s[2])) for s in samples),
    "signature_looks_previews_total_bytes": sig_look_bytes,
    "signature_looks_sources_total_bytes": sig_source_bytes,
    "average_cover_size_kb": round(sum(os.path.getsize(os.path.join(COLLECTIONS_DIR, c[1])) for c in covers) / len(covers) / 1024, 2),
    "average_thumb_size_kb": round(sum(os.path.getsize(os.path.join(SAMPLES_DIR, s[2])) for s in samples) / len(samples) / 1024, 2),
    "average_sample_full_size_kb": round(sum(os.path.getsize(os.path.join(SAMPLES_DIR, s[1])) for s in samples) / len(samples) / 1024, 2),
    "average_signature_look_preview_kb": round(sig_look_bytes / len(sig_looks) / 1024, 2),
    "format": "WebP (lossy Q82-84)",
    "lazy_loading": "loading='lazy' and decoding='async' on all collection, signature look, and library images"
}

with open(os.path.join(REPORTS_DIR, "performance/asset_performance_metrics.json"), "w") as f:
    json.dump(perf_metrics, f, indent=2)

print("Saved performance metrics:", json.dumps(perf_metrics, indent=2))
