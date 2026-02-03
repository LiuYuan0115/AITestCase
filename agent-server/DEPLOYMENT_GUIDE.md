# AITestCase 项目部署指南

> 完整的部署、配置和运维指南

## 📋 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [Docker 部署](#docker-部署)
- [本地开发部署](#本地开发部署)
- [生产环境部署](#生产环境部署)
- [环境变量配置](#环境变量配置)
- [数据持久化](#数据持久化)
- [监控与日志](#监控与日志)
- [故障排查](#故障排查)
- [升级指南](#升级指南)

---

## 系统要求

### 硬件要求

| 配置项 | 最低配置 | 推荐配置 |
|--------|---------|---------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘空间 | 10 GB | 50 GB+ |
| 网络 | 稳定互联网连接 | 稳定互联网连接 |

### 软件要求

- **Python**: 3.9+ （推荐 3.10 或 3.11）
- **Node.js**: 18+ （前端开发，可选）
- **Docker**: 20.10+ （Docker 部署）
- **操作系统**: macOS / Linux / Windows (WSL2)

### 可选依赖

- **Tesseract OCR**: 图片 OCR 识别（可选）
  - macOS: `brew install tesseract tesseract-lang`
  - Ubuntu: `apt-get install tesseract-ocr tesseract-ocr-chi-sim`
  - Windows: 从 [GitHub](https://github.com/UB-Mannheim/tesseract/wiki) 下载安装

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd AITestCase/agent-server
```

### 2. 创建虚拟环境

```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### 3. 安装依赖

```bash
# 核心依赖
pip install -r requirements.txt

# 可选：图片 OCR 支持
pip install pytesseract
```

### 4. 配置环境变量

创建 `.env` 文件：

```bash
# 基础配置
USE_CHROMADB=true
USE_QA_SKILL=true
USE_HISTORY_REFERENCE=true

# LLM API 密钥（至少配置一个）
OPENAI_API_KEY=sk-...
# 或
ANTHROPIC_API_KEY=sk-ant-...

# 模型选择
MODEL_NAME=claude-sonnet-4

# 可选：自定义端口
PORT=8000
```

### 5. 启动服务

```bash
uvicorn agent_app.app_factory:app --reload --port 8000
```

### 6. 验证服务

```bash
# 健康检查
curl http://localhost:8000/health

# 预期输出包含：
# {
#   "status": "healthy",
#   "store_type": "ImprovedSessionStore (ChromaDB)",
#   "chroma_stats": {...}
# }
```

---

## Docker 部署

### 1. 创建 Dockerfile

创建 `Dockerfile`:

```dockerfile
FROM python:3.10-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data/chroma_db

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "agent_app.app_factory:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  agent-server:
    build: .
    ports:
      - "8000:8000"
    environment:
      - USE_CHROMADB=true
      - USE_QA_SKILL=true
      - USE_HISTORY_REFERENCE=true
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - MODEL_NAME=claude-sonnet-4
    volumes:
      - ./data:/app/data  # 持久化 ChromaDB 数据
      - ./assets:/app/assets  # 持久化截图等资源
    restart: unless-stopped
```

### 3. 构建并启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 本地开发部署

### 1. 完整安装步骤

```bash
# 1. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install --upgrade pip
pip install -r requirements.txt

# 3. 安装可选依赖（图片 OCR）
brew install tesseract tesseract-lang  # macOS
pip install pytesseract

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 API 密钥

# 5. 初始化 ChromaDB
python scripts/init_chromadb.py  # 可选：预填充测试数据

# 6. 启动开发服务器
uvicorn agent_app.app_factory:app --reload --port 8000
```

### 2. 开发工具

**推荐 VSCode 插件**:
- Python
- Pylance
- Black Formatter
- Docker
- REST Client

**代码格式化**:
```bash
# 安装 black
pip install black

# 格式化代码
black agent_app/ scripts/
```

---

## 生产环境部署

### 1. 性能优化配置

**使用 Gunicorn + Uvicorn Workers**:

```bash
# 安装 gunicorn
pip install gunicorn

# 启动（4 workers）
gunicorn agent_app.app_factory:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

**Systemd 服务配置**:

创建 `/etc/systemd/system/aitestcase.service`:

```ini
[Unit]
Description=AITestCase Agent Server
After=network.target

[Service]
Type=notify
User=aitestcase
WorkingDirectory=/opt/aitestcase/agent-server
Environment="PATH=/opt/aitestcase/venv/bin"
ExecStart=/opt/aitestcase/venv/bin/gunicorn \
  agent_app.app_factory:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable aitestcase
sudo systemctl start aitestcase
sudo systemctl status aitestcase
```

### 2. Nginx 反向代理

创建 `/etc/nginx/sites-available/aitestcase`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;  # 支持大文件上传

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（如需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/aitestcase /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. HTTPS 配置 (Certbot)

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 环境变量配置

### 核心环境变量

| 变量名 | 默认值 | 说明 | 必需 |
|--------|--------|------|------|
| `USE_CHROMADB` | `false` | 启用 ChromaDB 向量数据库 | 推荐 |
| `USE_QA_SKILL` | `true` | 启用 QA Engineer Skill | 可选 |
| `USE_HISTORY_REFERENCE` | `true` | 启用历史用例自动参考 | 可选 |
| `OPENAI_API_KEY` | - | OpenAI API 密钥 | 二选一 |
| `ANTHROPIC_API_KEY` | - | Anthropic API 密钥 | 二选一 |
| `MODEL_NAME` | `gpt-4` | 使用的 LLM 模型 | 可选 |
| `PORT` | `8000` | 服务监听端口 | 可选 |

### LLM 配置

**OpenAI**:
```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选
MODEL_NAME=gpt-4
```

**Anthropic (推荐)**:
```bash
ANTHROPIC_API_KEY=sk-ant-...
MODEL_NAME=claude-sonnet-4
```

**Azure OpenAI**:
```bash
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://<your-resource>.openai.azure.com/
OPENAI_API_VERSION=2023-05-15
MODEL_NAME=gpt-4
```

### ChromaDB 配置

```bash
CHROMA_DB_PATH=./data/chroma_db  # 数据库路径
HF_ENDPOINT=https://hf-mirror.com  # HuggingFace 镜像（中国大陆）
```

---

## 数据持久化

### ChromaDB 数据

**默认存储路径**: `./data/chroma_db/`

**备份方案**:

```bash
# 1. 停止服务
docker-compose down

# 2. 备份数据目录
tar -czf chroma_backup_$(date +%Y%m%d).tar.gz data/chroma_db/

# 3. 恢复备份
tar -xzf chroma_backup_20260128.tar.gz

# 4. 重启服务
docker-compose up -d
```

**定期备份脚本**:

创建 `scripts/backup_chroma.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/chroma"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/chroma_$DATE.tar.gz data/chroma_db/
# 保留最近 7 天的备份
find $BACKUP_DIR -name "chroma_*.tar.gz" -mtime +7 -delete
```

添加到 crontab：

```bash
# 每天凌晨 2 点备份
0 2 * * * /path/to/backup_chroma.sh
```

### 截图资源

**默认存储路径**: `./assets/screenshots/`

截图资源建议定期清理（占用空间较大）：

```bash
# 删除 7 天前的截图
find assets/screenshots/ -name "*.webp" -mtime +7 -delete
```

---

## 监控与日志

### 日志配置

**开发环境**:
```bash
uvicorn agent_app.app_factory:app --reload --log-level debug
```

**生产环境**:
```bash
gunicorn agent_app.app_factory:app \
  --access-logfile /var/log/aitestcase/access.log \
  --error-logfile /var/log/aitestcase/error.log \
  --log-level info
```

### 日志轮转

创建 `/etc/logrotate.d/aitestcase`:

```
/var/log/aitestcase/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 aitestcase aitestcase
    sharedscripts
    postrotate
        systemctl reload aitestcase > /dev/null 2>&1 || true
    endscript
}
```

### 健康检查

**API 端点**: `GET /health`

**监控脚本**:

```bash
#!/bin/bash
HEALTH_URL="http://localhost:8000/health"
RESPONSE=$(curl -s $HEALTH_URL)

if echo "$RESPONSE" | grep -q '"status":"healthy"'; then
    echo "✅ Service is healthy"
    exit 0
else
    echo "❌ Service is unhealthy"
    echo "$RESPONSE"
    exit 1
fi
```

**Prometheus 监控**（可选）:

安装 `prometheus-fastapi-instrumentator`:

```bash
pip install prometheus-fastapi-instrumentator
```

添加到 `app_factory.py`:

```python
from prometheus_fastapi_instrumentator import Instrumentator

# 在 create_app() 中添加
Instrumentator().instrument(app).expose(app)
```

访问 `/metrics` 获取监控指标。

---

## 故障排查

### 常见问题

#### 1. ChromaDB 初始化失败

**错误**: `RuntimeError: ChromaDB is not available`

**解决**:
```bash
pip install chromadb==0.4.22 sentence-transformers==2.3.1 numpy<2.0
```

#### 2. PDF 解析失败

**错误**: `RuntimeError: PDF dependencies not installed`

**解决**:
```bash
pip install pdfplumber PyPDF2
```

#### 3. 图片 OCR 失败

**错误**: `TesseractNotFoundError`

**解决**:
```bash
# macOS
brew install tesseract tesseract-lang

# Ubuntu
sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim

# 验证安装
tesseract --version
```

#### 4. API 调用超时

**错误**: `Request timeout`

**解决**:
- 增加超时配置：`--timeout 180`
- 检查网络连接
- 使用国内 API 中转服务（如 OpenAI）

#### 5. 内存不足

**错误**: `MemoryError` 或 OOM Killer

**解决**:
- 增加系统内存
- 减少 workers 数量
- 限制 ChromaDB 缓存大小

### 调试模式

启用详细日志：

```bash
export LOG_LEVEL=DEBUG
uvicorn agent_app.app_factory:app --log-level debug
```

### 性能分析

使用 `py-spy` 分析性能瓶颈：

```bash
pip install py-spy
py-spy top --pid <PID>
```

---

## 升级指南

### 从旧版本升级

#### 1. 备份数据

```bash
# 备份 ChromaDB
tar -czf chroma_backup.tar.gz data/chroma_db/

# 备份环境变量
cp .env .env.backup
```

#### 2. 拉取新代码

```bash
git pull origin main
```

#### 3. 更新依赖

```bash
pip install --upgrade -r requirements.txt
```

#### 4. 数据迁移（如需要）

```bash
python scripts/migrate_data.py  # 如果有迁移脚本
```

#### 5. 重启服务

```bash
# Docker
docker-compose restart

# Systemd
sudo systemctl restart aitestcase
```

### 版本兼容性

| 功能 | 最低版本 | 推荐版本 |
|------|---------|---------|
| ChromaDB | 0.4.0 | 0.4.22 |
| Python | 3.9 | 3.10+ |
| FastAPI | 0.100 | 最新 |

---

## 附录

### 完整 requirements.txt

```
# Web 框架
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6

# LangGraph
langgraph==0.0.30
langchain==0.1.0

# 向量数据库
chromadb==0.4.22
sentence-transformers==2.3.1
numpy<2.0

# 多模态文件处理
pdfplumber==0.9.0
PyPDF2==3.0.0
Pillow==10.0.0
pytesseract==0.3.10  # 可选

# LLM 客户端
openai  # 可选
anthropic  # 可选

# 其他
python-dotenv==1.0.0
httpx==0.25.0
```

### 环境变量完整示例 (.env)

```bash
# === 核心配置 ===
USE_CHROMADB=true
USE_QA_SKILL=true
USE_HISTORY_REFERENCE=true

# === LLM API ===
# OpenAI (二选一)
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic (推荐)
ANTHROPIC_API_KEY=sk-ant-...

# 模型选择
MODEL_NAME=claude-sonnet-4

# === ChromaDB ===
CHROMA_DB_PATH=./data/chroma_db
HF_ENDPOINT=https://hf-mirror.com

# === 服务配置 ===
PORT=8000
LOG_LEVEL=INFO

# === 可选：限流配置 ===
RATE_LIMIT_PER_MINUTE=60
MAX_UPLOAD_SIZE_MB=50
```

---

**文档版本**: 1.0
**更新日期**: 2026-01-28
**作者**: Claude Code