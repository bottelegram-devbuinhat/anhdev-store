/* ============================================================================
   Test frontend — B1 mua acc that tren web (khong phu thuoc kind) + B5 khoa
   frontend acc trang (chi admin mua duoc)
   ----------------------------------------------------------------------------
   Chạy:  NODE_PATH=/tmp/node_modules node tests/test-webbuy-white-lock.js
   (từ thư mục files/store-upgrade/)
   Cần: jsdom (đã có ở /tmp/node_modules), stock.json thật ở
   ../anhdev-store-push/stock.json (để có acc thật trong lưới).

   Fake backend trong file này CHỈ dùng dữ liệu test tự bịa — tk|mk trả về
   là "testuser123" / "testpass123" (không phải tk|mk thật), user testuser /
   testadmin là fixture (không phải 5 acc test thật). Nó mô phỏng đúng hợp
   đồng backend đã kiểm chứng: login -> JWT, /me -> {user:{role}},
   POST /api/shop/buy -> 200 (kèm tk|mk fake) / 401.

   Kịch bản:
     a. B1: user web (role=user) mua acc RANDOM LQ1710 (acc trong bug report)
        -> modal web-buy ("Xác nhận mua"), mua xong trừ đúng 3.000đ, 1 request.
     b. B1: user web mua acc INFO (kind=info, có code) -> modal web-buy
        (chứng minh mua web không phụ thuộc kind).
     c. B1: user Telegram + backend đã cấu hình -> modal bot (đúng luồng cũ;
        đây chính là trạng thái khiến LQ1710 của Anh rơi về modal bot:
        state.user.web false).
     d. B1: trang tải lên đã có sẵn user Telegram lưu + token web lưu
        -> phiên web được khôi phục và THẮNG (tên hiện testuser, số dư web),
        mua LQ1710 ra modal web-buy (trước fix này token web bị bỏ qua).
     e. B5: user thường xem acc trắng -> nút Mua bị disable + ghi chú
        "Chỉ admin mới mua được acc trắng thông tin"; bấm nút disable không
        mở modal; kể cả nút bị bật lại bằng tay (mô phỏng lưới chưa vẽ lại)
        thì modal vẫn chặn, không gọi API, không có link bot.
     f. B5: admin (role=admin) xem acc trắng -> nút Mua bình thường, không
        có ghi chú khóa; mua trắng thành công qua web như acc thường.
     g. Pack/demo (kho mẫu, kind=pack, không có code) -> luồng demo cũ
        ("Xác nhận mua" demo, không gọi /api/shop/buy).
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

/* acc mẫu thật lấy từ stock.json (chỉ dùng code + kind + price, không đọc tk|mk) */
const RANDOM_CODE = "LQ1710"; // acc random trong bug report (kind=random, 3.000đ)
const INFO_ACC = (stock.accounts || []).find(function(a){ return a.kind === "info"; });
const WHITE_ACC = (stock.accounts || []).find(function(a){ return a.kind === "white"; });
const WHITE_ACC2 = (stock.accounts || []).filter(function(a){ return a.kind === "white"; })[1];

