# Strom Ampel — 一键发布指南

## 整体架构

```
.\build-and-release.ps1
        │
        ├── 🔨 Step 1: Gradle assembleRelease (本地 build)
        │
        ├── ☁️  Step 2: GitHub Releases 上传 (gh CLI)
        │          └── 覆盖 latest tag → 永久稳定链接不变
        │
        └── 🔲 Step 3: QR 二维码生成 (免费 API)
                   └── 自动打开下载页 + QR 图片
```

## 一次性设置（只需做一次）

### 1. 在 GitHub 上创建仓库
- 去 https://github.com/new
- 名字建议: `strom-ampel-app`
- 选 **Public**（这样手机无需登录就能下载 APK）
- 不要勾选 "Add README"

### 2. 连接本地项目到 GitHub
```powershell
cd "D:\Stock Analysis\StromAmpelApp"
git remote add origin https://github.com/wid1990/strom-ampel-app.git
git push -u origin main
```

### 3. 登录 GitHub CLI
```powershell
gh auth login
# 选择 GitHub.com → HTTPS → Login with browser → 粘贴一次性验证码
```

## 日常使用

### 完整发布（build + 上传 + QR）
```powershell
cd "D:\Stock Analysis\StromAmpelApp"
.\build-and-release.ps1
```

### 只上传（跳过 build，上传上次的 APK）
```powershell
.\build-and-release.ps1 -SkipBuild
```

### 只 build（不上传）
```powershell
.\build-and-release.ps1 -DryRun
```

## 下载链接

| 链接类型 | URL |
|---------|-----|
| **永久稳定链接** (每次覆盖) | `https://github.com/wid1990/strom-ampel-app/releases/latest/download/strom-ampel-latest.apk` |
| Release 页面 | `https://github.com/wid1990/strom-ampel-app/releases/latest` |
| QR 图片 (本地) | `D:\Stock Analysis\StromAmpelApp\qr-latest.png` |

> ⚡ 永久稳定链接每次 build 后自动更新，**这个 URL 永不变**。

## 二维码

QR 码基于永久稳定链接生成，`qr-latest.png` 保存在项目根目录。
你可以把这个 QR 码打印出来，以后每次 build 都自动对应最新版本。

## 手机安装步骤
1. 扫描 QR 码 或 点击稳定链接
2. 浏览器下载 `.apk` 文件
3. 打开文件，点「安装」
4. 若提示"未知来源"，点「允许」→ 再点「安装」

## 成本
- GitHub Free Tier: **完全免费**
- QR API (api.qrserver.com): **完全免费**
- GitHub CLI: **开源免费**
- APK 托管大小限制: 每个文件最大 2 GB（APK 约 65 MB，远低于上限）
