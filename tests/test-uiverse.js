/* ============================================================================
   Test frontend — Uiverse UI pack Phase 1 (5 components, scope .uiv-)
   ----------------------------------------------------------------------------
   Chay:  NODE_PATH=/tmp/node_modules node tests/test-uiverse.js
   (tu thu muc files/store-upgrade/)
   Can: jsdom (da co o /tmp/node_modules), stock.json that o
   ../anhdev-store-push/stock.json.

   Kich ban:
     A. Tinh (source): 5 class .uiv- ton tai trong uiverse.css; khong class
        chung nao leak ra global (strip comment roi grep); giu comment MIT;
        cac fix tu worker check co mat (loader var(--ink), ripple hover
        #0d6fb8 khong #47a7f5, ripple min-height 44px, shine tat scale
        <=760px + nut full-width, glitch margin:0, glow wrapper
        position:relative + isolation, input width:100%, khong 301px).
     B. Runtime (jsdom): loader hien luc khoi dong + chu VN; glow search giu
        #searchInput + nut × tuy chinh + nut filter that (bat/tat loc "Con
        hang" that); autocomplete van mo; glitch modal giu 2 tab + nut mat +
        login KHONG minlength + data-text submit doi theo tab; shine co tren
        nut Mua ngay / tao VietQR / gui the; ripple CHI tren nut phu (khong
        phai moi <button>); anh VietQR an khi src=""; muc white chi co acc
        trang (khong "acc ban", khong tron vao detail); dropdown goi y la
        sibling cua wrapper glow (khong bi bay xuong duoi lop glow).
     C. Tuong phan (tinh toan ty le WCAG): cac cap mau chu/nen chinh >= 4.5:1.
   ============================================================================ */
const fs = require("fs");
const path = require("path");
let JSDOM;
try { JSDOM = require("jsdom").JSDOM; }
catch (e) { JSDOM = require("/tmp/node_modules/jsdom").JSDOM; }

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "assets/app.js"), "utf8");
const animJs = fs.readFileSync(path.join(ROOT, "assets/animations.js"), "utf8");
const animCss = fs.readFileSync(path.join(ROOT, "assets/animations.css"), "utf8");
const uivCss = fs.readFileSync(path.join(ROOT, "assets/uiverse.css"), "utf8");
const stock = JSON.parse(fs.readFileSync(
  (fs.existsSync(path.join(ROOT, "stock.json")) ? path.join(ROOT, "stock.json") : path.join(__dirname, "..", "..", "anhdev-store-push", "stock.json")), "utf8"));
const API_URL = "https://api.test.local";
const ACCOUNTS = stock.accounts || [];
const TOTAL = ACCOUNTS.length;
const WHITE_CODES = ACCOUNTS.filter(function(a){ return a.kind === "white"; }).map(function(a){ return a.code; });

/* ---------- fake backend (nhu test-white-shuffle.js) ----------------------- */
function makeResp(status, obj){
  return { ok: status >= 200 && status < 300, status: status,
           text: function(){ return Promise.resolve(JSON.stringify(obj)); },
           json: function(){ return Promise.resolve(obj); } };
}
function fakeFetch(url, opts){
  const u = String(url);
  if (u.indexOf("stock.json") !== -1) return Promise.resolve(makeResp(200, stock));
  if (u.indexOf("/api/shop/sold-codes") !== -1)
    return Promise.resolve(makeResp(200, { ok: true, codes: [] }));
  return Promise.resolve(makeResp(404, { ok: false, error: "not found: " + u }));
}

