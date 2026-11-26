/* ============================================================================
   Test frontend — Mua acc truc tiep tren web (tra tk|mk ngay)
   ----------------------------------------------------------------------------
   Chạy:  NODE_PATH=/tmp/node_modules node tests/test-shop-buy.js
   (từ thư mục files/store-upgrade/)
   Cần: jsdom (đã có ở /tmp/node_modules), stock.json thật ở
   ../anhdev-store-push/stock.json (để có acc thật trong lưới).

   Fake backend trong file này CHỈ dùng dữ liệu test tự bịa — tk|mk trả về
   là "testuser123" / "testpass123" (không phải tk|mk thật). Nó mô phỏng
   đúng hợp đồng backend đã kiểm chứng: login -> JWT, /me -> {user},
   POST /api/shop/buy -> 200 (kèm tk|mk fake) / 409 sold_out /
   402 insufficient_balance / 500 decrypt_failed / lỗi mạng.

   Kịch bản:
     a. mua thành công: modal hiện tk|mk fake + nút Sao chép + cảnh báo
        "chỉ hiện một lần", số dư trừ đúng, acc bị đánh dấu hết hàng,
        chỉ 1 request buy (không double-buy).
     b. double-click nút Xác nhận: chỉ 1 request buy được gửi.
     c. ví không đủ (client): modal hiện thiếu bao nhiêu + nút Nạp tiền,
        không gọi buy.
     d. server báo 402 insufficient_balance: modal hiện thiếu + Nạp tiền.
     e. server báo 409 sold_out: toast + modal giữ mở, acc đánh dấu hết hàng.
     f. lỗi mạng / 500 decrypt_failed: fallback về modal bot cũ
        ("Mua trong bot @devbn_bot") + toast "không dùng được".
     g. chưa đăng nhập: bấm Mua ngay -> mở modal đăng nhập, không gọi buy.
     h. backend chưa cấu hình (API_BASE_URL rỗng) + user Telegram: bấm mua
        -> modal bot cũ (không gọi web buy).
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

/* ---------- fake backend -------------------------------------------------- */
const USERS = {
  webbuyer: { password: "buyerpass1", role: "user", balance: 250000 },
  poorbuyer: { password: "buyerpass2", role: "user", balance: 1000 },
};
let buyMode = "success";   // success | sold_out | insufficient | network | server_error
let buyCalls = [];         // {code} — moi request POST /api/shop/buy
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
    if (buyMode === "network") return Promise.reject(new TypeError("Failed to fetch"));
    if (buyMode === "server_error")
      return Promise.resolve(makeResp(500, { ok: false, error: "decrypt_failed" }));
    const price = priceOf(code);
    if (buyMode === "sold_out")
      return Promise.resolve(makeResp(409, { ok: false, error: "sold_out", message: "Acc nay da duoc ban." }));
    if (buyMode === "insufficient")
      return Promise.resolve(makeResp(402, { ok: false, error: "insufficient_balance",
        price: price, balance: rec.balance, shortfall: price - rec.balance }));
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

async function makePage(opts){
  opts = opts || {};
  const appSrc = opts.apiBase === ""
    ? appJs.replace(/var API_BASE_URL = "[^"]*";/, 'var API_BASE_URL = "";')
    : appJs.replace(/var API_BASE_URL = "[^"]*";/, 'var API_BASE_URL = "' + API_URL + '";');
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/",
    runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = function(){ return { matches: false, media: "", addEventListener: function(){}, removeEventListener: function(){} }; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return null; };
  if (opts.telegram){
    w.Telegram = { WebApp: { initDataUnsafe: { user: { id: 999001, first_name: "Tg", username: "tgtest" } },
      initData: "test-init-data", ready: function(){}, expand: function(){} } };
  }
  w.fetch = fakeFetch;
  dom.window.eval(animJs);
  dom.window.eval(appSrc);
  for (let i = 0; i < 40; i++){
    await sleep(150);
    const pc = w.document.querySelector("#prodCount");
    if (pc && pc.textContent.indexOf("12126") !== -1) break;
  }
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
/* Số dư hiển thị có hiệu ứng đếm (ticker 650ms trong animations.js):
   sau khi mua, textContent đếm dần từ số dư cũ về số dư mới nên đọc
   ngay sau 700ms có thể vớ đúng lúc đang đếm (247.021đ thay vì 247.000đ).
   Đợi tới khi text ổn định đúng giá trị mong đợi (tối đa ~3s) thay vì
   sleep cố định. */
async function waitForBalance(w, expected, timeoutMs){
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 3000)){
    if (balanceText(w) === expected) return true;
    await sleep(100);
  }
  return balanceText(w) === expected;
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
  // Chi lay acc random/info (khong lay acc trang: user thuong bi khoa nut
  // Mua trang, khach thi thay nut trang — test nay khong mua acc trang).
  const btns = Array.from(w.document.querySelectorAll("[data-buy]"));
  return btns.find(function(b){
    if ((b.getAttribute("data-buy") || "").indexOf("api-") !== 0) return false;
    const card = b.closest("article");
    return !card || card.getAttribute("data-cat") !== "white";
  }) || null;
}
function buyModalText(w){
  const b = w.document.querySelector("#buyBody");
  return b ? b.textContent : "";
}
function buyActionsHtml(w){
  const a = w.document.querySelector("#buyActions");
  return a ? a.innerHTML : "";
}

