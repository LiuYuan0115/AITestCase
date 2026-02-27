"""
Midscene Sidecar HTTP Client

Provides Python interface to the Midscene Sidecar Node.js service.
Supports two modes:
  - run_testcase(): High-level test case execution (aiAct + aiAssert + aiQuery)
  - run_steps(): Custom step-by-step execution
"""

import os
import json
import logging
import requests
from typing import Any, Dict, List, Optional

SIDECAR_URL = os.getenv("MIDSCENE_SIDECAR_URL", "http://localhost:3100")
logger = logging.getLogger(__name__)

# Bypass HTTP_PROXY/HTTPS_PROXY for local Sidecar connections
# Without this, requests routes localhost traffic through the proxy (returns 503)
_NO_PROXY = {"http": None, "https": None}


def check_health() -> bool:
    """Check if the Midscene Sidecar service is available."""
    try:
        r = requests.get(f"{SIDECAR_URL}/health", timeout=3, proxies=_NO_PROXY)
        return r.status_code == 200
    except Exception:
        return False


def get_health_info() -> Optional[Dict[str, Any]]:
    """Get detailed health info from Sidecar."""
    try:
        r = requests.get(f"{SIDECAR_URL}/health", timeout=3, proxies=_NO_PROXY)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def run_testcase(
    url: str,
    testcase: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Execute a structured test case via Midscene Sidecar (advanced mode).

    The Sidecar uses Midscene's high-level APIs:
      - aiAct(scenario) for autonomous VLM-driven execution
      - aiAssert(expected) for visual assertions
      - aiQuery(schema) for structured data extraction
      - freezePageContext() for efficient batch queries

    Args:
        url: Target page URL
        testcase: {
            name: str,
            scenario: str,           # Passed directly to aiAct()
            expectedResults: [str],   # Each passed to aiAssert()
            preconditions: str,       # Set as aiContext
            testData: dict,           # Test data (embedded in scenario)
            extractSchema: str        # Optional: for aiQuery()
        }
        options: {
            headless: bool,
            cache: { strategy: str, id: str },
            deepThink: bool,
            aiContext: str,
            timeout: int (seconds)
        }

    Returns:
        Midscene native result dict containing:
        - status: "passed" | "failed"
        - testcaseName: str
        - results: { steps, assertions, extractions, pageState }
        - report: { type: "midscene_html", dir, logContent }
    """
    opts = options or {}
    timeout_sec = opts.get("timeout", 300)  # 默认 5 分钟，首次代理连接可能较慢

    try:
        resp = requests.post(
            f"{SIDECAR_URL}/run-testcase",
            json={"url": url, "testcase": testcase, "options": opts},
            timeout=timeout_sec + 60,  # 额外缓冲时间
            proxies=_NO_PROXY,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.Timeout:
        logger.error(f"Midscene Sidecar timeout after {timeout_sec}s")
        return {
            "status": "error",
            "message": f"Sidecar timeout after {timeout_sec}s",
            "results": {"steps": [], "assertions": [], "extractions": []},
        }
    except requests.ConnectionError:
        logger.error("Midscene Sidecar connection refused")
        return {
            "status": "error",
            "message": "Sidecar connection refused. Is it running?",
            "results": {"steps": [], "assertions": [], "extractions": []},
        }
    except Exception as e:
        logger.error(f"Midscene Sidecar error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "results": {"steps": [], "assertions": [], "extractions": []},
        }


def run_steps(
    url: str,
    steps: List[Dict[str, str]],
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Execute custom steps via Midscene Sidecar (simple mode).

    Args:
        url: Target page URL
        steps: [{ type: "action"|"assert"|"wait"|"screenshot"|"extract", instruction: str }]
        options: { headless, cache, aiContext, timeout }

    Returns:
        Execution result with step-by-step results and Midscene HTML report.
    """
    opts = options or {}
    timeout_sec = opts.get("timeout", 300)  # 默认 5 分钟

    try:
        resp = requests.post(
            f"{SIDECAR_URL}/run-steps",
            json={"url": url, "steps": steps, "options": opts},
            timeout=timeout_sec + 60,
            proxies=_NO_PROXY,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.Timeout:
        return {"status": "error", "message": f"Sidecar timeout after {timeout_sec}s"}
    except requests.ConnectionError:
        return {"status": "error", "message": "Sidecar connection refused"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def list_reports() -> List[Dict[str, Any]]:
    """List available Midscene HTML reports."""
    try:
        resp = requests.get(f"{SIDECAR_URL}/reports", timeout=5, proxies=_NO_PROXY)
        if resp.status_code == 200:
            return resp.json().get("reports", [])
    except Exception:
        pass
    return []


def run_screenshot(url: str) -> Optional[str]:
    """
    Take a headless screenshot of a URL via Sidecar.

    Always uses headless mode (no CDP). Used for page analysis
    and test case generation from URL.

    Returns base64-encoded PNG string, or None on failure.
    """
    try:
        resp = requests.post(
            f"{SIDECAR_URL}/screenshot",
            json={"url": url},
            timeout=30,
            proxies=_NO_PROXY,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("screenshot")
    except Exception as e:
        logger.error(f"Screenshot failed for {url}: {e}")
        return None
