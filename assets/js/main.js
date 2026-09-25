/* =============================================================
   Glass Motion Portfolio — interactions
   Vanilla JS, zero dependencies
   ============================================================= */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Theme ---------------- */
  const root = document.documentElement;
  const stored = localStorage.getItem("gm-theme");
  if (stored) root.dataset.theme = stored;
  else if (window.matchMedia("(prefers-color-scheme: light)").matches) root.dataset.theme = "light";

  $$("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = next;
      localStorage.setItem("gm-theme", next);
    });
  });

  /* ---------------- Loader ---------------- */
  const loader = $(".loader");
  const numEl = $(".loader-num");
  const barEl = $(".loader-bar i");

  function runLoader() {
    if (!loader) return Promise.resolve();
    return new Promise((resolve) => {
      let p = 0;
      const tick = () => {
        p = Math.min(100, p + Math.random() * 20 + 9);
        if (numEl) numEl.textContent = String(Math.floor(p)).padStart(2, "0");
        if (barEl) barEl.style.width = p + "%";
        if (p < 100) setTimeout(tick, 38 + Math.random() * 46);
        else setTimeout(() => {
          loader.classList.add("done");
          if (loader) { loader.style.display = "none"; }
          document.body.classList.add("loaded");
          resolve();
        }, 320);
      };
      tick();
    });
  }

  /* ---------------- Split text ---------------- */
  function splitText(el, mode = "char") {
    const text = el.textContent;
    el.textContent = "";
    const frag = document.createDocumentFragment();
    const units = mode === "word" ? text.split(" ") : [...text];
    let i = 0;
    units.forEach((u, idx) => {
      const span = document.createElement("span");
      span.className = mode === "word" ? "word" : "char";
      span.textContent = u === " " ? "\u00A0" : u;
      span.style.setProperty("--i", i++);
      frag.appendChild(span);
      if (mode === "word" && idx < units.length - 1) frag.appendChild(document.createTextNode(" "));
    });
    el.appendChild(frag);
    return el;
  }

  $$("[data-split]").forEach((el) => {
    splitText(el, el.dataset.split === "word" ? "word" : "char");
    el.classList.add("split");
  });

  /* ---------------- Reveal / split observer ---------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  $$(".reveal, .split").forEach((el) => io.observe(el));

  /* stagger reveal inside grids */
  $$("[data-stagger]").forEach((parent) => {
    [...parent.children].forEach((c, i) => {
      c.classList.add("reveal");
      c.style.setProperty("--d", (i % 6) * 90 + "ms");
      io.observe(c);
    });
  });

  /* ---------------- Nav state + drawer ---------------- */
  const nav = $(".nav");
  const drawer = $(".drawer");
  const burger = $(".burger");

  const onScrollNav = () => {
    if (!nav) return;
    nav.classList.toggle("stuck", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  burger && burger.addEventListener("click", () => {
    drawer.classList.toggle("open");
    document.body.style.overflow = drawer.classList.contains("open") ? "hidden" : "";
  });
  drawer && drawer.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }
  });

  /* current page highlight */
  const here = location.pathname.split("/").pop() || "index.html";
  $$(".nav-links a, .drawer a").forEach((a) => {
    if (a.getAttribute("href") === here) a.classList.add("active");
  });

  /* ---------------- Scroll progress ---------------- */
  const progress = $(".progress");
  function updateProgress() {
    if (!progress) return;
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    progress.style.width = pct + "%";
    if (toTop) toTop.classList.toggle("show", window.scrollY > 620);
  }
  const toTop = $(".to-top");
  toTop && toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* ---------------- Custom cursor ---------------- */
  const dot = $(".cursor-dot");
  const ring = $(".cursor-ring");
  if (dot && ring && window.matchMedia("(hover: hover)").matches) {
    let mx = 0, my = 0, rx = 0, ry = 0;
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      const hot = e.target.closest("a, button, .work, .chip, input, textarea");
      ring.classList.toggle("hot", !!hot);
    }, { passive: true });
    (function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- Mouse spotlight + tilt ---------------- */
  $$(".spot").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", e.clientX - r.left + "px");
      el.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  $$("[data-tilt]").forEach((el) => {
    if (reduceMotion || window.matchMedia("(hover: none)").matches) return;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transition = "transform .12s linear";
      el.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateY(-8px) scale(1.015)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
      el.style.transform = "";
    });
  });

  /* ---------------- Magnetic buttons ---------------- */
  $$(".btn").forEach((btn) => {
    if (reduceMotion || window.matchMedia("(hover: none)").matches) return;
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.32;
      const y = (e.clientY - r.top - r.height / 2) * 0.4;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
  });

  /* ---------------- Counters ---------------- */
  const counters = $$("[data-count]");
  const cIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const dur = 1600;
      const start = performance.now();
      const suffix = el.dataset.suffix || "";
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      cIO.unobserve(el);
    });
  }, { threshold: 0.4 });
  counters.forEach((c) => cIO.observe(c));

  /* ---------------- Skill bars ---------------- */
  const bars = $$(".skill-bar i");
  const bIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.width = e.target.dataset.pct + "%";
      bIO.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  bars.forEach((b) => bIO.observe(b));

  /* ---------------- Work filter ---------------- */
  const filterBtns = $$(".filters button");
  const works = $$(".work");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.filter;
      filterBtns.forEach((b) => b.classList.toggle("on", b === btn));
      works.forEach((w) => {
        const match = cat === "all" || w.dataset.cat === cat;
        if (match) {
          w.classList.remove("hide");
          w.classList.add("reveal");
          requestAnimationFrame(() => w.classList.add("in"));
        } else {
          w.classList.add("hide");
        }
      });
    });
  });

  /* ---------------- Marquee duplication ---------------- */
  $$(".marquee-track").forEach((t) => {
    t.innerHTML += t.innerHTML;
  });

  /* ---------------- Toast ---------------- */
  const toast = $(".toast");
  let toastTimer;
  window.gmToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  };

  /* ---------------- Contact form ---------------- */
  const form = $("#contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get("name") || "").trim();
      const email = (data.get("email") || "").trim();
      const msg = (data.get("message") || "").trim();
      if (!name || !email || !msg) { window.gmToast("请填完所有字段"); return; }
      const subject = encodeURIComponent(`[作品集] 来自 ${name} 的新消息`);
      const body = encodeURIComponent(`${msg}\n\n—\n${name}\n${email}`);
      window.gmToast("正在调起邮件客户端…");
      window.location.href = `mailto:361****9@qq.com?subject=${subject}&body=${body}`;
      form.reset();
    });
  }

  /* ---------------- WeChat QR modal ---------------- */
  const qrModal = $("#qr-modal");
  if (qrModal) {
    const setQr = (open) => {
      qrModal.classList.toggle("open", open);
      qrModal.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    };
    $("#wechat-btn")?.addEventListener("click", () => setQr(true));
    $$("[data-qr-close]", qrModal).forEach((el) =>
      el.addEventListener("click", () => setQr(false))
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && qrModal.classList.contains("open")) setQr(false);
    });
  }

  /* ---------------- Flow canvas ---------------- */
  const canvas = $("#flow-canvas");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1, nodes = [], mouse = { x: -999, y: -999 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = window.innerWidth * dpr;
      h = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const count = Math.round(Math.min(90, Math.max(30, window.innerWidth / 18)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28 * dpr,
        vy: (Math.random() - 0.5) * 0.28 * dpr,
        r: (Math.random() * 1.6 + 0.6) * dpr,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const link = 122 * dpr;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        const mx = (mouse.x * dpr) - n.x;
        const my = (mouse.y * dpr) - n.y;
        const md = Math.hypot(mx, my);
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < link) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(124,92,255,${(1 - d / link) * 0.28})`;
            ctx.lineWidth = 1 * dpr;
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.fillStyle = md < 170 * dpr ? "rgba(0,229,199,.95)" : "rgba(237,239,250,.55)";
        ctx.arc(n.x, n.y, md < 170 * dpr ? n.r * 1.7 : n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    /* resize + 跨屏拖动（devicePixelRatio 变化）+ 旋转屏，全部即时重建画布 */
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("orientationchange", resize);
    window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

    /* 系统显示缩放比例变化（在不同 DPI 显示器之间移动窗口、改 scale）时
       没有任何 resize 事件，只能监听 dppx 媒体查询 */
    let dprWatch = null;
    const watchDpr = () => {
      if (dprWatch) dprWatch.removeEventListener("change", onDpr);
      const d = window.devicePixelRatio || 1;
      dprWatch = window.matchMedia(`(resolution: ${d}dppx)`);
      dprWatch.addEventListener("change", onDpr);
    };
    function onDpr() { resize(); watchDpr(); }
    watchDpr();

    resize();
    draw();
  }

  /* ---------------- Click-to-play video facade ----------------
     未点击时不加载任何第三方播放器（省流量、不自动播放）；
     点击后才注入 iframe 并带 autoplay=1 —— 此时是用户明确意图，浏览器不拦。
     任何 .video-facade[data-video-src] 都自动生效，含以后新增的视频位。 */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".video-facade[data-video-src]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();               // 位于作品卡的 <a> 内部时避免误跳链接
    const slot = btn.closest(".video-slot");
    if (!slot || slot.dataset.activated) return;
    slot.dataset.activated = "1";

    const src = btn.dataset.videoSrc;
      /* 抖音 / 视频号：无公开嵌入接口，点击跳转新窗口观看 */
      if (/douyin\.com|iesdouyin\.com|channels\.weixin\.qq\.com|weixin\.qq\.com|wxv/i.test(src)) {
        btn.remove();
        const ext = document.createElement("a");
        ext.href = src;
        ext.target = "_blank";
        ext.rel = "noopener";
        ext.className = "ext-watch";
        ext.textContent = "前往平台观看 ↗";
        slot.appendChild(ext);
        const glassA = slot.closest(".work, .video-frame, .glass");
        if (glassA) glassA.classList.add("is-playing");
        return;
      }
      /* mp4 直链：原生 video 直接播，不走 iframe */
      if (/\.mp4(\?|$)/i.test(src)) {
        const v = document.createElement("video");
        v.src = src;
        v.controls = true;
        v.autoplay = true;
        v.playsInline = true;
        btn.remove();
        slot.appendChild(v);
        return;
      }
      const sep = src.includes("?") ? "&" : "?";
      const frame = document.createElement("iframe");
      frame.src = src + sep + "autoplay=1&high_quality=1&danmaku=0&mute=0";
      frame.setAttribute("scrolling", "no");
      frame.setAttribute("frameborder", "0");
      /* 跨域 iframe 要能全屏，必须同时给权限策略与老式布尔属性 */
      frame.setAttribute("allow", "fullscreen; autoplay; encrypted-media; picture-in-picture");
      frame.setAttribute("allowfullscreen", "true");
      frame.setAttribute("webkitallowfullscreen", "true");
      frame.setAttribute("mozallowfullscreen", "true");
      frame.title = btn.getAttribute("aria-label") || "作品视频";

      /* 播放中：清掉祖先的 backdrop-filter / transform。
         这两者会让部分 Chromium 版本拒绝 iframe 全屏，也会拖慢解码 */
      const glassAncestor = slot.closest(".work, .video-frame, .glass");
      if (glassAncestor) glassAncestor.classList.add("is-playing");

      btn.remove();
      slot.appendChild(frame);
  });

  /* 本站自控的全屏按钮：让自己的容器进全屏，绕过跨域 iframe 的权限限制 */
  function addFullscreenButton(slot) {
    const api = slot.requestFullscreen || slot.webkitRequestFullscreen || slot.msRequestFullscreen;
    if (!api) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fs-btn";
    btn.setAttribute("aria-label", "全屏播放");
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    const sync = () => {
      const on = document.fullscreenElement === slot || document.webkitFullscreenElement === slot;
      btn.setAttribute("aria-label", on ? "退出全屏" : "全屏播放");
      btn.classList.toggle("is-on", on);
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const target = document.fullscreenElement || document.webkitFullscreenElement;
      if (target === slot) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        try { api.call(slot); } catch (_) { /* 被策略拒绝时静默忽略 */ }
      }
    });
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    slot.appendChild(btn);
  }

  /* ---------------- Boot ---------------- */
  window.addEventListener("load", () => runLoader());
  setTimeout(() => { if (loader && !loader.classList.contains("done")) { loader.classList.add("done"); if (loader) { loader.style.display = "none"; } } }, 2000);
})();
