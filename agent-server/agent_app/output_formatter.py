"""
输出格式转换器 - 支持 Markdown, Table, YAML, JSON

将测试用例等内容从 Markdown 格式转换为其他格式。
"""

import json
import re
from typing import Any, Dict, List, Literal, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    yaml = None
    YAML_AVAILABLE = False


class OutputFormat(str, Enum):
    """输出格式枚举"""
    MARKDOWN = "markdown"
    TABLE = "table"
    YAML = "yaml"
    JSON = "json"
    MINDMAP = "mindmap"  # 兼容现有思维导图（实际上就是 Markdown）


# 类型别名
OutputFormatType = Literal["markdown", "table", "yaml", "json", "mindmap"]


class OutputFormatter:
    """输出格式转换器"""

    @classmethod
    def convert(
        cls,
        content: str,
        target_format: OutputFormatType,
        content_type: Literal["testcase", "testpoint", "prd"] = "testcase"
    ) -> str:
        """
        将 Markdown 内容转换为目标格式

        Args:
            content: 原始 Markdown 内容
            target_format: 目标格式
            content_type: 内容类型（影响解析策略）

        Returns:
            转换后的内容
        """
        if target_format in (OutputFormat.MARKDOWN, OutputFormat.MINDMAP, "markdown", "mindmap"):
            return content

        # 先解析 Markdown 结构
        parsed = cls._parse_markdown(content, content_type)

        if target_format in (OutputFormat.TABLE, "table"):
            return cls._to_table(parsed, content_type)
        elif target_format in (OutputFormat.YAML, "yaml"):
            return cls._to_yaml(parsed)
        elif target_format in (OutputFormat.JSON, "json"):
            return cls._to_json(parsed)

        return content

    @classmethod
    def _parse_markdown(cls, content: str, content_type: str) -> List[Dict[str, Any]]:
        """
        解析 Markdown 层级结构为结构化数据

        针对测试用例的 H1-H6 结构解析
        """
        items = []
        current_item: Dict[str, Any] = {}
        current_module = ""
        current_feature = ""
        current_checkpoint = ""

        lines = content.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # H1: 文档标题
            if line.startswith("# "):
                # 开始新文档
                pass

            # H2: 模块
            elif line.startswith("## "):
                current_module = line[3:].strip()

            # H3: 功能测试点
            elif line.startswith("### "):
                current_feature = line[4:].strip()

            # H4: 验证点
            elif line.startswith("#### "):
                current_checkpoint = line[5:].strip()

            # H5: 用例场景
            elif line.startswith("##### "):
                if current_item and current_item.get("scenario"):
                    items.append(current_item)

                current_item = {
                    "module": current_module,
                    "feature": current_feature,
                    "checkpoint": current_checkpoint,
                    "scenario": line[6:].strip(),
                    "expected_results": [],
                }

            # H6: 预期结果
            elif line.startswith("###### "):
                pass  # 预期结果标题，跳过

            # 列表项（预期结果详情）
            elif line.startswith("- ") and current_item:
                if "expected_results" not in current_item:
                    current_item["expected_results"] = []
                current_item["expected_results"].append(line[2:].strip())

        if current_item and current_item.get("scenario"):
            items.append(current_item)

        return items

    @classmethod
    def _to_table(cls, items: List[Dict], content_type: str) -> str:
        """转换为 Markdown 表格"""
        if not items:
            return "| 无数据 |\n|---|"

        if content_type == "testcase":
            headers = ["模块", "功能点", "验证点", "用例场景", "预期结果"]
            rows = []
            for item in items:
                expected = "; ".join(item.get("expected_results", []))
                rows.append([
                    item.get("module", ""),
                    item.get("feature", ""),
                    item.get("checkpoint", ""),
                    item.get("scenario", ""),
                    expected,
                ])
        elif content_type == "testpoint":
            headers = ["模块", "测试点", "验证要点", "优先级"]
            rows = []
            for item in items:
                rows.append([
                    item.get("module", ""),
                    item.get("feature", item.get("name", "")),
                    item.get("checkpoint", item.get("verification", "")),
                    item.get("priority", "中"),
                ])
        else:
            # 通用表格
            if items and isinstance(items[0], dict):
                headers = list(items[0].keys())
                rows = [[str(item.get(h, "")) for h in headers] for item in items]
            else:
                return "| 无法转换 |\n|---|"

        # 生成 Markdown 表格
        table = "| " + " | ".join(headers) + " |\n"
        table += "| " + " | ".join(["---"] * len(headers)) + " |\n"
        for row in rows:
            # 转义表格中的管道符和换行符
            escaped_row = [
                cell.replace("|", "\\|").replace("\n", " ")
                for cell in row
            ]
            table += "| " + " | ".join(escaped_row) + " |\n"

        return table

    @classmethod
    def _to_yaml(cls, items: List[Dict]) -> str:
        """转换为 YAML 格式"""
        if not YAML_AVAILABLE:
            # 手动构建简单的 YAML
            return cls._manual_yaml(items)

        return yaml.dump(
            {"testcases": items},
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )

    @classmethod
    def _manual_yaml(cls, items: List[Dict]) -> str:
        """手动构建 YAML（不依赖 pyyaml）"""
        lines = ["testcases:"]
        for item in items:
            lines.append(f'  - module: "{cls._escape_yaml_string(item.get("module", ""))}"')
            lines.append(f'    feature: "{cls._escape_yaml_string(item.get("feature", ""))}"')
            lines.append(f'    checkpoint: "{cls._escape_yaml_string(item.get("checkpoint", ""))}"')
            lines.append(f'    scenario: "{cls._escape_yaml_string(item.get("scenario", ""))}"')
            lines.append("    expected_results:")
            for result in item.get("expected_results", []):
                lines.append(f'      - "{cls._escape_yaml_string(result)}"')
        return "\n".join(lines)

    @classmethod
    def _escape_yaml_string(cls, s: str) -> str:
        """转义 YAML 字符串中的特殊字符"""
        return s.replace('"', '\\"').replace("\n", "\\n")

    @classmethod
    def _to_json(cls, items: List[Dict]) -> str:
        """转换为 JSON 格式"""
        return json.dumps(
            {"testcases": items},
            ensure_ascii=False,
            indent=2
        )


# 便捷函数
def format_output(
    content: str,
    target_format: str,
    content_type: str = "testcase"
) -> str:
    """格式化输出"""
    return OutputFormatter.convert(content, target_format, content_type)


def get_supported_formats() -> List[str]:
    """获取支持的格式列表"""
    return [f.value for f in OutputFormat]
