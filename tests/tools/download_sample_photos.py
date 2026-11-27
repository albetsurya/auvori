#!/usr/bin/env python3
"""
Auvori Phase 6 Selective Open-Source Photo Acquisition & Integrity Verifier.

Reads approved entries from tests/fixtures/opensource_photos/manifest.json,
verifies license safety, downloads untouched original files (skipping valid cached
files matching SHA-256), validates HTTP/MIME/PIL integrity, checks minimum resolution
and deduplication, and emits an auditable JSON + console verification report.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_MANIFEST = ROOT / "tests" / "fixtures" / "opensource_photos" / "manifest.json"

ALLOWED_LICENSES = {
    "CC0 1.0 Universal",
    "CC0",
    "Public Domain",
    "Public domain",
    "CC-PD-Mark",
    "CC BY 4.0",
    "CC BY 3.0",
    "CC BY 2.0",
}
FORBIDDEN_PREFIXES = ("CC BY-NC", "CC BY-ND", "CC BY-SA", "All Rights Reserved")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MIN_LONG_EDGE = 900
HEADERS = {"User-Agent": "AuvoriPhotoLibraryCurator/1.0 (https://auvori.app; reproducible test dataset)"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_license_safe(license_name: str) -> bool:
    norm = license_name.strip()
    if any(norm.upper().startswith(p.upper()) for p in FORBIDDEN_PREFIXES):
        return False
    return norm in ALLOWED_LICENSES


def validate_image_bytes(data: bytes, expected_mime: str | None = None) -> tuple[int, int, str]:
    with Image.open(io.BytesIO(data)) as im:
        im.verify()
    with Image.open(io.BytesIO(data)) as im:
        fmt = (im.format or "").upper()
        w, h = im.size
        im.load()
    if max(w, h) < MIN_LONG_EDGE:
        raise ValueError(f"Resolution {w}x{h} below minimum long-edge {MIN_LONG_EDGE}px")
    if expected_mime == "image/jpeg" and fmt != "JPEG":
        raise ValueError(f"MIME image/jpeg mismatched format {fmt}")
    return w, h, fmt


def process_manifest(
    manifest_path: Path,
    verify_only: bool = False,
    populate_metadata: bool = False,
    report_path: Path | None = None,
) -> int:
    dest_dir = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries: List[Dict[str, Any]] = manifest if isinstance(manifest, list) else manifest.get("photos", [])

    seen_hashes: Dict[str, str] = {}
    stats = {
        "total": len(entries),
        "downloaded": 0,
        "cached_verified": 0,
        "skipped_unapproved": 0,
        "failed": 0,
        "duplicates": 0,
    }
    report_rows = []
    modified = False

    for entry in entries:
        fname = entry["filename"]
        status = entry.get("verification_status", "pending-review")
        lic = entry.get("license_name", "")
        out_file = dest_dir / fname

        if status not in ("verified-original", "verified-license", "verified-attribution"):
            stats["skipped_unapproved"] += 1
            report_rows.append({"filename": fname, "result": "skipped-unapproved", "status": status})
            continue

        if not is_license_safe(lic):
            stats["failed"] += 1
            report_rows.append({"filename": fname, "result": "rejected-unsafe-license", "license": lic})
            print(f"[FAIL] Unsafe license on {fname}: {lic}")
            continue

        expected_sha = (entry.get("sha256") or "").strip().lower()
        if out_file.exists():
            raw = out_file.read_bytes()
            actual_sha = sha256_bytes(raw)
            if expected_sha and actual_sha == expected_sha:
                if actual_sha in seen_hashes:
                    stats["duplicates"] += 1
                    print(f"[FAIL] Duplicate file SHA-256: {fname} matches {seen_hashes[actual_sha]}")
                    continue
                seen_hashes[actual_sha] = fname
                w, h, fmt = validate_image_bytes(raw)
                stats["cached_verified"] += 1
                report_rows.append({
                    "filename": fname, "result": "cached-verified", "width": w, "height": h,
                    "bytes": len(raw), "sha256": actual_sha,
                })
                continue

        if verify_only:
            stats["failed"] += 1
            report_rows.append({"filename": fname, "result": "missing-or-checksum-mismatch"})
            print(f"[FAIL] Verify-only failed on {fname}")
            continue

        url = entry["download_url"]
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"HTTP {resp.status}")
                mime = resp.headers.get_content_type()
                if mime not in ALLOWED_MIME:
                    raise ValueError(f"Disallowed MIME type: {mime}")
                raw = resp.read()
        except Exception as exc:
            stats["failed"] += 1
            report_rows.append({"filename": fname, "result": f"download-error: {exc}"})
            print(f"[FAIL] Download error for {fname}: {exc}")
            continue

        actual_sha = sha256_bytes(raw)
        if actual_sha in seen_hashes:
            stats["duplicates"] += 1
            report_rows.append({"filename": fname, "result": f"rejected-duplicate-of-{seen_hashes[actual_sha]}"})
            print(f"[FAIL] Duplicate image discarded: {fname} == {seen_hashes[actual_sha]}")
            continue

        if expected_sha and actual_sha != expected_sha:
            stats["failed"] += 1
            report_rows.append({"filename": fname, "result": "sha256-mismatch"})
            print(f"[FAIL] SHA-256 mismatch for {fname}: expected {expected_sha}, got {actual_sha}")
            continue

        try:
            w, h, fmt = validate_image_bytes(raw, mime)
        except Exception as exc:
            stats["failed"] += 1
            report_rows.append({"filename": fname, "result": f"invalid-image: {exc}"})
            print(f"[FAIL] Invalid image for {fname}: {exc}")
            continue

        # Save raw untouched bytes verbatim (zero re-encoding)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_bytes(raw)
        seen_hashes[actual_sha] = fname
        stats["downloaded"] += 1

        if populate_metadata:
            entry["original_width"] = w
            entry["original_height"] = h
            entry["file_format"] = fmt
            entry["file_size_bytes"] = len(raw)
            entry["sha256"] = actual_sha
            modified = True

        report_rows.append({
            "filename": fname, "result": "downloaded-verified", "width": w, "height": h,
            "bytes": len(raw), "sha256": actual_sha,
        })

    if modified and not verify_only:
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    summary = {"stats": stats, "entries": report_rows}
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    print(
        f"[download_sample_photos] total={stats['total']} downloaded={stats['downloaded']} "
        f"cached_verified={stats['cached_verified']} skipped={stats['skipped_unapproved']} "
        f"duplicates={stats['duplicates']} failed={stats['failed']}"
    )
    return 0 if stats["failed"] == 0 and stats["duplicates"] == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--populate-metadata", action="store_true", help="Only used during initial curation to stamp observed byte length/dimensions/sha256")
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args()
    return process_manifest(args.manifest, args.verify_only, args.populate_metadata, args.report)


if __name__ == "__main__":
    sys.exit(main())
