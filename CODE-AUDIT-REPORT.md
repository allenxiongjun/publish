# 作品集网站代码审计报告

**审计日期**：2026-09-26
**审计范围**：server.js / admin/admin.js / admin/rte.js / admin/app.html / admin/admin.css / assets/css/style.css / assets/css/article.css / assets/js/main.js / assets/js/cms-bridge.js / index.html / works.html / data/content.json
**审计方式**：全部 JS 通过 `node --check` 语法校验；逐文件完整通读；content.json 用 node 解析 + 脚本批量校验图片路径/分类引用/重复 ID
**硬约束**：未修改任何源文件，仅输出本报告

---

## 总览

| 严重度 | 数量 | 关键项 |
|--------|------|--------|
| 🔴 高 | 11 | 静态托管可越权读密码、批量删除假删、保存失败仍发布旧内容、图片字段静默丢值、编辑器误替换回调、两个页面文件缺失致全站死链、R2 预签名封面 1h 过期、主题首屏闪黑 |
| 🟡 中 | 22 | SSRF 重定向绕过、publish 非原子、CSS 变量未定义、编辑器撤销丢批/颜色刷爆栈/监听器泄漏、作品数量文案三处不一致、空列表无兜底 |
| 🟢 低 | 30+ | JSON.parse 缺 try/catch、死代码、SMIL 语法、缓存参数、样式细节等 |

---

## 🔴 高风险（11 项，附修复代码）

