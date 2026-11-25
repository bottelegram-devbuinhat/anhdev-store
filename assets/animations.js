/* ==========================================================================
   AnhDev Store — animations.js
   Lop hieu ung. Nap SAU assets/app.js (defer, dung thu tu) nen cac su kien
   anhdev:* tu app.js da co san. Thu vien CDN (GSAP 3.12.5, Lenis 1.1.14,
   canvas-confetti 1.9.3) nap TRUOC app.js — tat ca deu co guard: thieu
   thu vien thi tu dong dung ban vanilla / bo qua, khong bao gio lam vo app.
   Ton trong prefers-reduced-motion: neu user tat chuyen dong thi chi chay
   logic can thiet (cap nhat so), khong chay animation. Man hinh cam ung nho
   tu dong giam hat / tilt / parallax.
   ========================================================================== */
(function(){
  "use strict";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  var hasGsap = typeof window.gsap === "object" && window.gsap !== null;
  if (hasGsap) document.documentElement.classList.add("gsap-on");
  function $(s){ return document.querySelector(s); }
  function $all(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function on(el, ev, fn){ if (el) el.addEventListener(ev, fn); }

  /* ================= 0. Lenis smooth scroll (CDN, guarded) ================= */
  var lenis = null;
  function initLenis(){
    if (reduceMotion || isTouch) return;
    if (typeof window.Lenis !== "function") return;
    try {
      lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
      window.__lenis = lenis; /* app.js instantScrollTop() dung cai nay */
      var raf = function(t){ lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    } catch (e) { lenis = null; }
  }
  initLenis();

  /* ---------- dinh dang tien (giong fmt() trong app.js) ---------- */
  var USD_RATE = 25400;
  function fmtNum(n){
    var cur = $("#curSelect") ? $("#curSelect").value : "VND";
    if (cur === "USD"){
      return "$" + (Number(n) / USD_RATE).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
    }
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  /* ================= 1. Balance ticker + border beam ================= */
  var lastBalance = null, tickRaf = null;
  function setBalanceText(v){
    $all("[data-balance]").forEach(function(el){ el.textContent = fmtNum(Math.round(v)); });
  }
  /* Beam vien Houdini: chay lien tuc khi da dong bo (da dang nhap), tat khi chua.
     Khong dung one-shot nua — beam xoay vong quanh vien, khong cat chu. */
  function setBeam(on){
    var card = $(".balance-card");
    if (!card) return;
    card.classList.toggle("beam", !!on && !reduceMotion);
  }
  document.addEventListener("anhdev:balance", function(e){
    var v = (e.detail && typeof e.detail.value === "number") ? e.detail.value : 0;
    var synced = !!(e.detail && e.detail.synced);
    setBeam(synced);
    if (lastBalance === null){ lastBalance = v; return; } /* lan dau: khong dem */
    var from = lastBalance;
    lastBalance = v;
    if (from === v) return;
    if (reduceMotion){ setBalanceText(v); return; }
    if (tickRaf) cancelAnimationFrame(tickRaf);
    var start = null, dur = 650;
    var ease = function(t){ return 1 - Math.pow(1 - t, 3); }; /* easeOutCubic */
    var step = function(ts){
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      setBalanceText(from + (v - from) * ease(p));
      if (p < 1) tickRaf = requestAnimationFrame(step);
      else { setBalanceText(v); tickRaf = null; }
    };
    tickRaf = requestAnimationFrame(step);
  });

  /* ================= 2. Diem danh: confetti + so bay + pulse ================= */
  var CONFETTI_COLORS = ["#b08d2e", "#d3ab4a", "#0d3b2e", "#5ec49a", "#ffffff", "#177245"];
  function confetti(n){
    if (reduceMotion) return;
    var count = n || 42;
    for (var i = 0; i < count; i++){
      var d = document.createElement("div");
      d.className = "confetti-piece";
      var size = 6 + Math.random() * 8;
      d.style.width = size + "px";
      d.style.height = size * (0.6 + Math.random() * 0.8) + "px";
      d.style.left = (Math.random() * 100) + "vw";
      d.style.top = (-12 - Math.random() * 30) + "px";
      d.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      d.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      d.style.animationDelay = (Math.random() * 0.35) + "s";
      d.style.transform = "rotate(" + Math.floor(Math.random() * 360) + "deg)";
      document.body.appendChild(d);
      (function(el){ setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 3800); })(d);
    }
  }
  function floatPlus(amount, anchorEl){
    if (reduceMotion) return;
    var x = window.innerWidth / 2, y = window.innerHeight * 0.38;
    if (anchorEl){
      var r = anchorEl.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    var el = document.createElement("div");
    el.className = "float-plus";
    el.textContent = "+" + fmtNum(amount);
    el.style.left = x + "px";
    el.style.top = y + "px";
    document.body.appendChild(el);
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }
  /* canvas-confetti: no 2 goc duoi (vang + emerald), them 1 dot giua nhe.
     Neu CDN loi thi dung ban vanilla (confetti) o duoi. */
  function confettiBurst(){
    if (reduceMotion) return;
    if (typeof window.confetti === "function"){
      var base = { spread: 70, ticks: 220, gravity: 0.9, decay: 0.93, scalar: 1.05, colors: CONFETTI_COLORS, disableForReducedMotion: true };
      window.confetti(Object.assign({}, base, { particleCount: 70, angle: 60, origin: { x: 0, y: 0.7 } }));
      window.confetti(Object.assign({}, base, { particleCount: 70, angle: 120, origin: { x: 1, y: 0.7 } }));
      window.confetti(Object.assign({}, base, { particleCount: 40, spread: 100, origin: { x: 0.5, y: 0.5 }, scalar: 0.9 }));
    } else {
      confetti(42);
    }
  }
  document.addEventListener("anhdev:checkin", function(e){
    var amt = (e.detail && e.detail.amount) || 0;
    confettiBurst();
    var modal = $("#checkinModal .modal");
    floatPlus(amt, modal || $(".balance-card"));
    var card = $(".balance-card");
    if (card && !reduceMotion){
      card.classList.remove("checkin-pulse");
      void card.offsetWidth;
      card.classList.add("checkin-pulse");
      setTimeout(function(){ card.classList.remove("checkin-pulse"); }, 1800);
    }
  });

  /* ================= 3. Sidebar: sliding indicator ================= */
  var nav = $(".sidebar nav"), indicator = null;
  function positionIndicator(){
    if (!nav || !indicator) return;
    var active = nav.querySelector(".nav-item.active");
    if (!active || !active.offsetHeight){
      indicator.style.opacity = "0";
      return;
    }
    indicator.style.opacity = "1";
    indicator.style.top = active.offsetTop + "px";
    indicator.style.height = active.offsetHeight + "px";
  }
  if (nav){
    indicator = document.createElement("div");
    indicator.className = "nav-indicator";
    indicator.style.opacity = "0";
    nav.insertBefore(indicator, nav.firstChild);
    /* active doi khi showView() chay (app.js) -> quan sat class */
    var navObs = new MutationObserver(function(){ positionIndicator(); });
    navObs.observe(nav, { attributes:true, attributeFilter:["class"], subtree:true });
    var rsTick = false;
    window.addEventListener("resize", function(){
      if (!rsTick){ rsTick = true; requestAnimationFrame(function(){ rsTick = false; positionIndicator(); }); }
    });
    /* cho font/layout on dinh roi moi dinh vi lan dau */
    setTimeout(positionIndicator, 60);
    setTimeout(positionIndicator, 400);
    window.addEventListener("load", positionIndicator);
  }

  /* ================= 4. Topbar: kinh mo khi cuon ================= */
  var topbar = $(".topbar"), ticking = false;
  function onScroll(){
    if (!topbar) return;
    topbar.classList.toggle("scrolled", window.scrollY > 8);
    ticking = false;
  }
  window.addEventListener("scroll", function(){
    if (!ticking){ ticking = true; requestAnimationFrame(onScroll); }
  }, { passive:true });
  onScroll();

  /* ================= 5. Card skeleton khi dang dong bo kho ================= */
  document.addEventListener("anhdev:stock-syncing", function(){
    if (reduceMotion) return;
    var area = $("#productArea");
    if (!area) return;
    /* Chi hien skeleton khi chua co card nao (lan tai dau) — tranh nhap nhay khi refresh */
    if (area.querySelector(".card") || area.querySelector(".empty-box")) return;
    var html = '<div class="grid">';
    for (var i = 0; i < 6; i++){
      html += '<div class="card-skeleton"><div class="sk-cover"></div>' +
              '<div class="sk-line"></div><div class="sk-line short"></div></div>';
    }
    html += "</div>";
    area.innerHTML = html;
  });

  /* ================= 6. Card + leaderboard: stagger --i ================= */
  function stagger(containerSel, itemSel, max){
    var container = $(containerSel);
    if (!container) return;
    var setIdx = function(){
      var items = container.querySelectorAll(itemSel);
      items.forEach(function(el, i){
        el.style.setProperty("--i", Math.min(i, max == null ? 11 : max));
      });
    };
    setIdx();
    var obs = new MutationObserver(setIdx);
    obs.observe(container, { childList:true, subtree:true });
  }
  stagger("#productArea", ".card", 11);
  stagger("#lbList", ".lb-row", 11);
  /* Modal: gan --i cho cac field de CSS fieldIn stagger (PART 3 §6) */
  stagger("#authModal .modal", ".field", 8);
  stagger("#buyModal .modal", ".field", 8);
  stagger("#checkinModal .modal", ".field", 8);

  /* ================= 7. Gia crossfade khi doi tien te ================= */
  var area = $("#productArea");
  on($("#curSelect"), "change", function(){
    if (!area || reduceMotion) return;
    /* card se render lai (stagger fade-in) + them flip nhe cho gia */
    area.classList.remove("flip");
    void area.offsetWidth;
    area.classList.add("flip");
    setTimeout(function(){ area.classList.remove("flip"); }, 450);
  });

  /* ================= 8. Modal: khoa cuon body khi mo (GIU NGUYEN VI TRI CUON) =================
     Khoa kieu cu (chi overflow:hidden) tren mot so WebView co the lam trang
     nhay ve dau khi modal mo. Khoa kieu moi: body position:fixed + top:-scrollY
     (ky thuat chuan); mo khoa thi tra lai scrollY NGAY LAP TUC (khong smooth). */
  var lockY = 0, locked = false;
  function lockScroll(on){
    if (on && !locked){
      locked = true;
      if (lenis) lenis.stop(); /* Lenis dung cuon nen khi modal mo */
      lockY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = "-" + lockY + "px";
      document.body.classList.add("modal-lock");
    } else if (!on && locked){
      locked = false;
      document.body.classList.remove("modal-lock");
      document.body.style.top = "";
      if (lenis) lenis.start();
      var de = document.documentElement, prev = de.style.scrollBehavior;
      de.style.scrollBehavior = "auto";
      window.scrollTo(0, lockY);
      de.style.scrollBehavior = prev;
    }
  }
  var wraps = $all(".modal-wrap");
  if (wraps.length){
    var lockObs = new MutationObserver(function(){
      var anyOpen = wraps.some(function(w){ return w.classList.contains("open"); });
      lockScroll(anyOpen);
    });
    wraps.forEach(function(w){
      lockObs.observe(w, { attributes:true, attributeFilter:["class"] });
    });
  }

  /* ================= 9. Hero: GSAP timeline + canvas particles + parallax =================
     Ken Burns CSS bi tat khi co GSAP (html.gsap-on) — GSAP dam nhan scale + x/y
     tren .hero img.bg. Neu GSAP loi, CSS Ken Burns chay lai nhu cu. */
  var hero = $(".hero"), heroFx = $("#heroFx"), heroBg = hero ? hero.querySelector("img.bg") : null;
  var heroParticles = [], heroMouse = { x: 0.5, y: 0.5 };
  function heroFxResize(){
    if (!hero || !heroFx) return;
    var r = hero.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    heroFx.width = Math.max(1, Math.round(r.width * dpr));
    heroFx.height = Math.max(1, Math.round(r.height * dpr));
  }
  function heroFxInit(){
    if (!hero || !heroFx || reduceMotion || isTouch) return;
    heroFxResize();
    var ctx = heroFx.getContext("2d");
    if (!ctx) return;
    var N = 46, i;
    heroParticles = [];
    for (i = 0; i < N; i++){
      var crimson = Math.random() < 0.55;
      heroParticles.push({
        x: Math.random(), y: Math.random(),
        r: 0.8 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 0.00035,
        vy: -(0.00012 + Math.random() * 0.00035),
        a: 0.25 + Math.random() * 0.5,
        hue: crimson ? "220,38,38" : "212,175,55",
        tw: Math.random() * Math.PI * 2
      });
    }
    var draw = function(){
      var w = heroFx.width, h = heroFx.height;
      ctx.clearRect(0, 0, w, h);
      heroParticles.forEach(function(p){
        p.x += p.vx + (heroMouse.x - 0.5) * 0.00012;
        p.y += p.vy + (heroMouse.y - 0.5) * 0.00006;
        p.tw += 0.02;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
        var alpha = p.a * (0.7 + 0.3 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * (w / 800 + 0.5), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + p.hue + "," + alpha.toFixed(3) + ")";
        ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", heroFxResize);
  }
  function heroIntro(){
    if (!hero || reduceMotion) return;
    var items = hero.querySelectorAll(".hero-inner > *");
    if (items.length && hasGsap){
      window.gsap.fromTo(items,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out", clearProps: "transform,opacity" });
    }
    /* Ken Burns bang GSAP (scale 1 -> 1.07, yoyo, lap vo han) + parallax x/y.
       x/y va scale la property khac nhau nen overwrite:"auto" khong diet nhau. */
    if (heroBg && hasGsap){
      window.gsap.fromTo(heroBg, { scale: 1 }, { scale: 1.07, duration: 16, yoyo: true, repeat: -1, ease: "sine.inOut" });
      if (window.matchMedia("(hover:hover) and (pointer:fine)").matches){
        hero.addEventListener("pointermove", function(e){
          var r = hero.getBoundingClientRect();
          if (r.width < 2) return;
          heroMouse.x = (e.clientX - r.left) / r.width;
          heroMouse.y = (e.clientY - r.top) / r.height;
          window.gsap.to(heroBg, { x: (heroMouse.x - 0.5) * -14, y: (heroMouse.y - 0.5) * -10, duration: 0.9, ease: "power2.out", overwrite: "auto" });
        });
        hero.addEventListener("pointerleave", function(){
          heroMouse.x = 0.5; heroMouse.y = 0.5;
          window.gsap.to(heroBg, { x: 0, y: 0, duration: 0.9, ease: "power2.out", overwrite: "auto" });
        });
      }
    }
  }
  heroFxInit();
  heroIntro();

  /* ================= 10. Card: GSAP entrance + tilt 3D + spotlight + VIP beam ================= */
  var gridArea = $("#productArea");
  var canTilt = window.matchMedia("(hover:hover) and (pointer:fine)").matches && !reduceMotion && !isTouch;
  function animateCards(cards){
    if (!cards || !cards.length) return;
    if (hasGsap && !reduceMotion){
      window.gsap.fromTo(cards,
        { opacity: 0, y: 16, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: "power3.out", overwrite: "auto", clearProps: "transform,opacity" });
    }
  }
  function applyVipBeam(){
    if (!gridArea || reduceMotion) return;
    var vip = gridArea.querySelector(".card[data-cat='detail']");
    if (vip && !vip.classList.contains("beam")){
      gridArea.querySelectorAll(".card.beam").forEach(function(c){ c.classList.remove("beam"); });
      vip.classList.add("beam");
    }
  }
  if (gridArea){
    /* Entrance khi card render (app.js render lai grid moi lan loc/phan trang) */
    var cardObs = new MutationObserver(function(muts){
      var fresh = [];
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if (n.nodeType === 1 && n.classList && n.classList.contains("card")) fresh.push(n);
          else if (n.nodeType === 1 && n.querySelectorAll) n.querySelectorAll(".card").forEach(function(c){ fresh.push(c); });
        });
      });
      if (fresh.length){ animateCards(fresh); applyVipBeam(); }
    });
    cardObs.observe(gridArea, { childList:true, subtree:true });
    /* Card san co luc load (app.js INIT render truoc khi animations.js chay) */
    var initialCards = gridArea.querySelectorAll(".card");
    if (initialCards.length){ animateCards(Array.prototype.slice.call(initialCards)); applyVipBeam(); }
    /* Tilt + spotlight: pointermove tren grid, set --rx/--ry/--mx/--my cho card duoi chuot.
       CSS transition (0.28s) lam muot — khong can GSAP o day. */
    if (canTilt){
      gridArea.addEventListener("pointermove", function(e){
        var card = e.target.closest ? e.target.closest(".card") : null;
        if (!card || !gridArea.contains(card)) return;
        var r = card.getBoundingClientRect();
        if (r.width < 2) return;
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--rx", ((0.5 - py) * 7).toFixed(2) + "deg");
        card.style.setProperty("--ry", ((px - 0.5) * 7).toFixed(2) + "deg");
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      });
      gridArea.addEventListener("pointerout", function(e){
        var card = e.target.closest ? e.target.closest(".card") : null;
        if (card && !card.contains(e.relatedTarget)){
          card.style.setProperty("--rx", "0deg");
          card.style.setProperty("--ry", "0deg");
        }
      });
    }
  }

  /* ================= 11. Magnetic CTA (GSAP quickTo, desktop only) ================= */
  var magneticBtns = $all(".hero-actions .btn, #topLoginBtn");
  if (hasGsap && !reduceMotion && !isTouch && window.matchMedia("(hover:hover) and (pointer:fine)").matches){
    magneticBtns.forEach(function(btn){
      var xTo = window.gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3.out" });
      var yTo = window.gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3.out" });
      btn.addEventListener("pointermove", function(e){
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        xTo(Math.max(-6, Math.min(6, dx * 0.18)));
        yTo(Math.max(-6, Math.min(6, dy * 0.18)));
      });
      btn.addEventListener("pointerleave", function(){ xTo(0); yTo(0); });
    });
  }
})();
