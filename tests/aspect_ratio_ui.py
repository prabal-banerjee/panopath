"""Browser smoke test for PanoPath's aspect-ratio preview and export controls."""

import os

from playwright.sync_api import sync_playwright


CASES = (
    ("16:9", 16 / 9, "1920×1080"),
    ("9:16", 9 / 16, "1080×1920"),
    ("1:1", 1, "1080×1080"),
)
BASE_URL = os.environ.get("PANOPATH_TEST_URL", "http://127.0.0.1:4173/")
SCREENSHOT_PATH = os.environ.get("PANOPATH_TEST_SCREENSHOT")


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--use-gl=swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(BASE_URL, wait_until="networkidle")
        page.get_by_role("button", name="Try the demo").click()
        page.locator("#viewerHud:not(.hidden)").wait_for()

        for aspect, expected_ratio, expected_dimensions in CASES:
            page.locator(f'#aspectControl button[data-aspect="{aspect}"]').click()
            page.wait_for_timeout(300)
            viewer = page.locator("#viewer").bounding_box()
            canvas_ratio = page.locator("#glCanvas").evaluate(
                "canvas => canvas.width / canvas.height"
            )
            assert viewer is not None
            assert abs(viewer["width"] / viewer["height"] - expected_ratio) < 0.015
            assert abs(canvas_ratio - expected_ratio) < 0.015
            assert expected_dimensions in page.locator("#exportEstimate").inner_text()
            if SCREENSHOT_PATH and aspect == "9:16":
                page.screenshot(path=SCREENSHOT_PATH)

        page.set_viewport_size({"width": 390, "height": 844})
        page.locator('#aspectControl button[data-aspect="9:16"]').click()
        page.wait_for_timeout(300)
        mobile_viewer = page.locator("#viewer").bounding_box()
        mobile_stage = page.locator("#viewerStage").bounding_box()
        assert mobile_viewer is not None and mobile_stage is not None
        assert abs(mobile_viewer["width"] / mobile_viewer["height"] - 9 / 16) < 0.015
        assert mobile_viewer["width"] <= mobile_stage["width"]
        assert mobile_viewer["height"] <= mobile_stage["height"]

        browser.close()


if __name__ == "__main__":
    main()
