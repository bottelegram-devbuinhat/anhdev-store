/* ============================================================================
   Test frontend — An acc da ban khoi luoi (GET /api/shop/sold-codes)
   ----------------------------------------------------------------------------
   Chạy:  NODE_PATH=/tmp/node_modules node tests/test-sold-codes.js
   (từ thư mục files/store-upgrade/)
   Cần: jsdom (đã có ở /tmp/node_modules), stock.json thật ở
   ../anhdev-store-push/stock.json (để có acc thật trong lưới).

   Fake backend trong file này CHỈ dùng dữ liệu test tự bịa — tk|mk trả về
   là "testuser123" / "testpass123" (không phải tk|mk thật). Endpoint
   /api/shop/sold-codes là CONG KHAI (không cần auth): chỉ trả danh sách
   mã acc đã bán, không có tk|mk.

   Kịch bản:
     a. sold-codes trả 3 mã -> 3 acc đó BIẾN KHỎI lưới hoàn toàn (không còn
        nút Mua ngay, không còn thẻ), số lượng giảm TOTAL -> TOTAL-3,
        acc khác vẫn còn; endpoint được gọi đúng 1 lần lúc tải trang.
     b. sold-codes lỗi mạng -> fallback im lặng: lưới vẫn hiện đủ TOTAL acc,
        không toast lỗi, không vỡ trang.
     c. sold-codes trả danh sách rỗng -> lưới đủ TOTAL acc.
     d. mua thành công 1 acc -> acc đó biến khỏi lưới ngay (số lượng -1),
        không còn nút Mua ngay.
     e. server báo 409 sold_out (người khác mua trước) -> acc đó cũng biến
        khỏi lưới ngay + toast báo đã bị mua mất.
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
const stock = JSON.parse(fs.readFileSync(
  (fs.existsSync(path.join(ROOT, "stock.json")) ? path.join(ROOT, "stock.json") : path.join(__dirname, "..", "..", "anhdev-store-push", "stock.json")), "utf8"));
const API_URL = "https://api.test.local";
const TOTAL = (stock.accounts || []).length; // tong kho that, tu stock.json
const SOLD3 = (stock.accounts || []).slice(0, 3).map(function(a){ return a.code; });
const FOURTH = (stock.accounts || [])[3].code;

/* ---------- fake backend -------------------------------------------------- */
const USERS = {
  webbuyer: { password: "buyerpass1", role: "user", balance: 250000 },
};
let soldMode = "ok";       // ok | empty | network | error500
let buyMode = "success";   // success | sold_out
let soldCalls = 0;
let buyCalls = [];
function priceOf(code){
  const a = (stock.accounts || []).find(function(x){ return x.code === code; });
  return a ? a.price : 0;
}
function makeResp(status, obj){
  return { ok: status >= 200 && status < 300, status: status,
           text: function(){ return Promise.resolve(JSON.stringify(obj)); },
           json: function(){ return Promise.resolve(obj); } };
}
function fakeFetch(url, opts){
  opts = opts || {};
  const u = String(url);
  if (u.indexOf("stock.json") !== -1) return Promise.resolve(makeResp(200, stock));
  if (u.indexOf("/api/shop/sold-codes") !== -1){
    soldCalls++;
    if (soldMode === "network") return Promise.reject(new TypeError("Failed to fetch"));
    if (soldMode === "error500")
      return Promise.resolve(makeResp(500, { ok: false, error: "internal" }));
    if (soldMode === "empty") return Promise.resolve(makeResp(200, { ok: true, codes: [] }));
    return Promise.resolve(makeResp(200, { ok: true, codes: SOLD3.slice() }));
  }
  const body = opts.body ? JSON.parse(opts.body) : null;
  const auth = (opts.headers && opts.headers.Authorization) || "";
  const tokenUser = auth.replace(/^Bearer\s+/, "").replace(/^jwt-/, "");
  if (u.indexOf("/api/auth/login") !== -1){
    const rec = USERS[body && body.username];
    if (!rec || rec.password !== (body && body.password))
      return Promise.resolve(makeResp(401, { ok: false, error: "Sai tên đăng nhập hoặc mật khẩu." }));
    return Promise.resolve(makeResp(200, { ok: true, token: "jwt-" + body.username }));
  }
  if (u.indexOf("/api/auth/me") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    return Promise.resolve(makeResp(200, { ok: true, user: { username: tokenUser, balance: rec.balance,
      role: rec.role, discount_percent: 0, telegram_id: null } }));
  }
  if (u.indexOf("/api/auth/logout") !== -1) return Promise.resolve(makeResp(200, { ok: true }));
  if (u.indexOf("/api/shop/buy") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    const code = body && body.code;
    buyCalls.push({ code: code });
    if (buyMode === "sold_out")
      return Promise.resolve(makeResp(409, { ok: false, error: "sold_out", message: "Acc nay da duoc ban." }));
    const price = priceOf(code);
    if (rec.balance < price)
      return Promise.resolve(makeResp(402, { ok: false, error: "insufficient_balance",
        price: price, balance: rec.balance, shortfall: price - rec.balance }));
    rec.balance -= price;
    return Promise.resolve(makeResp(200, { ok: true,
      order: { id: 1, code: code, price: price, balance: rec.balance },
      account: { username: "testuser123", password: "testpass123" } }));
  }
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
  // Cho kho that tai xong (so luong bat dau bang "1212") roi doi them cho
  // fetch sold-codes chay xong (ca 2 deu la fake fetch, xong trong vai tick).
  for (let i = 0; i < 40; i++){
    await sleep(150);
    const pc = w.document.querySelector("#prodCount");
    if (pc && pc.textContent.indexOf("1212") !== -1) break;
  }
  await sleep(600);
  return { dom: dom, w: w };
}
function prodCount(w){
  const el = w.document.querySelector("#prodCount");
  return el ? el.textContent : "";
}
function toasts(w){
  return Array.from(w.document.querySelectorAll(".toast-item")).map(function(t){ return t.textContent; });
}
function balanceText(w){
  const el = w.document.querySelector("[data-balance]");
  return el ? el.textContent : "";
}
function hasBuyBtn(w, code){
  return !!w.document.querySelector('[data-buy="api-' + code + '"]');
}
async function searchFor(w, query){
  /* Tim 1 acc cu the bang o search — luoi da xao tron nen acc khong con
     nam co dinh o trang 1, khong the kiem tra nut Mua ngay truc tiep nua.
     Debounce search la 120ms nen doi 400ms cho chac. */
  const input = w.document.querySelector("#searchInput");
  input.value = query;
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(400);
}
async function login(w, user, pass){
  const d = w.document;
  d.querySelector("#topLoginBtn").click();
  await sleep(100);
  d.querySelector("#authUser").value = user;
  d.querySelector("#authPass").value = pass;
  d.querySelector("#authForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(900);
}
function firstRealBuyBtn(w){
  const btns = Array.from(w.document.querySelectorAll("[data-buy]"));
  return btns.find(function(b){ return (b.getAttribute("data-buy") || "").indexOf("api-") === 0; }) || null;
}

(async function(){
  console.log("== a. sold-codes tra 3 ma -> 3 acc bien khoi luoi ==");
  soldMode = "ok"; buyMode = "success"; soldCalls = 0; buyCalls = [];
  const p1 = await makePage();
  check("a1. so luong giam " + TOTAL + " -> " + (TOTAL - 3) + " (ca tu so va mau so)",
    prodCount(p1.w).indexOf((TOTAL - 3) + " / " + (TOTAL - 3)) !== -1, prodCount(p1.w));
  SOLD3.forEach(function(code, i){
    check("a2." + (i + 1) + ". acc da ban " + code + " khong con nut Mua ngay",
      !hasBuyBtn(p1.w, code));
  });
  await searchFor(p1.w, FOURTH);
  check("a3. acc chua ban (" + FOURTH + ") van con nut Mua ngay (tim bang search, vi luoi da xao tron)",
    hasBuyBtn(p1.w, FOURTH));
  check("a4. endpoint sold-codes duoc goi dung 1 lan luc tai trang",
    soldCalls === 1, "soldCalls=" + soldCalls);

  console.log("== b. sold-codes loi mang -> fallback hien du luoi ==");
  soldMode = "network"; soldCalls = 0;
  const p2 = await makePage();
  check("b1. loi mang: luoi van du " + TOTAL + " acc",
    prodCount(p2.w).indexOf(TOTAL + " / " + TOTAL) !== -1, prodCount(p2.w));
  await searchFor(p2.w, SOLD3[0]);
  check("b2. loi mang: acc dau tien van con nut Mua ngay (tim bang search, vi luoi da xao tron)",
    hasBuyBtn(p2.w, SOLD3[0]));
  check("b3. loi mang: khong co toast loi nao hien",
    toasts(p2.w).length === 0, JSON.stringify(toasts(p2.w)));

  console.log("== c. sold-codes tra danh sach rong ==");
  soldMode = "empty"; soldCalls = 0;
  const p3 = await makePage();
  check("c1. danh sach rong: luoi du " + TOTAL + " acc",
    prodCount(p3.w).indexOf(TOTAL + " / " + TOTAL) !== -1, prodCount(p3.w));

  console.log("== d. mua thanh cong -> acc vua mua bien khoi luoi ngay ==");
  soldMode = "empty"; buyMode = "success"; buyCalls = [];
  USERS.webbuyer.balance = 250000;
  const p4 = await makePage();
  check("d0. truoc khi mua: luoi du " + TOTAL + " acc",
    prodCount(p4.w).indexOf(TOTAL + " / " + TOTAL) !== -1, prodCount(p4.w));
  await login(p4.w, "webbuyer", "buyerpass1");
  check("d1. dang nhap web thanh cong", balanceText(p4.w) === "250.000đ", balanceText(p4.w));
  const btn4 = firstRealBuyBtn(p4.w);
  const code4 = btn4 ? btn4.getAttribute("data-buy").replace("api-", "") : "";
  btn4.click();
  await sleep(300);
  p4.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("d2. mua thanh cong (modal hien tk|mk fake)",
    (p4.w.document.querySelector("#buyBody") || {}).textContent.indexOf("testuser123") !== -1);
  check("d3. acc vua mua khong con nut Mua ngay",
    !hasBuyBtn(p4.w, code4), "code=" + code4);
  check("d4. so luong giam con " + (TOTAL - 1) + " / " + (TOTAL - 1),
    prodCount(p4.w).indexOf((TOTAL - 1) + " / " + (TOTAL - 1)) !== -1, prodCount(p4.w));

  console.log("== e. 409 sold_out -> acc cung bien khoi luoi ==");
  soldMode = "empty"; buyMode = "sold_out"; buyCalls = [];
  USERS.webbuyer.balance = 250000;
  const p5 = await makePage();
  await login(p5.w, "webbuyer", "buyerpass1");
  const btn5 = firstRealBuyBtn(p5.w);
  const code5 = btn5 ? btn5.getAttribute("data-buy").replace("api-", "") : "";
  btn5.click();
  await sleep(300);
  p5.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("e1. 409 -> toast bao acc vua bi mua mat",
    toasts(p5.w).some(function(t){ return t.indexOf("vừa được người khác mua") !== -1; }),
    JSON.stringify(toasts(p5.w)));
  check("e2. acc 409 khong con nut Mua ngay",
    !hasBuyBtn(p5.w, code5), "code=" + code5);
  check("e3. so luong giam con " + (TOTAL - 1) + " / " + (TOTAL - 1),
    prodCount(p5.w).indexOf((TOTAL - 1) + " / " + (TOTAL - 1)) !== -1, prodCount(p5.w));

  console.log("\nKET QUA: " + pass + " PASS, " + fail + " FAIL");
  if (failures.length) console.log("FAILURES: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})();
