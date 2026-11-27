#!/usr/bin/env python3
"""
tests/phase6_3_asset_integrity.py
Validates integrity, existence, hashing, quarantine compliance, and clean imports for Phase 6.3 production assets.
"""

import os
import sys
import json
import hashlib
from PIL import Image

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(REPO_ROOT, "public/assets/attribution/production_asset_manifest.json")
COLLECTIONS_DIR = os.path.join(REPO_ROOT, "public/assets/collections")
SAMPLES_DIR = os.path.join(REPO_ROOT, "public/assets/studio-samples")
SIG_LOOKS_DIR = os.path.join(REPO_ROOT, "public/assets/signature-looks")
SRC_DIR = os.path.join(REPO_ROOT, "src")

EXPECTED_SIGNATURE_LOOKS = [
    "porcelain-bloom",
    "velvet-noir",
    "hannam-daylight",
    "amber-halation",
    "silver-gelatin",
]

QUARANTINED_PHOTOS = {
    "p6_18", "p6_34", "p6_35", "p6_42", "p6_45"
}

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def test_manifest_existence_and_hashes():
    print("[1/5] Verifying production asset manifest and SHA-256 hashes...")
    assert os.path.exists(MANIFEST_PATH), f"Manifest missing: {MANIFEST_PATH}"
    with open(MANIFEST_PATH) as f:
        data = json.load(f)

    # Check collections
    for item in data.get("collections", []):
        file_path = os.path.join(COLLECTIONS_DIR, item["out"])
        assert os.path.exists(file_path), f"Collection cover missing: {file_path}"
        actual_sha = sha256_file(file_path)
        assert actual_sha == item["sha256"], f"SHA mismatch on {item['out']}: expected {item['sha256']}, got {actual_sha}"
        actual_size = os.path.getsize(file_path)
        assert actual_size == item["size"], f"Size mismatch on {item['out']}: expected {item['size']}, got {actual_size}"
        assert actual_size < 150000, f"Collection cover too large (>150KB): {actual_size} bytes"

        # Check image dimensions
        with Image.open(file_path) as img:
            assert img.width == item["w"] and img.height == item["h"], f"Dimension mismatch: {img.size} vs {item['w']}x{item['h']}"

    # Check studio samples
    for item in data.get("samples", []):
        full_path = os.path.join(SAMPLES_DIR, item["out"])
        thumb_path = os.path.join(SAMPLES_DIR, item["thumb"])
        assert os.path.exists(full_path), f"Sample full file missing: {full_path}"
        assert os.path.exists(thumb_path), f"Sample thumb file missing: {thumb_path}"

        actual_sha = sha256_file(full_path)
        assert actual_sha == item["sha256"], f"SHA mismatch on {item['out']}"
        actual_thumb_sha = sha256_file(thumb_path)
        assert actual_thumb_sha == item["thumbSha256"], f"SHA mismatch on {item['thumb']}"

        actual_size = os.path.getsize(full_path)
        assert actual_size < 200000, f"Sample full too large (>200KB): {actual_size} bytes"
        thumb_size = os.path.getsize(thumb_path)
        assert thumb_size < 50000, f"Sample thumb too large (>50KB): {thumb_size} bytes"

    # Check signature looks
    sig_items = data.get("signatureLooks", [])
    sig_ids = [item.get("presetId") for item in sig_items]
    assert sig_ids == EXPECTED_SIGNATURE_LOOKS, f"Signature Looks mismatch: {sig_ids}"
    for item in sig_items:
        out_path = os.path.join(SIG_LOOKS_DIR, item["out"])
        src_asset_path = os.path.join(SIG_LOOKS_DIR, item["sourceAsset"])
        assert os.path.exists(out_path), f"Signature Look preview missing: {out_path}"
        assert os.path.exists(src_asset_path), f"Signature Look source asset missing: {src_asset_path}"

        actual_sha = sha256_file(out_path)
        assert actual_sha == item["sha256"], f"SHA mismatch on {item['out']}"
        actual_src_sha = sha256_file(src_asset_path)
        assert actual_src_sha == item["sourceAssetSha256"], f"SHA mismatch on {item['sourceAsset']}"

        actual_size = os.path.getsize(out_path)
        assert actual_size == item["size"], f"Size mismatch on {item['out']}"
        assert actual_size < 150000, f"Signature Look preview too large (>150KB): {actual_size} bytes"

        with Image.open(out_path) as img:
            assert img.width == item["w"] and img.height == item["h"], f"Dimension mismatch on {item['out']}"

        for req_field in ("assetId", "presetId", "sourcePhotoId", "src", "sourceSha256", "creator", "sourceUrl", "license", "licenseEvidence", "attribution", "rendererPath"):
            assert item.get(req_field), f"Missing attribution field {req_field} on {item['presetId']}"

    print("  ✓ All collection covers, studio samples, and signature look previews exist, match SHA-256, attribution, and size limits.")

