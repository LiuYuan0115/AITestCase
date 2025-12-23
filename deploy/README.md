# ai-testcase Cloud Run 部署脚本

# 构建&&推送 nginx

> 如果你没修改nginx配置，不需要重新推送

```bash
cd deploy/nginx;
make build_docker # 构建docker容器
make push_docker # 推送docker容器
```

# 构建&&推送 agent-server

> 每次修改代码的推送，都应该执行该步骤

```bash
cd deploy/agent-server;
make build_docker # 构建docker容器
make push_docker # 推送docker容器
```

# 部署 Cloud Run

> 部署前，先修改一下`deploy/service.yaml` 的环境变量，记得部署后，修改回来,防止密钥提交到代码仓库

```bash
cd deploy;
make deploy # 部署 Cloud Run
```
