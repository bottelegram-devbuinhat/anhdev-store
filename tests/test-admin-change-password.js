/* ============================================================================
   Test frontend — Admin đổi mật khẩu web (jsdom)
   ----------------------------------------------------------------------------
   Chạy:  NODE_PATH=/tmp/node_modules node tests/test-admin-change-password.js
   (từ thư mục files/store-upgrade/)
   Cần: jsdom (đã có ở /tmp/node_modules).

   Nạp admin.html + admin.js THẬT từ files/admin-page/ vào jsdom, mock fetch
   để giả lập backend. Mọi username/mật khẩu trong file này đều là FAKE,
   chỉ dùng để test luồng đổi mật khẩu, không phải tài khoản thật.

   Kịch bản:
     a. các phần tử pwUser/pwNew/pwConfirm/pwBtn/pwErr/pwOut tồn tại.
     b. nhập lại không khớp -> báo lỗi "Mật khẩu nhập lại không khớp.",
        KHÔNG gọi fetch.
     c. mật khẩu mới < 6 ký tự -> báo lỗi, KHÔNG gọi fetch.
     d. bấm Hủy ở hộp xác nhận -> KHÔNG gọi fetch.
     e. mật khẩu khớp -> POST /api/admin/users/<username>/password với
        {new_password}; thành công thì xóa 2 ô mật khẩu, pwOut hiện tài
        khoản, toast "Đã đổi mật khẩu cho ...".
     f. danh sách user đang hiện -> đổi mật khẩu xong tự tải lại danh sách;
        danh sách chưa tải -> không gọi thêm /api/admin/users.
     g. backend trả 404 -> báo "Không tìm thấy tài khoản web này."
     h. backend trả 400 -> báo đúng thông báo của server.
     i. admin.html/admin.js không chứa innerHTML/onclick/localStorage.
   ============================================================================ */
const fs = require("fs");
const path = require("path");
let JSDOM;
try { JSDOM = require("jsdom").JSDOM; }
catch (e) { JSDOM = require("/tmp/node_modules/jsdom").JSDOM; }

const ADMIN_DIR = path.join(__dirname, "..", "..", "admin-page");
const html = fs.readFileSync(path.join(ADMIN_DIR, "admin.html"), "utf8");
const adminJs = fs.readFileSync(path.join(ADMIN_DIR, "admin.js"), "utf8");
const adminHtmlSrc = html;
const API_URL = "https://anhdev-store-backend.onrender.com";

/* ---------- fake backend -------------------------------------------------- */
let pwMode = "ok";        // "ok" | "404" | "400"
let calls = [];           // {url, method, body}
let confirmAnswer = true; // hộp xác nhận đổi mật khẩu
function makeResp(status, obj){
  return { ok: status >= 200 && status < 300, status: status,
           text: function(){ return Promise.resolve(JSON.stringify(obj)); },
           json: function(){ return Promise.resolve(obj); } };
}
function fakeFetch(url, opts){
  opts = opts || {};
  const u = String(url);
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ url: u, method: opts.method || "GET", body: body });
  if (u.indexOf("/api/auth/login") !== -1)
    return Promise.resolve(makeResp(200, { token: "jwt-test-admin",
      user: { id: 1, username: "admin2", role: "admin" } }));
  if (u.indexOf("/api/auth/me") !== -1)
    return Promise.resolve(makeResp(200, { user: { id: 1, username: "admin2", role: "admin" } }));
  if (u.indexOf("/api/health") !== -1)
    return Promise.resolve(makeResp(200, { ok: true }));
  if (u.indexOf("/api/admin/random-index") !== -1)
    return Promise.resolve(makeResp(200, { total: 5 }));
  if (u.indexOf("/api/admin/shop/sold") !== -1)
    return Promise.resolve(makeResp(200, { count: 0, sold: [] }));
  if (u.indexOf("/api/admin/users/") !== -1 && u.indexOf("/password") !== -1){
    if (pwMode === "404")
      return Promise.resolve(makeResp(404, { error: "Không tìm thấy tài khoản web này." }));
    if (pwMode === "400")
      return Promise.resolve(makeResp(400, { error: "Mật khẩu mới không hợp lệ." }));
    const name = decodeURIComponent(u.split("/api/admin/users/")[1].split("/password")[0]);
    return Promise.resolve(makeResp(200, { username: name }));
  }
  if (u.indexOf("/api/admin/users") !== -1)
    return Promise.resolve(makeResp(200, { users: [
      { username: "nhatdz", role: "user", balance: 250000, telegram_id: null, created_at: "2026-11-27" },
      { username: "admin2", role: "admin", balance: 250000, telegram_id: null, created_at: "2026-11-25" }
    ] }));
  return Promise.resolve(makeResp(404, { error: "not found: " + u }));
}

