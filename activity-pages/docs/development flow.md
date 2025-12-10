### 1. CDN 缓存刷新

#### 1.1 下载并安装 AWS CLI，[文档](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)（永久性）

1. 下载安装脚本：

```
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

2. 验证安装：

```
which aws
# 输出 /usr/local/bin/aws
aws --version
# 输出 aws-cli/2.27.41 Python/3.11.6 Darwin/23.3.0
```

#### 3.4.2 配置 AWS CLI 令牌（永久性）

1. 找中台伙伴创建账号并获取 AWS Access Key ID 和 AWS Secret Access Key。
2. 配置令牌（Long-term credentials），文档（https://docs.aws.amazon.com/zh_cn/cli/latest/userguide/getting-started-quickstart.html#getting-started-quickstart-new-command）
   配置命令：

```
aws configure
AWS Access Key ID [None]: [AWS Access Key ID]
AWS Secret Access Key [None]: [AWS Secret Access Key]
Default region name [None]: us-west-2
Default output format [None]: json
```

验证配置：

```
aws help
```

#### 3.4.2 刷新正式环境 CDN 缓存

执行刷新命令

```
aws cloudfront create-invalidation --distribution-id E34ATQK1Z3P2Y4 --paths "/app/extension*"
aws cloudfront create-invalidation --distribution-id E34ATQK1Z3P2Y4 --paths "/_nuxt/*"
```

有加入的新页面或者新资源，同样需要刷新CDN缓存
