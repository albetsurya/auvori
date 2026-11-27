#!/usr/bin/env python3
"""
tests/phase6_3_collection_mapping.py
Validates mapping between Signature Collections, Presets, and production visual assets.
"""

import os
import sys
import re

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
COLLECTIONS_DIR = os.path.join(REPO_ROOT, "public/assets/collections")
SAMPLES_DIR = os.path.join(REPO_ROOT, "public/assets/studio-samples")
PRESETS_FILE = os.path.join(REPO_ROOT, "src/data/presets.ts")
SAMPLE_PHOTO_FILE = os.path.join(REPO_ROOT, "src/lib/samplePhoto.ts")

EXPECTED_COLLECTIONS = {
    "rosy-portrait": {
        "name": "Rosy Portrait",
        "expected_count": 2,
        "cover_file": "cover_rosy_portrait.webp"
    },
    "velvet-series": {
        "name": "Velvet Series",
        "expected_count": 3,
        "cover_file": "cover_velvet_series.webp"
    },
    "seoul-editorial": {
        "name": "Seoul Editorial",
        "expected_count": 6,
        "cover_file": "cover_seoul_editorial.webp"
    },
    "analog-archive": {
        "name": "Analog Archive",
        "expected_count": 7,
        "cover_file": "cover_analog_archive.webp"
    }
}

def test_collection_covers_exist():
    print("[1/3] Verifying collection cover files exist...")
    for col_id, info in EXPECTED_COLLECTIONS.items():
        cover_path = os.path.join(COLLECTIONS_DIR, info["cover_file"])
        assert os.path.exists(cover_path), f"Collection cover missing for {col_id}: {cover_path}"
        assert os.path.getsize(cover_path) > 10000, f"Collection cover suspiciously small: {cover_path}"
    print("  ✓ All 4 signature collection covers exist with proper size.")

def test_preset_membership_counts():
    print("[2/3] Verifying collection preset counts from presets.ts...")
    with open(PRESETS_FILE) as f:
        presets_content = f.read()

    # Find all presets and their collectionIds
    collection_matches = re.findall(r"collectionId:\s*['\"]([^'\"]+)['\"]", presets_content)
    counts = {}
    for cid in collection_matches:
        counts[cid] = counts.get(cid, 0) + 1

    for col_id, info in EXPECTED_COLLECTIONS.items():
        actual_count = counts.get(col_id, 0)
        assert actual_count == info["expected_count"], (
            f"Preset count mismatch for {col_id}: expected {info['expected_count']}, got {actual_count}"
        )
        print(f"    - {info['name']} ({col_id}): {actual_count} presets verified.")
    print("  ✓ All collection preset memberships match expected counts exactly.")

def test_studio_sample_metadata_and_presets():
    print("[3/3] Verifying StudioSampleLibrary entries in samplePhoto.ts...")
    with open(SAMPLE_PHOTO_FILE) as f:
        sample_code = f.read()

    with open(PRESETS_FILE) as f:
        presets_code = f.read()

    preset_ids = set(re.findall(r"id:\s*['\"]([^'\"]+)['\"]", presets_code))

    # Verify each studio sample referenced has files on disk
    expected_samples = [
        ("real:daylight_portrait", "sample_daylight_portrait.webp", "thumb_daylight_portrait.webp"),
        ("real:indoor_portrait", "sample_indoor_portrait.webp", "thumb_indoor_portrait.webp"),
        ("real:deep_skin", "sample_deep_skin.webp", "thumb_deep_skin.webp"),
        ("real:cafe_interior", "sample_cafe_interior.webp", "thumb_cafe_interior.webp"),
        ("real:food", "sample_food.webp", "thumb_food.webp"),
        ("real:night_street", "sample_night_street.webp", "thumb_night_street.webp"),
        ("real:neon", "sample_neon.webp", "thumb_neon.webp"),
        ("real:analog_scene", "sample_analog_scene.webp", "thumb_analog_scene.webp"),
        ("real:monochrome", "sample_monochrome.webp", "thumb_monochrome.webp"),
    ]

    for sid, full_f, thumb_f in expected_samples:
        assert sid in sample_code, f"Sample ID {sid} missing from samplePhoto.ts"
        full_p = os.path.join(SAMPLES_DIR, full_f)
        thumb_p = os.path.join(SAMPLES_DIR, thumb_f)
        assert os.path.exists(full_p), f"Full sample missing: {full_p}"
        assert os.path.exists(thumb_p), f"Thumb sample missing: {thumb_p}"

    # Extract suggestedPresetIds from STUDIO_SAMPLES
    suggested_presets = re.findall(r"suggestedPresetId:\s*['\"]([^'\"]+)['\"]", sample_code)
    for sp in suggested_presets:
        assert sp in preset_ids, f"suggestedPresetId '{sp}' does not exist in presets.ts!"

    print(f"  ✓ All 9 studio samples exist on disk and reference valid presets: {suggested_presets}")

if __name__ == "__main__":
    test_collection_covers_exist()
    test_preset_membership_counts()
    test_studio_sample_metadata_and_presets()
    print("\n✅ ALL COLLECTION MAPPING TESTS PASSED SUCCESSFULLY.")
