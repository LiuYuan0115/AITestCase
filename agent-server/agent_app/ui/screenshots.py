"""
截图存储与读取
"""

from __future__ import annotations

import base64
import os
from typing import List, Dict, Any, Optional

from agent_app.assets.storage import save_image_as_webp, StoredAsset


# 服务端基础 URL（可从环境变量配置）
def get_base_url() -> str:
    return os.getenv("AGENT_SERVER_BASE_URL", "http://localhost:8000")


def get_screenshot_dir() -> str:
    screenshot_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)
    return screenshot_dir


def upload_screenshot(filepath: str) -> Optional[str]:
    """
    上传截图到 assets 目录并返回可访问的 URL
    
    Args:
        filepath: 截图文件路径
        
    Returns:
        截图的访问 URL，失败返回 None
    """
    try:
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, "rb") as f:
            image_bytes = f.read()
        
        # 保存为 webp 格式到 assets
        asset: StoredAsset = save_image_as_webp(image_bytes, quality=85)
        
        # 生成访问 URL
        base_url = get_base_url()
        url = f"{base_url}/api/assets/{asset.filename}"
        return url
    except Exception as e:
        print(f"[upload_screenshot] Error: {e}")
        return None


def upload_screenshot_bytes(image_bytes: bytes, filename: str = "") -> Optional[str]:
    """
    直接上传截图字节数据并返回 URL
    """
    try:
        asset: StoredAsset = save_image_as_webp(image_bytes, quality=85)
        base_url = get_base_url()
        url = f"{base_url}/api/assets/{asset.filename}"
        return url
    except Exception as e:
        print(f"[upload_screenshot_bytes] Error: {e}")
        return None


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

            # 尝试上传获取 URL
            url = upload_screenshot(filepath)

            screenshots.append(
                {
                    "filename": filename,
                    "step": step_name,
                    "base64": f"data:image/png;base64,{img_base64}",
                    "url": url,
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


