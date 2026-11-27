/* ============================================================================
   Test frontend — Admin thêm tài khoản (bulk-add) (jsdom)
   ----------------------------------------------------------------------------
   Chạy:  NODE_PATH=/tmp/node_modules node tests/test-admin-bulk-add.js
   (từ thư mục files/admin-page/)
   Cần: jsdom (đã có ở /tmp/node_modules).

   Nạp admin.html + admin.js THẬT từ files/admin-page/ vào jsdom, mock fetch
   để giả lập backend. Mọi username/mật khẩu trong file này đều là FAKE
   (fakeuser123, fakepass123, ...), chỉ dùng để test luồng bulk-add,
   không phải tài khoản thật.

   Kịch bản:
     a. các phần tử tab/pane/textarea/file input/nút/bulkErr/bulkOut tồn tại;
        mặc định tab Nhập nhanh hiện, JSON/TXT ẩn.
     b. parseChatLines: dòng chuẩn, đủ 5 cột, dòng trống + dòng #, thiếu
        user/pass, giá sai (chữ/âm/thập phân), kind sai, CRLF, trim khoảng trắng.
     c. parseJsonText: mảng hợp lệ (đủ field optional), JSON hỏng, không phải
        mảng, mục không phải object, thiếu user/pass, price/kind sai.
     d. bấm tab JSON/TXT đổi pane + aria-selected; bấm lại Nhập nhanh.
     e. Nhập nhanh gửi thành công: POST /api/admin/shop/stock/bulk-add kèm
        Bearer, body {accounts}; hộp kết quả "Đã thêm 2 • Bỏ qua 0 • Lỗi 0",
        hiện mã đã thêm, toast thành công.
     f. server trả added/skipped/errors: hộp kết quả gộp lỗi server + lỗi
        parse client, bảng lỗi hiện mã + lý do.
     g. chỉ toàn dòng lỗi -> KHÔNG gọi fetch, bulkErr báo rõ.
     h. JSON gửi thành công: parse mảng JSON rồi POST đúng accounts.
     i. JSON hỏng -> KHÔNG gọi fetch, bulkErr báo rõ.
     j. load file .txt vào textarea rồi Gửi -> POST đúng accounts.
     k. load file .json vào textarea.
     l. server 500 -> bulkErr báo lỗi, không crash.
     m. admin.html/admin.js không chứa innerHTML/onclick/localStorage.
   ============================================================================ */
const fs = require("fs");
const path = require("path");
let JSDOM;
try { JSDOM = require("jsdom").JSDOM; }
catch (e) { JSDOM = require("/tmp/node_modules/jsdom").JSDOM; }

const ADMIN_DIR = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ADMIN_DIR, "admin.html"), "utf8");
const adminJs = fs.readFileSync(path.join(ADMIN_DIR, "admin.js"), "utf8");
const adminHtmlSrc = html;
const API_URL = "https://anhdev-store-backend.onrender.com";