(async function(){
  console.log("== a. mua thanh cong (webbuyer, 250.000d) ==");
  buyMode = "success"; buyCalls = [];
  const p1 = await makePage({});
  check("a1. kho that da tai (12126 acc)", prodCount(p1.w).indexOf("12126") !== -1, prodCount(p1.w));
  await login(p1.w, "webbuyer", "buyerpass1");
  check("a2. dang nhap web thanh cong, so du 250.000d", balanceText(p1.w) === "250.000đ", balanceText(p1.w));
  const btn1 = firstRealBuyBtn(p1.w);
  check("a3. tim duoc nut Mua ngay cua acc that", !!btn1);
  const code1 = btn1 ? btn1.getAttribute("data-buy").replace("api-", "") : "";
  const price1 = priceOf(code1);
  btn1.click();
  await sleep(300);
  check("a4. modal mua web hien nut Xac nhan mua (khong phai modal bot)",
    buyActionsHtml(p1.w).indexOf("data-buy-confirm") !== -1
    && buyActionsHtml(p1.w).indexOf("Mua trong bot") === -1, buyActionsHtml(p1.w).slice(0, 200));
  p1.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("a5. modal thanh cong hien tk|mk fake + nut Sao chep",
    buyModalText(p1.w).indexOf("testuser123") !== -1
    && buyModalText(p1.w).indexOf("testpass123") !== -1
    && buyModalText(p1.w).indexOf("Sao chép") !== -1, buyModalText(p1.w).slice(0, 200));
  check("a6. modal co canh bao chi hien mot lan",
    buyModalText(p1.w).indexOf("chỉ hiện một lần") !== -1, buyModalText(p1.w).slice(0, 300));
  const expectedBal = (250000 - price1).toLocaleString("vi-VN") + "đ";
  await waitForBalance(p1.w, expectedBal, 3000); // doi ticker dem so du xong
  check("a7. so du tru dung (" + expectedBal + ")", balanceText(p1.w) === expectedBal,
    balanceText(p1.w) + " vs " + expectedBal);
  check("a8. chi 1 request buy duoc gui", buyCalls.length === 1 && buyCalls[0].code === code1,
    JSON.stringify(buyCalls));
  check("a9. acc vua mua khong con nut Mua ngay (het hang)",
    !p1.w.document.querySelector('[data-buy="api-' + code1 + '"]'));
  p1.w.document.querySelector("[data-buy-orders]").click();
  await sleep(400);
  const ordersText = (p1.w.document.querySelector("#ordersList") || {}).textContent || "";
  const eye1 = p1.w.document.querySelector(".ord-eye-btn");
  check("a10a. don hang moi hien trong lich su, tk/mk mac dinh bi che",
    !!eye1 && ordersText.indexOf(code1) !== -1 && ordersText.indexOf("••••••••") !== -1 && ordersText.indexOf("testuser123") === -1,
    ordersText.slice(0, 200));
  if (eye1) eye1.click();
  const ordersTextShown = (p1.w.document.querySelector("#ordersList") || {}).textContent || "";
  check("a10b. bam mat thi hien tk/mk cua don moi mua",
    ordersTextShown.indexOf("testuser123") !== -1 && ordersTextShown.indexOf("testpass123") !== -1,
    ordersTextShown.slice(0, 200));

  console.log("== b. double-click nut Xac nhan ==");
  buyMode = "success"; buyCalls = [];
  USERS.webbuyer.balance = 250000;
  const p2 = await makePage({});
  await login(p2.w, "webbuyer", "buyerpass1");
  const btn2 = firstRealBuyBtn(p2.w);
  btn2.click();
  await sleep(300);
  const confirm2 = p2.w.document.querySelector("[data-buy-confirm]");
  confirm2.click();
  confirm2.click(); // bam 2 lan lien tiep trong cung tick
  await sleep(700);
  check("b1. double-click chi gui 1 request buy", buyCalls.length === 1,
    "buyCalls=" + buyCalls.length);
  check("b2. van mua thanh cong sau double-click",
    buyModalText(p2.w).indexOf("testuser123") !== -1);

  console.log("== c. vi khong du (client chan truoc, poorbuyer 1.000d) ==");
  buyMode = "success"; buyCalls = [];
  const p3 = await makePage({});
  await login(p3.w, "poorbuyer", "buyerpass2");
  const btn3 = firstRealBuyBtn(p3.w);
  btn3.click();
  await sleep(300);
  check("c1. modal hien thieu tien + nut Nap tien, khong co nut Xac nhan",
    buyModalText(p3.w).indexOf("còn thiếu") !== -1
    && buyActionsHtml(p3.w).indexOf("data-buy-topup") !== -1
    && buyActionsHtml(p3.w).indexOf("data-buy-confirm") === -1,
    buyModalText(p3.w).slice(0, 150));
  check("c2. khong goi buy khi vi khong du", buyCalls.length === 0);

  console.log("== d. server bao 402 insufficient_balance ==");
  buyMode = "insufficient"; buyCalls = [];
  USERS.webbuyer.balance = 250000;
  const p4 = await makePage({});
  await login(p4.w, "webbuyer", "buyerpass1");
  const btn4 = firstRealBuyBtn(p4.w);
  btn4.click();
  await sleep(300);
  p4.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("d1. 402 -> modal hien thieu tien + nut Nap tien",
    buyModalText(p4.w).indexOf("còn thiếu") !== -1
    && buyActionsHtml(p4.w).indexOf("data-buy-topup") !== -1,
    buyModalText(p4.w).slice(0, 150));
  check("d2. dung 1 request buy", buyCalls.length === 1);

  console.log("== e. server bao 409 sold_out ==");
  buyMode = "sold_out"; buyCalls = [];
  USERS.webbuyer.balance = 250000;
  const p5 = await makePage({});
  await login(p5.w, "webbuyer", "buyerpass1");
  const btn5 = firstRealBuyBtn(p5.w);
  const code5 = btn5.getAttribute("data-buy").replace("api-", "");
  btn5.click();
  await sleep(300);
  p5.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("e1. 409 -> toast bao acc vua bi mua mat",
    toasts(p5.w).some(function(t){ return t.indexOf("vừa được người khác mua") !== -1; }),
    JSON.stringify(toasts(p5.w)));
  check("e2. modal giu mo voi thong bao het hang + link bot",
    buyModalText(p5.w).indexOf("vừa được người khác mua") !== -1
    && buyActionsHtml(p5.w).indexOf("Mua trong bot") !== -1);
  check("e3. acc het hang khong con nut Mua ngay",
    !p5.w.document.querySelector('[data-buy="api-' + code5 + '"]'));

  console.log("== f. loi mang / 500 -> fallback modal bot ==");
  buyMode = "network"; buyCalls = [];
  USERS.webbuyer.balance = 250000;
  const p6 = await makePage({});
  await login(p6.w, "webbuyer", "buyerpass1");
  const btn6 = firstRealBuyBtn(p6.w);
  btn6.click();
  await sleep(300);
  p6.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("f1. loi mang -> ve modal bot (Mua trong bot @devbn_bot)",
    buyActionsHtml(p6.w).indexOf("Mua trong bot @devbn_bot") !== -1,
    buyActionsHtml(p6.w).slice(0, 200));
  check("f2. toast bao mua web khong dung duoc",
    toasts(p6.w).some(function(t){ return t.indexOf("không dùng được") !== -1; }),
    JSON.stringify(toasts(p6.w)));
  buyMode = "server_error"; buyCalls = [];
  const p6b = await makePage({});
  await login(p6b.w, "webbuyer", "buyerpass1");
  const btn6b = firstRealBuyBtn(p6b.w);
  btn6b.click();
  await sleep(300);
  p6b.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("f3. 500 decrypt_failed -> cung ve modal bot",
    buyActionsHtml(p6b.w).indexOf("Mua trong bot @devbn_bot") !== -1);

  console.log("== g. chua dang nhap ==");
  buyMode = "success"; buyCalls = [];
  const p7 = await makePage({});
  const btn7 = firstRealBuyBtn(p7.w);
  btn7.click();
  await sleep(400);
  check("g1. chua login -> mo modal dang nhap, khong goi buy",
    p7.w.document.querySelector("#authModal") !== null
    && buyCalls.length === 0);
  check("g2. modal mua khong mo (khong co nut Xac nhan)",
    buyActionsHtml(p7.w).indexOf("data-buy-confirm") === -1);

  console.log("== h. backend chua cau hinh + user Telegram ==");
  buyMode = "success"; buyCalls = [];
  const p8 = await makePage({ apiBase: "", telegram: true });
  await sleep(500); // cho Mini App tu dang nhap
  const btn8 = firstRealBuyBtn(p8.w);
  check("h1. user Telegram da dang nhap (khong phai web)", !!btn8);
  btn8.click();
  await sleep(300);
  check("h2. user Telegram -> modal bot cu, khong goi web buy",
    buyActionsHtml(p8.w).indexOf("Mua trong bot @devbn_bot") !== -1
    && buyCalls.length === 0, buyActionsHtml(p8.w).slice(0, 200));

  console.log("\nKET QUA: " + pass + " PASS, " + fail + " FAIL");
  if (failures.length) console.log("FAILURES: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})();