def test_no_quarantined_assets():
    print("[2/5] Verifying zero quarantined photos used in production manifest or code...")
    with open(MANIFEST_PATH) as f:
        manifest_str = f.read()
    for q in QUARANTINED_PHOTOS:
        assert q not in manifest_str, f"Quarantined photo {q} found in manifest!"

    # Check src/lib/samplePhoto.ts
    sample_photo_path = os.path.join(SRC_DIR, "lib/samplePhoto.ts")
    with open(sample_photo_path) as f:
        sample_code = f.read()
    for q in QUARANTINED_PHOTOS:
        assert q not in sample_code, f"Quarantined photo {q} found in src/lib/samplePhoto.ts!"

    print("  ✓ Zero quarantined photo references in production manifest and samplePhoto.ts.")

def test_no_fixture_imports_in_src():
    print("[3/5] Verifying no test fixture imports in production source code...")
    import re
    # Match imports or requires containing tests/ or fixtures/
    forbidden_import_pattern = re.compile(r"""(?:import|from|require)\s*\(?['"][^'"]*(?:fixtures/opensource_photos|tests/)[^'"]*['"]""")
    for root, _, files in os.walk(SRC_DIR):
        for fname in files:
            if fname.endswith((".ts", ".tsx", ".js", ".jsx", ".json")):
                p = os.path.join(root, fname)
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                match = forbidden_import_pattern.search(content)
                assert not match, f"Forbidden import found in {p}: {match.group(0)}"
    print("  ✓ Zero test fixture or test-path imports in src/.")

def test_attribution_files_exist():
    print("[4/5] Verifying attribution and credit documentation files...")
    attr_dir = os.path.join(REPO_ROOT, "public/assets/attribution")
    photo_credits = os.path.join(attr_dir, "PHOTO_CREDITS.md")
    cover_credits = os.path.join(attr_dir, "collection_cover_credits.md")
    sig_credits = os.path.join(attr_dir, "signature_look_credits.md")
    assert os.path.exists(photo_credits), f"Missing {photo_credits}"
    assert os.path.exists(cover_credits), f"Missing {cover_credits}"
    assert os.path.exists(sig_credits), f"Missing {sig_credits}"

    with open(photo_credits) as f:
        c1 = f.read()
    assert "CC0 1.0 Universal" in c1
    assert "Allef Vinicius" in c1

    with open(cover_credits) as f:
        c2 = f.read()
    assert "rosy-portrait" in c2
    assert "velvet-series" in c2
    assert "seoul-editorial" in c2
    assert "analog-archive" in c2

    with open(sig_credits) as f:
        c3 = f.read()
    for pid in EXPECTED_SIGNATURE_LOOKS:
        assert pid in c3, f"Missing {pid} in signature_look_credits.md"
    print("  ✓ Attribution files verified with valid CC0 licensing and author attribution.")

def test_webp_decodability():
    print("[5/5] Verifying all production WebP images are valid and decodable...")
    for directory in [COLLECTIONS_DIR, SAMPLES_DIR, SIG_LOOKS_DIR]:
        for fname in os.listdir(directory):
            if fname.endswith(".webp"):
                fpath = os.path.join(directory, fname)
                with Image.open(fpath) as im:
                    im.verify()
                # Reopen to test load/decode
                with Image.open(fpath) as im:
                    im.load()
                    assert im.format == "WEBP", f"File {fname} is not WEBP format"
    print("  ✓ All production WebP files decoded cleanly.")

if __name__ == "__main__":
    test_manifest_existence_and_hashes()
    test_no_quarantined_assets()
    test_no_fixture_imports_in_src()
    test_attribution_files_exist()
    test_webp_decodability()
    print("\n✅ ALL ASSET INTEGRITY TESTS PASSED SUCCESSFULLY.")
