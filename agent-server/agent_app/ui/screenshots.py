"""
截图存储与读取
"""

from __future__ import annotations

import base64
import os
from typing import List, Dict, Any


def get_screenshot_dir() -> str:
    screenshot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)
    return screenshot_dir


def list_screenshots(limit: int = 50) -> Dict[str, Any]:
    screenshot_dir = get_screenshot_dir()
    screenshots: List[Dict[str, Any]] = []

    if os.path.exists(screenshot_dir):
        for filename in sorted(os.listdir(screenshot_dir), reverse=True):
            if not filename.endswith(".png"):
                continue
            filepath = os.path.join(screenshot_dir, filename)
            with open(filepath, "rb") as f:
                img_base64 = base64.b64encode(f.read()).decode()

            parts = filename.replace(".png", "").split("_")
            step_name = parts[0] if parts else filename

            screenshots.append(
                {
                    "filename": filename,
                    "step": step_name,
                    "base64": f"data:image/png;base64,{img_base64}",
                    "timestamp": os.path.getmtime(filepath),
                }
            )

    return {"status": "success", "screenshots": screenshots[:limit], "total": len(screenshots)}


def clear_screenshots() -> Dict[str, Any]:
    screenshot_dir = get_screenshot_dir()
    count = 0
    if os.path.exists(screenshot_dir):
        for filename in os.listdir(screenshot_dir):
            if filename.endswith(".png"):
                os.remove(os.path.join(screenshot_dir, filename))
                count += 1
    return {"status": "success", "message": f"Cleared {count} screenshots."}


