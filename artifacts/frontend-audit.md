# 前台文件与数据系统性审计报告

**审计对象**：`D:\GitHub-myfiles\portfolio` 前台（不含 admin/、publish/、dist/ 构建产物）
**审计时间**：2026-09-26
**审计范围**：style.css / article.css / main.js / cms-bridge.js / index.html / works.html / data/content.json
**硬约束**：未修改任何源文件（仅临时脚本校验后已删除）。

---

## 0. 先行确认：work.html / about.html 是否存在

用 Glob 搜索根目录 `*.html`：

- 根目录仅有 `index.html`、`works.html` 两个前台页面。
- **`work.html`（作品详情页）不存在。**
- **`about.html`（关于页）不存在。**

但全站链接与 JS 渲染逻辑大量指向这两个不存在的页面 → 确认是死链接 bug，详见下方高风险项。

---

## 1. 问题清单（按严重度排序）

### 【高】【assets/js/cms-bridge.js:152 与 :172】【作品详情页链接全部指向不存在的 work.html】
**问题**：cms-bridge 在渲染作品卡时，给每个图文作品拼了 `href="work.html?id=xxx"`：
```js
var href = 'work.html?id=' + encodeURIComponent(w.id || '');
// 152: works 列表
// 172: works-featured 首页精选
```
**原因**：`work.html` 文件根本不存在（根目录确认）。9 个已发布作品里 8 个是 `kind:"article"`，前台渲染出来全是 `<a href="work.html?id=work-02">…</a>`，用户点任意作品卡都会 404。视频作品（work-01）是 `<div>` 不挂链接，不受影响。
**修复建议**：二选一——
1. 尽快补建 `work.html`（content.schema.json 已为 about/work 预留了字段，style.css:1453-1465 也已写好 `.work-detail` 样式）；
2. 若暂不做详情页，先把链接降级为无跳转：
```js
// cms-bridge.js:152-155 与 172-177 临时修复：
return '<div class="work glass spot" data-cat="' + esc(w.cat) + '" data-tilt>' +
       '<div class="work-thumb">' + inner + '</div>' + body + '</div>';   // 用 div 代替 <a>，去掉 href
```

---

### 【高】【index.html:41,58,137,277,327,357；works.html:38,55,263】【about.html 死链接共 9 处】
**问题**：导航栏、抽屉、按钮、页脚全部链接到不存在的 `about.html`。
| 文件 | 行号 | 上下文 |
|---|---|---|
| index.html | 41 | 顶部导航「关于」 |
| index.html | 58 | 移动端抽屉「关于」 |
| index.html | 137 | About 预览区「完整简历」按钮 |
| index.html | 277 | Experience 区「完整简历与教育背景」按钮 |
| index.html | 327 | Contact 卡片里「完整简历」按钮 |
| index.html | 357 | 页脚 social 图标 |
| works.html | 38 | 顶部导航「关于」 |
| works.html | 55 | 抽屉「关于」 |
| works.html | 263 | 页脚 social 图标 |

**原因**：about.html 未创建，但导航/CTA 早已指向它。content.schema.json 里 `about.cards/profile/education` 数据都填好了，style.css:1396-1451 也写好了 `.info-card/.edu-card` 样式——就差页面本身。
**修复建议**：补建 `about.html`（复用现有 `.info-cards/.edu-cards/.profile` 样式与 cms-bridge 的 `data-cms-list="cards/profile/education"`）；若短期不建，先把这 9 处 `href="about.html"` 临时改成 `href="index.html#contact"` 或 `href="javascript:void(0)"`。

---

### 【高】【data/content.json · work-01.cover】【视频作品封面是 1 小时过期的 R2 预签名 URL】
**问题**：work-01（药灸视，首页精选 + 作品页首卡）的 cover 字段值是：
```
https://42081437bb6b1d6658b1666a951d69cf.r2.cloudflarestorage.com/gerenzhan/yaojiugui-fm.jpg?
  X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Date=20260926T123413Z
  &X-Amz-Expires=3600            ← 有效期仅 3600 秒 = 1 小时
  &X-Amz-Signature=...
```
**原因**：这是 R2（Cloudflare 对象存储）的临时预签名下载链接，`X-Amz-Expires=3600` 意味着从签名时刻（2026-09-26 12:34 UTC）起 1 小时后失效。失效后该封面图会返回 403 Forbidden，前台视频卡封面裂开（cms-bridge.js:65 会渲染 `<img class="facade-img" src="<已过期URL>">`）。
**修复建议**：不要把预签名 URL 存进 content.json。改为：
- 把该图下载到本地 `assets/img/uploads/` 或 `assets/img/remote/`，cover 改填本地相对路径；或
- 在 R2 上把该对象设为公共读（public bucket），用永久 URL；或
- 发布流程里由 server.js/admin 每次导出 content.js 时重新签名长时效 URL（如 Expires=604800），但仍会过期，不推荐。

