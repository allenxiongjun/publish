/* 前台内容桥接（零依赖）
   读取 window.SITE_CONTENT（由后台「发布」生成的 assets/js/content.js），
   把内容填到带 data-cms* 标记的节点上。
   没有 content.js 时什么都不做 —— 页面照常显示 HTML 里原有的文案。 */
(function () {
  var C = window.SITE_CONTENT;
  if (!C) return;

  function get(p) { return p.split('.').reduce(function (o, k) { return (o == null ? o : o[k]); }, C); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function textNodes(el) {
    return Array.prototype.slice.call(el.childNodes).filter(function (n) {
      return n.nodeType === 3 && n.nodeValue.trim() !== '';
    });
  }
  // 默认：替换最后一个有内容的文本节点（保留 <span class="pulse"> 之类的装饰元素）
  // 空值一律跳过：后台没填的字段保留页面原有文案，绝不把网站改空白
  function setText(el, v) { if (v == null || v === '') return; var n = textNodes(el); if (n.length) n[n.length - 1].nodeValue = v; else el.textContent = v; }
  // 按钮/带图标的元素：替换第一个有内容的文本节点
  function setFirst(el, v) { if (v == null || v === '') return; var n = textNodes(el)[0]; if (n) n.nodeValue = v; else el.textContent = v; }

  /* ---- 单值字段 ---- */
  document.querySelectorAll('[data-cms]').forEach(function (el) { setText(el, get(el.dataset.cms)); });
  document.querySelectorAll('[data-cms-first]').forEach(function (el) { setFirst(el, get(el.dataset.cmsFirst)); });
  document.querySelectorAll('[data-cms-html]').forEach(function (el) {
      var v = get(el.dataset.cmsHtml);
      if (v != null && v !== '') el.innerHTML = String(v).replace(/\n/g, '<br>');
  });
  document.querySelectorAll('[data-cms-src]').forEach(function (el) { var v = get(el.dataset.cmsSrc); if (v) el.setAttribute('src', v); });

  /* ---- SEO ---- */
  var file = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  var page = file === '' || file === 'portfolio' ? 'index' : file;
  var seo = get('site.seo.' + page);
  if (seo) {
    if (seo.title) document.title = seo.title;
    if (seo.description) {
      var md = document.querySelector('meta[name="description"]');
      if (md) md.setAttribute('content', seo.description);
    }
  }

  /* ---- 列表构建器 ---- */
  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
  var OPEN_SVG = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  var TAG_LABEL = { event: 'Event', copy: 'Copy', design: 'Design', video: 'Video', ai: 'AI' };
  // 分类改为后台可增删：content.js 顶层 categories = [{key,label,en?}]
  var CATS = Array.isArray(C.categories) ? C.categories.filter(function (c) { return c && c.key && c.label; }) : [];
  CATS.forEach(function (c) { TAG_LABEL[c.key] = c.en || c.label; });
  // 重建作品页筛选按钮（含「全部」）；无分类数据时保留页面静态按钮
  document.querySelectorAll('.filters').forEach(function (box) {
    if (!CATS.length) return;
    box.innerHTML = '<button class="on" data-filter="all">全部</button>' +
      CATS.map(function (c) { return '<button data-filter="' + esc(c.key) + '">' + esc(c.label) + '</button>'; }).join('');
  });

  function tags(list) {
    return (list || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
  }
  function facade(w) {
    var cover = w.cover ? '<img class="facade-img" src="' + esc(w.cover) + '" alt="" loading="lazy">' : '';
    return '<div class="video-slot">' +
      '<button class="video-facade" type="button" data-video-src="' + esc(w.videoSrc || '') +
      '" aria-label="' + esc(platformLabel(w.videoSrc)) + '：' + esc(w.title) + '">' + cover +
      '<span class="play-btn" aria-hidden="true">' + PLAY_SVG + '</span>' +
      '<span class="facade-txt"><b>' + esc(w.title) + '</b><span>' + esc(platformLabel(w.videoSrc)) + '</span></span>' +
      '</button></div>';
  }
  function platformLabel(src) {
    if (!src) return '点击在线观看';
    if (/\.mp4(\?|$)/i.test(src)) return '点击在线播放';
    if (/douyin\.com|iesdouyin/i.test(src)) return '点击前往抖音观看';
    if (/weixin\.qq\.com|channels\.weixin/i.test(src)) return '点击前往视频号观看';
    if (/bilibili/i.test(src)) return '点击在线观看 · B 站';
    return '点击在线观看';
  }

  var LISTS = {
    marquee: { path: 'home.marquee', build: function (t) { return '<span class="chip"><em></em>' + esc(t) + '</span>'; } },

    skills: {
      path: 'collections.skills',
      build: function (s) {
        var c = /^#[0-9a-fA-F]{6}$/.test(String(s.color || '')) ? ' style="color:' + s.color + '"' : '';
        return '<div class="skill"><strong' + c + '>' + esc(s.label) + '</strong>' +
          '<div class="skill-bar"><i data-pct="' + (Number(s.pct) || 0) + '"></i></div></div>';
      },
    },

    timeline: {
      path: 'collections.timeline',
      build: function (t) {
        return '<div class="tl-item reveal"><div class="tl-year">' + esc(t.year) + '</div>' +
          '<h3>' + esc(t.title) + '</h3><p>' + esc(t.desc) + '</p></div>';
      },
    },

    services: {
      path: 'collections.services',
      build: function (s) {
        return '<div class="glass spot reveal" style="padding:30px 26px; text-align:left">' +
          '<h3 style="margin-bottom:10px">' + esc(s.title) + '</h3>' +
          '<p style="font-size:14.5px">' + esc(s.text) + '</p></div>';
      },
    },

    education: {
      path: 'collections.education',
      build: function (e) {
        // text 形如「学校 · 学历 · 专业」：首个 · 前是校名，其余做细节行
        var raw = String(e.text || ''), idx = raw.indexOf('·');
        var school = idx > -1 ? raw.slice(0, idx).trim() : raw;
        var rest = idx > -1 ? raw.slice(idx + 1).trim() : '';
        return '<div class="glass edu-card reveal" data-tilt><span class="edu-year">' + esc(e.year) + '</span>' +
          '<h3>' + esc(school) + '</h3>' + (rest ? '<p>' + esc(rest) + '</p>' : '') + '</div>';
      },
    },

    cards: {
      path: 'about.cards',
      build: function (c, i) {
        var num = ('0' + (i + 1)).slice(-2);
        return '<div class="glass info-card reveal" data-tilt><span class="ic-num" aria-hidden="true">' + num + '</span>' +
          '<h3>' + esc(c.title) + '</h3><p>' + esc(c.text) + '</p></div>';
      },
    },

    profile: {
      path: 'about.profile',
      build: function (p) {
        return '<div class="glass spot reveal" style="padding:26px 24px">' +
          '<strong style="display:block; font-size:32px; line-height:1.1">' + esc(p.value) +
          (p.unit ? '<small style="font-size:14px; opacity:.6"> ' + esc(p.unit) + '</small>' : '') + '</strong>' +
          '<span style="font-size:13.5px; opacity:.7">' + esc(p.label) + '</span></div>';
      },
    },

    works: {
      path: 'collections.works',
      filter: function (arr) { return (arr || []).filter(function (w) { return (w.status || 'published') === 'published'; }); },
      build: function (w, i) {
        var inner =
          '<span class="tag">' + esc(TAG_LABEL[w.cat] || 'Work') + '</span>' +
          '<span class="open">' + OPEN_SVG + '</span>' +
          (w.kind === 'video' ? facade(w) : '<img src="' + esc(w.cover) + '" alt="' + esc(w.title) + '" loading="lazy">');
        var body = '<div class="work-body"><h3>' + esc(w.title) + '</h3><p>' + esc(w.desc) + '</p>' +
          '<div class="work-tags">' + tags(w.tags) + '</div></div>';
        var href = 'work.html?id=' + encodeURIComponent(w.id || '');
        return w.kind === 'video'
          ? '<div class="work glass spot" data-cat="' + esc(w.cat) + '" data-tilt><div class="work-thumb">' + inner + '</div>' + body + '</div>'
          : '<a class="work glass spot" href="' + href + '" data-cat="' + esc(w.cat) + '" data-tilt><div class="work-thumb">' + inner + '</div>' + body + '</a>';
      },
    },

    'works-featured': {
      path: 'collections.works',
      filter: function (arr) {
        return (arr || []).filter(function (w) { return w.featured && (w.status || 'published') === 'published'; }).slice(0, 4);
      },
      build: function (w, i) {
        var n = String(i + 1).padStart(2, '0');
        var inner =
          (w.kind === 'video' ? facade(w) : '') +
          '<span class="ghost-num" aria-hidden="true">' + n + '</span>' +
          '<span class="tag">' + esc(TAG_LABEL[w.cat] || 'Work') + '</span>' +
          '<span class="open">' + OPEN_SVG + '</span>' +
          (w.kind === 'video' ? '' : '<img src="' + esc(w.cover) + '" alt="' + esc(w.title) + '" loading="lazy">');
        var href = 'work.html?id=' + encodeURIComponent(w.id || '');
        return '<a class="work glass spot" href="' + href + '" data-cat="' + esc(w.cat) + '" data-tilt>' +
          '<div class="work-thumb">' + inner + '</div>' +
          '<div class="work-body"><h3>' + esc(w.title) + '</h3><p>' + esc(w.desc) + '</p>' +
          '<div class="work-tags">' + tags(w.tags) + '</div></div></a>';
      },
    },
  };

  Object.keys(LISTS).forEach(function (key) {
    var cfg = LISTS[key];
    document.querySelectorAll('[data-cms-list="' + key + '"]').forEach(function (el) {
      var arr = get(cfg.path);
      if (!Array.isArray(arr)) return;
      var items = cfg.filter ? cfg.filter(arr) : arr;
      el.innerHTML = items.map(cfg.build).join('');
    });
  });
})();
