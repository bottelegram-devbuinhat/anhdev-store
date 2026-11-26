/* ============================================================================
   Test frontend — Rieng tu muc Nap tien (va 2026-11-26)
   ----------------------------------------------------------------------------
   Chay:  NODE_PATH=/tmp/node_modules node tests/test-topup-privacy.js
   (tu thu muc files/store-upgrade/)
   Can: jsdom (da co o /tmp/node_modules), stock.json that o
   ../anhdev-store-push/stock.json.

   Kich ban (khoa hanh vi sau va 2026-11-26):
     A. Console: 0 jsdomError / console.error luc load trang.
     B. Anh VietQR (#payQrImg): an + khong co src khi chua tao hoa don;
        co src that (img.vietqr.io) + hien sau khi tao hoa don.
     C. Khong con chu "SePay" trong UI muc Nap tien / Hoa don (VI + EN):
        topupSub, amtHint, invSub.
     D. Dong thong tin chuyen khoan (#bankLine): an + rong khi chua login;
        van an khi da login nhung chua co hoa don; hien (STK + ten chu TK)
        sau khi tao hoa don; doi ngon ngu EN/VI doi theo; an lai sau logout.
   ============================================================================ */
const fs = require("fs");
const path = require("path");
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch (e) { ({ JSDOM, VirtualConsole } = require("/tmp/node_modules/jsdom")); }

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "assets/app.js"), "utf8");
const animJs = fs.readFileSync(path.join(ROOT, "assets/animations.js"), "utf8");
const stock = JSON.parse(fs.readFileSync(
  (fs.existsSync(path.join(ROOT, "stock.json")) ? path.join(ROOT, "stock.json") : path.join(__dirname, "..", "..", "anhdev-store-push", "stock.json")), "utf8"));
const API_URL = "https://api.test.local";

const USERS = {
  nhatdeptrai: { password: "test123456", role: "user" },
  admin2: { password: "x", role: "admin" }
};
function makeResp(status, obj){
  return { ok: status >= 200 && status < 300, status: status,
    text: function(){ return Promise.resolve(JSON.stringify(obj)); },
    json: function(){ return Promise.resolve(obj); } };
}
function fakeFetch(url, opts){
  opts = opts || {};
  const u = String(url);
  if (u.indexOf("stock.json") !== -1) return Promise.resolve(makeResp(200, stock));
  const body = opts.body ? JSON.parse(opts.body) : null;
  const auth = (opts.headers && opts.headers.Authorization) || "";
  const tokenUser = auth.replace(/^Bearer\s+/, "").replace(/^jwt-/, "");
  if (u.indexOf("/api/auth/login") !== -1){
    const rec = USERS[body && body.username];
    if (!rec || rec.password !== (body && body.password))
      return Promise.resolve(makeResp(401, { ok: false, error: "Sai ten dang nhap." }));
    return Promise.resolve(makeResp(200, { ok: true, token: "jwt-" + body.username }));
  }
  if (u.indexOf("/api/auth/me") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    return Promise.resolve(makeResp(200, { ok: true, user: { username: tokenUser, balance: 250000,
      role: rec.role, discount_percent: 0, telegram_id: null } }));
  }
  if (u.indexOf("/api/auth/logout") !== -1) return Promise.resolve(makeResp(200, { ok: true }));
  if (u.indexOf("/api/shop/sold-codes") !== -1)
    return Promise.resolve(makeResp(200, { ok: true, codes: [] }));
  return Promise.resolve(makeResp(404, { ok: false, error: "not found: " + u }));
}

/* ---------- harness ------------------------------------------------------- */
let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

