# Solvely Plugin Config

## 上线步骤

1. 更新文件提交 MR 到 main 分支。
2. 入库后到 s3 更新文件：s3://solve-now/web-static/json/plugin-config.json
3. 刷新 CDN 缓存：`aws cloudfront create-invalidation --distribution-id EKOO9YTWJFIYU --paths "/web-static/json/plugin-config.json"`
4. 线上地址验证：https://static.justsolvely.com/web-static/json/plugin-config.json

**注意：正式上线前请先更新 `plugin-config-test.json` 文件测试。**

## AB 实验

| ID | 描述 | 更新记录 |
| :-- | :-- | :-- |
| TEST_S_Plugin_OneSolve | Web 一键解题实验 | 2025.08.22 增加配置文件 |

## 更新日志

### 2025.11.20

- 挽留弹窗实验 TEST_Plugin_QuaterPackage_Recall 全量。

### 2025.11.14

- 多模型和浮层实验全量 & 删除无用的实验配置。

### 2025.11.13

- 新增了 canvasCapture 配置。

### 2025.11.06

- 新增了挽留弹窗实验 TEST_Plugin_QuaterPackage_Recall。
- 新增了多模型配置项.

### 2025.10.30

- 新增多模型配置 & TEST_Plugin_MutiModel_Panel 实验。

### 2025.10.27

- TEST_Plugin_2Solves 实验全量，TEST_Plugin_SearchWord 实验下线。

### 2025.10.25

- 新增多模型配置。
- 新增 TEST_Plugin_MutiModel 实验。

### 2025.10.18

- 新增 TEST_Plugin_2Solves 实验。
- 移除已全量的 TEST_S_Plugin_OneSolve 实验。

### 2025.10.17

- TEST_Plugin_Onboarding、TEST_Plugin_Language、TEST_Plugin_Weblogin 三个实验全量。

### 2025.10.16

- 新增插件搜索引导相关配置。
- 新增 TEST_Plugin_SearchWord 实验。

### 2025.10.10

- 新增 TEST_Plugin_Algorithm 实验。

### 2025.10.06

- TEST_Plugin_MutipleModel 和 TEST_Plugin_Reanswer 实验暂停。
- 新增 3 个新用户实验：TEST_Plugin_Language、TEST_Plugin_QuaterPackage、TEST_Plugin_Weblogin。

### 2025.09.24

- 商业化划线实验全量，TEST_Plugin_Pricetest:Strikethrough。
- 引用实验全量，TEST_Plugin_QuoteAsk:Test。
- 新增新版 Onboarding 实验 TEST_Plugin_Onboarding。

### 2025.09.13

插件 0.4.0 版本

- 新增了 [TEST_Plugin_MutipleModel 实验和 TEST_Plugin_Reanswer 实验](https://pf6xrzskv9.feishu.cn/wiki/MCTfwFqr2iVORKkM4bDca4denHg)。
- 新增了多模型的 icon 和文案的配置。

### 2025.09.10

插件 0.3.9 新增了 TEST_Plugin_QuoteAsk 实验。

### 2025.09.02

[新增9.1插件&web次数和划线价格实验](https://pf6xrzskv9.feishu.cn/wiki/Q0n3wPignidRZLkIEfFc1VGKnxd)

### 2025.09.02

一键解题实验全量。

### 2025.08.22

配置文件新增 AB 实验配置项。

### 2025.08.21

创建仓库，同步线上文件。