/* ---------- fake backend -------------------------------------------------- */
let bulkMode = "ok";      // "ok" | "partial" | "500"
let calls = [];           // {url, method, body, auth}
function makeResp(status, obj){
  return { ok: status >= 200 && status < 300, status: status,
           text: function(){ return Promise.resolve(JSON.stringify(obj)); },
           json: function(){ return Promise.resolve(obj); } };
}
function fakeFetch(url, opts){
  opts = opts || {};
  const u = String(url);
  const body = opts.body ? JSON.parse(opts.body) : null;
  const auth = (opts.headers && opts.headers.Authorization) || "";
  calls.push({ url: u, method: opts.method || "GET", body: body, auth: auth });
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
  if (u.indexOf("/api/admin/shop/stock/bulk-add") !== -1){
    if (bulkMode === "500")
      return Promise.resolve(makeResp(500, { error: "Lỗi máy chủ nội bộ." }));
    const n = (body && body.accounts) ? body.accounts.length : 0;
    if (bulkMode === "partial")
      return Promise.resolve(makeResp(200, { ok: true, added: 1, skipped: 1,
        errors: [{ index: 1, code: "LQ9002", reason: "Username đã tồn tại." }],
        codes: ["LQ9001"] }));
    const codes = [];
    for (let i = 0; i < n; i++) codes.push("LQ900" + (i + 1));
    return Promise.resolve(makeResp(200, { ok: true, added: n, skipped: 0, errors: [], codes: codes }));
  }
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
function bulkCalls(){
  return calls.filter(function(c){ return c.url.indexOf("/api/admin/shop/stock/bulk-add") !== -1; });
}
function toasts(w){
  return Array.from(w.document.querySelectorAll(".toast-item")).map(function(t){ return t.textContent; });
}
async function makePage(){
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/admin.html",
    runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = fakeFetch;
  w.confirm = function(){ return true; };
  // admin.js mở đầu bằng "use strict" nên function declarations trong eval
  // không thành thuộc tính window; export 2 hàm parse trong cùng 1 lần eval.
  dom.window.eval(adminJs + "\n;window.__bulkFns = { parseChatLines: parseChatLines, parseJsonText: parseJsonText };");
  const d = w.document;
  d.querySelector("#loginUser").value = "admin2";
  d.querySelector("#loginPass").value = "test-admin-pass";
  d.querySelector("#loginForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(300);
  return { dom: dom, w: w };
}
function setFile(w, inputId, name, text, type){
  const inp = w.document.querySelector(inputId);
  const f = new w.File([text], name, { type: type });
  Object.defineProperty(inp, "files", { value: [f], configurable: true });
  inp.dispatchEvent(new w.Event("change", { bubbles: true }));
}

(async function(){
  const p = await makePage();
  const w = p.w, d = w.document;

  console.log("== a. phần tử bulk-add ==");
  check("a1. đăng nhập fake thành công, bảng điều khiển hiện",
    d.querySelector("#dashSec").classList.contains("hidden") === false);
  check("a2. 3 tab tồn tại, chữ đúng",
    !!d.querySelector("#bulkTabChat") && d.querySelector("#bulkTabChat").textContent === "Nhập nhanh" &&
    !!d.querySelector("#bulkTabJson") && d.querySelector("#bulkTabJson").textContent === "JSON" &&
    !!d.querySelector("#bulkTabTxt") && d.querySelector("#bulkTabTxt").textContent === "TXT");
  check("a3. 3 pane tồn tại",
    !!d.querySelector("#bulkChatPane") && !!d.querySelector("#bulkJsonPane") && !!d.querySelector("#bulkTxtPane"));
  check("a4. mặc định: pane Nhập nhanh hiện, JSON/TXT ẩn",
    !d.querySelector("#bulkChatPane").classList.contains("hidden") &&
    d.querySelector("#bulkJsonPane").classList.contains("hidden") &&
    d.querySelector("#bulkTxtPane").classList.contains("hidden"));
  check("a5. tab Nhập nhanh active + aria-selected=true",
    d.querySelector("#bulkTabChat").classList.contains("active") &&
    d.querySelector("#bulkTabChat").getAttribute("aria-selected") === "true");
  check("a6. textarea + file input + nút Gửi tồn tại",
    !!d.querySelector("#bulkChat") && !!d.querySelector("#bulkJson") && !!d.querySelector("#bulkTxt") &&
    !!d.querySelector("#bulkJsonFile") && !!d.querySelector("#bulkTxtFile") &&
    !!d.querySelector("#bulkChatBtn") && !!d.querySelector("#bulkJsonBtn") && !!d.querySelector("#bulkTxtBtn"));
  check("a7. bulkTxt readonly (chỉ hiển thị file đã load)",
    d.querySelector("#bulkTxt").readOnly === true);
  check("a8. bulkErr + bulkOut tồn tại", !!d.querySelector("#bulkErr") && !!d.querySelector("#bulkOut"));
  check("a9. parseChatLines + parseJsonText export được để unit-test",
    w.__bulkFns && typeof w.__bulkFns.parseChatLines === "function" &&
    typeof w.__bulkFns.parseJsonText === "function");

  console.log("== b. parseChatLines ==");
  const pc = w.__bulkFns.parseChatLines;
  let r = pc("fakeuser123|fakepass123\nfakeuser456|fakepass456");
  check("b1. 2 dòng chuẩn -> 2 acc, mặc định price 0 + kind random",
    r.accounts.length === 2 && r.errors.length === 0 &&
    r.accounts[0].username === "fakeuser123" && r.accounts[0].password === "fakepass123" &&
    r.accounts[0].price === 0 && r.accounts[0].kind === "random",
    JSON.stringify(r));
  r = pc("fakeuser123|fakepass123|18000|info|Cao Thủ");
  check("b2. đủ 5 cột -> price/kind/rank đúng",
    r.accounts.length === 1 && r.accounts[0].price === 18000 &&
    r.accounts[0].kind === "info" && r.accounts[0].rank === "Cao Thủ",
    JSON.stringify(r));
  r = pc("\n  \n# ghi chú\nfakeuser123|fakepass123\n#dòng chú thích\nfakeuser456|fakepass456\n");
  check("b3. bỏ qua dòng trống + dòng bắt đầu bằng #",
    r.accounts.length === 2 && r.errors.length === 0, JSON.stringify(r));
  r = pc("fakeuser123|\n|fakepass123\nfakeuser456|fakepass456");
  check("b4. thiếu user/pass -> dòng lỗi, dòng đúng vẫn giữ",
    r.accounts.length === 1 && r.errors.length === 2 &&
    r.errors[0].reason.indexOf("thiếu username hoặc password") !== -1,
    JSON.stringify(r));
  r = pc("fakeuser123|fakepass123|abc\nfakeuser456|fakepass456|-5\nfakeuser789|fakepass789|1.5\nfakeuser000|fakepass000|0");
  check("b5. giá chữ/âm/thập phân -> lỗi; giá 0 hợp lệ",
    r.accounts.length === 1 && r.accounts[0].username === "fakeuser000" && r.errors.length === 3,
    JSON.stringify(r));
  r = pc("fakeuser123|fakepass123|1000|vip\nfakeuser456|fakepass456|1000|WHITE");
  check("b6. kind sai -> lỗi; kind WHITE viết hoa vẫn nhận (lowercase)",
    r.accounts.length === 1 && r.accounts[0].kind === "white" && r.errors.length === 1,
    JSON.stringify(r));
  r = pc("fakeuser123|fakepass123\r\nfakeuser456|fakepass456\r");
  check("b7. CRLF/CR tách dòng đúng", r.accounts.length === 2 && r.errors.length === 0, JSON.stringify(r));
  r = pc("  fakeuser123  |  fakepass123  |  18000  |  info  |  Cao Thủ  ");
  check("b8. trim khoảng trắng 2 đầu mỗi cột",
    r.accounts.length === 1 && r.accounts[0].username === "fakeuser123" &&
    r.accounts[0].rank === "Cao Thủ", JSON.stringify(r));
  r = pc("");
  check("b9. text rỗng -> 0 acc, 0 lỗi", r.accounts.length === 0 && r.errors.length === 0);
  r = pc("fakeuser123|fakepass123|18000");
  check("b10. chỉ có price, thiếu kind/rank -> kind mặc định random",
    r.accounts.length === 1 && r.accounts[0].price === 18000 && r.accounts[0].kind === "random",
    JSON.stringify(r));

  console.log("== c. parseJsonText ==");
  const pj = w.__bulkFns.parseJsonText;
  r = pj('[{"username":"fakeuser123","password":"fakepass123","code":"LQ9001","price":18000,"kind":"info","rank":"Cao Thủ","rare_skins":"Nakroth Test","description":"acc test"}]');
  check("c1. mảng hợp lệ -> đủ field optional giữ nguyên",
    r.accounts.length === 1 && r.errors.length === 0 &&
    r.accounts[0].code === "LQ9001" && r.accounts[0].price === 18000 &&
    r.accounts[0].kind === "info" && r.accounts[0].rank === "Cao Thủ" &&
    r.accounts[0].rare_skins === "Nakroth Test" && r.accounts[0].description === "acc test",
    JSON.stringify(r));
  r = pj('[{"username":"fakeuser123","password":"fakepass123"}]');
  check("c2. chỉ user/pass -> mặc định price 0 + kind random",
    r.accounts.length === 1 && r.accounts[0].price === 0 && r.accounts[0].kind === "random",
    JSON.stringify(r));
  r = pj('[{"username":"fakeuser123"');
  check("c3. JSON hỏng -> 1 lỗi, 0 acc",
    r.accounts.length === 0 && r.errors.length === 1 &&
    r.errors[0].reason.indexOf("JSON không hợp lệ") === 0, JSON.stringify(r));
  r = pj('{"username":"fakeuser123","password":"fakepass123"}');
  check("c4. JSON không phải mảng -> 1 lỗi",
    r.accounts.length === 0 && r.errors.length === 1 &&
    r.errors[0].reason.indexOf("phải là một mảng") !== -1, JSON.stringify(r));
  r = pj('["chuoi", 42, null, {"username":"","password":"fakepass123"}, {"username":"fakeuser123","password":"fakepass123"}]');
  check("c5. mục không phải object + thiếu user/pass -> lỗi, mục đúng vẫn giữ",
    r.accounts.length === 1 && r.errors.length === 4, JSON.stringify(r));
  r = pj('[{"username":"fakeuser123","password":"fakepass123","price":-1},{"username":"fakeuser456","password":"fakepass456","kind":"vip"}]');
  check("c6. price âm / kind sai -> lỗi từng mục",
    r.accounts.length === 0 && r.errors.length === 2, JSON.stringify(r));
  r = pj('[]');
  check("c7. mảng rỗng -> 0 acc, 0 lỗi", r.accounts.length === 0 && r.errors.length === 0);
  r = pj('[{"username":"fakeuser123","password":"fakepass123","price":"18000","kind":"White"}]');
  check("c8. price dạng chuỗi số + kind viết hoa vẫn nhận",
    r.accounts.length === 1 && r.accounts[0].price === 18000 && r.accounts[0].kind === "white",
    JSON.stringify(r));

  console.log("== d. wiring tab chế độ ==");
  d.querySelector("#bulkTabJson").click();
  check("d1. bấm JSON -> pane JSON hiện, pane Nhập nhanh ẩn",
    !d.querySelector("#bulkJsonPane").classList.contains("hidden") &&
    d.querySelector("#bulkChatPane").classList.contains("hidden"));
  check("d2. tab JSON active + aria-selected, tab Nhập nhanh mất active",
    d.querySelector("#bulkTabJson").classList.contains("active") &&
    d.querySelector("#bulkTabJson").getAttribute("aria-selected") === "true" &&
    !d.querySelector("#bulkTabChat").classList.contains("active") &&
    d.querySelector("#bulkTabChat").getAttribute("aria-selected") === "false");
  d.querySelector("#bulkTabTxt").click();
  check("d3. bấm TXT -> pane TXT hiện, pane JSON ẩn",
    !d.querySelector("#bulkTxtPane").classList.contains("hidden") &&
    d.querySelector("#bulkJsonPane").classList.contains("hidden"));
  d.querySelector("#bulkTabChat").click();
  check("d4. bấm lại Nhập nhanh -> về pane chat",
    !d.querySelector("#bulkChatPane").classList.contains("hidden") &&
    d.querySelector("#bulkTxtPane").classList.contains("hidden"));

  console.log("== e. Nhập nhanh gửi thành công ==");
  calls = [];
  bulkMode = "ok";
  d.querySelector("#bulkChat").value = "fakeuser123|fakepass123\nfakeuser456|fakepass456|18000|info|Cao Thủ";
  d.querySelector("#bulkChatBtn").click();
  await sleep(300);
  check("e1. POST đúng endpoint bulk-add, 1 lần",
    bulkCalls().length === 1 &&
    bulkCalls()[0].url === API_URL + "/api/admin/shop/stock/bulk-add" &&
    bulkCalls()[0].method === "POST",
    JSON.stringify(bulkCalls()[0]));
  check("e2. gửi kèm Bearer token admin",
    bulkCalls()[0] && bulkCalls()[0].auth === "Bearer jwt-test-admin",
    bulkCalls()[0] && bulkCalls()[0].auth);
  check("e3. body {accounts} đúng 2 acc đã parse",
    bulkCalls()[0] && bulkCalls()[0].body && bulkCalls()[0].body.accounts &&
    bulkCalls()[0].body.accounts.length === 2 &&
    bulkCalls()[0].body.accounts[0].username === "fakeuser123" &&
    bulkCalls()[0].body.accounts[1].price === 18000 &&
    bulkCalls()[0].body.accounts[1].kind === "info" &&
    bulkCalls()[0].body.accounts[1].rank === "Cao Thủ",
    JSON.stringify(bulkCalls()[0] && bulkCalls()[0].body));
  check("e4. hộp kết quả 'Đã thêm 2 • Bỏ qua 0 • Lỗi 0'",
    d.querySelector("#bulkOut").textContent.indexOf("Đã thêm 2 • Bỏ qua 0 • Lỗi 0") !== -1,
    d.querySelector("#bulkOut").textContent);
  check("e5. hộp kết quả hiện mã đã thêm LQ9001, LQ9002",
    d.querySelector("#bulkOut").textContent.indexOf("LQ9001") !== -1 &&
    d.querySelector("#bulkOut").textContent.indexOf("LQ9002") !== -1,
    d.querySelector("#bulkOut").textContent);
  check("e6. toast 'Đã thêm 2 acc vào kho.'",
    toasts(w).some(function(t){ return t.indexOf("Đã thêm 2 acc vào kho.") !== -1; }),
    JSON.stringify(toasts(w)));

  console.log("== f. server trả lỗi từng acc + lỗi parse client ==");
  calls = [];
  bulkMode = "partial";
  d.querySelector("#bulkChat").value = "fakeuser123|fakepass123\nfakeuser456|\nfakeuser789|fakepass789";
  d.querySelector("#bulkChatBtn").click();
  await sleep(300);
  check("f1. vẫn POST 2 acc hợp lệ (dòng lỗi parse bị loại)",
    bulkCalls().length === 1 && bulkCalls()[0].body.accounts.length === 2,
    JSON.stringify(bulkCalls()[0] && bulkCalls()[0].body));
  check("f2. hộp kết quả 'Đã thêm 1 • Bỏ qua 1 • Lỗi 2' (1 server + 1 parse)",
    d.querySelector("#bulkOut").textContent.indexOf("Đã thêm 1 • Bỏ qua 1 • Lỗi 2") !== -1,
    d.querySelector("#bulkOut").textContent);
  check("f3. bảng lỗi hiện mã server LQ9002 + lý do 'Username đã tồn tại.'",
    d.querySelector("#bulkOut").textContent.indexOf("LQ9002") !== -1 &&
    d.querySelector("#bulkOut").textContent.indexOf("Username đã tồn tại.") !== -1,
    d.querySelector("#bulkOut").textContent);
  check("f4. bảng lỗi hiện cả lý do parse 'thiếu username hoặc password'",
    d.querySelector("#bulkOut").textContent.indexOf("thiếu username hoặc password") !== -1,
    d.querySelector("#bulkOut").textContent);
  bulkMode = "ok";

  console.log("== g. chỉ toàn dòng lỗi -> không gọi fetch ==");
  calls = [];
  d.querySelector("#bulkChat").value = "fakeuser123|\n|fakepass123\n# chỉ chú thích\n";
  d.querySelector("#bulkChatBtn").click();
  await sleep(200);
  check("g1. KHÔNG gọi fetch bulk-add", bulkCalls().length === 0, "bulkCalls=" + bulkCalls().length);
  check("g2. bulkErr báo 'Không có acc hợp lệ để gửi.'",
    d.querySelector("#bulkErr").textContent.indexOf("Không có acc hợp lệ để gửi.") !== -1,
    d.querySelector("#bulkErr").textContent);

  console.log("== h. JSON gửi thành công ==");
  calls = [];
  d.querySelector("#bulkTabJson").click();
  d.querySelector("#bulkJson").value = '[{"username":"fakeuser123","password":"fakepass123","price":7000,"kind":"white"},{"username":"fakeuser456","password":"fakepass456"}]';
  d.querySelector("#bulkJsonBtn").click();
  await sleep(300);
  check("h1. POST bulk-add 1 lần với 2 acc từ JSON",
    bulkCalls().length === 1 && bulkCalls()[0].body.accounts.length === 2 &&
    bulkCalls()[0].body.accounts[0].kind === "white" &&
    bulkCalls()[0].body.accounts[0].price === 7000 &&
    bulkCalls()[0].body.accounts[1].kind === "random",
    JSON.stringify(bulkCalls()[0] && bulkCalls()[0].body));
  check("h2. hộp kết quả 'Đã thêm 2 • Bỏ qua 0 • Lỗi 0'",
    d.querySelector("#bulkOut").textContent.indexOf("Đã thêm 2 • Bỏ qua 0 • Lỗi 0") !== -1,
    d.querySelector("#bulkOut").textContent);

  console.log("== i. JSON hỏng -> không gọi fetch ==");
  calls = [];
  d.querySelector("#bulkJson").value = '[{"username":"fakeuser123"';
  d.querySelector("#bulkJsonBtn").click();
  await sleep(200);
  check("i1. KHÔNG gọi fetch bulk-add", bulkCalls().length === 0, "bulkCalls=" + bulkCalls().length);
  check("i2. bulkErr báo 'Không có acc hợp lệ để gửi.'",
    d.querySelector("#bulkErr").textContent.indexOf("Không có acc hợp lệ để gửi.") !== -1,
    d.querySelector("#bulkErr").textContent);

  console.log("== j. load file .txt rồi Gửi ==");
  calls = [];
  d.querySelector("#bulkTabTxt").click();
  setFile(w, "#bulkTxtFile", "acc-test.txt",
    "fakeuser123|fakepass123\nfakeuser456|fakepass456|18000|info|Cao Thủ\n", "text/plain");
  await sleep(200);
  check("j1. textarea TXT hiện đúng nội dung file đã load",
    d.querySelector("#bulkTxt").value.indexOf("fakeuser123|fakepass123") !== -1 &&
    d.querySelector("#bulkTxt").value.indexOf("fakeuser456|fakepass456|18000|info|Cao Thủ") !== -1,
    d.querySelector("#bulkTxt").value);
  check("j2. toast 'Đã load file acc-test.txt.'",
    toasts(w).some(function(t){ return t.indexOf("Đã load file acc-test.txt.") !== -1; }),
    JSON.stringify(toasts(w)));
  d.querySelector("#bulkTxtBtn").click();
  await sleep(300);
  check("j3. Gửi từ TXT -> POST 2 acc đúng nội dung file",
    bulkCalls().length === 1 && bulkCalls()[0].body.accounts.length === 2 &&
    bulkCalls()[0].body.accounts[1].rank === "Cao Thủ",
    JSON.stringify(bulkCalls()[0] && bulkCalls()[0].body));
  check("j4. hộp kết quả 'Đã thêm 2 • Bỏ qua 0 • Lỗi 0'",
    d.querySelector("#bulkOut").textContent.indexOf("Đã thêm 2 • Bỏ qua 0 • Lỗi 0") !== -1,
    d.querySelector("#bulkOut").textContent);

  console.log("== k. load file .json ==");
  d.querySelector("#bulkTabJson").click();
  setFile(w, "#bulkJsonFile", "acc-test.json",
    '[{"username":"fakeuser123","password":"fakepass123","kind":"white"}]', "application/json");
  await sleep(200);
  check("k1. textarea JSON hiện đúng nội dung file đã load",
    d.querySelector("#bulkJson").value.indexOf('"username":"fakeuser123"') !== -1,
    d.querySelector("#bulkJson").value);
  check("k2. toast 'Đã load file acc-test.json.'",
    toasts(w).some(function(t){ return t.indexOf("Đã load file acc-test.json.") !== -1; }),
    JSON.stringify(toasts(w)));

  console.log("== l. server 500 ==");
  calls = [];
  bulkMode = "500";
  d.querySelector("#bulkTabChat").click();
  d.querySelector("#bulkChat").value = "fakeuser123|fakepass123";
  d.querySelector("#bulkChatBtn").click();
  await sleep(300);
  check("l1. server 500 -> bulkErr báo lỗi, không crash",
    d.querySelector("#bulkErr").textContent.indexOf("Lỗi:") === 0 &&
    d.querySelector("#bulkErr").textContent.indexOf("Lỗi máy chủ nội bộ.") !== -1,
    d.querySelector("#bulkErr").textContent);
  check("l2. nút Gửi mở khóa lại sau lỗi (không kẹt disabled)",
    d.querySelector("#bulkChatBtn").disabled === false);
  bulkMode = "ok";

  console.log("== m. không dùng innerHTML/onclick/localStorage ==");
  ["innerHTML", "outerHTML", "onclick", "localStorage", "document.write"].forEach(function(bad){
    check("m. admin.js không chứa '" + bad + "'", adminJs.indexOf(bad) === -1);
    check("m. admin.html không chứa '" + bad + "'", adminHtmlSrc.indexOf(bad) === -1);
  });
  check("m. admin.js không chứa mật khẩu test thật (chỉ code, không credential)",
    adminJs.indexOf("fakepass") === -1 && adminJs.indexOf("test123456") === -1);

  console.log("\n==== KẾT QUẢ: " + pass + " PASS, " + fail + " FAIL ====");
  if (failures.length) console.log("FAILED: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})().catch(function(e){ console.error("HARNESS ERROR", e && e.stack || e); process.exit(2); });