### H1. 静态托管 `data/` 拦截大小写敏感，Windows 下可绕过读取密码哈希
- **文件**：server.js:436
- **问题**：`rel.split('/').includes('data')` 用精确小写段匹配，NTFS 大小写不敏感。请求 `/DATA/users.json` 或 `/Data/INIT-PASSWORD.txt` 不命中拦截，却能实际打开 `data\` 下文件，泄露 scrypt 密码哈希和初始明文密码。
- **修复**（替换 L436 附近的 data 拦截）：
```js
const SENSITIVE_DIRS = new Set(['data', '.git', 'publish', 'node_modules']);
const relSegs = rel.split('/').filter(Boolean).map(s => s.toLowerCase());
if (relSegs.some(s => SENSITIVE_DIRS.has(s))) {
  res.writeHead(403).end('Forbidden'); return;
}
```

### H2. `full.startsWith(ROOT)` 前缀判断可被兄弟目录同名前缀绕过
- **文件**：server.js:435
- **问题**：`D:\GitHub-myfiles\portfolio-secret\flag.txt` 字符串上以 `...\portfolio` 开头，绕过 403 读到 ROOT 外的兄弟目录文件。
- **修复**（替换 L435）：
```js
const rootBase = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
if (full !== ROOT && !full.startsWith(rootBase)) {
  res.writeHead(403).end('Forbidden'); return;
}
```

### H3. 批量删除只打 `_del` 标记，并未真正删除
- **文件**：admin/admin.js:418
- **问题**：`bDel.onclick = () => applyBatch((w) => { w._del = true; }, ...)` 只加标记从不 splice；`worksSorted()`(L371) 和 `renderWorksList()`(L383) 都没按 `_del` 过滤。弹完"批量操作完成"后被勾选项原样还在列表里。单条删除 L502 `arr.splice(i,1)` 是对的，唯独批量是坏的。
- **修复**（替换 L418 整个 bDel.onclick）：
```js
bDel.onclick = () => {
  if (!WK.checked.size) { toast('先勾选要操作的作品', 'bad'); return; }
  if (!confirm('确定删除选中的 ' + WK.checked.size + ' 个作品？删除后不可恢复。')) return;
  const arr = worksAll();
  [...WK.checked].sort((a, b) => b - a).forEach(i => arr.splice(i, 1));
  WK.checked.clear(); markDirty(); renderWorksList();
  toast('已删除（记得点保存）');
};
```

### H4. `doPublish` 在 `save()` 失败后仍继续发布旧内容
- **文件**：admin/admin.js:745-751 + 782-790
- **问题**：`save()` 内部 catch 后只 toast、不 rethrow，`await save()` 永远 resolve。保存失败时 `doPublish` 仍 POST `/publish`，把磁盘上**旧的** content 发布出去。
- **修复**：
```js
// save() 末尾 catch 改为 return false：
async function save() {
  try {
    await localizeRemoteImages();
    const j = await api('/api/admin/content', { method:'PUT', body: JSON.stringify(CONTENT) });
    dirty = false;
    $('#saved-at').textContent = '已保存 ' + new Date(j.updatedAt).toLocaleString('zh-CN');
    toast('已保存'); return true;
  } catch (e) { toast('保存失败：' + e.message, 'bad'); return false; }
}
// doPublish 开头加判断：
async function doPublish() {
  if (!await save()) { toast('保存未成功，已取消发布', 'bad'); return; }
  // ...原 publish 逻辑
}
```

### H5. 图片字段外层 change 监听被内层文本框冒泡触发，把地址静默覆盖成 `undefined`
- **文件**：admin/admin.js:189-193 + 207
- **问题**：`renderFields` 里 `input = buildImageField(f)` 返回的是容器 `div`，L189 又给 div 挂 change 监听 `setPath(CONTENT, f.p, input.value)`——div 没有 `.value`，是 `undefined`。用户直接在可见文本框改 URL 后失焦，内层(L207)先写对值，change 冒泡到 div，外层立刻把它冲成 `undefined`。只有"直接编辑文本框"路径中招，但一旦触发就是静默丢数据。
- **修复**（替换 L189 的 change 监听）：
```js
input.addEventListener('change', () => {
  if (f.t === 'image') return;   // buildImageField 内部已自行 setV + markDirty
  if (f.t === 'lines') setPath(CONTENT, f.p, input.value.split('\n').map(s => s.trim()).filter(Boolean));
  else setPath(CONTENT, f.p, input.value);
  markDirty();
});
```

### H6. 编辑器 `imgCb` 闭包残留，"插入图片"误触发上一次的替换回调
- **文件**：admin/rte.js:949, 951, 1570
- **问题**：`upImg` 的 change 处理器调用 `imgCb && imgCb(url)` 后没有把 `imgCb` 置空。工具栏"插入图片"按钮点击时不设置 imgCb。复现：点图替换→"替换图片"→文件框**取消**（change 不触发，imgCb 残留）→再点工具栏"插入图片"选本地图→change 触发残留 doReplace，把上一张 SVG/img 替换掉而不是插入新图。
- **修复**：
```js
upImg.addEventListener('change', async () => {
  const f = upImg.files[0]; upImg.value = '';
  if (!f) return;
  const cb = imgCb; imgCb = null;
  try { const url = await window.__uploadImage(f); cb && cb(url); }
  catch (err) { alert('图片上传失败：' + err.message); }
});
// 工具栏插入图片按钮显式设置 imgCb：
const imgBtn = btn('插入图片', '&#128247;', () => {
  imgCb = (url) => insert('<p style="text-align:center;margin:18px 0"><img src="' + url + '" referrerpolicy="no-referrer" style="max-width:100%;border-radius:12px"></p>');
  upImg.click();
});
```

### H7. 编辑器"变换组件"模式对秀米画布内的块静默失效，且 `replaceMode` 不复位
- **文件**：admin/rte.js:179-188
- **问题**：替换分支条件 `replaceMode && curBlock && curBlock.parentNode === editor`，但秀米内容全在 `.xiumi-canvas` 里，块的 parentNode 是 canvas 不是 editor。结果变换组件不替换、走普通插入；且 `replaceMode=false` 只在替换分支执行，走普通插入后 replaceMode 仍为 true，下一次 insert 会意外替换当前块。
- **修复**：
```js
function insert(html) {
  if (replaceMode && curBlock && curBlock.isConnected && editor.contains(curBlock)) {
    /* …原替换逻辑… */
    replaceMode = false;
    return;
  }
  replaceMode = false;   // 所有非替换路径都复位
  /* …原插入逻辑… */
}
```

### H8. 作品详情页 `work.html` 不存在，8/9 作品卡全部死链
- **文件**：assets/js/cms-bridge.js:152, 172
- **问题**：cms-bridge 渲染作品卡时拼 `href="work.html?id=xxx"`，但根目录无 work.html。9 个作品中 8 个是 `kind:"article"`，点任意作品卡都 404。style.css:1453 已预留 `.work-detail` 样式，article.css 也已就绪，就差页面本身。
- **修复**：补建 work.html（参考 style.css 的 `.work-detail` / article.css 结构）；或临时把 `<a>` 降级为 `<div>` 去掉 href。

### H9. `about.html` 不存在，全站 9 处导航死链
- **文件**：index.html:41,58,137,277,327,357；works.html:38,55,263
- **问题**：导航栏/抽屉/按钮/页脚共 9 处链接到不存在的 about.html。content.schema.json 的 about 数据和 style.css:1396-1451 的 `.info-card/.edu-card` 样式都已就绪。
- **修复**：补建 about.html；或临时把 `href="about.html"` 改成 `href="index.html#contact"`。

### H10. work-01 封面是 1 小时过期的 R2 预签名 URL
- **文件**：data/content.json · work-01.cover
- **问题**：封面存的是 `https://….r2.cloudflarestorage.com/…?X-Amz-Expires=3600&X-Amz-Date=20260926T123413Z…`，1 小时后 403，首页精选和作品页首卡封面裂开。
- **修复**：把图片下载到本地 `assets/img/uploads/`，或 R2 bucket 设公共读，content.json 里存永久 URL，不要存预签名链接。