---

### 【高】【index.html:2 + main.js:14-16】【主题切换 FOUC：light 用户首屏闪黑】
**问题**：HTML 根节点硬编码 `<html data-theme="dark">`（index.html:2、works.html:2），而读取 localStorage / 系统偏好的逻辑在 `main.js`（body 末尾同步脚本，第 14-16 行）才执行：
```js
const stored = localStorage.getItem("gm-theme");
if (stored) root.dataset.theme = stored;
else if (window.matchMedia("(prefers-color-scheme: light)").matches) root.dataset.theme = "light";
```
**原因**：在 main.js 执行前，浏览器已按 `data-theme="dark"` 渲染首屏。对于系统 light 主题用户或上次选了 light 的回访用户，会先看到一屏深色，再被 JS 切白——明显闪烁。
**修复建议**：在 `<head>` 里加一段内联脚本，在样式表加载前就定主题：
```html
<head>
  <script>
    (function(){try{
      var t = localStorage.getItem("gm-theme")
        || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      document.documentElement.dataset.theme = t;
    }catch(e){}})();
  </script>
  ...
</head>
```
同时把 HTML 里硬编码的 `data-theme="dark"` 去掉（交由脚本设置）。

---

### 【中】【data/content.json · home.worksBtnText / worksPage.pageHeroLead；index.html:261；works.html:65】【作品数量文案与实际不符（9 / 10 / 11 三个数字）】
**问题**：
- 实际 `collections.works` 已发布数量 = **9**（脚本实测）。
- CMS 文案 `home.worksBtnText` = "查看全部 **10** 个作品"；`worksPage.pageHeroLead` = "**10** 个项目，按类型筛"。
- 静态 HTML（被 cms-bridge 覆盖前的兜底）index.html:261 写"查看全部 **11** 个作品"，works.html:65 写"**11** 个项目"。

**原因**：作品增删后没有同步改数字。CMS 生效后显示 10，但实际渲染 9 个卡片，用户数出来对不上。
**修复建议**：把 content.json 里两处数字改为 9（或由 cms-bridge 在渲染时自动拼接 `works.length`，见下）：
```js
// cms-bridge.js 渲染后可自动校正按钮文案，避免手改：
var worksCount = items.length;
var btn = document.querySelector('[data-cms-first="home.worksBtnText"]');
if (btn) btn.textContent = '查看全部 ' + worksCount + ' 个作品';
```

---

### 【中】【assets/js/cms-bridge.js:185-187】【空作品列表无空状态兜底】
**问题**：
```js
var arr = get(cfg.path);
if (!Array.isArray(arr)) return;
var items = cfg.filter ? cfg.filter(arr) : arr;
el.innerHTML = items.map(cfg.build).join('');
```
若 `collections.works` 是空数组（或全部被 filter 过滤成 draft），`el.innerHTML = ''` 会把 works.html 里那堆静态占位卡全部清空，留下一片空白网格，没有"暂无作品"提示。
**原因**：只判断了"不是数组就保留静态 HTML"，没判断"数组为空"。
**修复建议**：
```js
if (!Array.isArray(arr)) return;
var items = cfg.filter ? cfg.filter(arr) : arr;
if (!items.length) {
  el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--muted)">作品筹备中，敬请期待…</div>';
  return;
}
el.innerHTML = items.map(cfg.build).join('');
```

---

### 【中】【main.js:276；index.html:323；content.json:90】【联系表单 mailto 指向脱敏占位邮箱】
**问题**：
- main.js:276 提交表单后 `window.location.href = "mailto:361****9@qq.com?..."`
- index.html:323 `<a href="mailto:361****9@qq.com">`
- content.json `contact.email = "361****9@qq.com"`

