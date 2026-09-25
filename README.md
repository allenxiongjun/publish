# Glass Motion Portfolio

动感玻璃拟态（Glassmorphism）风格的个人作品集静态站。**零第三方依赖**，不引 CDN、不用构建工具，双击 `index.html` 即可预览。

## 目录结构

```
portfolio/
├── index.html          # 首页：Hero / 技能 / 精选作品 / 数据 / 履历 / 联系
├── works.html          # 作品全集，带分类筛选
├── about.html          # 关于我 / 服务能力 / 履历 / 教育背景
├── assets/
│   ├── css/style.css   # 全部样式（设计变量集中在 :root）
│   ├── js/main.js      # 全部交互，纯原生 JS
│   │   ├── img/work-0X.svg # 作品占位图（自绘 SVG，替换成真图即可）
│   │   └── img/wechat-qr.png # 微信二维码（当前为占位图，换成自己的二维码名片截图）
└── README.md
```

## 已经实现的动效

| 效果 | 位置 |
| --- | --- |
| 加载进度动画（数字 + 进度条） | 全站首屏 |
| 三条大色斑流动背景 | 全局 `.bg-layer` |
| Canvas 粒子网格 + 鼠标吸附 | `#flow-canvas` |
| 自定义光标（点 + 跟随光环 + hover 放大） | 全局 |
| 滚动进度条 | 顶部 |
| 标题逐字上浮出场 | `[data-split]` |
| 卡片逐项错峰淡入 | `.reveal` / `[data-stagger]` |
| 元素进入视口才触发 | IntersectionObserver |
| 卡片 3D 倾斜跟随鼠标 | `[data-tilt]` |
| 卡片鼠标聚光 highlihgt | `.spot` |
| 按钮磁吸位移 | `.btn` |
| 技能条 / 数字滚动计数 | `.skill-bar` / `[data-count]` |
| 无限滚动跑马灯 | `.marquee` |
| 明暗主题切换（记忆偏好） | `.icon-btn[data-theme-toggle]` |
| `prefers-reduced-motion` 降级 | 全局 |

## 改造成你自己的

1. **名字 / 联系方式**：当前为「熊俊 / XIONG JUN」，兜底头像字 `XJ`，邮箱 `361****9@qq.com`（简历脱敏值，上线前换成真实邮箱）。
2. **占位图**：把 `assets/img/work-0X.svg` 换成真实作品图，保持 `16:10` 左右的横向比例最佳；推荐 `.webp`，路径改 `<img src>`。
3. **配色**：改 `assets/css/style.css` 顶部 `:root` 里的 `--a1 ~ --a4` 四个强调色，全站渐变会一起变。
4. **明暗默认值**：`<html data-theme="dark">`，改成 `light` 即为默认亮色。
5. **作品数量**：复制 `.work` 整块即可，`data-cat` 对应筛选按钮的 `data-filter`。
6. **联系表单**：目前走 `mailto:` 跳转。要收邮件就换成 Formspree / Netlify Forms 之类的 endpoint。

## 本地预览

```bash
# 任选一种
python -m http.server 4173
npx serve .
```
然后打开 http://localhost:4173

## 部署上线

纯静态资源，任意平台都能丢上去：

- **GitHub Pages**：仓库根目录 / `docs/`，Settings → Pages 选择分支。
- **Vercel / Netlify**：拖文件夹或连仓库，无需构建命令。
- **对象存储 + CDN**：整目录上传即可。

> 注意：`mailto:` 依赖用户本地邮件客户端；上线前建议换成真正可用的表单服务。