### H11. 主题切换 FOUC：light 用户首屏闪黑
- **文件**：index.html:2 + assets/js/main.js:14-16
- **问题**：HTML 硬编码 `<html data-theme="dark">`，主题读取在 body 末尾的 main.js。light 偏好用户先看到一屏深色再被切白。
- **修复**（在 `<head>` 加内联脚本，放在 CSS 之前）：
```html
<script>(function(){try{var t=localStorage.getItem("gm-theme")||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=t;}catch(e){}})();</script>
```

---

## 🟡 中风险（22 项）

### 后端 server.js

| # | 文件:行号 | 问题 | 修复方向 |
|---|-----------|------|----------|
| M1 | server.js:411-414 | remote-fetch 跟随重定向不二次校验，SSRF 绕过（302 到 169.254.169.254/127.0.0.1 不再校验） | 改 `redirect:'manual'` 手动跳，每跳重新走 REMOTE_HOST_RE 校验 |
| M2 | server.js:416 | remote-fetch 先 arrayBuffer 全量入内存再判大小，超大响应可 OOM | 改 reader 流式累加，超 8MB 即 cancel |
| M3 | server.js:347-371 | publish() 先删后拷非原子，中途崩溃留空目录 | 先拷到 `*.tmp` 再 rename 原子切换 |
| M4 | server.js:431-451 | 静态托管未屏蔽 `.git` / `publish/`，`/.git/config` 可下载泄露仓库信息 | 用 H1 的 SENSITIVE_DIRS 统一拦截 |

### 后台 admin.js / admin.css

| # | 文件:行号 | 问题 | 修复方向 |
|---|-----------|------|----------|
| M5 | admin.css:92,100,101,119,120,122,128,137 | CSS 变量 `--border` 从未定义，作品表格/富文本边框全部不渲染（`:root` 只有 `--line`） | `:root` 加 `--border: var(--line);` |
| M6 | admin.js:842,844,782,745 | 保存/发布按钮无 loading/防连点，快速双击产生并发写竞态 | 加 `saving` 标志 + 按钮 disabled + "保存中…"文案 |
| M7 | admin.js:474,413,502 | 批量勾选存数组下标，单条删除 splice 后下标错位，误操作别的作品 | 改用作品 `id` 作 key（`WK.checked.add(w.id)`） |
| M8 | admin.js:784,760-781 | 单张图床图片本地化失败会阻断整个保存（一 reject 就冒泡到 save catch） | 本地化包 try/catch，失败只 warn 仍继续保存正文 |
| M9 | admin.js:318-329 | `renderList` 的 `f.t==='image'` 分支仍是旧版单文件上传，与 `buildImageField` 双按钮不一致 | 该分支直接复用 `buildImageField({get,set})` |
| M10 | admin.css:101 | 作品表格七列固定栅格无小屏断点，`.wk-table` overflow:hidden，窄屏操作列被裁 | 加 `@media (max-width:720px){ .wk-table{overflow-x:auto} .wk-tr{min-width:680px} }` |

