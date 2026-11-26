/* ============================================================================
   Test frontend — Hero CTA + toan bo anh (Worker B3, 2026-11-26)
   ----------------------------------------------------------------------------
   Chay:  NODE_PATH=/tmp/node_modules node tests/test-hero-cta.js
   (tu thu muc files/store-upgrade/)
   Can: jsdom (da co o /tmp/node_modules), stock.json that o
   ../anhdev-store-push/stock.json (neu co).

   Kich ban:
     A. Hero CTA "Kham pha kho": co chu trong DOM; computed style SAU khi
        nap uiverse.css + animations.css dung thu tu trang that phai la
        nen trang + chu xanh dam, tuong phan >= 4.5:1 — o ca Light, Dark
        va khi KHONG co uiverse.css (gia lap file CSS chua ve / cache cu).
     B. Anh hero <img> dung kich thuoc that cua hero-01.webp (1920x1080).
     C. Moi <img> trong index.html + moi img: trong catalog demo (app.js)
        deu tro toi file ton tai trong working copy; moi file anh la WebP
        hop le (magic RIFF/WEBP).
     D. Ca 20 anh heroes/hero-01..20.webp ton tai + hop le.
     E. Kho that (stock.json): khong acc nao co photos -> the acc that
        khong render <img> ngoai (chi khoi gradient .card-head).
     F. Anh VietQR #payQrImg: chua co src + hidden khi chua tao hoa don.
   ============================================================================ */
const fs = require("fs");
const path = require("path");
let JSDOM;
try { JSDOM = require("jsdom").JSDOM; }
catch (e) { JSDOM = require("/tmp/node_modules/jsdom").JSDOM; }

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const uivCss = fs.readFileSync(path.join(ROOT, "assets/uiverse.css"), "utf8");
const animCss = fs.readFileSync(path.join(ROOT, "assets/animations.css"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "assets/app.js"), "utf8");

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; failures.push(name); console.log("FAIL " + name + (extra !== undefined ? " :: " + extra : "")); }
}
function isWebP(p) {
  const b = fs.readFileSync(p);
  return b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
}
function lum(rgb) {
  const m = String(rgb).match(/[\d.]+/g).map(Number);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
}
function contrast(bg, fg) {
  const l1 = lum(bg), l2 = lum(fg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/* Dung thu tu stylesheet nhu trang that: animations.css (link 25) TRUOC
   <style> noi tuyen, uiverse.css (link 499) SAU <style> noi tuyen. */
function makeDom(theme, withUiv) {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const doc = dom.window.document;
  const sAnim = doc.createElement("style"); sAnim.textContent = animCss;
  doc.head.insertBefore(sAnim, doc.querySelector("head style"));
  if (withUiv) {
    const sUiv = doc.createElement("style"); sUiv.textContent = uivCss;
    doc.head.appendChild(sUiv);
  }
  if (theme) doc.documentElement.setAttribute("data-theme", theme);
  return dom;
}
function ctaStyle(dom) {
  const btn = dom.window.document.querySelector('[data-i18n="heroExplore"]');
  const cs = dom.window.getComputedStyle(btn);
  return { text: btn.textContent, bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius };
}

/* ---- A. Hero CTA ---- */
(function () {
  const dom0 = makeDom(null, true);
  const btn = dom0.window.document.querySelector('[data-i18n="heroExplore"]');
  check("a1. nut hero CTA co chu 'Kham pha kho'", !!btn && btn.textContent.trim().length > 0, btn && JSON.stringify(btn.textContent));
  check("a2. nut hero CTA giu class btn-light (nen trang theo thiet ke)", !!btn && btn.classList.contains("btn-light"));
  ["light", "dark"].forEach(function (theme) {
    const s = ctaStyle(makeDom(theme, true));
    const r = contrast(s.bg, s.color);
    check("a3-" + theme + ". CTA co uiverse.css: nen trang + chu dam, tuong phan >= 4.5:1",
      s.bg === "rgb(255, 255, 255)" && r >= 4.5, "bg=" + s.bg + " color=" + s.color + " ratio=" + r.toFixed(2));
  });
  ["light", "dark"].forEach(function (theme) {
    const s = ctaStyle(makeDom(theme, false));
    const r = contrast(s.bg, s.color);
    check("a4-" + theme + ". CTA KHONG uiverse.css: van nen trang + chu dam, tuong phan >= 4.5:1",
      s.bg === "rgb(255, 255, 255)" && r >= 4.5, "bg=" + s.bg + " color=" + s.color + " ratio=" + r.toFixed(2));
  });
  const sPill = ctaStyle(makeDom("light", true));
  check("a5. nut hero CTA van dang vien thuoc (pill 9999px tu shine)", sPill.radius === "9999px", sPill.radius);
})();

/* ---- B. Anh hero dung kich thuoc that ---- */
(function () {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const img = dom.window.document.querySelector(".hero img.bg");
  check("b1. anh hero la assets/heroes/hero-01.webp", !!img && img.getAttribute("src") === "assets/heroes/hero-01.webp", img && img.getAttribute("src"));
  check("b2. width/height dung kich thuoc that cua hero-01.webp (1920x1080)",
    !!img && img.getAttribute("width") === "1920" && img.getAttribute("height") === "1080",
    img && img.getAttribute("width") + "x" + img.getAttribute("height"));
})();

/* ---- C. Moi anh duoc dung deu ton tai + hop le ---- */
(function () {
  const srcs = new Set();
  const reImg = /<img[^>]+src="([^"]+)"/g;
  let m;
  while ((m = reImg.exec(html))) { if (!m[1].startsWith("http")) srcs.add(m[1]); }
  const reDemo = /img:"(assets\/[^"]+)"/g;
  while ((m = reDemo.exec(appJs))) srcs.add(m[1]);
  srcs.add("assets/heroes/hero-01.webp");
  const list = Array.from(srcs).sort();
  check("c1. quet duoc anh noi bo (img HTML + img: demo)", list.length >= 5, list.join(", "));
  list.forEach(function (src) {
    const p = path.join(ROOT, src);
    check("c2. ton tai + WebP hop le: " + src, fs.existsSync(p) && isWebP(p),
      fs.existsSync(p) ? "size=" + fs.statSync(p).size : "THIEU FILE");
  });
})();