**原因**：`361****9@qq.com` 是脱敏后的占位字符串，不是真实邮箱。点"发送消息"会调起邮件客户端发到一个不存在/打码的地址，联系表单实际收不到。电话 `188****5140` 同理也是脱敏号。
**说明**：如果这是为了公开仓库防爬虫而故意脱敏、线上部署时再替换成真实邮箱，则属于"预期行为"；但若线上站点也是这个值，则联系功能完全失效。请确认线上 content.js 里是否已替换为真实邮箱。
**修复建议**：上线前在 content.json 填真实邮箱（并在 server.js 部署后做一次 mailto 点击实测）。

---

### 【中】【assets/js/main.js:76】【IntersectionObserver 无特性检测，老浏览器整段 IIFE 中断】
**问题**：
```js
const io = new IntersectionObserver((entries) => {...}, {threshold:0.15, rootMargin:"0px 0px -8% 0px"});
```
**原因**：未做 `if (!('IntersectionObserver' in window))` 兜底。IE11 / 极旧 WebView 下这里直接抛 `ReferenceError`，整个 IIFE 在第 76 行中断——后面的 QR 弹层（282 行）、视频 facade 点击（381 行）、全屏按钮、联系表单全部失效。现代浏览器（Chrome 51+/Safari 12.1+/Firefox 55+）都支持，风险面主要是微信内置旧版本 WebView。
**修复建议**：
```js
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(cb, {threshold:.15, rootMargin:'0px 0px -8% 0px'});
  $$('.reveal, .split').forEach(el => io.observe(el));
} else {
  // 兜底：直接全部显示
  $$('.reveal, .split').forEach(el => el.classList.add('in'));
}
```

---

### 【中】【works.html:111-115】【开发占位文案在 content.js 加载失败时会暴露给访客】
**问题**：静态作品格里硬编码了一张占位卡：
```html
<div class="video-ph">
  <svg ...></svg>
  <b>视频标题 02</b>
  <span>粘贴 B 站 iframe 嵌入代码到此处</span>
</div>
```
**原因**：正常情况下 cms-bridge.js:187 会用 CMS 数据整个替换掉 `[data-cms-list="works"]` 的 innerHTML，这行占位字不会出现。但如果 `assets/js/content.js` 加载失败（404/CDN 故障/缓存损坏），cms-bridge.js:7 `if (!C) return` 直接退出，静态占位卡保留——访客会看到"粘贴 B 站 iframe 嵌入代码到此处"这种开发提示。
**修复建议**：把这张占位卡删掉，或改成正常的"敬请期待"文案，不要带开发指令。

---

### 【低】【index.html:383；works.html:272】【content.js 缺 ?v= 缓存击穿参数】
**问题**：`content.js` 引用为 `<script src="assets/js/content.js"></script>`，没有 `?v=`。而同页其它资源都有（style.css?v=37、cms-bridge.js?v=25、main.js?v=38）。
**原因**：后台每次发布都会重写 content.js（271KB 数据文件），但浏览器/CDN 可能拿旧缓存，导致前台显示过期作品数据。
**修复建议**：发布流程里给 content.js 也加版本号，例如 `<script src="assets/js/content.js?v=20260926"></script>`，与 cms-bridge/main.js 同步 bump。

---

### 【低】【assets/js/main.js:397】【外链 rel 缺 noreferrer】
**问题**：跳转抖音/视频号时 `ext.rel = "noopener"`，没带 `noreferrer`。
**原因**：虽然 `<meta name="referrer" content="no-referrer">`（index.html:4）已全局兜底，但按安全规范外链应写全。
**修复建议**：`ext.rel = "noopener noreferrer";`

---

### 【低】【assets/js/main.js:108-117；style.css:395,1278-1279】【汉堡菜单/抽屉为死代码】
**问题**：main.js 绑定了 burger 点击切 drawer，但 CSS 里 `.burger { display:none; }`（395 行默认）且 `@media (max-width:900px){ .burger{display:none} .drawer{display:none} }`（1278-1279 行）——汉堡按钮在所有断点都不显示，抽屉在小屏 display:none、桌面屏 opacity:0。
**原因**：当前移动端导航方案是 nav-links 内联常显（≤900px 时压缩字号 padding），不用抽屉。burger/drawer 相关 JS/CSS 保留但永不触发。
**影响**：非 bug，仅是死代码。注意 ≤560px 时导航 4 个链接 + logo + 2 个图标按钮在 360px 宽屏上可能拥挤，建议真机验证。
**修复建议**：可保留（未来可能切回抽屉模式），或删除 burger/drawer 的 HTML+CSS+JS 以减负。

