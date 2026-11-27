/* ============================================================================
   Test frontend — Lich su mua hang (don mua acc tren web)
   ----------------------------------------------------------------------------
   Chay:  NODE_PATH=/tmp/node_modules node tests/test-orders-history.js
   (tu thu muc files/store-upgrade/)
   Can: jsdom (da co o /tmp/node_modules), stock.json that o
   ../anhdev-store-push/stock.json (de co acc that trong luoi).

   Hoi quy bug "lich su bi loi chua luu dc cai j het" (2026-11-25):
   state.orders truoc day chi duoc them trong bo nho khi mua ngay trong
   phien — app KHONG BAO GIO goi GET /api/shop/orders va KHONG luu don
   xuong localStorage. Tai lai trang la lich su trong rong du backend da
   luu don (LQ12126 mua that 21:05 da co trong GET /api/shop/orders).
   Sua (assets/app.js): refreshBackendOrders() + load/saveWebOrders() +
   goi o setUser (tai khoan web) va showView("orders").

   Fake backend trong file nay CHI dung du lieu test tu bia — tk|mk tra ve
   la "testuser123" / "testpass123" (khong phai tk|mk that). No mo phong
   dung hop dong backend da kiem chung: login -> JWT, /me -> {user},
   POST /api/shop/buy -> 200 (kem tk|mk fake), GET /api/shop/orders ->
   200 {orders:[{id, code, price, status, created_at}]} (KHONG co tk|mk),
   GET /api/shop/orders/<code>/credentials -> 200 {code, username, password}
   (tk|mk fake "testuser123" / "testpass123"; mode fail -> 403,
   network -> loi mang, slow -> tra cham 400ms).

   Kich ban:
     a. don backend hien trong lich su ngay sau khi dang nhap (bug goc):
        GET /api/shop/orders tra 1 don -> mo Don hang thay don do, khong
        thay "Chua co don hang nao", co nhan "da hien thi 1 lan".
     b. mua web xong luu localStorage (CHI metadata, KHONG tk|mk) + tai lai
        trang khoi phuc metadata: mua 1 acc -> localStorage co don (code +
        ten + gia, KHONG co testuser123) -> mo trang moi (seed token + don
        da luu) -> lich su van thay don nhung phai bam "Xem lai tai khoan"
        de goi API lay tk|mk ve RAM, khong trung lap voi don backend cung ma.
     c. GET /api/shop/orders loi mang: lich su khong vo, van hien trang
        thai trong / don local, trang van chay binh thuong.
     d. dang xuat: don bien khoi bo nho, mo Don hang chi con man hinh
        dang nhap, khong thay don cu.
   e. xem lai tk|mk don khong co ban local (nut "Xem lại tài khoản"):
        bam nut -> GET /api/shop/orders/<code>/credentials -> tk|mk
        hien dang che + nut mat nhu don mua trong phien, tk|mk CHI nam
        trong RAM (KHONG luu xuong localStorage — lan sau phai bam Xem lai
        de goi API lai); don da co tk|mk local thi KHONG co nut nay.
   f. GET /credentials loi (403): toast loi, fallback + nut Xem lai
        nguyen ven, khong luu tk|mk.
   g. bam nut 2 lan lien tiep trong luc dang goi: chi goi backend 1 lan
        (nut bi khoa + hien "Đang lấy…").
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
};
let ordersMode = "one";    // one | empty | network
let ordersCalls = [];      // moi request GET /api/shop/orders
let BACKEND_ORDERS = [];   // don backend tra ve (fake shop_orders)
let revealMode = "ok";     // ok | fail | network | slow (GET .../credentials)
let revealCalls = [];      // moi request GET /api/shop/orders/<code>/credentials
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
  const body = opts.body ? JSON.parse(opts.body) : null;
  const auth = (opts.headers && opts.headers.Authorization) || "";
  const tokenUser = auth.replace(/^Bearer\s+/, "").replace(/^jwt-/, "");
  if (u.indexOf("/api/auth/login") !== -1){
    const rec = USERS[body && body.username];
    if (!rec || rec.password !== (body && body.password))
      return Promise.resolve(makeResp(401, { ok: false, error: "Sai ten dang nhap hoac mat khau." }));
    return Promise.resolve(makeResp(200, { ok: true, token: "jwt-" + body.username }));
  }
  if (u.indexOf("/api/auth/me") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    return Promise.resolve(makeResp(200, { ok: true, user: { username: tokenUser, balance: rec.balance,
      role: rec.role, discount_percent: 0, telegram_id: null } }));
  }
  if (u.indexOf("/api/auth/logout") !== -1) return Promise.resolve(makeResp(200, { ok: true }));
  if (u.indexOf("/credentials") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    const m = u.match(/\/api\/shop\/orders\/([^\/]+)\/credentials/);
    const code = m ? decodeURIComponent(m[1]) : null;
    revealCalls.push({ code: code });
    if (revealMode === "fail") return Promise.resolve(makeResp(403, { ok: false, error: "not_owner" }));
    if (revealMode === "network") return Promise.reject(new TypeError("Failed to fetch"));
    const okResp = function(){ return makeResp(200, { ok: true, code: code, username: "testuser123", password: "testpass123" }); };
    if (revealMode === "slow") return new Promise(function(res){ setTimeout(function(){ res(okResp()); }, 400); });
    return Promise.resolve(okResp());
  }
  if (u.indexOf("/api/shop/orders") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    ordersCalls.push({});
    if (ordersMode === "network") return Promise.reject(new TypeError("Failed to fetch"));
    if (ordersMode === "empty") return Promise.resolve(makeResp(200, { ok: true, orders: [] }));
    return Promise.resolve(makeResp(200, { ok: true, orders: BACKEND_ORDERS.slice() }));
  }
  if (u.indexOf("/api/shop/buy") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    const code = body && body.code;
    buyCalls.push({ code: code });
    const price = priceOf(code);
    if (rec.balance < price)
      return Promise.resolve(makeResp(402, { ok: false, error: "insufficient_balance",
        price: price, balance: rec.balance, shortfall: price - rec.balance }));
    rec.balance -= price;
    BACKEND_ORDERS.unshift({ id: 99, code: code, price: price,
      status: "delivered", created_at: "2026-11-25 14:03:29" });
    return Promise.resolve(makeResp(200, { ok: true,
      order: { id: 99, code: code, price: price, balance: rec.balance },
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
  const appSrc = appJs.replace(/var API_BASE_URL = "[^"]*";/, 'var API_BASE_URL = "' + API_URL + '";');
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/",
    runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = function(){ return { matches: false, media: "", addEventListener: function(){}, removeEventListener: function(){} }; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return null; };
  w.fetch = fakeFetch;
  if (opts.seedLocalStorage){
    Object.keys(opts.seedLocalStorage).forEach(function(k){
      w.localStorage.setItem(k, opts.seedLocalStorage[k]);
    });
  }
  dom.window.eval(animJs);
  dom.window.eval(appSrc);
  for (let i = 0; i < 40; i++){
    await sleep(150);
    const pc = w.document.querySelector("#prodCount");
    if (pc && pc.textContent.indexOf("12126") !== -1) break;
  }
  return { dom: dom, w: w };
}
function ordersText(w){
  const el = w.document.querySelector("#ordersList");
  return el ? el.textContent : "";
}
function ordersRows(w){
  return w.document.querySelectorAll("#ordersList .order").length;
}
function balanceText(w){
  const el = w.document.querySelector("[data-balance]");
  return el ? el.textContent : "";
}
async function login(w, user, passw){
  const d = w.document;
  d.querySelector("#topLoginBtn").click();
  await sleep(100);
  d.querySelector("#authUser").value = user;
  d.querySelector("#authPass").value = passw;
  d.querySelector("#authForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(900);
}
async function openOrders(w){
  const btn = w.document.querySelector('[data-nav="orders"]');
  if (btn) btn.click();
  await sleep(600);
}
function firstRealBuyBtn(w){
  const btns = Array.from(w.document.querySelectorAll("[data-buy]"));
  return btns.find(function(b){ return (b.getAttribute("data-buy") || "").indexOf("api-") === 0; }) || null;
}

(async function(){
  console.log("== a. don backend hien trong lich su ngay sau khi dang nhap ==");
  ordersMode = "one"; ordersCalls = [];
  BACKEND_ORDERS = [{ id: 7, code: "LQ9002", price: 3000,
    status: "delivered", created_at: "2026-11-25 14:03:29" }];
  const p1 = await makePage({});
  await login(p1.w, "webbuyer", "buyerpass1");
  check("a1. dang nhap web thanh cong", balanceText(p1.w) === "250.000đ", balanceText(p1.w));
  check("a2. app goi GET /api/shop/orders sau khi dang nhap", ordersCalls.length >= 1,
    "ordersCalls=" + ordersCalls.length);
  await openOrders(p1.w);
  check("a3. lich su hien don backend LQ9002 (khong phai 'Chua co don hang nao')",
    ordersText(p1.w).indexOf("LQ9002") !== -1
    && ordersText(p1.w).indexOf("Chưa có đơn hàng nào") === -1, ordersText(p1.w).slice(0, 200));
  check("a4. lich su hien dung gia 3.000đ", ordersText(p1.w).indexOf("3.000") !== -1,
    ordersText(p1.w).slice(0, 200));
  check("a5. lich su khong hien 'undefined' (ten/gio duoc map tu backend)",
    ordersText(p1.w).indexOf("undefined") === -1, ordersText(p1.w).slice(0, 300));
  check("a6. don khong co tk|mk local thi hien nhan 'da hien thi 1 lan' (khong doi sang bot)",
    ordersText(p1.w).indexOf("đã hiển thị 1 lần") !== -1
    && ordersText(p1.w).indexOf("Mở bot") === -1, ordersText(p1.w).slice(0, 300));
  check("a7. dung 1 dong don", ordersRows(p1.w) === 1, "rows=" + ordersRows(p1.w));

  console.log("== b. mua web -> luu localStorage -> tai lai trang khoi phuc kem tk|mk ==");
  ordersMode = "one"; ordersCalls = []; buyCalls = [];
  BACKEND_ORDERS = [];
  USERS.webbuyer.balance = 250000;
  const p2 = await makePage({});
  await login(p2.w, "webbuyer", "buyerpass1");
  const btn2 = firstRealBuyBtn(p2.w);
  check("b1. tim duoc nut Mua ngay cua acc that", !!btn2);
  const code2 = btn2 ? btn2.getAttribute("data-buy").replace("api-", "") : "";
  btn2.click();
  await sleep(300);
  p2.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  const storedRaw = p2.w.localStorage.getItem("anhdev_web_orders_webbuyer") || "";
  check("b2. don vua mua duoc luu xuong localStorage CHI metadata (co code, KHONG co tk|mk fake)",
    storedRaw.indexOf(code2) !== -1 && storedRaw.indexOf("testuser123") === -1 &&
    storedRaw.indexOf("testpass123") === -1 && storedRaw.indexOf("testpass") === -1,
    storedRaw.slice(0, 200));
  await openOrders(p2.w);
  const eye2 = p2.w.document.querySelector(".ord-eye-btn");
  check("b3a. tk/mk mac dinh bi che (••••••••) trong lich su",
    !!eye2 && ordersText(p2.w).indexOf(code2) !== -1 && ordersText(p2.w).indexOf("••••••••") !== -1 && ordersText(p2.w).indexOf("testuser123") === -1,
    ordersText(p2.w).slice(0, 200));
  if (eye2) eye2.click();
  check("b3b. bam mat thi hien tk/mk cua don do",
    ordersText(p2.w).indexOf("testuser123") !== -1 && ordersText(p2.w).indexOf("testpass123") !== -1,
    ordersText(p2.w).slice(0, 200));
  if (eye2) eye2.click();
  check("b3c. bam mat lan nua thi an lai tk/mk",
    ordersText(p2.w).indexOf("testuser123") === -1 && ordersText(p2.w).indexOf("••••••••") !== -1,
    ordersText(p2.w).slice(0, 200));
  check("b4. khong trung lap don (local + backend cung ma chi 1 dong)",
    ordersRows(p2.w) === 1, "rows=" + ordersRows(p2.w));
  // "Tai lai trang": trang moi, seed token + don da luu truoc khi eval app.js.
  // Don da luu gio CHI co metadata (khong tk|mk) -> lich su phai hien nut
  // "Xem lai tai khoan" thay vi nut mat; bam nut moi goi API lay tk|mk ve RAM.
  const p2b = await makePage({ seedLocalStorage: {
    "anhdev_web_token": "jwt-webbuyer",
    "anhdev_web_orders_webbuyer": storedRaw } });
  await sleep(900); // doi restoreWebSession (/me) + refreshBackendOrders
  await openOrders(p2b.w);
  const rv2b = p2b.w.document.querySelector(".ord-reveal-btn");
  check("b5a. sau khi tai lai trang, don chi co metadata nen hien nut 'Xem lại tài khoản', khong co nut mat, khong lo tk|mk",
    !!rv2b && rv2b.getAttribute("data-reveal") === code2 && !p2b.w.document.querySelector(".ord-eye-btn") &&
    ordersText(p2b.w).indexOf(code2) !== -1 && ordersText(p2b.w).indexOf("testuser123") === -1,
    ordersText(p2b.w).slice(0, 200));
  if (rv2b) rv2b.click();
  await sleep(600);
  const eye2b = p2b.w.document.querySelector(".ord-eye-btn");
  check("b5b. sau khi tai lai trang, bam Xem lai thi goi API lay tk|mk ve RAM: tk/mk bi che mac dinh + co nut mat, khong con nut Xem lai",
    !!eye2b && !p2b.w.document.querySelector(".ord-reveal-btn") && ordersText(p2b.w).indexOf("••••••••") !== -1 && ordersText(p2b.w).indexOf("testuser123") === -1,
    ordersText(p2b.w).slice(0, 200));
  if (eye2b) eye2b.click();
  check("b5c. sau khi tai lai trang, bam mat thi hien tk|mk vua lay ve",
    ordersText(p2b.w).indexOf("testuser123") !== -1 && ordersText(p2b.w).indexOf("testpass123") !== -1,
    ordersText(p2b.w).slice(0, 200));
  check("b6. sau khi tai lai trang, khong trung lap don",
    ordersRows(p2b.w) === 1, "rows=" + ordersRows(p2b.w));

  console.log("== c. GET /api/shop/orders loi mang: lich su khong vo ==");
  ordersMode = "network"; ordersCalls = [];
  BACKEND_ORDERS = [];
  USERS.webbuyer.balance = 250000; // reset sau don mua o (b)
  const p3 = await makePage({});
  await login(p3.w, "webbuyer", "buyerpass1");
  await openOrders(p3.w);
  check("c1. loi mang thi lich su hien trang thai trong (khong vo trang)",
    ordersText(p3.w).indexOf("Chưa có đơn hàng nào") !== -1, ordersText(p3.w).slice(0, 200));
  check("c2. trang van chay binh thuong (so du van hien)",
    balanceText(p3.w).indexOf("250.000") !== -1, balanceText(p3.w));

  console.log("== d. dang xuat: don bien khoi bo nho ==");
  ordersMode = "one"; ordersCalls = [];
  BACKEND_ORDERS = [{ id: 7, code: "LQ9002", price: 3000,
    status: "delivered", created_at: "2026-11-25 14:03:29" }];
  USERS.webbuyer.balance = 250000; // reset sau don mua o (b)
  const p4 = await makePage({});
  await login(p4.w, "webbuyer", "buyerpass1");
  await openOrders(p4.w);
  check("d1. truoc khi dang xuat thay don LQ9002",
    ordersText(p4.w).indexOf("LQ9002") !== -1, ordersText(p4.w).slice(0, 200));
  const accBtn = p4.w.document.querySelector('[data-nav="account"]');
  if (accBtn) accBtn.click();
  await sleep(400);
  const logoutBtn = p4.w.document.querySelector("#accLogout");
  check("d2. tim duoc nut dang xuat", !!logoutBtn);
  if (logoutBtn) logoutBtn.click();
  await sleep(500);
  await openOrders(p4.w);
  check("d3. sau khi dang xuat, lich su chi con man hinh dang nhap (khong thay don cu)",
    ordersText(p4.w).indexOf("Đăng nhập để xem đơn hàng") !== -1
    && ordersText(p4.w).indexOf("LQ9002") === -1, ordersText(p4.w).slice(0, 200));

  console.log("== e. xem lai tk|mk don khong co ban local (GET /credentials) ==");
  ordersMode = "one"; ordersCalls = []; revealMode = "ok"; revealCalls = [];
  BACKEND_ORDERS = [{ id: 7, code: "LQ9002", price: 3000,
    status: "delivered", created_at: "2026-11-25 14:03:29" }];
  USERS.webbuyer.balance = 250000;
  const p5 = await makePage({});
  await login(p5.w, "webbuyer", "buyerpass1");
  await openOrders(p5.w);
  const rv5 = p5.w.document.querySelector(".ord-reveal-btn");
  check("e1. don khong co tk|mk local thi hien nut 'Xem lại tài khoản' (data-reveal=LQ9002), khong co nut mat",
    !!rv5 && rv5.getAttribute("data-reveal") === "LQ9002" && !p5.w.document.querySelector(".ord-eye-btn"),
    rv5 ? rv5.outerHTML.slice(0, 200) : "no button");
  check("e2. van hien nhan 'da hien thi 1 lan' truoc khi xem lai",
    ordersText(p5.w).indexOf("đã hiển thị 1 lần") !== -1, ordersText(p5.w).slice(0, 200));
  if (rv5) rv5.click();
  await sleep(600);
  check("e3. bam nut goi dung GET /api/shop/orders/LQ9002/credentials",
    revealCalls.length === 1 && revealCalls[0].code === "LQ9002",
    JSON.stringify(revealCalls));
  const eye5 = p5.w.document.querySelector(".ord-eye-btn");
  check("e4. sau khi xem lai: tk/mk bi che (••••••••) + co nut mat, khong con nut Xem lai",
    !!eye5 && !p5.w.document.querySelector(".ord-reveal-btn") && ordersText(p5.w).indexOf("••••••••") !== -1 && ordersText(p5.w).indexOf("testuser123") === -1,
    ordersText(p5.w).slice(0, 200));
  if (eye5) eye5.click();
  check("e5. bam mat thi hien tk/mk vua lay ve",
    ordersText(p5.w).indexOf("testuser123") !== -1 && ordersText(p5.w).indexOf("testpass123") !== -1,
    ordersText(p5.w).slice(0, 200));
  const stored5 = p5.w.localStorage.getItem("anhdev_web_orders_webbuyer") || "";
  check("e6. tk/mk vua lay ve KHONG duoc luu xuong localStorage (chi metadata, tk|mk chi trong RAM)",
    stored5.indexOf("LQ9002") !== -1 && stored5.indexOf("testuser123") === -1 &&
    stored5.indexOf("testpass123") === -1,
    stored5.slice(0, 200));
  check("e7. don da co tk|mk local thi KHONG hien nut Xem lai (chi co nut mat)",
    !p2.w.document.querySelector(".ord-reveal-btn") && !!p2.w.document.querySelector(".ord-eye-btn"));

  console.log("== f. GET /credentials loi: toast loi, fallback nguyen ven ==");
  ordersMode = "one"; revealMode = "fail"; revealCalls = [];
  BACKEND_ORDERS = [{ id: 7, code: "LQ9002", price: 3000,
    status: "delivered", created_at: "2026-11-25 14:03:29" }];
  const p6 = await makePage({});
  await login(p6.w, "webbuyer", "buyerpass1");
  await openOrders(p6.w);
  const rv6 = p6.w.document.querySelector(".ord-reveal-btn");
  check("f1. tim duoc nut Xem lai", !!rv6);
  if (rv6) rv6.click();
  await sleep(600);
  const toast6 = p6.w.document.querySelector("#toastContainer");
  check("f2. loi 403 thi hien toast loi 'Không xem lại được tài khoản'",
    !!toast6 && toast6.textContent.indexOf("Không xem lại được tài khoản") !== -1,
    toast6 ? toast6.textContent : "no toast");
  check("f3. sau khi loi: fallback 'da hien thi 1 lan' van con, nut Xem lai van con, khong co nut mat",
    ordersText(p6.w).indexOf("đã hiển thị 1 lần") !== -1
    && !!p6.w.document.querySelector(".ord-reveal-btn")
    && !p6.w.document.querySelector(".ord-eye-btn"),
    ordersText(p6.w).slice(0, 200));
  check("f4. sau khi loi: tk/mk khong duoc luu xuong localStorage",
    (p6.w.localStorage.getItem("anhdev_web_orders_webbuyer") || "").indexOf("testuser123") === -1);

  console.log("== g. bam nut 2 lan lien tiep chi goi backend 1 lan ==");
  ordersMode = "one"; revealMode = "slow"; revealCalls = [];
  BACKEND_ORDERS = [{ id: 7, code: "LQ9002", price: 3000,
    status: "delivered", created_at: "2026-11-25 14:03:29" }];
  const p7 = await makePage({});
  await login(p7.w, "webbuyer", "buyerpass1");
  await openOrders(p7.w);
  const rv7 = p7.w.document.querySelector(".ord-reveal-btn");
  check("g1. tim duoc nut Xem lai", !!rv7);
  if (rv7){ rv7.click(); rv7.click(); }
  check("g2. nut bi khoa + hien 'Đang lấy…' ngay khi dang goi",
    !!rv7 && rv7.disabled === true && rv7.textContent.indexOf("Đang lấy") !== -1,
    rv7 ? "disabled=" + rv7.disabled + " text=" + rv7.textContent : "no button");
  await sleep(900);
  check("g3. chi goi GET /credentials dung 1 lan du bam 2 lan",
    revealCalls.length === 1, "revealCalls=" + revealCalls.length);
  check("g4. sau khi goi xong: tk/mk bi che + co nut mat",
    !!p7.w.document.querySelector(".ord-eye-btn") && ordersText(p7.w).indexOf("••••••••") !== -1,
    ordersText(p7.w).slice(0, 200));

  console.log("== h. du lieu cu con tk|mk trong localStorage: tu chua khi tai trang (P1 migration) ==");
  ordersMode = "one"; revealMode = "ok"; revealCalls = [];
  BACKEND_ORDERS = [{ id: 7, code: "LQ9002", price: 3000,
    status: "delivered", created_at: "2026-11-25 14:03:29" }];
  const oldRaw = JSON.stringify([{ code: "LQ9002", productName: "Acc LQ9002", price: 3000,
    time: "14:03 · 25/11/2026", user: "testuser123", pass: "testpass123" }]);
  const p8 = await makePage({ seedLocalStorage: {
    "anhdev_web_token": "jwt-webbuyer",
    "anhdev_web_orders_webbuyer": oldRaw } });
  await sleep(900); // doi restoreWebSession (/me) + loadWebOrders (migration) + refreshBackendOrders
  await openOrders(p8.w);
  const stored8 = p8.w.localStorage.getItem("anhdev_web_orders_webbuyer") || "";
  check("h1. ban luu cu con tk|mk duoc ghi de bang ban sach chi metadata (khong con testuser123/testpass123)",
    stored8.indexOf("LQ9002") !== -1 && stored8.indexOf("testuser123") === -1 &&
    stored8.indexOf("testpass123") === -1,
    stored8.slice(0, 200));
  check("h2. sau migration, don hien nut 'Xem lại tài khoản' (khong con nut mat doc tk|mk tu cache)",
    !!p8.w.document.querySelector(".ord-reveal-btn") && !p8.w.document.querySelector(".ord-eye-btn"),
    ordersText(p8.w).slice(0, 200));

  console.log("\nKET QUA: " + pass + " PASS, " + fail + " FAIL");
  if (failures.length) console.log("FAILURES: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})();
