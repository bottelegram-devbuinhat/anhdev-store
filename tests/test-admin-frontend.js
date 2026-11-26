/* ============================================================================
   Test frontend — Admin tìm kiếm skin Acc Random (jsdom)
   ----------------------------------------------------------------------------
   Chạy:  NODE_PATH=/tmp/node_modules node tests/test-admin-frontend.js
   (từ thư mục files/store-upgrade/)
   Cần: jsdom (đã có ở /tmp/node_modules), stock.json thật ở
   ../anhdev-store-push/stock.json (để kiểm tra hồi quy tìm kiếm 9/162).

   Fake backend trong file này CHỈ dùng dữ liệu test tự bịa (mã LQ900x, skin
   "Kiểm Thử") — không chứa dữ liệu skin thật của kho. Nó mô phỏng đúng
   hợp đồng backend đã kiểm chứng: login -> JWT, /me -> {user:{role}},
   /api/admin/* -> 403 với role=user, 200 với role=admin.

   Kịch bản:
     a. acc thường (role=user): không import module admin, không gọi
        /api/admin, không badge/toggle, tìm "nakroth ki" không ra acc Random.
     b. admin2 (role=admin): module được import, badge + toggle hiện; bật
        toggle + gõ "nakroth" -> gọi /api/admin/random-search kèm Bearer,
        kết quả hiện mã acc + skin thật (test); tắt toggle -> về tìm thường.
     c. đăng xuất sau khi dùng admin: badge/toggle biến mất, RAM xoá sạch,
        tìm thường không gọi /api/admin nữa.
     d. API_BASE_URL trống: form login báo chưa cấu hình, module không nạp;
        gọi trực tiếp init module với backendReady=false -> không fetch, toast lỗi.
     e. JWT user gọi /api/admin/* -> 403; admin bị thu hồi quyền giữa chừng
        (stub trả 403) -> toast "Không có quyền Admin" + toggle tự tắt.
     f. hồi quy tìm kiếm cũ: "nakroth ki" = 9, "murad" = 162, "sss" không ra
        acc Random nào (anti-leak).
     g. đăng ký vẫn chặn mật khẩu < 6 ký tự; đăng nhập chấp nhận mật khẩu 1 ký tự.
     h. tải lại trang với token admin đã lưu -> module tự nạp (restore session).
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

/* ---------- nạp module admin THẬT (strip từ khóa `export` để Node chạy) --- */
function loadAdminModuleReal(){
  let src = fs.readFileSync(path.join(ROOT, "assets/admin-random-search.js"), "utf8");
  src = src.replace(/^export /gm, "");
  const moduleObj = { exports: {} };
  const fn = new Function("module", "exports",
    src + "\n;module.exports = { initAdminRandomSearch, cleanupAdminRandomSearch, syncAdminPlaceholder, getAdminDebugState };");
  fn(moduleObj, moduleObj.exports);
  return moduleObj.exports;
}
const adminModuleReal = loadAdminModuleReal();

/* ---------- fake backend (dữ liệu test tự bịa — KHÔNG phải mật khẩu thật.
   Backend giả lập chạy local; mật khẩu ở đây chỉ là fixture để test
   luồng đăng nhập, không trùng mật khẩu acc test thật trên backend. -- */