### 编辑器 rte.js

| # | 文件:行号 | 问题 | 修复方向 |
|---|-----------|------|----------|
| M11 | rte.js:556-560 + 469-477 | 每次 keyup 都 `hidePanel()`，样式面板在打字时立即关闭 | keyup 里只更新高亮/操作条，不再强制 hidePanel |
| M12 | rte.js:82,94-95 | undo 前未 flush 420ms 防抖快照，连打后立即 Ctrl+Z 会丢一批输入 | undo/redo 开头先 `clearTimeout(debSnap); snapshot(false);` |
| M13 | rte.js:732,773,807,619-623 | 颜色选择器拖动每帧 push 全量快照，撤销栈被刷爆（`<input type=color>` 每秒 10+ 次 input） | 颜色 input 时只 `emitThrottled()`，`change` 时才 `snapshot(true)` |
| M14 | rte.js:1044-1069 | openRemoteInput 位置不跟随滚动、无 URL 校验（不判 http(s)）、无取消/Esc | 加 scroll/resize 监听重定位；确定时校验 `^https?:`；加 Esc 关闭 |
| M15 | rte.js:26,618,637 | `curPanel` 是只写状态变量，声明+赋值但全文从未读取，死状态 | 删除 curPanel 相关代码 |
| M16 | rte.js:891-903,835,924 | 主题换色覆盖面不全：只改 `getAttribute('style')` 不碰粘贴的 `<style>` 块；"应用到全文"用 `[...editor.children]` 漏掉 `.xiumi-canvas` 嵌套块 | 补 `querySelectorAll('style')` 遍历；全文应用改 `editor.querySelectorAll('section,div,p,…')` |
| M17 | rte.js:267 | `xlink:href="javascript:…"` 未被清洗（属性过滤只判 href/src，SVG 的 xlink:href 小写后不命中），残留 XSS 面 | 条件加 `\|\| nm==='xlink:href'` |
| M18 | rte.js:561,562,611,845,846 | document/window 级监听器只加不删，无 destroy()，SPA 重建 RTE 时旧闭包泄漏 | return 里补 `destroy()`，selectionchange 回调提为具名函数 |

### 前台 / 数据

| # | 文件:行号 | 问题 | 修复方向 |
|---|-----------|------|----------|
| M19 | content.json · home.worksBtnText / worksPage.pageHeroLead；index.html:261；works.html:65 | 作品数量文案三处不一致：实际 9 个，CMS 写"10 个"，静态 HTML 写"11 个" | 统一改为 9，或 cms-bridge 渲染时自动拼 `items.length` |
| M20 | cms-bridge.js:185-187 | 空作品列表无空状态兜底，空数组时 `innerHTML=''` 留空白网格 | 加 `if(!items.length){ el.innerHTML='<div>作品筹备中…</div>'; return; }` |
| M21 | main.js:276；index.html:323；content.json:90 | mailto 指向脱敏占位邮箱 `361****9@qq.com`，联系表单实际发不到 | 确认线上 content.js 是否已替换真实邮箱 |
| M22 | main.js:76 | IntersectionObserver 无特性检测，老浏览器抛错导致整个 IIFE 中断，QR 弹层/视频/表单全失效 | 加 `if ('IntersectionObserver' in window)` 兜底，不支持时直接给 `.reveal` 加 `.in` |
| M23 | works.html:111-115 | 开发占位文案"粘贴 B 站 iframe 嵌入代码到此处"会在 content.js 加载失败时暴露给访客 | 删掉占位卡或改成"敬请期待" |

---

## 🟢 低风险（30+ 项，按文件分组）

