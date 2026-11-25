/* ==========================================================================
   AnhDev Store — animations.js
   Lop hieu ung (vanilla JS, khong thu vien ngoai). Nap SAU assets/app.js
   (defer, dung thu tu) nen cac su kien anhdev:* tu app.js da co san.
   Tat ca deu co guard: thieu element thi bo qua, khong bao gio lam vo app.
   Ton trong prefers-reduced-motion: neu user tat chuyen dong thi chi chay
   logic can thiet (cap nhat so), khong chay animation.
   ========================================================================== */
(function(){
  "use strict";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s){ return document.querySelector(s); }
  function $all(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function on(el, ev, fn){ if (el) el.addEventListener(ev, fn); }

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
  function beam(){
    var card = $(".balance-card");
    if (!card || reduceMotion) return;
    card.classList.remove("beam");
    void card.offsetWidth; /* restart animation */
    card.classList.add("beam");
    setTimeout(function(){ card.classList.remove("beam"); }, 1000);
  }
  document.addEventListener("anhdev:balance", function(e){
    var v = (e.detail && typeof e.detail.value === "number") ? e.detail.value : 0;
    var synced = !!(e.detail && e.detail.synced);
    if (lastBalance === null){ lastBalance = v; return; } /* lan dau: khong dem */
    var from = lastBalance;
    lastBalance = v;
    if (from === v) return;
    if (synced) beam();
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
  document.addEventListener("anhdev:checkin", function(e){
    var amt = (e.detail && e.detail.amount) || 0;
    confetti(42);
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
      lockY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = "-" + lockY + "px";
      document.body.classList.add("modal-lock");
    } else if (!on && locked){
      locked = false;
      document.body.classList.remove("modal-lock");
      document.body.style.top = "";
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
})();