/* ---------- harness ------------------------------------------------------- */
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function pwCalls(){
  return calls.filter(function(c){ return c.url.indexOf("/password") !== -1; });
}
function usersCalls(){
  return calls.filter(function(c){ return c.url.indexOf("/api/admin/users") !== -1 && c.url.indexOf("/password") === -1; });
}
function toasts(w){
  return Array.from(w.document.querySelectorAll(".toast-item")).map(function(t){ return t.textContent; });
}
async function makePage(){
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/admin.html",
    runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = fakeFetch;
  w.confirm = function(){ return confirmAnswer; };
  dom.window.eval(adminJs);
  // đăng nhập admin2 (fake) để hiện bảng điều khiển
  const d = w.document;
  d.querySelector("#loginUser").value = "admin2";
  d.querySelector("#loginPass").value = "test-admin-pass";
  d.querySelector("#loginForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(300);
  return { dom: dom, w: w };
}
function fillPw(w, u, p, f){
  const d = w.document;
  d.querySelector("#pwUser").value = u;
  d.querySelector("#pwNew").value = p;
  d.querySelector("#pwConfirm").value = f;
}
async function clickPw(w){
  w.document.querySelector("#pwBtn").click();
  await sleep(250);
}

(async function(){
  const p = await makePage();
  const w = p.w, d = w.document;

  console.log("== a. phần tử form đổi mật khẩu ==");
  check("a1. pwUser tồn tại, type=text", !!d.querySelector("#pwUser") && d.querySelector("#pwUser").type === "text");
  check("a2. pwNew tồn tại, type=password", !!d.querySelector("#pwNew") && d.querySelector("#pwNew").type === "password");
  check("a3. pwConfirm tồn tại, type=password", !!d.querySelector("#pwConfirm") && d.querySelector("#pwConfirm").type === "password");
  check("a4. pwBtn tồn tại, chữ 'Đổi mật khẩu'", !!d.querySelector("#pwBtn") && d.querySelector("#pwBtn").textContent.indexOf("Đổi mật khẩu") !== -1);
  check("a5. pwErr + pwOut tồn tại", !!d.querySelector("#pwErr") && !!d.querySelector("#pwOut"));
  check("a6. đăng nhập fake thành công, bảng điều khiển hiện",
    d.querySelector("#dashSec").classList.contains("hidden") === false,
    "dashSec hidden=" + d.querySelector("#dashSec").classList.contains("hidden"));

  console.log("== b. nhập lại không khớp ==");
  calls = [];
  fillPw(w, "nhatdz", "matkhauMoi123", "matkhauKhac456");
  await clickPw(w);
  check("b1. báo lỗi 'Mật khẩu nhập lại không khớp.'",
    d.querySelector("#pwErr").textContent === "Mật khẩu nhập lại không khớp.",
    d.querySelector("#pwErr").textContent);
  check("b2. KHÔNG gọi fetch đổi mật khẩu", pwCalls().length === 0, "pwCalls=" + pwCalls().length);

  console.log("== c. mật khẩu mới quá ngắn ==");
  calls = [];
  fillPw(w, "nhatdz", "12345", "12345");
  await clickPw(w);
  check("c1. báo lỗi 6–64 ký tự",
    d.querySelector("#pwErr").textContent.indexOf("6–64 ký tự") !== -1,
    d.querySelector("#pwErr").textContent);
  check("c2. KHÔNG gọi fetch đổi mật khẩu", pwCalls().length === 0, "pwCalls=" + pwCalls().length);

  console.log("== d. hủy hộp xác nhận ==");
  calls = [];
  confirmAnswer = false;
  fillPw(w, "nhatdz", "matkhauMoi123", "matkhauMoi123");
  await clickPw(w);
  check("d1. hủy xác nhận -> KHÔNG gọi fetch", pwCalls().length === 0, "pwCalls=" + pwCalls().length);
  check("d2. hủy xác nhận -> không báo lỗi", d.querySelector("#pwErr").textContent === "");
  confirmAnswer = true;

  console.log("== e. đổi mật khẩu thành công (danh sách user chưa tải) ==");
  calls = [];
  pwMode = "ok";
  fillPw(w, "nhatdz", "matkhauMoi123", "matkhauMoi123");
  await clickPw(w);
  check("e1. POST đúng endpoint /api/admin/users/nhatdz/password",
    pwCalls().length === 1 &&
    pwCalls()[0].url === API_URL + "/api/admin/users/nhatdz/password" &&
    pwCalls()[0].method === "POST",
    JSON.stringify(pwCalls()[0]));
  check("e2. body gửi {new_password}",
    pwCalls()[0] && pwCalls()[0].body && pwCalls()[0].body.new_password === "matkhauMoi123",
    JSON.stringify(pwCalls()[0] && pwCalls()[0].body));
  check("e3. xóa 2 ô mật khẩu sau khi đổi xong",
    d.querySelector("#pwNew").value === "" && d.querySelector("#pwConfirm").value === "");
  check("e4. pwOut hiện tài khoản vừa đổi",
    d.querySelector("#pwOut").textContent.indexOf("nhatdz") !== -1,
    d.querySelector("#pwOut").textContent);
  check("e5. toast 'Đã đổi mật khẩu cho nhatdz.'",
    toasts(w).some(function(t){ return t.indexOf("Đã đổi mật khẩu cho nhatdz.") !== -1; }),
    JSON.stringify(toasts(w)));
  check("e6. danh sách user chưa tải -> không gọi thêm /api/admin/users",
    usersCalls().length === 0, "usersCalls=" + usersCalls().length);

  console.log("== f. đổi mật khẩu xong tải lại danh sách user đang hiện ==");
  calls = [];
  d.querySelector("#usersBtn").click();
  await sleep(250);
  check("f0. bấm 'Tải danh sách' -> gọi GET /api/admin/users",
    usersCalls().length === 1 && usersCalls()[0].method === "GET",
    "usersCalls=" + usersCalls().length);
  check("f1. danh sách hiện 2 tài khoản fake",
    d.querySelector("#usersOut").textContent.indexOf("nhatdz") !== -1 &&
    d.querySelector("#usersOut").textContent.indexOf("admin2") !== -1);
  calls = [];
  fillPw(w, "admin2", "matkhauMoi999", "matkhauMoi999");
  await clickPw(w);
  check("f2. đổi xong -> tự gọi lại GET /api/admin/users",
    usersCalls().length === 1 && usersCalls()[0].method === "GET",
    "usersCalls=" + usersCalls().length);

  console.log("== g. backend 404 ==");
  calls = [];
  pwMode = "404";
  fillPw(w, "khongcouser", "matkhauMoi123", "matkhauMoi123");
  await clickPw(w);
  check("g1. báo 'Không tìm thấy tài khoản web này.'",
    d.querySelector("#pwErr").textContent === "Không tìm thấy tài khoản web này.",
    d.querySelector("#pwErr").textContent);
  check("g2. vẫn POST tới endpoint của user đó",
    pwCalls().length === 1 && pwCalls()[0].url.indexOf("/api/admin/users/khongcouser/password") !== -1,
    JSON.stringify(pwCalls()[0]));

  console.log("== h. backend 400 ==");
  calls = [];
  pwMode = "400";
  fillPw(w, "nhatdz", "matkhauMoi123", "matkhauMoi123");
  await clickPw(w);
  check("h1. báo đúng thông báo của server",
    d.querySelector("#pwErr").textContent === "Mật khẩu mới không hợp lệ.",
    d.querySelector("#pwErr").textContent);
  pwMode = "ok";

  console.log("== i. không dùng innerHTML/onclick/localStorage ==");
  ["innerHTML", "outerHTML", "onclick", "localStorage", "document.write"].forEach(function(bad){
    check("i. admin.js không chứa '" + bad + "'", adminJs.indexOf(bad) === -1);
    check("i. admin.html không chứa '" + bad + "'", adminHtmlSrc.indexOf(bad) === -1);
  });

  console.log("\n==== KẾT QUẢ: " + pass + " PASS, " + fail + " FAIL ====");
  if (failures.length) console.log("FAILED: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})().catch(function(e){ console.error("HARNESS ERROR", e && e.stack || e); process.exit(2); });
