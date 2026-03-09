"""
无代码 UI 自动化 - 模板存储

混合存储策略：
- 预置模板：从 templates/ 目录加载（只读）
- 用户模板：存储在 SessionStore（可读写）
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from agent_app.flow.schemas import FlowConfig


class TemplateStore:
    """
    模板存储管理器
    
    支持：
    - 预置模板（从文件加载，不可修改/删除）
    - 用户模板（存储在内存/SessionStore，可增删改）
    """
    
    # 预置模板 ID 前缀
    PRESET_PREFIX = "template_"
    
    # 用户模板 ID 前缀
    USER_PREFIX = "user_"
    
    def __init__(self, templates_dir: Optional[str] = None, session_store: Optional[Any] = None):
        """
        初始化模板存储
        
        Args:
            templates_dir: 预置模板目录路径
            session_store: SessionStore 实例（用于用户模板）
        """
        # 预置模板目录
        if templates_dir:
            self.templates_dir = templates_dir
        else:
            # 默认在 agent-server/templates/
            self.templates_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "templates"
            )
        
        self.session_store = session_store
        
        # 用户模板缓存（按 session_id 分组）
        self._user_templates: Dict[str, Dict[str, Dict[str, Any]]] = {}
        
        # 预置模板缓存
        self._preset_templates: Dict[str, Dict[str, Any]] = {}
        
        # 加载预置模板
        self._load_preset_templates()
    
    def _load_preset_templates(self) -> None:
        """从文件系统加载预置模板"""
        self._preset_templates = {}
        
        if not os.path.exists(self.templates_dir):
            print(f"[TemplateStore] Templates directory not found: {self.templates_dir}")
            return
        
        for filename in os.listdir(self.templates_dir):
            if not filename.endswith(".json"):
                continue
            
            filepath = os.path.join(self.templates_dir, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    template = json.load(f)
                
                # 确保有 ID
                template_id = template.get("id", filename.replace(".json", ""))
                template["id"] = template_id
                template["isPreset"] = True
                
                self._preset_templates[template_id] = template
                print(f"[TemplateStore] Loaded preset template: {template_id}")
                
            except Exception as e:
                print(f"[TemplateStore] Error loading template {filename}: {e}")
    
    def list_all(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        获取所有模板（预置 + 用户）
        
        Args:
            session_id: 会话 ID（用于获取该会话的用户模板）
            
        Returns:
            模板列表
        """
        templates = []
        
        # 1. 预置模板
        for template in self._preset_templates.values():
            templates.append(template.copy())
        
        # 2. 用户模板
        if session_id and session_id in self._user_templates:
            for template in self._user_templates[session_id].values():
                templates.append(template.copy())
        
        return templates
    
    def list_presets(self) -> List[Dict[str, Any]]:
        """获取所有预置模板"""
        return [t.copy() for t in self._preset_templates.values()]
    
    def list_user_templates(self, session_id: str) -> List[Dict[str, Any]]:
        """获取指定会话的用户模板"""
        if session_id not in self._user_templates:
            return []
        return [t.copy() for t in self._user_templates[session_id].values()]
    
    def get(self, template_id: str, session_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        获取模板详情
        
        Args:
            template_id: 模板 ID
            session_id: 会话 ID（用于查找用户模板）
            
        Returns:
            模板配置，不存在返回 None
        """
        # 1. 先查预置模板
        if template_id in self._preset_templates:
            return self._preset_templates[template_id].copy()
        
        # 2. 再查用户模板
        if session_id and session_id in self._user_templates:
            if template_id in self._user_templates[session_id]:
                return self._user_templates[session_id][template_id].copy()
        
        return None
    
    def save(self, template: Dict[str, Any], session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        保存用户模板
        
        Args:
            template: 模板配置
            session_id: 会话 ID
            
        Returns:
            保存后的模板（包含生成的 ID 和时间戳）
        """
        # 生成或使用现有 ID
        template_id = template.get("id")
        if not template_id or template_id.startswith(self.PRESET_PREFIX):
            # 预置模板不能直接修改，生成新的用户模板 ID
            template_id = f"{self.USER_PREFIX}{uuid.uuid4().hex[:8]}"
        
        # 设置元数据
        template["id"] = template_id
        template["isPreset"] = False
        template["updatedAt"] = datetime.now().isoformat()
        if not template.get("createdAt"):
            template["createdAt"] = template["updatedAt"]
        
        # 存储
        session_key = session_id or "_global_"
        if session_key not in self._user_templates:
            self._user_templates[session_key] = {}
        
        self._user_templates[session_key][template_id] = template
        
        print(f"[TemplateStore] Saved user template: {template_id} (session: {session_key})")
        
        return template.copy()
    
    def delete(self, template_id: str, session_id: Optional[str] = None) -> bool:
        """
        删除用户模板
        
        Args:
            template_id: 模板 ID
            session_id: 会话 ID
            
        Returns:
            是否删除成功
        """
        # 预置模板不能删除
        if template_id in self._preset_templates:
            print(f"[TemplateStore] Cannot delete preset template: {template_id}")
            return False
        
        # 删除用户模板
        session_key = session_id or "_global_"
        if session_key in self._user_templates:
            if template_id in self._user_templates[session_key]:
                del self._user_templates[session_key][template_id]
                print(f"[TemplateStore] Deleted user template: {template_id}")
                return True
        
        return False
    
    def is_preset(self, template_id: str) -> bool:
        """检查模板是否为预置模板"""
        return template_id in self._preset_templates
    
    def reload_presets(self) -> None:
        """重新加载预置模板"""
        self._load_preset_templates()
    
    def clear_user_templates(self, session_id: Optional[str] = None) -> None:
        """清除用户模板"""
        if session_id:
            if session_id in self._user_templates:
                del self._user_templates[session_id]
        else:
            self._user_templates = {}


# 全局模板存储实例
_template_store: Optional[TemplateStore] = None


def get_template_store() -> TemplateStore:
    """获取全局模板存储实例"""
    global _template_store
    if _template_store is None:
        _template_store = TemplateStore()
    return _template_store


def init_template_store(templates_dir: Optional[str] = None, session_store: Optional[Any] = None) -> TemplateStore:
    """初始化全局模板存储实例"""
    global _template_store
    _template_store = TemplateStore(templates_dir, session_store)
    return _template_store