/* ---------- fake backend -------------------------------------------------- */
const USERS = {
  testuser:  { password: "testpass1", role: "user",  balance: 250000 },
  testadmin: { password: "testpass2", role: "admin", balance: 250000 },
};
let buyCalls = []; // {code} — moi request POST /api/shop/buy
let stockFail = false;
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
  if (u.indexOf("stock.json") !== -1){
    if (stockFail) return Promise.reject(new TypeError("Failed to fetch"));
    return Promise.resolve(makeResp(200, stock));
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

async function makePage(opts){
  opts = opts || {};
  stockFail = !!opts.stockFail;
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
  if (opts.seedTGUser) w.localStorage.setItem("anhdev_user", JSON.stringify(opts.seedTGUser));
  if (opts.seedToken) w.localStorage.setItem("anhdev_web_token", opts.seedToken);
  w.fetch = fakeFetch;
  dom.window.eval(animJs);
  dom.window.eval(appSrc);
  for (let i = 0; i < 40; i++){
    await sleep(150);
    if (opts.stockFail){
      if (w.document.querySelector("#productArea .card")) break;
    } else {
      const pc = w.document.querySelector("#prodCount");
      if (pc && pc.textContent.indexOf("12126") !== -1) break;
    }
  }
  return { dom: dom, w: w };
}
function prodCount(w){
  const el = w.document.querySelector("#prodCount");
  return el ? el.textContent : "";
}
function balanceText(w){
  const el = w.document.querySelector("[data-balance]");
  return el ? el.textContent : "";
}
function userNameText(w){
  const el = w.document.querySelector("#userName");
  return el ? el.textContent : "";
}
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
async function searchFor(w, text){
  const inp = w.document.querySelector("#searchInput");
  inp.value = text;
  inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(600); // debounce 120ms + render
}
function cardForCode(w, code){
  return Array.from(w.document.querySelectorAll("#productArea .card")).find(function(c){
    const n = c.querySelector(".name");
    return n && n.textContent.indexOf(code) !== -1;
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
function isBuyModalOpen(w){
  const m = w.document.querySelector("#buyModal");
  return !!(m && m.classList.contains("open"));
}

(async function(){
  console.log("== a. B1: user web mua acc RANDOM LQ1710 (bug report) ==");
  buyCalls = [];
  USERS.testuser.balance = 250000;
  const p1 = await makePage({});
  check("a0. kho that da tai (12126 acc)", prodCount(p1.w).indexOf("12126") !== -1, prodCount(p1.w));
  await login(p1.w, "testuser", "testpass1");
  check("a1. dang nhap web thanh cong, so du 250.000d", balanceText(p1.w) === "250.000đ", balanceText(p1.w));
  await searchFor(p1.w, RANDOM_CODE);
  const card1 = cardForCode(p1.w, RANDOM_CODE);
  check("a2. tim duoc the Acc LQ1710 qua o tim kiem", !!card1);
  const btn1 = card1 && card1.querySelector("[data-buy]");
  check("a3. the LQ1710 co nut Mua ngay (khong bi khoa)", !!btn1);
  if (btn1) btn1.click();
  await sleep(300);
  check("a4. modal mua web hien nut Xac nhan mua, KHONG phai modal bot",
    buyActionsHtml(p1.w).indexOf("data-buy-confirm") !== -1
    && buyActionsHtml(p1.w).indexOf("Mua trong bot") === -1
    && buyModalText(p1.w).indexOf("mua qua bot") === -1,
    buyActionsHtml(p1.w).slice(0, 200));
  p1.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("a5. mua xong hien tk|mk fake",
    buyModalText(p1.w).indexOf("testuser123") !== -1
    && buyModalText(p1.w).indexOf("testpass123") !== -1, buyModalText(p1.w).slice(0, 200));
  check("a6. dung 1 request buy cho LQ1710",
    buyCalls.length === 1 && buyCalls[0].code === RANDOM_CODE, JSON.stringify(buyCalls));
  await waitForBalance(p1.w, "247.000đ", 3000); // 250.000 - 3.000
  check("a7. so du tru dung con 247.000d", balanceText(p1.w) === "247.000đ", balanceText(p1.w));

  console.log("== b. B1: user web mua acc INFO (kind=info) ==");
  buyCalls = [];
  USERS.testuser.balance = 250000;
  const p2 = await makePage({});
  await login(p2.w, "testuser", "testpass1");
  await searchFor(p2.w, INFO_ACC.code);
  const card2 = cardForCode(p2.w, INFO_ACC.code);
  check("b1. tim duoc the acc info " + INFO_ACC.code, !!card2, "info=" + (INFO_ACC && INFO_ACC.code));
  const btn2 = card2 && card2.querySelector("[data-buy]");
  if (btn2) btn2.click();
  await sleep(300);
  check("b2. acc info cung ra modal web-buy (khong phu thuoc kind)",
    buyActionsHtml(p2.w).indexOf("data-buy-confirm") !== -1
    && buyActionsHtml(p2.w).indexOf("Mua trong bot") === -1,
    buyActionsHtml(p2.w).slice(0, 200));
  check("b3. chua goi buy khi moi mo modal", buyCalls.length === 0);

  console.log("== c. B1: user Telegram + backend da cau hinh -> modal bot ==");
  buyCalls = [];
  const p3 = await makePage({ telegram: true });
  await sleep(500);
  await searchFor(p3.w, RANDOM_CODE);
  const card3 = cardForCode(p3.w, RANDOM_CODE);
  const btn3 = card3 && card3.querySelector("[data-buy]");
  check("c1. user Telegram thay nut Mua ngay cua LQ1710", !!btn3);
  if (btn3) btn3.click();
  await sleep(300);
  check("c2. user Telegram -> modal bot, khong goi web buy",
    buyActionsHtml(p3.w).indexOf("Mua trong bot @devbn_bot") !== -1
    && buyCalls.length === 0, buyActionsHtml(p3.w).slice(0, 200));

  console.log("== d. B1: user Telegram da luu + token web da luu -> phien web thang ==");
  buyCalls = [];
  USERS.testuser.balance = 250000;
  const p4 = await makePage({
    seedTGUser: { name: "Tg", username: "tgtest", telegram_id: 999001, photo_url: null, via: "Telegram" },
    seedToken: "jwt-testuser",
  });
  await sleep(1200); // cho restoreWebSession (/me) chay xong
  check("d1. phien web thang: ten hien testuser (khong phai Tg)",
    userNameText(p4.w) === "testuser", userNameText(p4.w));
  check("d2. so du web 250.000d (khong phai vi Telegram)",
    balanceText(p4.w) === "250.000đ", balanceText(p4.w));
  await searchFor(p4.w, RANDOM_CODE);
  const card4 = cardForCode(p4.w, RANDOM_CODE);
  const btn4 = card4 && card4.querySelector("[data-buy]");
  if (btn4) btn4.click();
  await sleep(300);
  check("d3. sau khi khoi phuc phien web, mua LQ1710 ra modal web-buy",
    buyActionsHtml(p4.w).indexOf("data-buy-confirm") !== -1
    && buyActionsHtml(p4.w).indexOf("Mua trong bot") === -1,
    buyActionsHtml(p4.w).slice(0, 200));

  console.log("== e. B5: user thuong xem acc trang -> nut khoa + ghi chu ==");
  buyCalls = [];
  USERS.testuser.balance = 250000;
  const p5 = await makePage({});
  await login(p5.w, "testuser", "testpass1");
  await searchFor(p5.w, WHITE_ACC.code);
  const card5 = cardForCode(p5.w, WHITE_ACC.code);
  check("e1. tim duoc the acc trang " + WHITE_ACC.code, !!card5, "white=" + (WHITE_ACC && WHITE_ACC.code));
  const btn5 = card5 && card5.querySelector(".buy-btn");
  check("e2. nut Mua cua acc trang bi disable",
    !!btn5 && btn5.disabled === true && !btn5.getAttribute("data-buy"),
    btn5 ? btn5.outerHTML.slice(0, 160) : "no btn");
  check("e3. the acc trang hien ghi chu chi-admin",
    !!card5 && card5.textContent.indexOf("Chỉ admin mới mua được acc trắng thông tin") !== -1,
    card5 ? card5.textContent.slice(0, 200) : "");
  if (btn5) btn5.click(); // nut disable: khong duoc mo modal
  await sleep(300);
  check("e4. bam nut disable khong mo modal mua",
    !isBuyModalOpen(p5.w) && buyCalls.length === 0);
  // Mo phong nut con sot lai sau khi doi phien (luoi chua ve lai kip):
  // bat lai nut bang tay roi bam -> modal van phai chan, khong goi API.
  if (btn5){
    btn5.removeAttribute("disabled");
    btn5.setAttribute("data-buy", "api-" + WHITE_ACC.code);
    btn5.click();
  }
  await sleep(300);
  check("e5. nut bi bat lai bang tay -> modal chan 'Chi admin...', khong co nut Xac nhan",
    isBuyModalOpen(p5.w)
    && buyModalText(p5.w).indexOf("Chỉ admin mới mua được acc trắng thông tin") !== -1
    && buyActionsHtml(p5.w).indexOf("data-buy-confirm") === -1,
    buyModalText(p5.w).slice(0, 200));
  check("e6. modal chan khong co link bot (khong vuot khoa qua bot)",
    buyActionsHtml(p5.w).indexOf("Mua trong bot") === -1,
    buyActionsHtml(p5.w).slice(0, 200));
  check("e7. khong goi API buy cho acc trang", buyCalls.length === 0, JSON.stringify(buyCalls));

  console.log("== f. B5: admin mua acc trang binh thuong ==");
  buyCalls = [];
  USERS.testadmin.balance = 250000;
  const p6 = await makePage({});
  await login(p6.w, "testadmin", "testpass2");
  check("f1. dang nhap admin thanh cong", balanceText(p6.w) === "250.000đ", balanceText(p6.w));
  await searchFor(p6.w, WHITE_ACC2.code);
  const card6 = cardForCode(p6.w, WHITE_ACC2.code);
  check("f2. tim duoc the acc trang " + WHITE_ACC2.code, !!card6);
  const btn6 = card6 && card6.querySelector("[data-buy]");
  check("f3. admin thay nut Mua trang binh thuong (co data-buy, khong disable)",
    !!btn6 && btn6.disabled === false, btn6 ? btn6.outerHTML.slice(0, 160) : "no btn");
  check("f4. the acc trang cua admin KHONG co ghi chu khoa",
    !!card6 && card6.textContent.indexOf("Chỉ admin mới mua được acc trắng thông tin") === -1);
  if (btn6) btn6.click();
  await sleep(300);
  check("f5. admin mua trang ra modal web-buy",
    buyActionsHtml(p6.w).indexOf("data-buy-confirm") !== -1
    && buyActionsHtml(p6.w).indexOf("Mua trong bot") === -1,
    buyActionsHtml(p6.w).slice(0, 200));
  p6.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(700);
  check("f6. admin mua trang thanh cong, hien tk|mk fake",
    buyModalText(p6.w).indexOf("testuser123") !== -1, buyModalText(p6.w).slice(0, 200));
  check("f7. 1 request buy cho acc trang " + WHITE_ACC2.code,
    buyCalls.length === 1 && buyCalls[0].code === WHITE_ACC2.code, JSON.stringify(buyCalls));

  console.log("== g. Pack/demo (kho mau) -> luong demo cu ==");
  buyCalls = [];
  USERS.testuser.balance = 250000;
  const p7 = await makePage({ stockFail: true });
  check("g0. kho mau da tai (khong phai 12126 acc)", prodCount(p7.w).indexOf("12126") === -1, prodCount(p7.w));
  await login(p7.w, "testuser", "testpass1");
  const packBtn = p7.w.document.querySelector('[data-buy^="r"]');
  check("g1. tim duoc nut Mua cua pack demo", !!packBtn);
  if (packBtn) packBtn.click();
  await sleep(300);
  check("g2. pack demo ra modal demo co nut Xac nhan mua (khong phai modal bot)",
    buyActionsHtml(p7.w).indexOf("data-buy-confirm") !== -1
    && buyActionsHtml(p7.w).indexOf("Mua trong bot") === -1,
    buyActionsHtml(p7.w).slice(0, 200));
  p7.w.document.querySelector("[data-buy-confirm]").click();
  await sleep(500);
  check("g3. mua demo thanh cong (hien tk demo), KHONG goi /api/shop/buy",
    buyCalls.length === 0 && buyModalText(p7.w).indexOf("Tài khoản") !== -1,
    buyModalText(p7.w).slice(0, 200));

  console.log("\nKET QUA: " + pass + " PASS, " + fail + " FAIL");
  if (failures.length) console.log("FAILURES: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})();
