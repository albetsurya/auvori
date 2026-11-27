#!/usr/bin/env python3
"""
tests/phase6_3_signature_looks.py
End-to-end verification and responsive screenshot capture for Phase 6.3 Signature Looks:
1. Verifies all 5 Signature Looks in presets.ts and HomeScreen UI.
2. Verifies every Signature Look card renders a real photographic WebP asset
   from /assets/signature-looks/ (never a data:image/* synthetic illustration).
3. Verifies HTTP 200 image resolution, naturalWidth > 0, favorite toggle,
   PresetDetailModal navigation, Before/After hold-to-compare, and Try in Editor.
4. Captures responsive UI screenshots at 360px, 390px, 430px, 768px, and 1280px
   into tests/reports/phase6_3/signature_looks/.
"""

import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = REPO_ROOT / "public" / "assets" / "attribution" / "production_asset_manifest.json"
REPORT_DIR = REPO_ROOT / "tests" / "reports" / "phase6_3" / "signature_looks"
HOME_REPORT_DIR = REPO_ROOT / "tests" / "reports" / "phase6_3" / "home"
RESPONSIVE_DIR = REPO_ROOT / "tests" / "reports" / "phase6_3" / "responsive"

EXPECTED_SIGNATURES = [
    ("porcelain-bloom", "Porcelain Bloom", "Portrait"),
    ("velvet-noir", "Velvet Noir", "Portrait"),
    ("hannam-daylight", "Hannam Daylight", "Korean"),
    ("amber-halation", "Amber Halation", "Film"),
    ("silver-gelatin", "Silver Gelatin", "Film"),
]


