#!/usr/bin/env python3
"""
Auvori Phase 6.1C — SHA-256, File Integrity, License & Originality Dataset Audit Runner.

Strictly separates three independent checks per file:
  1. File Integrity (existence, readability, valid image, extension/MIME match, dimensions, size, SHA-256, uniqueness)
  2. License Verification (verified vs pending-review vs rejected vs source-unavailable)
  3. Originality Review (reviewed-original vs possibly-processed vs unknown vs rejected)

Also verifies directory partitioning between gold_standard/ and exploratory/ and ensures
zero unregistered files or missing manifest entries.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OPENSOURCE_DIR = ROOT / "tests" / "fixtures" / "opensource_photos"
MANIFEST_PATH = OPENSOURCE_DIR / "manifest.json"
GOLD_DIR = OPENSOURCE_DIR / "gold_standard"
EXP_DIR = OPENSOURCE_DIR / "exploratory"
REPORT_PATH = ROOT / "tests" / "reports" / "phase6_1" / "dataset_integrity_report.json"

EXT_TO_FORMAT = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".webp": "WEBP",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    if not MANIFEST_PATH.exists():
        print(f"[FAIL] Manifest missing: {MANIFEST_PATH}")
        return 1

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    photos: List[Dict[str, Any]] = manifest.get("photos", [])
    manifest_filenames = {p["filename"] for p in photos}

    # Check unregistered image files in root OPENSOURCE_DIR
    disk_images = {
        p.name
        for p in OPENSOURCE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in EXT_TO_FORMAT
    }
    unregistered = sorted(disk_images - manifest_filenames)
    missing_from_disk = sorted(manifest_filenames - disk_images)

    seen_hashes: Dict[str, str] = {}
    duplicate_hashes: List[Dict[str, str]] = []

    file_results: List[Dict[str, Any]] = []
    integrity_failures = 0
    gold_leaks = 0

    counts = {
        "total": len(photos),
        "file_integrity_pass": 0,
        "file_integrity_fail": 0,
        "license_verified": 0,
        "license_pending_review": 0,
        "license_rejected": 0,
        "license_source_unavailable": 0,
        "originality_reviewed_original": 0,
        "originality_possibly_processed": 0,
        "originality_unknown": 0,
        "originality_rejected": 0,
        "gold_standard": 0,
        "exploratory": 0,
    }

    expected_gold = set()
    expected_exp = set()

    for p in photos:
        fn = p["filename"]
        fpath = OPENSOURCE_DIR / fn

        exists_ok = fpath.is_file()
        readable_ok = False
        valid_image_ok = False
        mime_ext_ok = False
        dims_ok = False
        size_ok = False
        sha_ok = False
        unique_sha_ok = False

        actual_sha = None
        actual_size = None
        actual_w = None
        actual_h = None
        actual_fmt = None

        if exists_ok:
            try:
                raw = fpath.read_bytes()
                readable_ok = True
                actual_size = len(raw)
                size_ok = actual_size == p.get("file_size_bytes")
                actual_sha = hashlib.sha256(raw).hexdigest()
                sha_ok = actual_sha == (p.get("sha256") or "").lower()
                if actual_sha in seen_hashes:
                    duplicate_hashes.append({"file": fn, "duplicate_of": seen_hashes[actual_sha]})
                    unique_sha_ok = False
                else:
                    seen_hashes[actual_sha] = fn
                    unique_sha_ok = True

                with Image.open(fpath) as im:
                    im.verify()
                with Image.open(fpath) as im:
                    im.load()
                    actual_fmt = (im.format or "").upper()
                    actual_w, actual_h = im.size
                valid_image_ok = True
                expected_fmt = EXT_TO_FORMAT.get(fpath.suffix.lower())
                mime_ext_ok = actual_fmt == expected_fmt and actual_fmt == (p.get("file_format") or "").upper()
                dims_ok = (actual_w == p.get("original_width")) and (actual_h == p.get("original_height"))
            except Exception as exc:
                print(f"  [ERROR] Failed reading {fn}: {exc}")

        file_integrity_pass = all([
            exists_ok, readable_ok, valid_image_ok, mime_ext_ok,
            dims_ok, size_ok, sha_ok, unique_sha_ok
        ])
        if file_integrity_pass:
            counts["file_integrity_pass"] += 1
        else:
            counts["file_integrity_fail"] += 1
            integrity_failures += 1

        # Independent License Verification Check
        lv = p.get("license_verification") or {}
        lic_status = lv.get("status", "pending-review")
        if lic_status == "verified":
            counts["license_verified"] += 1
        elif lic_status == "pending-review":
            counts["license_pending_review"] += 1
        elif lic_status == "rejected":
            counts["license_rejected"] += 1
        else:
            counts["license_source_unavailable"] += 1

        # Independent Originality Review Check
        orv = p.get("originality_review") or {}
        orig_status = orv.get("status", "unknown")
        if orig_status == "reviewed-original":
            counts["originality_reviewed_original"] += 1
        elif orig_status == "possibly-processed":
            counts["originality_possibly_processed"] += 1
        elif orig_status == "unknown":
            counts["originality_unknown"] += 1
        else:
            counts["originality_rejected"] += 1

        # Tier Verification
        is_gold = (lic_status == "verified") and (orig_status == "reviewed-original")
        declared_tier = p.get("dataset_tier")
        if is_gold:
            expected_gold.add(fn)
            counts["gold_standard"] += 1
            if declared_tier != "gold_standard":
                gold_leaks += 1
        else:
            expected_exp.add(fn)
            counts["exploratory"] += 1
            if declared_tier == "gold_standard":
                gold_leaks += 1

        # Print per-file report cleanly
        print(fn)
        print(f"  [{'PASS' if exists_ok and readable_ok else 'FAIL'}] File exists & readable")
        print(f"  [{'PASS' if valid_image_ok and mime_ext_ok else 'FAIL'}] Image valid & MIME/extension ({actual_fmt})")
        print(f"  [{'PASS' if dims_ok else 'FAIL'}] Dimensions ({actual_w}x{actual_h})")
        print(f"  [{'PASS' if size_ok else 'FAIL'}] File size ({actual_size} bytes)")
        print(f"  [{'PASS' if sha_ok and unique_sha_ok else 'FAIL'}] SHA-256 ({(actual_sha or '')[:16]}...)")
        print(f"  [{'PASS' if lic_status == 'verified' else 'WARN'}] License status: {lic_status} ({lv.get('verified_license', 'none')})")
        print(f"  [{'PASS' if orig_status == 'reviewed-original' else 'INFO'}] Originality status: {orig_status} -> tier={declared_tier}")

        file_results.append({
            "filename": fn,
            "file_integrity": {
                "pass": file_integrity_pass,
                "exists": exists_ok,
                "readable": readable_ok,
                "valid_image": valid_image_ok,
                "mime_ext_match": mime_ext_ok,
                "dimensions_match": dims_ok,
                "size_match": size_ok,
                "sha256_match": sha_ok,
                "unique_sha256": unique_sha_ok,
                "actual_sha256": actual_sha,
            },
            "license_verification": lv,
            "originality_review": orv,
            "dataset_tier": declared_tier,
        })

    # Verify gold_standard/ and exploratory/ directories
    actual_gold = {p.name for p in GOLD_DIR.iterdir()} if GOLD_DIR.exists() else set()
    actual_exp = {p.name for p in EXP_DIR.iterdir()} if EXP_DIR.exists() else set()

    gold_dir_ok = actual_gold == expected_gold
    exp_dir_ok = actual_exp == expected_exp
    if not gold_dir_ok:
        print(f"[FAIL] gold_standard/ mismatch! Extra={actual_gold - expected_gold}, Missing={expected_gold - actual_gold}")
        gold_leaks += 1
    if not exp_dir_ok:
        print(f"[FAIL] exploratory/ mismatch! Extra={actual_exp - expected_exp}, Missing={expected_exp - actual_exp}")
        gold_leaks += 1
    if unregistered:
        print(f"[FAIL] Unregistered files in {OPENSOURCE_DIR}: {unregistered}")
        integrity_failures += len(unregistered)
    if missing_from_disk:
        print(f"[FAIL] Manifest entries missing from disk: {missing_from_disk}")
        integrity_failures += len(missing_from_disk)

    report = {
        "counts": counts,
        "unregistered_files": unregistered,
        "missing_files": missing_from_disk,
        "duplicate_hashes": duplicate_hashes,
        "gold_standard_dir_exact_match": gold_dir_ok,
        "exploratory_dir_exact_match": exp_dir_ok,
        "gold_leaks_detected": gold_leaks,
        "files": file_results,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print("\n=== PHASE 6.1C DATASET INTEGRITY SUMMARY ===")
    print(f"Total Manifest Entries : {counts['total']}")
    print(f"File Integrity PASS    : {counts['file_integrity_pass']}/{counts['total']} (failures={integrity_failures}, duplicates={len(duplicate_hashes)}, unregistered={len(unregistered)}, missing={len(missing_from_disk)})")
    print(f"License Verification   : verified={counts['license_verified']}, pending-review={counts['license_pending_review']}, rejected={counts['license_rejected']}")
    print(f"Originality Review     : reviewed-original={counts['originality_reviewed_original']}, possibly-processed={counts['originality_possibly_processed']}, unknown={counts['originality_unknown']}, rejected={counts['originality_rejected']}")
    print(f"Partitioning           : gold_standard={counts['gold_standard']} (dir_match={gold_dir_ok}), exploratory={counts['exploratory']} (dir_match={exp_dir_ok}), leaks={gold_leaks}")
    print(f"Saved report           : {REPORT_PATH}")

    return 0 if (integrity_failures == 0 and len(duplicate_hashes) == 0 and gold_leaks == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