/* ---- D. Ca 20 anh heroes ---- */
(function () {
  let ok = 0;
  for (let i = 1; i <= 20; i++) {
    const f = "assets/heroes/hero-" + String(i).padStart(2, "0") + ".webp";
    if (fs.existsSync(path.join(ROOT, f)) && isWebP(path.join(ROOT, f))) ok++;
  }
  check("d1. du 20/20 anh heroes/hero-01..20.webp ton tai + WebP hop le", ok === 20, ok + "/20");
})();

/* ---- E. Kho that khong co photos ---- */
(function () {
  const stockPath = fs.existsSync(path.join(ROOT, "stock.json"))
    ? path.join(ROOT, "stock.json")
    : path.join(__dirname, "..", "..", "anhdev-store-push", "stock.json");
  if (!fs.existsSync(stockPath)) { console.log("SKIP e1. khong tim thay stock.json"); return; }
  const data = JSON.parse(fs.readFileSync(stockPath, "utf8"));
  const items = Array.isArray(data) ? data : (data.accounts || data.data || []);
  const withPhotos = items.filter(function (a) { return a.photos && a.photos.length; });
  check("e1. kho that: 0/" + items.length + " acc co photos -> the acc that khong render <img> ngoai",
    withPhotos.length === 0, withPhotos.length + " acc co photos");
  const iImg = appJs.indexOf("} else if (p.img){");
  const iCover = appJs.indexOf("card-cover");
  const iHead = appJs.indexOf("card-head", iCover);
  check("e2. app.js: acc that khong anh (img=null) roi vao khoi .card-head gradient",
    iImg !== -1 && iCover !== -1 && iCover > iImg && iHead !== -1 && iHead > iCover);
})();

/* ---- F. Anh VietQR ---- */
(function () {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const img = dom.window.document.querySelector("#payQrImg");
  check("f1. #payQrImg chua co src khi chua tao hoa don", !!img && !img.getAttribute("src"));
  check("f2. #payQrImg hidden khi chua tao hoa don", !!img && img.hasAttribute("hidden"));
  check("f3. co fallback text khi QR loi (#payQrFallback)", !!dom.window.document.querySelector("#payQrFallback"));
  check("f4. app.js co onerror an QR + hien fallback", /payQrImg"\)\.addEventListener\("error"/.test(appJs));
})();

console.log("\n" + pass + " PASS, " + fail + " FAIL");
if (failures.length) console.log("FAILURES: " + failures.join(" | "));
process.exit(fail ? 1 : 0);