/* ---------- harness ------------------------------------------------------- */
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function lum(hex){
  const c = hex.replace("#", "");
  const ch = function(i){
    const v = parseInt(c.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}
function ratio(fg, bg){
  const l1 = lum(fg), l2 = lum(bg);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

async function makePage(){
  const appSrc = appJs.replace(/var API_BASE_URL = "[^"]*";/,
    'var API_BASE_URL = "' + API_URL + '";');
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/",
    runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = function(){ return { matches: false, media: "", addEventListener: function(){}, removeEventListener: function(){} }; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return null; };
  w.fetch = fakeFetch;
  dom.window.eval(animJs);
  dom.window.eval(appSrc);
  /* Loader phai co NGAY sau eval (truoc khi fetch stock.json xong). */
  const loaderAtBoot = w.document.querySelector("#syncStatus .uiv-liquid-loader");
  const loaderTextAtBoot = loaderAtBoot ? loaderAtBoot.textContent : "";
  for (let i = 0; i < 40; i++){
    await sleep(150);
    const pc = w.document.querySelector("#prodCount");
    if (pc && pc.textContent.indexOf(String(TOTAL)) !== -1) break;
  }
  await sleep(600);
  return { dom: dom, w: w, loaderAtBoot: !!loaderAtBoot, loaderTextAtBoot: loaderTextAtBoot };
}
function prodCount(w){
  const el = w.document.querySelector("#prodCount");
  return el ? el.textContent : "";
}
function clickChip(w, cat){
  const chip = w.document.querySelector('#catChips [data-cat="' + cat + '"]');
  if (!chip) return false;
  chip.click();
  return true;
}
function pageCodes(w){
  return Array.from(w.document.querySelectorAll("#productArea [data-buy]"))
    .map(function(b){ return (b.getAttribute("data-buy") || "").replace(/^api-/, ""); })
    .filter(function(c){ return !!c; });
}

(async function(){
  /* ================= A. Tinh: scope + MIT + cac fix worker check ============ */
  console.log("== A. Source: scope .uiv-, MIT, cac fix tuong phan/responsive ==");
  ["uiv-shine-btn", "uiv-liquid-loader", "uiv-glow-search", "uiv-glitch-auth", "uiv-ripple-btn"].forEach(function(cls){
    check("a1. ." + cls + " ton tai trong uiverse.css",
      uivCss.indexOf("." + cls) !== -1);
  });
  const cssNoComments = uivCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const leaked = ["button", "icon", "grid", "white", "border", "input",
    "card-header", "card-body", "form-group", "submit-btn", "glow",
    "darkBorderBg", "filterBorder", "glitch-card", "glitch-form-wrapper",
    "loading-text", "loader-track", "liquid-fill", "dot"].filter(function(cls){
      return new RegExp("\\." + cls + "(?![a-zA-Z0-9_-])").test(cssNoComments);
    });
  const leakedIds = ["poda", "main", "filter-icon", "search-icon", "input-mask", "pink-mask"].filter(function(id){
    return new RegExp("#" + id + "(?![a-zA-Z0-9_-])").test(cssNoComments);
  });
  check("a2. khong class chung nao leak ra global scope",
    leaked.length === 0 && leakedIds.length === 0,
    "leaked: " + leaked.concat(leakedIds.map(function(x){ return "#" + x; })).join(","));
  check("a3. giu comment MIT (loader + search + glitch = 3)",
    (uivCss.match(/MIT License/g) || []).length >= 3,
    "found " + ((uivCss.match(/MIT License/g) || []).length));
  check("a4. loader: chu dung var(--ink) theo theme (fix trang tren nen sang 1.09:1)",
    /\.uiv-loading-text\s*\{[^}]*color:\s*var\(--ink\)/.test(uivCss));
  check("a5. ripple hover: var(--brand-primary), KHONG con #0d6fb8/#47a7f5 (Worker A doi sang mau brand)",
    /\.uiv-ripple-btn:hover\s*\{[^}]*var\(--brand-primary\)/.test(uivCss) &&
    cssNoComments.indexOf("#0d6fb8") === -1 && cssNoComments.indexOf("#47a7f5") === -1);
  check("a6. ripple mac dinh: nen var(--brand-secondary) + chu var(--brand-secondary-text), KHONG con #1D9AF2/#292D3E (Worker A doi sang mau brand)",
    /\.uiv-ripple-btn\s*\{[^}]*background-color:\s*var\(--brand-secondary\)/.test(uivCss) &&
    /\.uiv-ripple-btn\s*\{[^}]*color:\s*var\(--brand-secondary-text\)/.test(uivCss) &&
    uivCss.indexOf("#1D9AF2") === -1 && uivCss.indexOf("#292D3E") === -1);
  check("a7. ripple min-height 44px (fix chuan cham 36px)",
    /\.uiv-ripple-btn\s*\{[^}]*min-height:\s*44px/.test(uivCss));
  check("a8. shine: tat scale <=760px va tren nut full-width (fix tran card mobile)",
    uivCss.indexOf("@media (max-width: 760px)") !== -1 &&
    uivCss.indexOf(".buy-btn.uiv-shine-btn:hover") !== -1 &&
    /\.uiv-shine-btn:hover\s*\{[^}]*transform:\s*none/.test(uivCss));
  check("a9. glitch: margin:0 khi long trong modal (fix tran ~32px o 390px)",
    /\.uiv-glitch-auth #authForm\s*\{[^}]*margin:\s*0/.test(uivCss));
  check("a10. glow wrapper: position:relative + isolation (fix lop glow can theo viewport)",
    /\.uiv-glow-search\s*\{[^}]*position:\s*relative/.test(uivCss) &&
    uivCss.indexOf("isolation: isolate") !== -1);
  check("a11. glow input width:100%, khong con 301px co dinh",
    /\.uiv-glow-input\s*\{[^}]*width:\s*100%/.test(cssNoComments) && cssNoComments.indexOf("301px") === -1);
  check("a12. glow: an nut xoa native cua input[type=search] (dung nut × tuy chinh)",
    uivCss.indexOf("::-webkit-search-cancel-button") !== -1);
  const zSuggest = (html.match(/--z-suggest:\s*(\d+)/) || [])[1];
  check("a13. dropdown z-index 32 > lop glow (-1/0): thang z-index giu nguyen",
    zSuggest === "32" &&
    animCss.indexOf("z-index:var(--z-suggest)") !== -1 &&
    uivCss.indexOf("z-index: -1") !== -1);
  check("a14. app.js co helper loader + dong bo text VN/EN + guard payQr",
    appJs.indexOf("uivLoaderHtml") !== -1 && appJs.indexOf("syncUivLoaderText") !== -1 &&
    appJs.indexOf("syncPayQrVisibility") !== -1 && appJs.indexOf('loadingStock') !== -1);
  check("a15. .grid o index.html la product grid cua store (khong bi xoa nham)",
    html.indexOf('class="grid"') !== -1 || html.indexOf("grid-template-columns:repeat(auto-fill") !== -1);

  /* ================= B. Runtime (jsdom) ==================================== */
  console.log("== B. Runtime: gan component + giu hanh vi cu ==");
  const p = await makePage();
  const w = p.w, d = w.document;
  check("b1. loader hien ngay luc khoi dong (sync kho) + chu VN",
    p.loaderAtBoot && p.loaderTextAtBoot.indexOf("Đang đồng bộ kho thật") !== -1,
    "text=" + JSON.stringify(p.loaderTextAtBoot));
  check("b2. sau khi kho ve: syncStatus bao kho that (loader da tat)",
    d.querySelector("#syncStatus") && d.querySelector("#syncStatus").textContent.indexOf("Kho thật") !== -1 &&
    !d.querySelector("#syncStatus .uiv-liquid-loader"),
    d.querySelector("#syncStatus") && d.querySelector("#syncStatus").textContent.slice(0, 60));

  console.log("-- B3-B6. Glow search: giu #searchInput, ×, filter, autocomplete --");
  const inp = d.querySelector("#searchInput");
  const clearBtn = d.querySelector("#uivSearchClear");
  const filterBtn = d.querySelector("#uivFilterBtn");
  check("b3. glow search giu #searchInput + nut × tuy chinh + nut filter that",
    !!inp && inp.classList.contains("uiv-glow-input") &&
    !!clearBtn && clearBtn.tagName === "BUTTON" &&
    !!filterBtn && filterBtn.tagName === "BUTTON");
  check("b4. dropdown goi y KHONG nam trong wrapper glow (sibling — khong bi bay xuong duoi)",
    !!d.querySelector("#uivSearchPoda") && !!d.querySelector("#searchSuggest") &&
    d.querySelector("#searchSuggest").parentElement === d.querySelector(".search-wrap") &&
    !d.querySelector("#uivSearchPoda").contains(d.querySelector("#searchSuggest")));
  /* Go xong -> nut × hien; bam × -> o trong + luoi ve du. */
  inp.value = "acc random";
  inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  check("b5. go chu -> nut × hien",
    clearBtn.hidden === false, "hidden=" + clearBtn.hidden);
  await sleep(500);
  check("b6. autocomplete van mo dropdown goi y khi go",
    d.querySelector("#searchSuggest").hidden === false &&
    d.querySelectorAll("#searchSuggest .sug-row").length > 0,
    "rows=" + d.querySelectorAll("#searchSuggest .sug-row").length);
  clearBtn.click();
  await sleep(200);
  check("b7. bam nut × -> o trong + luoi ve du " + TOTAL + " acc",
    inp.value === "" && clearBtn.hidden === true &&
    prodCount(w).indexOf(TOTAL + " / " + TOTAL) !== -1,
    "value=" + JSON.stringify(inp.value) + " count=" + prodCount(w));
  /* Filter: bat/tat that — dong bo ca #stockToggle lan nut glow. */
  const stockToggle = d.querySelector("#stockToggle");
  filterBtn.click();
  check("b8. bam filter -> bat loc Con hang that (#stockToggle + nut glow cung ON)",
    stockToggle.classList.contains("on") && stockToggle.getAttribute("aria-pressed") === "true" &&
    filterBtn.classList.contains("on") && filterBtn.getAttribute("aria-pressed") === "true");
  filterBtn.click();
  check("b9. bam filter lan 2 -> tat loc (ca 2 nut cung OFF)",
    !stockToggle.classList.contains("on") && stockToggle.getAttribute("aria-pressed") === "false" &&
    !filterBtn.classList.contains("on") && filterBtn.getAttribute("aria-pressed") === "false");

  console.log("-- B10-B12. Glitch login: 2 tab, mat, khong minlength, data-text --");
  d.querySelector("#topLoginBtn").click();
  const authModal = d.querySelector("#authModal");
  const authSubmit = d.querySelector("#authSubmit");
  check("b10. modal dang nhap mo + co class uiv-glitch-auth, du 2 tab + nut mat",
    authModal.classList.contains("open") &&
    authModal.querySelector(".modal").classList.contains("uiv-glitch-auth") &&
    !!d.querySelector("#tabLogin") && !!d.querySelector("#tabRegister") &&
    d.querySelectorAll("#authModal .pw-eye").length === 2);
  check("b11. login KHONG co minlength tren #authPass (acc admin mat khau 1 ky tu khong bi chan)",
    !d.querySelector("#authPass").hasAttribute("minlength"));
  check("b12. data-text submit doi theo tab (login -> register -> login)",
    authSubmit.getAttribute("data-text") === "Đăng nhập" &&
    (function(){
      d.querySelector("#tabRegister").click();
      const reg = authSubmit.getAttribute("data-text") === "Tạo tài khoản" &&
        d.querySelector("#passField2").style.display !== "none";
      d.querySelector("#tabLogin").click();
      return reg && authSubmit.getAttribute("data-text") === "Đăng nhập";
    })());
  const eye = d.querySelector('#authModal .pw-eye[data-eye="authPass"]');
  const passInput = d.querySelector("#authPass");
  eye.click();
  check("b13. nut mat doi type password <-> text",
    passInput.type === "text", "type=" + passInput.type);
  eye.click();
  check("b14. khung Telegram login van nam duoi form",
    !!d.querySelector("#telegramLoginWrap") &&
    d.querySelector("#telegramLoginWrap").querySelector("script") !== null);
  /* Doi ngon ngu: nhan aria nut filter + submit doi theo EN. */
  const langSel = d.querySelector("#langSelect");
  langSel.value = "en";
  langSel.dispatchEvent(new w.Event("change", { bubbles: true }));
  check("b15. doi VN->EN: nhan filter + nut submit doi theo EN",
    filterBtn.getAttribute("aria-label") === "In stock only" &&
    authSubmit.textContent === "Log In",
    "aria=" + filterBtn.getAttribute("aria-label") + " submit=" + authSubmit.textContent);
  langSel.value = "vi";
  langSel.dispatchEvent(new w.Event("change", { bubbles: true }));

  console.log("-- B16-B18. Shine / ripple / VietQR --");
  check("b16. shine co tren nut Mua ngay (the acc) + Tao VietQR + Gui the + Kham pha kho",
    d.querySelectorAll("#productArea .buy-btn.uiv-shine-btn").length > 0 &&
    d.querySelector("#makeQrBtn").classList.contains("uiv-shine-btn") &&
    d.querySelector("#cardSubmit").classList.contains("uiv-shine-btn") &&
    d.querySelector('[data-scroll="products"].uiv-shine-btn') !== null,
    "buy-btns=" + d.querySelectorAll("#productArea .buy-btn.uiv-shine-btn").length);
  const allBtns = Array.from(d.querySelectorAll("button"));
  const rippleBtns = allBtns.filter(function(b){ return b.classList.contains("uiv-ripple-btn"); });
  check("b17. ripple CHI tren nut phu — khong phai moi <button>",
    rippleBtns.length > 0 && rippleBtns.length < allBtns.length &&
    d.querySelectorAll("#amountGrid .amount-btn.uiv-ripple-btn").length === 6 &&
    d.querySelector("#topLoginBtn").classList.contains("uiv-ripple-btn") &&
    d.querySelector("#checkinItem").classList.contains("uiv-ripple-btn") &&
    !d.querySelectorAll(".chip.uiv-ripple-btn").length &&
    !d.querySelectorAll(".buy-btn.uiv-ripple-btn").length,
    "ripple=" + rippleBtns.length + "/" + allBtns.length);
  const qrImg = d.querySelector("#payQrImg");
  check("b18. anh VietQR an khi chua co src (chua tao hoa don)",
    qrImg.hidden === true && !qrImg.getAttribute("src"),
    "hidden=" + qrImg.hidden + " src=" + JSON.stringify(qrImg.getAttribute("src")));

  console.log("-- B19-B20. White chi co acc trang --");
  check("b19. loc white -> dung " + WHITE_CODES.length + " acc, the hien nhan trang, khong 'acc ban'",
    clickChip(w, "white") && prodCount(w).indexOf(WHITE_CODES.length + " / " + TOTAL) !== -1 &&
    Array.from(d.querySelectorAll("#productArea .card")).every(function(c){
      const desc = c.querySelector(".desc");
      return desc && desc.textContent.indexOf("Acc trắng thông tin") !== -1 &&
        desc.textContent.indexOf("acc ban") === -1;
    }), prodCount(w));
  check("b20. loc detail -> trang 1 khong co acc trang nao",
    clickChip(w, "detail") &&
    pageCodes(w).every(function(c){ return WHITE_CODES.indexOf(c) === -1; }),
    "detail page1: " + pageCodes(w).slice(0, 5).join(","));

  /* ================= C. Tuong phan (WCAG, tinh toan) ======================== */
  console.log("== C. Tuong phan chu/nen (WCAG AA >= 4.5:1) ==");
  const contrastPairs = [
    /* [BRAND 2026-11-26 Worker D] Cap nhat theo palette Emerald + Vang kim
       (Worker A): cac cap Neon Aurora cu (#7C3AED, #1D9AF2/#292D3E,
       #010201, #00f2ea) khong con tren site — thay bang cac cap chu/nen
       brand that. Vang --brand-gold (#C68B2C) KHONG dung lam chu tren nen
       sang (~2.9:1); chu vang dung alias --gold (#92400E Light /
       #F5B942 Dark) tren --gold-soft, xem 2 cap badge.pend duoi. */
    ["Light text-primary #121E1A tren #F6F4EE", "#121E1A", "#F6F4EE"],
    ["Light text-secondary #5A6963 tren #F6F4EE", "#5A6963", "#F6F4EE"],
    ["Light ripple: #0C4A3B tren #E6EFEA", "#0C4A3B", "#E6EFEA"],
    ["Light CTA: trang tren #0C4A3B", "#ffffff", "#0C4A3B"],
    ["Dark text-primary #F2F6F4 tren #090D0C", "#F2F6F4", "#090D0C"],
    ["Dark text-secondary #93A69F tren #090D0C", "#93A69F", "#090D0C"],
    ["Dark ripple: #6EE7B7 tren #162420", "#6EE7B7", "#162420"],
    ["Dark CTA: #082A20 tren #10B981", "#082A20", "#10B981"],
    ["Hero kicker: vang #F5B942 tren #0C4A3B", "#F5B942", "#0C4A3B"],
    ["badge.pend Light: #92400E tren #FEF3C7", "#92400E", "#FEF3C7"],
    ["badge.pend Dark: #F5B942 tren #2E2410", "#F5B942", "#2E2410"]
  ];
  contrastPairs.forEach(function(p){
    const r = ratio(p[1], p[2]);
    check("c. " + p[0] + " = " + r.toFixed(2) + ":1", r >= 4.5);
  });

  /* ================= D. Theme mac dinh theo he thong + placeholder ========= */
  console.log("== D. Theme mac dinh theo he thong (2026-11-26) + placeholder ==");
  /* --- D1. Tinh --- */
  const htmlTag = (html.match(/<html[^>]*>/) || [""])[0];
  check("d1. the <html> khong con data-theme hardcode",
    htmlTag.indexOf("data-theme") === -1, htmlTag);
  check("d2. CSS co @media (prefers-color-scheme: light) voi palette Light",
    /@media\s*\(\s*prefers-color-scheme:\s*light\s*\)[\s\S]*?:root\s*\{[\s\S]*?--bg:#F6F4EE/.test(html),
    "thieu khoi media light hoac --bg Light");
  check("d3. initTheme khong con 'saved || \"dark\"', co dung matchMedia he thong",
    appJs.indexOf('saved || "dark"') === -1
    && appJs.indexOf('matchMedia("(prefers-color-scheme: dark)")') !== -1);
  check("d4. initTheme co listener doi theme theo he thong khi chua luu tay",
    appJs.indexOf('addEventListener("change"') !== -1);
  const maskRule = (uivCss.match(/\.uiv-glow-input-mask\s*\{[^}]*\}/) || [""])[0];
  check("d5. .uiv-glow-input-mask bi an han (display: none)",
    /display\s*:\s*none/.test(maskRule), maskRule);
  check("d6. placeholder 'Tim ten san pham...' con nguyen",
    html.indexOf('placeholder="Tìm tên sản phẩm..."') !== -1);
  /* --- D2. Runtime: theme theo he thong / luu tay thang --- */
  async function makeThemePage(sysDark, saved){
    const appSrc = appJs.replace(/var API_BASE_URL = "[^"]*";/,
      'var API_BASE_URL = "' + API_URL + '";');
    const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/",
      runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window;
    const mq = { matches: !!sysDark, media: "(prefers-color-scheme: dark)", _h: [],
      addEventListener: function(ev, fn){ if (ev === "change") this._h.push(fn); },
      addListener: function(fn){ this._h.push(fn); },
      removeEventListener: function(){}, removeListener: function(){},
      fire: function(m){ this.matches = !!m; var self = this;
        this._h.forEach(function(fn){ fn.call(self); }); } };
    w.matchMedia = function(q){
      if (String(q).indexOf("prefers-color-scheme") !== -1) return mq;
      return { matches: false, media: q,
        addEventListener: function(){}, removeEventListener: function(){},
        addListener: function(){}, removeListener: function(){} };
    };
    w.HTMLCanvasElement.prototype.getContext = function(){ return null; };
    w.fetch = fakeFetch;
    if (saved) w.localStorage.setItem("anhdev_theme", saved);
    dom.window.eval(animJs);
    dom.window.eval(appSrc);
    return { dom: dom, w: w, mq: mq };
  }
  function themeOf(w){ return w.document.documentElement.getAttribute("data-theme"); }
  let tp = await makeThemePage(true, null);
  check("d7. chua luu + he TOI -> theme dark", themeOf(tp.w) === "dark", themeOf(tp.w));
  tp = await makeThemePage(false, null);
  check("d8. chua luu + he SANG -> theme light", themeOf(tp.w) === "light", themeOf(tp.w));
  tp = await makeThemePage(true, "light");
  check("d9. da luu light + he TOI -> giu light (luu tay thang)", themeOf(tp.w) === "light", themeOf(tp.w));
  tp = await makeThemePage(false, "dark");
  check("d10. da luu dark + he SANG -> giu dark (luu tay thang)", themeOf(tp.w) === "dark", themeOf(tp.w));
  tp = await makeThemePage(true, null);
  tp.mq.fire(false);
  check("d11. chua luu + he doi TOI->SANG -> theme doi sang light", themeOf(tp.w) === "light", themeOf(tp.w));
  tp = await makeThemePage(true, "light");
  tp.mq.fire(false);
  check("d12. da luu light + he doi -> theme van light (khong bi he de)", themeOf(tp.w) === "light", themeOf(tp.w));
  tp = await makeThemePage(false, null);
  tp.w.document.querySelector("#themeDark").click();
  check("d13. bam chon tay dark -> theme dark + luu localStorage",
    themeOf(tp.w) === "dark" && tp.w.localStorage.getItem("anhdev_theme") === "dark",
    themeOf(tp.w) + "/" + tp.w.localStorage.getItem("anhdev_theme"));
  tp.w.document.querySelector("#themeLight").click();
  check("d14. bam chon tay light -> theme light + luu localStorage",
    themeOf(tp.w) === "light" && tp.w.localStorage.getItem("anhdev_theme") === "light",
    themeOf(tp.w) + "/" + tp.w.localStorage.getItem("anhdev_theme"));
  tp = await makeThemePage(false, null);
  const maskEl = tp.w.document.querySelector("#uivInputMask");
  check("d15. element mask #uivInputMask van trong DOM (chi an bang CSS, khong xoa)",
    !!maskEl);
  const searchInp = tp.w.document.querySelector("#searchInput");
  check("d16. input tim kiem con placeholder + khong bi lop phu de (mask display none)",
    !!searchInp && searchInp.getAttribute("placeholder") === "Tìm tên sản phẩm..."
    && /display\s*:\s*none/.test(maskRule));

  console.log("\n" + pass + " PASS, " + fail + " FAIL");
  if (failures.length) console.log("FAILURES: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})().catch(function(e){ console.error(e); process.exit(1); });