async function main(){
  const jsErrors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", function(e){ jsErrors.push("jsdomError: " + (e && e.message)); });
  vc.on("error", function(m){ jsErrors.push("console.error: " + m); });
  const appSrc = appJs.replace(/var API_BASE_URL = "[^"]*";/, 'var API_BASE_URL = "' + API_URL + '";');
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/",
    runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.matchMedia = function(){ return { matches: false, media: "", addEventListener: function(){}, removeEventListener: function(){} }; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return null; };
  w.fetch = fakeFetch;
  dom.window.eval(animJs);
  dom.window.eval(appSrc);
  for (let i = 0; i < 40; i++){
    await sleep(150);
    const pc = w.document.querySelector("#prodCount");
    if (pc && pc.textContent.indexOf("12126") !== -1) break;
  }
  const d = w.document;
  const STK = "05817666778899";
  const HOLDER = "BUI NGUYEN XUAN NHAT";

  console.log("== A. Console (0 loi) ==");
  check("a1. khong co jsdomError/console.error luc load", jsErrors.length === 0, jsErrors.join(" | "));

  console.log("== B. Anh VietQR (chua tao hoa don) ==");
  const qr = d.querySelector("#payQrImg");
  check("b1. payQrImg hidden + khong co src", qr.hidden === true && !qr.getAttribute("src"),
    "hidden=" + qr.hidden + " src=" + JSON.stringify(qr.getAttribute("src")));

  console.log("== C. Khong con chu SePay (Nap tien / Hoa don) ==");
  const langSel = d.querySelector("#langSelect");
  check("c1. topupSub (VI) khong nhac SePay",
    d.querySelector('[data-i18n="topupSub"]').textContent.indexOf("SePay") === -1,
    d.querySelector('[data-i18n="topupSub"]').textContent);
  check("c2. amtHint (VI) khong nhac SePay",
    d.querySelector('[data-i18n="amtHint"]').textContent.indexOf("SePay") === -1,
    d.querySelector('[data-i18n="amtHint"]').textContent);
  check("c3. invSub (VI) khong nhac SePay",
    d.querySelector('[data-i18n="invSub"]').textContent.indexOf("SePay") === -1,
    d.querySelector('[data-i18n="invSub"]').textContent);
  langSel.value = "en";
  langSel.dispatchEvent(new w.Event("change", { bubbles: true }));
  await sleep(200);
  check("c4. topupSub (EN) khong nhac SePay",
    d.querySelector('[data-i18n="topupSub"]').textContent.indexOf("SePay") === -1,
    d.querySelector('[data-i18n="topupSub"]').textContent);
  check("c5. amtHint (EN) khong nhac SePay",
    d.querySelector('[data-i18n="amtHint"]').textContent.indexOf("SePay") === -1,
    d.querySelector('[data-i18n="amtHint"]').textContent);
  check("c6. invSub (EN) khong nhac SePay",
    d.querySelector('[data-i18n="invSub"]').textContent.indexOf("SePay") === -1,
    d.querySelector('[data-i18n="invSub"]').textContent);
  langSel.value = "vi";
  langSel.dispatchEvent(new w.Event("change", { bubbles: true }));
  await sleep(200);

  console.log("== D. bankLine an/hien theo login + hoa don ==");
  const bankLine = d.querySelector("#bankLine");
  check("d1. chua login: bankLine hidden + rong", bankLine.hidden === true && bankLine.textContent === "",
    "hidden=" + bankLine.hidden + " text=" + JSON.stringify(bankLine.textContent));
  check("d2. chua login: STK khong co trong text bankLine", bankLine.textContent.indexOf(STK) === -1);
  d.querySelector("#topLoginBtn").click();
  await sleep(100);
  d.querySelector("#authUser").value = "nhatdeptrai";
  d.querySelector("#authPass").value = "test123456";
  d.querySelector("#authForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(900);
  check("d3. da login, chua co hoa don: bankLine van hidden", bankLine.hidden === true,
    "hidden=" + bankLine.hidden);
  d.querySelector('[data-amt="10000"]').click();
  d.querySelector("#makeQrBtn").click();
  await sleep(600);
  check("d4. sau khi tao hoa don: bankLine hien", bankLine.hidden === false, "hidden=" + bankLine.hidden);
  check("d5. bankLine (VI) co STK + ten chu TK",
    bankLine.textContent.indexOf(STK) !== -1 && bankLine.textContent.indexOf(HOLDER) !== -1,
    bankLine.textContent);
  check("d6. sau khi tao hoa don: payQrImg co src that + hien",
    qr.getAttribute("src") && qr.getAttribute("src").indexOf("img.vietqr.io") !== -1 && qr.hidden === false,
    "src=" + qr.getAttribute("src") + " hidden=" + qr.hidden);
  langSel.value = "en";
  langSel.dispatchEvent(new w.Event("change", { bubbles: true }));
  await sleep(200);
  check("d7. bankLine (EN) co STK + 'Account'",
    bankLine.textContent.indexOf(STK) !== -1 && bankLine.textContent.indexOf("Account") !== -1,
    bankLine.textContent);
  langSel.value = "vi";
  langSel.dispatchEvent(new w.Event("change", { bubbles: true }));
  await sleep(200);
  d.querySelector("#accLogout").click();
  await sleep(400);
  check("d8. sau khi dang xuat: bankLine hidden + rong", bankLine.hidden === true && bankLine.textContent === "",
    "hidden=" + bankLine.hidden + " text=" + JSON.stringify(bankLine.textContent));

  console.log("\nKET QUA: " + pass + " PASS, " + fail + " FAIL");
  process.exit(fail ? 1 : 0);
}
main().catch(function(e){ console.error(e); process.exit(2); });
