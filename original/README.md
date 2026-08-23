# 欧洲三国行程网站

这是一个不依赖服务器和第三方库的单页静态网站。行程内容包含每日时间轴、关键取舍、预约、城际交通、应急调整、可勾选检查清单和官方信息入口，不包含酒店推荐或住宿预订章节。

## 本地打开

1. 解压压缩包。
2. 双击 `index.html`。
3. 建议使用最新版 Chrome、Edge、Safari 或 Firefox。

网站可离线阅读。检查清单的勾选状态保存在当前浏览器中；更换设备、使用无痕模式或清除浏览器数据后，进度不会同步。

## 分享方式

### 直接发送文件

把 `index.html` 发送给对方即可。为了避免聊天软件改名或拦截 HTML，也可以直接发送完整 ZIP 压缩包。

### GitHub Pages

1. 新建一个 GitHub 仓库。
2. 把 `index.html` 上传到仓库根目录。
3. 打开仓库 `Settings → Pages`。
4. Source 选择 `Deploy from a branch`，分支选择 `main`，目录选择 `/ (root)`。
5. 保存后等待 GitHub 生成公开网址。

### Netlify

1. 登录 Netlify。
2. 使用 Netlify Drop 或新建站点。
3. 直接上传包含 `index.html` 的文件夹。
4. 部署完成后即可获得公开网址。

### Vercel

1. 新建一个项目并导入包含 `index.html` 的仓库。
2. Framework Preset 选择 `Other`。
3. 不需要 Build Command，输出目录保持根目录。
4. 部署后即可获得公开网址。

## 打印或导出 PDF

点击网站右上角的“打印 / 导出 PDF”，在浏览器打印窗口中选择“另存为 PDF”。打印样式会自动展开每日行程，并隐藏筛选和操作按钮。

## 内容更新

所有行程数据、样式和交互都位于 `index.html` 内。无需安装 Node.js，也不需要运行构建命令。