const USERS = {
  nhatdeptrai: { password: "test123456", role: "user" },
  nhatdz:      { password: "test123456", role: "user" },
  muaacc:      { password: "test123456", role: "user" },
  colonmahup:  { password: "test123456", role: "user" },
  admin2:      { password: "x",          role: "admin" }  // 1 ký tự: test login không min-6
};
const FAKE_RANDOM = [
  { code: "LQ9001", price: 24000, rank: "Cao Thủ", level: 30, heroes: 12, skins: 5,
    rare_skins: ["Nakroth Kiểm Thử Alpha", "Violet Kiểm Thử Beta"],
    description: "[Skin SSS] (sss:1, ss:2, ss+:0, s+:0, ssm:0, anime:0) - acc test",
    category: "Skin SSS", kind: "random" },
  { code: "LQ9002", price: 32000, rank: "Thách Đấu", level: 30, heroes: 20, skins: 8,
    rare_skins: ["Florentino Kiểm Thử Gamma"],
    description: "[Skin SS+] (sss:0, ss:1, ss+:1, s+:0, ssm:0, anime:0) - acc test",
    category: "Skin SS+", kind: "random" },
  { code: "LQ9003", price: 15000, rank: "Kim Cương", level: 28, heroes: 8, skins: 3,
    rare_skins: ["Murad Kiểm Thử Delta"],
    description: "[Skin SS] (sss:0, ss:1, ss+:0, s+:0, ssm:0, anime:0) - acc test",
    category: "Skin SS", kind: "random" },
  { code: "LQ9004", price: 7000, rank: "Đồng", level: 30, heroes: 0, skins: 0,
    rare_skins: [], description: "[Skin thường] (sss:0, ss:0, ss+:0, s+:0, ssm:0, anime:0) - acc test",
    category: "Skin thường", kind: "random" }
];
function norm(s){
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
let revokeAdmin = false;   // bật để stub trả 403 cho cả token admin (kịch bản e)
let adminSearchFailTimes = 0; // bật để stub làm rớt mạng N lần cho /api/admin/random-search (kịch bản i: retry)
let adminCalls = [];       // {url, auth} — mọi request tới /api/admin
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
  if (u.indexOf("/api/auth/register") !== -1){
    if (!body || !body.password || body.password.length < 6)
      return Promise.resolve(makeResp(400, { ok: false, error: "Mật khẩu tối thiểu 6 ký tự." }));
    return Promise.resolve(makeResp(201, { ok: true, token: "jwt-" + body.username }));
  }
  if (u.indexOf("/api/auth/me") !== -1){
    const rec = USERS[tokenUser];
    if (!rec) return Promise.resolve(makeResp(401, { ok: false, error: "unauthorized" }));
    return Promise.resolve(makeResp(200, { ok: true, user: { username: tokenUser, balance: 250000,
      role: rec.role, discount_percent: 0, telegram_id: null } }));
  }
  if (u.indexOf("/api/auth/logout") !== -1) return Promise.resolve(makeResp(200, { ok: true }));
  if (u.indexOf("/api/admin/") !== -1){
    adminCalls.push({ url: u, auth: auth });
    const rec = USERS[tokenUser];
    if (revokeAdmin || !rec || rec.role !== "admin")
      return Promise.resolve(makeResp(403, { ok: false, error: "Forbidden" }));
    const q = new URL(u, "http://x").searchParams;
    if (u.indexOf("/api/admin/random-search") !== -1){
      if (adminSearchFailTimes > 0){ adminSearchFailTimes--; return Promise.reject(new Error("network down (test)")); }
      const query = q.get("q") || "";
      if (!query) return Promise.resolve(makeResp(400, { ok: false, error: "missing q" }));
      const toks = norm(query).split(/\s+/).filter(Boolean);
      const hits = FAKE_RANDOM.filter(function(a){
        const hay = norm(a.code + " " + (Array.isArray(a.rare_skins) ? a.rare_skins.join(" ") : "") +
          " " + a.description + " " + a.category);
        return toks.every(function(t){ return hay.indexOf(t) !== -1; });
      });
      const limit = parseInt(q.get("limit") || "20", 10);
      const offset = parseInt(q.get("offset") || "0", 10);
      return Promise.resolve(makeResp(200, { ok: true, total: hits.length, limit: limit,
        offset: offset, results: hits.slice(offset, offset + limit) }));
    }
    if (u.indexOf("/api/admin/random-index") !== -1){
      const limit = parseInt(q.get("limit") || "20", 10);
      const offset = parseInt(q.get("offset") || "0", 10);
      return Promise.resolve(makeResp(200, { ok: true, total: FAKE_RANDOM.length, limit: limit,
        offset: offset, accounts: FAKE_RANDOM.slice(offset, offset + limit) }));
    }
    return Promise.resolve(makeResp(404, { ok: false, error: "not found" }));
  }
  return Promise.resolve(makeResp(404, { ok: false, error: "not found: " + u }));
}

/* ---------- harness ------------------------------------------------------ */
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