---

### 【低】【assets/css/article.css 未被前台引用】
**问题**：article.css（5KB，作品正文排版）在 index.html / works.html 均未 `<link>`。
**原因**：它是给 work.html 详情页和 admin 实时预览用的。当前 work.html 不存在，所以前台不加载它——无功能问题。
**备注**：等 work.html 建好后需在该页 `<head>` 加 `<link rel="stylesheet" href="assets/css/article.css">`。

---

### 【低】【assets/css/style.css:1178-1232, 1396-1465】【.wd-* / .work-detail / .info-card / .edu-card 选择器当前无对应页面】
**问题**：分享面板 `.wd-share*`、作品详情 `.work-detail/.wd-*`、关于页 `.info-card/.edu-card` 等样式约 130 行，当前 index/works 两页用不到。
**原因**：都是为尚未创建的 work.html / about.html 预留的（与 cms-bridge 的 cards/profile/education LISTS 对应）。
**影响**：非 bug，约 4-5KB 死 CSS，可接受。等对应页面落地后自然生效。

---

### 【低】【data/content.json · collections.works】【作品 ID 跳号：缺 work-03】
**问题**：9 个作品的 id 序列为 work-01, 02, 04, 05, 06, 07, 08, 09, 10 —— **没有 work-03**。
**原因**：work-03 曾被删除，ID 不复用。无重复 ID（脚本已校验），分类引用一致，不影响功能。
**备注**：仅作记录，无需修复。

---

### 【低】【data/content.json · work-08】【小程序作品分类与静态标签不一致】
**问题**：work-08「小程序运营与维护」在 CMS 里 `cat="design"`，前台渲染 tag 会显示 `TAG_LABEL["design"]="Design"`（cms-bridge.js:50,147）；但 works.html 静态占位卡（205 行）原来写的是 `<span class="tag">Mini App</span>`。
**原因**：cms-bridge 生效后静态占位被替换，tag 统一为 "Design"。若希望小程序单独分类，需在 categories 里加一个 key（如 `miniapp`）并把 work-08 的 cat 改过去。
**影响**：纯文案标签，不影响功能。

---

## 2. content.json 图片路径检查表

本地相对路径逐个 `fs.existsSync` 校验（远程 R2 URL 跳过）：

| 作品 ID | cover 路径 | 类型 | 结果 |
|---|---|---|---|
| work-01 药灸视 | `https://…r2.cloudflarestorage.com/…yaojiugui-fm.jpg` | 远程预签名 | ⚠️ 1h 后过期（见高风险项 3） |
| work-02 企业全国会统筹 | `assets/img/work-01.svg` | 本地 | ✅ 存在 |
| work-04 公众号内容矩阵 | `assets/img/work-03.svg` | 本地 | ✅ 存在 |
| work-05 AI 视觉化策划方案 | `assets/img/work-04.svg` | 本地 | ✅ 存在 |
| work-06 品牌课程包装与推广 | `assets/img/work-02.svg` | 本地 | ✅ 存在 |
| work-07 会议物料与海报设计 | `assets/img/work-05.svg` | 本地 | ✅ 存在 |
| work-08 小程序运营与维护 | `assets/img/work-06.svg` | 本地 | ✅ 存在 |
| work-09 终端门店营销活动策划 | `assets/img/work-02.svg` | 本地 | ✅ 存在 |
| work-10 会务现场摄影与快剪 | `assets/img/work-03.svg` | 本地 | ✅ 存在 |
| (全局) home.avatar | `assets/img/avatar.jpg` | 本地 | ✅ 存在 |
| (全局) about.avatar | `assets/img/avatar.jpg` | 本地 | ✅ 存在 |
| (全局) contact.wechatQr | `assets/img/wechat-qr.png` | 本地 | ✅ 存在 |