### server.js
- **L470,515,546,553,570**：多处 `JSON.parse` 未 try/catch，非法 JSON 直接 500（与 L531-533 的 content PUT 不一致）
- **L478-479**：登录用户名枚举时序侧信道（用户不存在时短路不跑 scrypt），可加 dummy scrypt 恒定时间
- **L584**：HEAD 请求仍 pipe 响应体，应写完 headers 后 `if (req.method==='HEAD') return res.end()`
- **L143**：sessions Map 只在访问时清理过期项，永不被访问的过期 sid 永久驻留
- **全局**：缺 `uncaughtException`/`unhandledRejection` 兜底

### admin.js / admin.css
- **admin.css:154**：`content:/▾/` 是非法 CSS（应为 `content:'▾'`），折叠头下拉箭头不显示
- **admin.css:76 / admin.js:807**：Modal 缺遮罩点击关闭、ESC 关闭、背景滚动锁定
- **admin.css:83-84**：`.toast.warn` 无样式（L776 用过 warn）
- **admin.css:35**：`.btn:disabled` 无视觉态
- **admin.js:570-591**：分类不校验重名
- **admin.js:194**：死代码三元，两分支相同
- **admin.js:53**：`compress()` 一律输出 JPEG，透明 PNG 变黑底
- **admin.js:673,681**：预览 iframe `srcdoc` 无 `sandbox`
- **admin.js:539**：`catsAll()` 读取时静默写 fallback 不 markDirty
- **admin.js:406-419**："批量移动分类"按钮缺失（功能缺口）
- **admin.js:859**：首次 `load()` 失败是 unhandled rejection，页面空壳无提示
- **admin.css:52-53**：`.field-row` 类未被使用，死样式
- **admin.js:813**：Modal 异步 OK 期间可重复点击提交
- **admin.js:817-825**：改密码无前端长度校验
- **admin.js:677-683**：预览防抖 timer 离开编辑器未 clear

### rte.js
- **L94-95**：undo/redo 边界回退原生 execCommand，与自维护 hist 栈脱钩
- **L1437**：`tidyEmptySlots` 定义后从未调用，死代码
- **L289,1817**：SMIL begin 用空格拼接（`touchstart click`），规范要求分号
- **L1094**：图集缩略图无 onerror，外链失效只显示灰块
- **L372,1277**：localStorage `JSON.parse` 无 try/catch
- **L879,883**：hex 正则无词边界，`#7c5cff00`（8 位带 alpha）会被半截替换

### 前台 / 数据
- **index.html:383；works.html:272**：content.js 缺 `?v=` 缓存参数，发布后可能命中旧缓存
- **main.js:397**：外链 rel 缺 noreferrer（meta referrer 已兜底）
- **main.js:108-117；style.css:395,1278-1279**：汉堡菜单/抽屉为死代码（所有断点 display:none）
- **article.css**：未被前台引用（work.html 不存在），建详情页后需补 `<link>`
- **style.css:1178-1232,1396-1465**：`.wd-*` / `.work-detail` / `.info-card` / `.edu-card` 约 130 行 CSS 当前无对应页面（为预留）
- **content.json · works**：作品 ID 跳号缺 work-03（无重复，不影响功能）
- **content.json · work-08**：小程序作品 cat=design 渲染 tag 为 "Design"，如需独立分类可在 categories 加 key

---

## 已检查、确认无问题的模块

