"""
资产存储：本地落盘 + URL 生成
"""

from __future__ import annotations

import base64
import io
import os
import secrets
from dataclasses import dataclass
from typing import Optional, Tuple

from PIL import Image


@dataclass
class StoredAsset:
    asset_id: str
    filename: str
    mime_type: str
    abs_path: str


def get_assets_dir() -> str:
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "assets")
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


def _new_asset_id() -> str:
    return secrets.token_urlsafe(16).replace("-", "").replace("_", "")


def _strip_data_url_prefix(data_url: str) -> Tuple[Optional[str], str]:
    """
    支持 data URL：
    data:image/png;base64,xxxx
    返回 (mime, base64)
    """
    if not data_url.startswith("data:"):
        return None, data_url
    try:
        header, b64 = data_url.split(",", 1)
        # data:image/png;base64
        mime = header.split(":", 1)[1].split(";", 1)[0]
        return mime, b64
    except Exception:
        return None, data_url


def save_image_as_webp(image_bytes: bytes, asset_id: Optional[str] = None, quality: int = 85) -> StoredAsset:
    """
    将图片转为 webp 落盘（统一输出 .webp）
    """
    asset_id = asset_id or _new_asset_id()
    out_dir = get_assets_dir()
    filename = f"{asset_id}.webp"
    abs_path = os.path.join(out_dir, filename)

    img = Image.open(io.BytesIO(image_bytes))
    # 转为 RGB 避免透明/模式兼容问题
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    # RGBA 也可保存 webp，这里保留 alpha
    img.save(abs_path, format="WEBP", quality=quality, method=6)
    return StoredAsset(asset_id=asset_id, filename=filename, mime_type="image/webp", abs_path=abs_path)


def save_base64_image_as_webp(data_url_or_b64: str, asset_id: Optional[str] = None, quality: int = 85) -> StoredAsset:
    mime, b64 = _strip_data_url_prefix(data_url_or_b64.strip())
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception as e:
        raise ValueError(f"Error: Invalid base64 image data: {e}")
    return save_image_as_webp(raw, asset_id=asset_id, quality=quality)


def save_file_bytes(file_bytes: bytes, filename: str, asset_id: Optional[str] = None) -> StoredAsset:
    """
    非图片文件：原样落盘，保留扩展名，返回本地 URL
    """
    asset_id = asset_id or _new_asset_id()
    out_dir = get_assets_dir()
    safe_name = filename or f"{asset_id}.bin"
    # 防路径穿越
    safe_name = os.path.basename(safe_name)
    abs_path = os.path.join(out_dir, f"{asset_id}-{safe_name}")
    with open(abs_path, "wb") as f:
        f.write(file_bytes)
    return StoredAsset(asset_id=asset_id, filename=os.path.basename(abs_path), mime_type="application/octet-stream", abs_path=abs_path)


def find_asset_file(asset_filename: str) -> Optional[str]:
    """
    根据文件名在 assets 目录查找
    """
    base_dir = get_assets_dir()
    candidate = os.path.join(base_dir, os.path.basename(asset_filename))
    if os.path.exists(candidate) and os.path.isfile(candidate):
        return candidate
    return None


