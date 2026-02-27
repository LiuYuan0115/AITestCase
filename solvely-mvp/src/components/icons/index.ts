/**
 * 图标统一导出
 * 使用 Lucide Icons (https://lucide.dev/)
 */

// 基础操作图标
export {
  X,                    // 关闭
  Eye,                  // 预览
  EyeOff,              // 隐藏
  CircleCheck,         // 选中/使用
  Trash2,              // 删除
  Pencil,              // 编辑
  Copy,                // 复制
  Download,            // 下载
  Upload,              // 上传
  RefreshCw,           // 刷新
  MoreVertical,        // 更多操作
  MoreHorizontal,      // 更多操作（横向）
} from 'lucide-vue-next';

// 导航图标
export {
  ChevronDown,         // 展开
  ChevronUp,           // 收起
  ChevronLeft,         // 左
  ChevronRight,        // 右
  PanelRightClose,     // 折叠面板
  PanelRightOpen,      // 展开面板
} from 'lucide-vue-next';

// 搜索相关
export {
  Search,              // 搜索
  Filter,              // 过滤
} from 'lucide-vue-next';

// 文件类型图标
export {
  File,                // 通用文件
  FileText,            // 文本文档
  Image,               // 图片
  FileCode,            // 代码文件
  FolderOpen,          // 文件夹（打开）
  Folder,              // 文件夹
  Library,             // 知识库
} from 'lucide-vue-next';

// 功能图标
export {
  ListChecks,          // 测试用例/清单
  GitBranch,           // 思维导图/分支
  MessageSquare,       // 对话
  Send,                // 发送
  Paperclip,           // 附件
  Globe,               // 网页/当前页
  Sparkles,            // AI/提示
  Zap,                 // 快速操作
  Settings,            // 设置
  HelpCircle,          // 帮助
  Info,                // 信息
  AlertCircle,         // 警告
  CheckCircle,         // 成功
  XCircle,             // 错误
} from 'lucide-vue-next';

// 状态图标
export {
  Loader2,             // 加载中（可旋转）
  Clock,               // 等待
  Check,               // 完成
  Plus,                // 添加
  Minus,               // 减少
} from 'lucide-vue-next';

// 导出 IconButton 组件
export { default as IconButton } from './IconButton.vue';