| 模块 | 结论 |
|------|------|
| server.js · serveStatic `../`/编码绕过/双重编码 | 正确解析拦截，无目录列表 |
| server.js · MIME 类型 | 扩展名映射 + nosniff，未知回 octet-stream |
| server.js · /api/admin/upload | 12MB 体上限 + 5MB 单图 + magic bytes + 随机文件名 + 固定目录，无重大问题 |
| server.js · publish() rm 目标边界 | 受限在 publish/ 内，不误删项目文件 |
| server.js · 登录鉴权 | scrypt 盐哈希 + timingSafeEqual + HttpOnly+SameSite=Lax + 统一鉴权门 + 失败锁定，设计良好 |
| server.js · CORS/Origin | 不发 ACAO、写操作白名单 Origin、不反射任意 Origin |
| server.js · content.json 写入 | .tmp + rename 原子写，错误不泄 stack，监听 127.0.0.1 |
| admin.js · buildImageField 双按钮 | 事件绑定/状态同步/图床校验/syncAll 刷新正确 |
| admin.js · 回滚状态机 | confirm→POST→load() 重渲染→dirty 复位，UI 同步 |
| admin.js · 分类删除 | 作品自动归入第一个分类 + toast 移动数量，空分类有拦截 |
| admin.js · api() 错误处理 | 401 跳登录、非 200 抛 err+details、JSON 失败兜底，完整 |
| admin.js · dirty 四件套 | markDirty/切区确认/重载确认/beforeunload 齐全 |
| admin.js · XSS | 用户内容全部走 textContent，无 innerHTML 注入 |
| rte.js · SVG 图替换 emit/snapshot | doReplace 两个都调了，无遗漏 |
| rte.js · redo 栈清理 | hist.length = histIdx+1 正确清空 redo 尾，HIST_MAX=120 超限 shift |
| rte.js · 动态监听器配对清理 | 布局拖拽/工具条拖拽/图集拖拽/openRemoteInput onDoc 均在结束时 remove |
| rte.js · 全局污染 | 全部在 createRTE 闭包内 + 'use strict'，无隐式全局 |
| rte.js · 粘贴脚本注入 | script/on*/javascript: 均被清洗（除 M17 的 xlink:href 缺口） |
| rte.js · openGalleryPanel 遍历 | 按 src 去重、同 src 缩略图+大图一起改、有兜底分支 |
| content.json · JSON 有效性 | JSON.parse 通过 |
| content.json · 分类 ID 一致性 | 9 个作品 cat 全部在 categories 中 |
| content.json · 重复 ID | 全集合无重复 |
| content.json · 字段完整性 | 每个作品 id/title/cat/kind/order/status/tags 齐全，desc/cover 无空串 |
| content.json · 本地图片路径 | 11 个本地引用全部存在，0 缺失 |
| content.js 与 content.json 同步 | 9=9，id/title 集合完全一致 |
| style.css · .filters 吸顶栏 | sticky + z-index:750，works.html 有 DOM，层级 < nav 800 不遮挡（当前 works.html 已包含吸顶代码） |
| style.css · dark/light 变量 | 双主题 token 成对覆盖，无遗漏 |
| main.js · reveal 动画 | IO 触发一次后 unobserve，reduce-motion 已降级 |
| main.js · 二维码弹层 | z-index:1200 最高，遮罩/关闭/Escape 三重关闭 |
| main.js · 视频播放 | 点击才注入 B 站 iframe，aspect-ratio:16/9 响应式，mp4 走原生 video |
| 移动端导航 | 断点 1180/900/700/560 齐全，触控热区 ≥44px |
| iframe 安全 | allow/fullscreen 属性齐全，meta referrer=no-referrer |

---

## 不在范围 / 已知背景（勿当 bug）

- R2 图床签名 URL 1 小时过期属图床机制（但 H10 是把预签名 URL 存进了 content.json，这是使用方式问题）
- works.html 曾从 git 恢复——当前版本已包含吸顶分类栏代码，不是缺失项
- 后台图片缩略图"加载失败自动隐藏"（img.onerror→display:none）为已知行为
- localizeRemoteImages 只本地化 xiumi.us/eqxiu/qpic 域名图片属设计如此
- admin/ 下有 `admin.css.bak`、`rte.js.bak`、`rte.js.pre-fix.bak` 和 `_bgdiag.html`、`_bgtest2~5.html` 等调试/备份文件——建议 deploy 前从发布目录排除

---

## 修复优先级建议

1. **立即修（影响安全/数据正确性）**：H1（密码泄露）、H2（目录穿越）、H3（批量删除假删）、H4（保存失败仍发布）、H5（图片字段丢值）、H10（封面 1h 后必裂）
2. **本周修（影响功能/体验）**：H6、H7（编辑器误替换）、H8、H9（死链页面补建或降级）、H11（FOUC）、M5（边框全没了）、M12（撤销丢输入）
3. **排期修**：M1-M4（后端安全加固）、M6-M10（后台健壮性）、M11-M18（编辑器体验）、M19-M23（前台细节）
4. **可缓**：全部低风险项