**汇总**：本地图片引用共 **11 个，全部存在，0 缺失**；远程 URL 1 个（R2 预签名，有时效风险）。

---

## 3. 各模块检查结论（已检查无问题项）

| 模块 | 结论 |
|---|---|
| **JSON 有效性** | ✅ `JSON.parse` 通过，无语法错误 |
| **分类 ID 引用一致性** | ✅ 9 个作品的 cat（event/copy/design/video/ai）全部能在 `categories[].key` 中找到 |
| **重复 ID** | ✅ works/skills/timeline/services/education/about.cards 均无重复 id |
| **字段完整性** | ✅ 每个作品都有 id/title/cat/kind/order/status/tags；desc 无空串；非视频作品 cover 无空串 |
| **content.schema.json** | ✅ 根目录存在，是内容模型示例（非 JSON Schema 校验器），结构与 content.json 对得上 |
| **content.js 与 content.json 同步** | ✅ 脚本解析 content.js 中 `window.SITE_CONTENT`，works 数量 9=9，作品 id/title 集合完全一致 |
| **.filters 吸顶栏** | ✅ style.css:756-770 有 `position:sticky; top:var(--nav-h-stuck); z-index:750`；works.html:72 有 `.filters` DOM；层级 750 < nav 800，不遮挡；当前 works.html **已包含**吸顶代码（不是缺失项） |
| **dark/light CSS 变量** | ✅ `:root` 与 `[data-theme="light"]` 成对覆盖了 --bg/--bg-soft/--text/--muted/--glass/--glass-2/--border/--border-strong/--shadow，无遗漏；强调色 --a1~a4 双主题共享合理 |
| **reveal 滚动动画** | ✅ IO 配置 threshold:0.15 + rootMargin:-8%，触发后 unobserve 只播一次；`.reveal.in` 终态 opacity:1；reduce-motion 媒体查询已降级（style.css:1338） |
| **微信二维码弹层** | ✅ .qr-modal z-index:1200 最高；遮罩/关闭按钮/Escape 键三重重关（main.js:288-299）；打开时 body overflow:hidden；二维码白底保证扫码 |
| **视频播放区** | ✅ B站 iframe 点击 facade 才注入（main.js:381-435），不自动加载；`.video-slot` aspect-ratio:16/9 响应式；mp4 直链走原生 `<video>`；抖音/视频号走新窗口跳转；播放中清 backdrop-filter/transform 避免全屏卡顿 |
| **分享面板 .wd-share** | ⚠️ 样式存在（style.css:1178-1232）但当前页面无对应 DOM（为 work.html 预留），无适配问题 |
| **移动端导航** | ✅ 断点 1180/900/700/560 齐全；viewport meta 正确；nav-links ≤900px 内联常显；触控热区 ≥44px（--touch） |
| **CSS !important** | ✅ 仅 4 处（is-playing 1156-1157、隐藏装饰 1163、fs-btn 1164、reduce-motion 1339），均为覆盖第三方/祖先滤镜的必要场景，无滥用 |
| **外链/iframe 安全** | ✅ B站 iframe 带 `allow="fullscreen; autoplay; encrypted-media; picture-in-picture"`；meta referrer=no-referrer；ext 跳转链 noopener（仅缺 noreferrer，见低风险项） |
| **meta/SEO** | ✅ viewport/description/title/favicon 齐全；cms-bridge.js:36-45 按页面覆盖 SEO title/description |
| **空数据兜底**（CMS 单值） | ✅ cms-bridge.js:22/24 空值跳过保留原 HTML，不会把页面改白 |
| **fetch/API 错误处理** | ✅ 前台不走 fetch，直接读 `window.SITE_CONTENT`（content.js 同步脚本）；content.js 缺失时 cms-bridge.js:7 静默退出，页面用静态 HTML 兜底 |

---

## 4. 修复优先级建议

1. **立即处理**：高风险项 3（R2 预签名封面 1 小时后必裂）、高风险项 4（FOUC 内联脚本）。
2. **本周内**：高风险项 1+2（补 work.html / about.html，或先把死链接降级）；中风险项 5（数量文案）。
3. **排期处理**：中风险项 6-9（空状态兜底、IO 降级、占位文案、mailto 真实邮箱确认）。
4. **可缓**：低风险项 10-16。