def start_vite(port: int = 4197) -> subprocess.Popen:
    proc = subprocess.Popen(
        ["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
        cwd=str(REPO_ROOT),
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
    raise RuntimeError("Vite dev server failed to start")


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    HOME_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    RESPONSIVE_DIR.mkdir(parents=True, exist_ok=True)

    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)

    sig_manifest = {x["presetId"]: x for x in manifest.get("signatureLooks", [])}
    assert len(sig_manifest) == 5, f"Expected 5 signatureLooks in manifest, got {len(sig_manifest)}"

    proc = start_vite(4197)
    base_url = "http://127.0.0.1:4197/"

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"],
            )

            # 1. Verify Preset Inventory in presets.ts (unchanged: 26 total, 5 signature, 2 adaptive, 19 essential)
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            page = ctx.new_page()
            page_errors = []
            failed_requests = []
            page.on("pageerror", lambda err: page_errors.append(str(err)))
            page.on("response", lambda resp: failed_requests.append((resp.url, resp.status)) if resp.status >= 400 else None)

            page.goto(base_url, wait_until="networkidle")

            inv = page.evaluate("""async () => {
                const { PRESETS } = await import('/src/data/presets.ts');
                const sig = PRESETS.filter(p => p.lookType === 'signature' && p.badge === 'Signature').map(p => ({
                    id: p.id, name: p.name, category: p.category, badge: p.badge
                }));
                const adaptive = PRESETS.filter(p => p.lookType === 'adaptive').map(p => p.id);
                const legacy = PRESETS.filter(p => p.id !== 'original' && p.lookType !== 'adaptive' && p.badge !== 'Signature').map(p => p.id);
                const hasOriginal = PRESETS.some(p => p.id === 'original');
                return { total: PRESETS.length, sig, adaptive, legacy, hasOriginal };
            }""")
            assert inv["total"] == 27, f"Expected 27 presets (1 original + 19 legacy + 5 signature + 2 adaptive), got {inv['total']}"
            assert inv["hasOriginal"], "Missing original neutral mode"
            assert [s["id"] for s in inv["sig"]] == [e[0] for e in EXPECTED_SIGNATURES], f"Signature IDs changed: {inv['sig']}"
            assert inv["adaptive"] == ["direct-flash", "night-cinema"], f"Adaptive IDs changed: {inv['adaptive']}"
            assert len(inv["legacy"]) == 19, f"Expected 19 legacy presets, got {len(inv['legacy'])}"
            print("[1/5] Preset inventory verified (27 total: 1 original, 19 legacy, 5 signature, 2 adaptive).")

            # 2. Verify all 5 Signature Looks render on HomeScreen with real WebP images & zero synthetic fallback
            sig_section = page.locator("section[aria-label='Signature Looks']")
            sig_section.scroll_into_view_if_needed()
            page.wait_for_timeout(600)

            cards_info = page.evaluate("""() => {
                const sec = document.querySelector("section[aria-label='Signature Looks']");
                if (!sec) return [];
                const imgs = Array.from(sec.querySelectorAll('img'));
                return imgs.map(img => ({
                    src: img.getAttribute('src'),
                    alt: img.getAttribute('alt'),
                    complete: img.complete,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    objectPosition: img.style.objectPosition,
                    text: img.closest('[role="button"], button, div.rounded-\\\\[14px\\\\]')?.innerText || ''
                }));
            }""")

            assert len(cards_info) == 5, f"Expected 5 Signature Look cards on HomeScreen, got {len(cards_info)}"
            for idx, (pid, name, cat) in enumerate(EXPECTED_SIGNATURES):
                info = cards_info[idx]
                expected_src = f"/assets/signature-looks/look_{pid.replace('-', '_')}.webp"
                assert info["src"] == expected_src, f"Card {pid} src mismatch: {info['src']} vs {expected_src}"
                assert not info["src"].startswith("data:"), f"Card {pid} fell back to data URL!"
                assert info["complete"] and info["naturalWidth"] > 0, f"Card {pid} failed to load image: {info}"
            print("[2/5] All 5 Signature Look cards rendered real WebP previews on HomeScreen (naturalWidth > 0, zero data URLs).")

            # Capture full Signature Looks section screenshot at 1280px (use 1280x1400 so inner scroll container shows all 5 cards completely)
            page.set_viewport_size({"width": 1280, "height": 1400})
            sig_section.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            sig_section.screenshot(path=str(REPORT_DIR / "signature_looks_section_complete.png"))
            page.set_viewport_size({"width": 1280, "height": 900})
            sig_section.scroll_into_view_if_needed()
            page.wait_for_timeout(200)

            # 3. Verify Favorite interaction, PresetDetailModal, Before/After & Try in Editor
            fav_btn = sig_section.locator("button[aria-label='Add to favorites: Silver Gelatin']")
            fav_btn.click()
            page.wait_for_timeout(150)
            fav_btn_after = sig_section.locator("button[aria-label='Remove from favorites: Silver Gelatin']")
            assert fav_btn_after.count() == 1, "Favorite toggle did not update Silver Gelatin state"
            # Restore favorite state
            fav_btn_after.click()
            page.wait_for_timeout(150)

            # Click Porcelain Bloom card to open PresetDetailModal
            sig_section.get_by_text("Porcelain Bloom", exact=True).click()
            page.wait_for_timeout(400)
            modal_img = page.locator("div[role='dialog'] img")
            assert modal_img.count() == 1, "PresetDetailModal did not render preview image"
            modal_src = modal_img.get_attribute("src")
            assert modal_src == "/assets/signature-looks/look_porcelain_bloom.webp", f"Unexpected modal src: {modal_src}"
            page.screenshot(path=str(REPORT_DIR / "signature_look_detail_modal.png"))

            # Test Hold-to-compare Before/After on modal
            compare_box = modal_img.locator("..")
            compare_box.dispatch_event("pointerdown")
            page.wait_for_timeout(150)
            before_src = modal_img.get_attribute("src")
            assert before_src == "/assets/signature-looks/source_porcelain_bloom.webp", f"Expected real source WebP on Before compare, got {before_src}"
            compare_box.dispatch_event("pointerup")
            page.wait_for_timeout(150)
            after_src = modal_img.get_attribute("src")
            assert after_src == "/assets/signature-looks/look_porcelain_bloom.webp", f"Expected look WebP after release, got {after_src}"

            # Test Try in Editor opens real photograph with Porcelain Bloom selected
            page.get_by_role("button", name="Try in Editor").click()
            page.wait_for_timeout(700)
            assert page.get_by_text("Porcelain Bloom").count() >= 1, "Editor did not open with Porcelain Bloom preset"
            page.screenshot(path=str(REPORT_DIR / "signature_look_editor_porcelain_bloom.png"))
            # Return to Home
            page.locator("header button").first.click()
            page.wait_for_timeout(300)
            print("[3/5] Interactive QA passed: Favorites, PresetDetailModal Before/After, and Editor launch with real photo.")

            # 4. Also check PresetsScreen (All Looks, Signature Collections, and Category filters) & DiscoverScreen
            page.get_by_role("button", name="See all presets").click()
            page.wait_for_timeout(1200)
            for pid, name, _ in EXPECTED_SIGNATURES:
                expected_src = f"/assets/signature-looks/look_{pid.replace('-', '_')}.webp"
                count = page.locator(f"img[src='{expected_src}']").count()
                assert count >= 1, f"PresetsScreen missing static WebP preview for {pid}"

            # Check each Signature Collection filter and category filter has real photos (no broken images, no synthetic 800x1000 canvas)
            for chip_label in ["Velvet Series", "Seoul Editorial", "Rosy Portrait", "Analog Archive", "Portrait", "Café", "Korean", "Film", "Night", "All Looks"]:
                page.get_by_role("button", name=chip_label, exact=True).click()
                page.wait_for_timeout(900)
                imgs_ok = page.evaluate("""() => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0);
                }""")
                assert imgs_ok, f"PresetsScreen filter '{chip_label}' has unloaded or broken images!"
                if chip_label in ("Velvet Series", "Seoul Editorial"):
                    slug = chip_label.lower().replace(" ", "_")
                    page.screenshot(path=str(REPORT_DIR / f"presets_collection_{slug}.png"))

            # Verify DiscoverScreen renders real photographs (zero synthetic illustrations)
            page.get_by_role("button", name="Discover").click()
            page.wait_for_timeout(600)
            discover_ok = page.evaluate("""() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                return imgs.length === 3 && imgs.every(i => i.complete && i.naturalWidth > 0 && i.getAttribute('src')?.startsWith('/assets/signature-looks/look_'));
            }""")
            assert discover_ok, "DiscoverScreen did not render all 3 stories with real /assets/signature-looks/ photos!"
            page.screenshot(path=str(REPORT_DIR / "discover_real_photos.png"))
            print("[4/5] PresetsScreen (all collections & filters) and DiscoverScreen verified with real photos.")
            ctx.close()

            # 5. Capture responsive screenshots at 360px, 390px, 430px, 768px, 1280px
            viewports = [
                (360, 800, "360px"),
                (390, 844, "390px"),
                (430, 932, "430px"),
                (768, 1024, "768px"),
                (1280, 900, "1280px"),
            ]
            for vw, vh, label in viewports:
                rctx = browser.new_context(viewport={"width": vw, "height": vh})
                rpage = rctx.new_page()
                rpage.on("pageerror", lambda err: page_errors.append(str(err)))
                rpage.on("response", lambda resp: failed_requests.append((resp.url, resp.status)) if resp.status >= 400 else None)
                rpage.goto(base_url, wait_until="networkidle")
                rpage.wait_for_timeout(500)
                rpage.screenshot(path=str(HOME_REPORT_DIR / f"home_{label}.png"), full_page=True)
                sec = rpage.locator("section[aria-label='Signature Looks']")
                sec.scroll_into_view_if_needed()
                rpage.wait_for_timeout(400)
                sec.screenshot(path=str(REPORT_DIR / f"home_signature_looks_{label}.png"))
                rpage.screenshot(path=str(RESPONSIVE_DIR / f"viewport_{label}.png"))
                # Verify all 5 images loaded in this viewport
                loaded = rpage.evaluate("""() => {
                    const imgs = Array.from(document.querySelectorAll("section[aria-label='Signature Looks'] img"));
                    return imgs.length === 5 && imgs.every(i => i.complete && i.naturalWidth > 0 && !i.src.startsWith('data:'));
                }""")
                assert loaded, f"Signature Look images failed verification at {label}"
                rctx.close()
            print("[5/5] Captured and verified responsive screenshots at 360px, 390px, 430px, 768px, 1280px.")

            assert not page_errors, f"Runtime page errors detected: {page_errors}"
            assert not failed_requests, f"HTTP errors detected: {failed_requests}"
            browser.close()
    finally:
        proc.terminate()
        proc.wait()

    print("\n✅ ALL SIGNATURE LOOKS UI & VISUAL QA TESTS PASSED SUCCESSFULLY.")


if __name__ == "__main__":
    main()