async function makePage(opts){
  opts = opts || {};
  const appSrc = opts.apiBase === "" ? appJs.replace(/var API_BASE_URL = "[^"]*";/, 'var API_BASE_URL = "";')
    : appJs.replace(/var API_BASE_URL = "[^"]*";/, 'var API_BASE_URL = "' + API_URL + '";');
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/",
    runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = function(){ return { matches: false, media: "", addEventListener: function(){}, removeEventListener: function(){} }; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return null; };
  let loaderCalls = 0;
  w.__adminModuleLoader = function(){ loaderCalls++; return Promise.resolve(adminModuleReal); };
  w.fetch = fakeFetch;
  if (opts.savedToken) w.localStorage.setItem("anhdev_web_token", opts.savedToken);
  dom.window.eval(animJs);
  dom.window.eval(appSrc);
  const page = { dom: dom, w: w,
    loaderCalls: function(){ return loaderCalls; },
    adminCalls: function(){ return adminCalls.length; } };
  // chờ syncStock() tải xong kho thật (prodCount hiện 12126)
  for (let i = 0; i < 40; i++){
    await sleep(150);
    const pc = w.document.querySelector("#prodCount");
    if (pc && pc.textContent.indexOf("12126") !== -1) break;
  }
  return page;
}
function prodCount(w){
  const el = w.document.querySelector("#prodCount");
  return el ? el.textContent : "";
}
function cards(w){ return Array.from(w.document.querySelectorAll("#productArea .card")); }
function adminCards(w){ return Array.from(w.document.querySelectorAll("#productArea .admin-card")); }
function toasts(w){
  return Array.from(w.document.querySelectorAll(".toast-item")).map(function(t){ return t.textContent; });
}
async function typeSearch(w, text){
  const inp = w.document.querySelector("#searchInput");
  inp.value = text;
  inp.dispatchEvent(new w.Event("input", { bubbles: true }));
  await sleep(450); // debounce 120ms + fetch + render
}
async function login(w, user, pass){
  const d = w.document;
  d.querySelector("#topLoginBtn").click();
  await sleep(100);
  d.querySelector("#authUser").value = user;
  d.querySelector("#authPass").value = pass;
  d.querySelector("#authForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(900); // login POST + /me + dynamic import module
}
async function logout(w){
  w.document.querySelector("#topLoginBtn").click();
  await sleep(400);
}

(async function(){
  console.log("== a. acc thường (nhatdeptrai) ==");
  adminCalls = [];
  const p1 = await makePage({});
  check("a1. kho thật đã tải (12126 acc)", prodCount(p1.w).indexOf("12126") !== -1, prodCount(p1.w));
  await login(p1.w, "nhatdeptrai", "test123456");
  check("a2. đăng nhập thường thành công, số dư 250.000đ",
    (p1.w.document.querySelector("[data-balance]") || {}).textContent === "250.000đ",
    (p1.w.document.querySelector("[data-balance]") || {}).textContent);
  check("a3. module admin KHÔNG được import", p1.loaderCalls() === 0, "loader=" + p1.loaderCalls());
  check("a4. không gọi API /api/admin", p1.adminCalls() === 0, "calls=" + p1.adminCalls());
  check("a5. không có badge ADMIN trong DOM", !p1.w.document.querySelector(".admin-badge"));
  check("a6. không có toggle admin trong DOM", !p1.w.document.querySelector(".admin-toggle"));
  await typeSearch(p1.w, "nakroth ki");
  check("a7. tìm 'nakroth ki' ra đúng 9 acc", prodCount(p1.w).indexOf("9 / 12126") === 0, prodCount(p1.w));
  check("a8. 9 kết quả đều là acc sẵn thông tin (không random)",
    cards(p1.w).length === 9 && cards(p1.w).every(function(c){ return c.getAttribute("data-cat") === "detail"; }),
    "cards=" + cards(p1.w).length);
  // e (mức fetch): JWT user gọi thẳng /api/admin -> 403
  const r403 = await fakeFetch(API_URL + "/api/admin/random-search?q=nakroth", { headers: { Authorization: "Bearer jwt-nhatdeptrai" } });
  check("e1. JWT user gọi /api/admin/random-search bị 403", r403.status === 403, "status=" + r403.status);
  const rIdx403 = await fakeFetch(API_URL + "/api/admin/random-index?limit=5", { headers: { Authorization: "Bearer jwt-nhatdeptrai" } });
  check("e2. JWT user gọi /api/admin/random-index bị 403", rIdx403.status === 403, "status=" + rIdx403.status);

  console.log("== b. admin2 (role=admin) ==");
  await logout(p1.w);
  await login(p1.w, "admin2", "x"); // mật khẩu 1 ký tự — đăng nhập phải chấp nhận (không min-6)
  check("b1. admin2 đăng nhập được với mật khẩu 1 ký tự, số dư 250.000đ",
    (p1.w.document.querySelector("[data-balance]") || {}).textContent === "250.000đ",
    (p1.w.document.querySelector("[data-balance]") || {}).textContent);
  check("b2. module admin được import (lazy-load)", p1.loaderCalls() === 1, "loader=" + p1.loaderCalls());
  check("b3. badge ADMIN hiện", !!p1.w.document.querySelector(".admin-badge"));
  const toggle = p1.w.document.querySelector(".admin-toggle");
  check("b4. toggle 'Soi skin Acc Random' hiện", !!toggle && toggle.textContent.indexOf("Soi skin Acc Random") !== -1);
  const callsBefore = p1.adminCalls();
  toggle.click();
  await sleep(200);
  check("b5. bật toggle -> placeholder đổi sang chế độ admin",
    p1.w.document.querySelector("#searchInput").placeholder.indexOf("Tìm skin Acc Random") === 0,
    p1.w.document.querySelector("#searchInput").placeholder);
  await typeSearch(p1.w, "nakroth");
  check("b6. đã gọi /api/admin/random-search kèm Bearer admin",
    p1.adminCalls() > callsBefore &&
    adminCalls[adminCalls.length - 1].url.indexOf("/api/admin/random-search?q=nakroth") !== -1 &&
    adminCalls[adminCalls.length - 1].auth === "Bearer jwt-admin2",
    JSON.stringify(adminCalls[adminCalls.length - 1]));
  check("b7. kết quả admin hiện mã acc + skin thật (test)",
    adminCards(p1.w).length === 1 &&
    adminCards(p1.w)[0].textContent.indexOf("LQ9001") !== -1 &&
    adminCards(p1.w)[0].textContent.indexOf("Nakroth Kiểm Thử Alpha") !== -1,
    "adminCards=" + adminCards(p1.w).length);
  check("b8. kết quả admin hiện bậc skin + giá",
    adminCards(p1.w)[0].textContent.indexOf("SSS") !== -1 &&
    adminCards(p1.w)[0].textContent.indexOf("24.000đ") !== -1);
  check("b9. kết quả admin là acc Random thật (kind=random, có nhãn)",
    adminCards(p1.w)[0].textContent.indexOf("Acc Random") !== -1);
  check("b10. thẻ admin KHÔNG có nút mua", !adminCards(p1.w)[0].querySelector("[data-buy]"));
  toggle.click(); // tắt toggle -> về tìm thường
  await sleep(300);
  check("b11. tắt toggle -> về tìm kiếm thường (không còn thẻ admin)",
    adminCards(p1.w).length === 0 && cards(p1.w).length > 0,
    "adminCards=" + adminCards(p1.w).length + " cards=" + cards(p1.w).length);
  check("b12. tắt toggle -> placeholder thường trở lại",
    p1.w.document.querySelector("#searchInput").placeholder.indexOf("Tìm tên sản phẩm") === 0,
    p1.w.document.querySelector("#searchInput").placeholder);

  console.log("== e3. admin bị thu hồi quyền giữa chừng -> 403 -> toast + toggle tự tắt ==");
  toggle.click(); // bật lại
  await sleep(200);
  revokeAdmin = true;
  await typeSearch(p1.w, "florentino");
  await sleep(300);
  check("e3. toast 'Không có quyền Admin' hiện",
    toasts(p1.w).some(function(t){ return t.indexOf("Không có quyền Admin") !== -1; }),
    JSON.stringify(toasts(p1.w)));
  check("e4. toggle tự tắt sau 403", !p1.w.document.querySelector(".admin-toggle").classList.contains("on"));
  revokeAdmin = false;

  console.log("== c. đăng xuất sau khi dùng admin ==");
  toggle.click(); // bật lại để có dữ liệu trong RAM
  await sleep(200);
  await typeSearch(p1.w, "murad");
  await sleep(200);
  check("c0. trước logout: RAM admin có 1 kết quả", adminModuleReal.getAdminDebugState().resultsCount === 1,
    JSON.stringify(adminModuleReal.getAdminDebugState()));
  const adminCallsBeforeLogout = p1.adminCalls();
  await logout(p1.w);
  check("c1. badge ADMIN biến mất sau logout", !p1.w.document.querySelector(".admin-badge"));
  check("c2. toggle admin biến mất sau logout", !p1.w.document.querySelector(".admin-toggle"));
  const dbg = adminModuleReal.getAdminDebugState();
  check("c3. dữ liệu Random trong RAM bị xoá sạch",
    dbg.resultsCount === 0 && dbg.on === false && dbg.initialized === false, JSON.stringify(dbg));
  await typeSearch(p1.w, "nakroth");
  check("c4. sau logout, tìm thường không gọi /api/admin nữa",
    p1.adminCalls() === adminCallsBeforeLogout, "calls=" + p1.adminCalls() + " before=" + adminCallsBeforeLogout);
  check("c5. sau logout, tìm 'nakroth' không ra thẻ admin", adminCards(p1.w).length === 0);

  console.log("== d. API_BASE_URL trống ==");
  adminCalls = [];
  const p2 = await makePage({ apiBase: "" });
  await login(p2.w, "admin2", "x");
  check("d1. backend chưa cấu hình: form báo lỗi rõ, không đăng nhập được",
    p2.w.document.querySelector("#authErr").textContent.indexOf("Chưa cấu hình backend") !== -1,
    p2.w.document.querySelector("#authErr").textContent);
  check("d2. module admin không được nạp khi chưa có backend", p2.loaderCalls() === 0);
  check("d3. không gọi /api/admin khi chưa có backend", p2.adminCalls() === 0);
  // d4: gọi trực tiếp init module với backendReady=false -> không fetch, toast lỗi
  let d4fetch = 0, d4toast = "";
  const fakeCtx = {
    doc: p2.w.document,
    apiBase: "", backendReady: function(){ return false; },
    getToken: function(){ return "jwt-admin2"; },
    fetchFn: function(){ d4fetch++; return Promise.resolve(makeResp(200, { ok: true, results: [] })); },
    toast: function(m){ d4toast = m; },
    L: function(k){ return k; }, esc: function(s){ return String(s); },
    fmt: function(n){ return String(n); }, normText: norm,
    searchInput: p2.w.document.querySelector("#searchInput"),
    searchWrap: p2.w.document.querySelector(".search-wrap"),
    catChips: p2.w.document.querySelector("#catChips"),
    sortSelect: p2.w.document.querySelector("#sortSelect"),
    stockToggle: p2.w.document.querySelector("#stockToggle"),
    productArea: p2.w.document.querySelector("#productArea"),
    prodCount: p2.w.document.querySelector("#prodCount"),
    userChip: p2.w.document.querySelector("#userChip"),
    renderProducts: function(){}, closeSuggest: function(){},
    setAdminSearchMode: function(){}, registerAdminQueryHandler: function(){},
    setAdminSearchActive: function(){}, applyNormalQuery: function(){}, resetSearch: function(){}
  };
  adminModuleReal.initAdminRandomSearch(fakeCtx);
  check("d4. init module với backend chưa cấu hình: không fetch, toast lỗi rõ",
    d4fetch === 0 && d4toast === "adminNoBackend", "fetch=" + d4fetch + " toast=" + d4toast);

  console.log("== f. hồi quy tìm kiếm cũ (kho thật) ==");
  await typeSearch(p1.w, "murad");
  check("f1. tìm 'murad' = 162 acc", prodCount(p1.w).indexOf("162 / 12126") === 0, prodCount(p1.w));
  await typeSearch(p1.w, "sss");
  check("f2. tìm 'sss' không ra acc Random nào (anti-leak)",
    cards(p1.w).every(function(c){ return c.getAttribute("data-cat") !== "random-tele"; }),
    "cards=" + cards(p1.w).length);
  await typeSearch(p1.w, "nakroth ki");
  check("f3. tìm 'nakroth ki' = 9 acc (không đổi)", prodCount(p1.w).indexOf("9 / 12126") === 0, prodCount(p1.w));

  console.log("== g. validate mật khẩu ==");
  const p3 = await makePage({});
  p3.w.document.querySelector("#topLoginBtn").click();
  await sleep(100);
  p3.w.document.querySelector("#tabRegister").click();
  await sleep(50);
  p3.w.document.querySelector("#authUser").value = "testuser1";
  p3.w.document.querySelector("#authPass").value = "12345"; // 5 ký tự
  p3.w.document.querySelector("#authPass2").value = "12345";
  p3.w.document.querySelector("#authForm").dispatchEvent(new p3.w.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(200);
  check("g1. đăng ký với mật khẩu 5 ký tự vẫn bị chặn",
    p3.w.document.querySelector("#authErr").textContent.indexOf("tối thiểu 6 ký tự") !== -1,
    p3.w.document.querySelector("#authErr").textContent);
  check("g2. placeholder mật khẩu tab đăng ký nhắc 'từ 6 ký tự'",
    p3.w.document.querySelector("#authPass").placeholder.indexOf("6 ký tự") !== -1,
    p3.w.document.querySelector("#authPass").placeholder);
  p3.w.document.querySelector("#tabLogin").click();
  await sleep(50);
  check("g3. placeholder mật khẩu tab đăng nhập không còn '6 ký tự'",
    p3.w.document.querySelector("#authPass").placeholder.indexOf("6 ký tự") === -1,
    p3.w.document.querySelector("#authPass").placeholder);

  console.log("== h. tải lại trang với token admin đã lưu (restore session) ==");
  adminCalls = [];
  const p4 = await makePage({ savedToken: "jwt-admin2" });
  await sleep(800); // restoreWebSession: /me + import module
  check("h1. restore session admin: badge ADMIN tự hiện không cần đăng nhập lại",
    !!p4.w.document.querySelector(".admin-badge"));
  check("h2. restore session admin: toggle hiện", !!p4.w.document.querySelector(".admin-toggle"));
  check("h3. restore session admin: module được import", p4.loaderCalls() === 1, "loader=" + p4.loaderCalls());
  check("h4. restore session: số dư 250.000đ",
    (p4.w.document.querySelector("[data-balance]") || {}).textContent === "250.000đ");

  console.log("== i. tìm admin rớt mạng thoáng qua -> tự thử lại (retry) ==");
  // Dùng p4 (đã đăng nhập admin2 qua restore session, module đã nạp, toggle có sẵn).
  // Không tạo trang mới: module admin là singleton, chỉ init 1 lần cho 1 trang.
  adminCalls = [];
  const toggleI = p4.w.document.querySelector(".admin-toggle");
  toggleI.click(); // bật toggle
  await sleep(200);
  // i1: rớt mạng 2 lần rồi lần 3 thành công -> hiện kết quả, không báo lỗi.
  adminSearchFailTimes = 2;
  const callsI1 = p4.adminCalls();
  await typeSearch(p4.w, "nakroth");
  await sleep(4200); // 2 lần thử lại x 1.5s + fetch + render
  check("i1. rớt mạng 2 lần rồi thành công: kết quả admin hiện (không báo lỗi)",
    adminCards(p4.w).length === 1 &&
    adminCards(p4.w)[0].textContent.indexOf("LQ9001") !== -1 &&
    !toasts(p4.w).some(function(t){ return t.indexOf("Không kết nối được máy chủ") !== -1; }),
    "adminCards=" + adminCards(p4.w).length + " toasts=" + JSON.stringify(toasts(p4.w)));
  check("i2. đã gọi /api/admin/random-search đúng 3 lần (1 lần đầu + 2 thử lại)",
    adminCalls.slice(callsI1).filter(function(c){ return c.url.indexOf("/api/admin/random-search?q=nakroth") !== -1; }).length === 3,
    "newCalls=" + (p4.adminCalls() - callsI1));
  // i3: rớt mạng cả 3 lần -> báo lỗi rõ + về lưới thường.
  toggleI.click(); // tắt toggle rồi bật lại cho sạch trạng thái
  await sleep(300);
  toggleI.click();
  await sleep(200);
  adminSearchFailTimes = 10; // rớt nhiều hơn số lần thử lại tối đa (3)
  const callsI3 = p4.adminCalls();
  await typeSearch(p4.w, "florentino");
  await sleep(4200); // 2 lần thử lại x 1.5s + fetch
  check("i3. rớt mạng cả 3 lần: toast 'Không kết nối được máy chủ' hiện",
    toasts(p4.w).some(function(t){ return t.indexOf("Không kết nối được máy chủ") !== -1; }),
    JSON.stringify(toasts(p4.w)));
  check("i4. hết 3 lần thử: về lưới thường (không còn thẻ admin)",
    adminCards(p4.w).length === 0 && cards(p4.w).length > 0,
    "adminCards=" + adminCards(p4.w).length + " cards=" + cards(p4.w).length);
  check("i5. rớt mạng 3 lần: chỉ gọi đúng 3 lần (không thử lại vô hạn)",
    adminCalls.slice(callsI3).filter(function(c){ return c.url.indexOf("/api/admin/random-search?q=florentino") !== -1; }).length === 3,
    "newCalls=" + (p4.adminCalls() - callsI3));
  adminSearchFailTimes = 0;

  console.log("\n==== KẾT QUẢ: " + pass + " PASS, " + fail + " FAIL ====");
  if (failures.length) console.log("FAILED: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})().catch(function(e){ console.error("HARNESS ERROR", e && e.stack || e); process.exit(2); });
