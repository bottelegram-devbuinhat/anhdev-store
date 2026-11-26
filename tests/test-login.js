/* ============================================================================
   Test frontend — Form dang nhap moi login.html (Worker B2, 2026-11-26)
   ----------------------------------------------------------------------------
   Chay:  NODE_PATH=/tmp/node_modules node tests/test-login.js
   (tu thu muc files/store-upgrade/)
   Can: jsdom (da co o /tmp/node_modules).

   Kich ban:
     A. Tinh (doc file login.html, khong chay JS):
        - Khong con Font Awesome (0 link/script, 0 class fa-*).
        - Khong con HEX / rgba() truc tiep trong CSS component (mau qua var,
          chi :root duoc giu HEX de dinh nghia token); khong co #000000.
        - Khong co style inline (QT-46), khong emoji lam icon (QT-23).
        - Nut 40px / input 42px / touch 44px o pointer:coarse (QT-20);
          active scale 0.97 (QT-21); cubic-bezier chuan (QT-28);
          prefers-reduced-motion (QT-32); vong xoay mini 14px (QT-36).
        - O password KHONG co minlength (admin2 mat khau "1" dang nhap duoc).
        - Co API_BASE_URL that, endpoint login/register, key anhdev_web_token,
          payload password_confirm; co chu thich bien QT-48.
     B. Chay that trong jsdom (fetch gia lap backend):
        - Tab Dang nhap/Dang ky chuyen dung; hien/an mat khau.
        - Login admin2 mat khau "1" thanh cong: dung endpoint + payload,
          token luu localStorage anhdev_web_token, chuyen ve index.html.
        - Login sai TK/MK -> notice loi tieng Viet, nut mo khoa lai.
        - Register moi: dung endpoint + payload (co password_confirm);
          trung ten / mat khau < 6 / xac nhan lech -> loi, khong goi fetch.
        - Double-submit: bam 2 lan chi goi 1 request (QT-36).
        - Loi mang -> notice tieng Viet ro rang.
        - /me loi van giu phien + chuyen trang (fallback nhu app.js).
        - Ghi nho: check -> remember "1"; bo check -> remember "0" +
          token trong sessionStorage.
        - Telegram: widget script dung bot devbn_bot + link fallback;
          onTelegramAuth luu anhdev_user dung dinh dang store + chuyen trang.
   ============================================================================ */
const fs = require("fs");
const path = require("path");
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch (e) { ({ JSDOM, VirtualConsole } = require("/tmp/node_modules/jsdom")); }

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "login.html"), "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond){ pass++; console.log("  PASS " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? " — " + extra : "")); }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

/* ---------- A. Tinh ------------------------------------------------------- */
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const style = styleMatch ? styleMatch[1] : "";
const rootBlock = (style.match(/:root\s*\{[^}]*\}/) || [""])[0];
const compCss = style.replace(/:root\s*\{[^}]*\}/, "").replace(/\/\*[\s\S]*?\*\//g, "");

console.log("== A. Tinh: design system + cau truc ==");
check("a1. khong co Font Awesome (0 link/script/class fa-*)",
  !/font-?awesome/i.test(html) && !/fa-(solid|regular|brands|user|lock|eye|shield)/i.test(html));
check("a2. khong co the <i> icon nao", !/<i[\s>]/.test(html));
check("a3. CSS component khong co HEX truc tiep (mau qua var)",
  !/#[0-9a-fA-F]{3,8}\b/.test(compCss), (compCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []).join(","));
check("a4. CSS component khong co rgba()/rgb()/hsl() truc tiep",
  !/rgba?\(/i.test(compCss) && !/hsla?\(/i.test(compCss));
check("a5. khong co #000000 tuyet doi (QT-01)", !/#000000/i.test(html));
check("a6. :root co token Obsidian #09090B + tang #111114/#18181C/#222228 + input #0D0D10",
  rootBlock.indexOf("#09090B") !== -1 && rootBlock.indexOf("#111114") !== -1 &&
  rootBlock.indexOf("#18181C") !== -1 && rootBlock.indexOf("#222228") !== -1 &&
  rootBlock.indexOf("#0D0D10") !== -1);
check("a7. accent STORE emerald #10B981 + vang #F5B942 (khong cam #FF5A1F)",
  rootBlock.indexOf("#10B981") !== -1 && rootBlock.indexOf("#F5B942") !== -1 &&
  !/#FF5A1F/i.test(html));
check("a8. khong co style inline (QT-46)", !/<[^>]*\sstyle\s*=/.test(html));
check("a9. khong co emoji trong file (QT-23)",
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(html));
check("a10. nut submit cao 40px (QT-20)", /\.submit-btn\s*\{[^}]*height:\s*40px/.test(style));
check("a11. input cao 42px (QT-20)", /\.input-wrap input\s*\{[^}]*height:\s*42px/.test(style));
check("a12. pointer:coarse min-height 44px (QT-20)",
  /@media\s*\(pointer:\s*coarse\)[\s\S]*?min-height:\s*44px/.test(style));
check("a13. active scale(0.97) (QT-21)", /scale\(0\.97\)/.test(style));
check("a14. cubic-bezier chuan, khong linear cho tuong tac (QT-28)",
  /cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/.test(style) && !/transition:[^;]*\blinear\b/.test(style));
check("a15. co prefers-reduced-motion (QT-32)", /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(style));
check("a16. vong xoay mini 14px (QT-36)", /\.submit-spinner\s*\{[^}]*width:\s*14px/.test(style));
check("a17. khong co gradient tim-xanh (QT-39)",
  !/#6366F1/i.test(html) && !/#A855F7/i.test(html) && !/#3B82F6/i.test(html));
check("a18. o password KHONG co minlength (admin2 '1' dang nhap duoc)",
  (function(){
    const m = html.match(/<input[^>]*id="password"[^>]*>/);
    return !!m && !/minlength/i.test(m[0]);
  })());
check("a19. o confirm password cung KHONG co minlength",
  (function(){
    const m = html.match(/<input[^>]*id="confirmPassword"[^>]*>/);
    return !!m && !/minlength/i.test(m[0]);
  })());
check("a20. form co novalidate (loi tieng Viet tu JS, khong bubble trinh duyet)",
  /<form[^>]*novalidate/.test(html));
check("a21. co API_BASE_URL that + endpoint login/register + key anhdev_web_token",
  html.indexOf("https://anhdev-store-backend.onrender.com") !== -1 &&
  html.indexOf("/api/auth/login") !== -1 && html.indexOf("/api/auth/register") !== -1 &&
  html.indexOf("anhdev_web_token") !== -1 && html.indexOf("password_confirm") !== -1);
check("a22. co chu thich bien QT-48 o cuoi script",
  /Chú thích biến \(QT-48\)/.test(html));
check("a23. co HTML ngu nghia header/nav/main/form/footer (QT-45)",
  /<header[\s>]/.test(html) && /<nav[\s>]/.test(html) && /<main[\s>]/.test(html) &&
  /<form[\s>]/.test(html) && /<footer[\s>]/.test(html));
check("a24. khong cuon ngang: body overflow-x clip (QT-47)", /overflow-x:\s*clip/.test(style));

/* ---------- B. Chay that (jsdom + fetch gia lap) --------------------------- */
function makeResp(status, obj){
  return { ok: status >= 200 && status < 300, status: status,
    text: function(){ return Promise.resolve(JSON.stringify(obj)); },
    json: function(){ return Promise.resolve(obj); } };
}
function makeFetch(o){
  o = o || {};
  const calls = [];
  const users = o.users || {
    admin2: { password: "1", role: "admin" },
    nhatdeptrai: { password: "123456", role: "user" }
  };
  function f(url, opts){
    opts = opts || {};
    calls.push({ url: String(url), method: opts.method,
      body: opts.body ? JSON.parse(opts.body) : null,
      auth: (opts.headers && opts.headers.Authorization) || "" });
    const u = String(url);
    const run = function(){
      if (u.indexOf("/api/auth/login") !== -1){
        const b = opts.body ? JSON.parse(opts.body) : {};
        const r = users[b.username];
        if (!r || r.password !== b.password)
          return makeResp(401, { ok: false, error: "Sai tên đăng nhập hoặc mật khẩu." });
        return makeResp(200, { ok: true, token: "jwt-" + b.username });
      }
      if (u.indexOf("/api/auth/register") !== -1){
        const b = opts.body ? JSON.parse(opts.body) : {};
        if (users[b.username]) return makeResp(409, { ok: false, error: "Tên đăng nhập đã tồn tại." });
        users[b.username] = { password: b.password, role: "user" };
        return makeResp(200, { ok: true, token: "jwt-" + b.username });
      }
      if (u.indexOf("/api/auth/me") !== -1){
        if (o.meFail) return makeResp(o.meFail, { ok: false, error: "loi me" });
        const n = ((opts.headers && opts.headers.Authorization) || "")
          .replace(/^Bearer\s+/, "").replace(/^jwt-/, "");
        const r = users[n];
        if (!r) return makeResp(401, { ok: false, error: "unauthorized" });
        return makeResp(200, { ok: true, user: { username: n, balance: 250000,
          role: r.role, discount_percent: 0, telegram_id: null } });
      }
      return makeResp(404, { ok: false, error: "not found" });
    };
    if (o.delay) return new Promise(function(res){ setTimeout(function(){ res(run()); }, o.delay); });
    return Promise.resolve(run());
  }
  f.calls = calls;
  f.users = users;
  return f;
}

function makeDom(fetcher){
  const jsErrors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", function(e){ jsErrors.push("jsdomError: " + (e && e.message)); });
  vc.on("error", function(m){ jsErrors.push("console.error: " + m); });
  let redirected = 0;
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/login.html",
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse: function(w){
      w.fetch = fetcher;
      w.__afterLogin = function(){ redirected++; };
    }});
  return { dom: dom, w: dom.window, d: dom.window.document, jsErrors: jsErrors,
    redirected: function(){ return redirected; } };
}

function submitForm(w, d){
  d.querySelector("#authForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
}
function noticeText(d){
  const n = d.querySelector("#notice");
  return { text: n.textContent, cls: n.className };
}

async function main(){
  console.log("== B. Chay that (jsdom) ==");

  /* b1: load sach, khong loi console */
  {
    const t = makeDom(makeFetch());
    await sleep(300);
    check("b1. load trang: 0 jsdomError/console.error", t.jsErrors.length === 0, t.jsErrors.join(" | "));
  }

  /* b2: tab dang nhap / dang ky */
  {
    const t = makeDom(makeFetch());
    const d = t.d;
    d.querySelector('[data-mode="register"]').click();
    check("b2a. tab Dang ky: hien o xac nhan + nut 'Tạo tài khoản'",
      !d.querySelector("#confirmGroup").classList.contains("hidden") &&
      d.querySelector("#submitLabel").textContent === "Tạo tài khoản");
    check("b2b. tab Dang ky: placeholder mat khau nhac '(từ 6 ký tự)'",
      d.querySelector("#password").placeholder.indexOf("6 ký tự") !== -1);
    d.querySelector('[data-mode="login"]').click();
    check("b2c. tab Dang nhap: an o xac nhan + nut 'Đăng nhập ngay'",
      d.querySelector("#confirmGroup").classList.contains("hidden") &&
      d.querySelector("#submitLabel").textContent === "Đăng nhập ngay");
  }

  /* b3: admin2 mat khau "1" dang nhap duoc (test chinh) */
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector("#username").value = "admin2";
    d.querySelector("#password").value = "1";
    submitForm(w, d);
    await sleep(1000);
    const loginCalls = f.calls.filter(function(c){ return c.url.indexOf("/api/auth/login") !== -1; });
    check("b3a. login admin2 goi dung POST /api/auth/login",
      loginCalls.length === 1 && loginCalls[0].method === "POST",
      JSON.stringify(loginCalls));
    check("b3b. payload dung {username:'admin2', password:'1'}",
      loginCalls.length === 1 && loginCalls[0].body &&
      loginCalls[0].body.username === "admin2" && loginCalls[0].body.password === "1",
      JSON.stringify(loginCalls[0] && loginCalls[0].body));
    check("b3c. token luu localStorage anhdev_web_token",
      w.localStorage.getItem("anhdev_web_token") === "jwt-admin2",
      String(w.localStorage.getItem("anhdev_web_token")));
    check("b3d. /me duoc goi kem Bearer sau login",
      f.calls.some(function(c){ return c.url.indexOf("/api/auth/me") !== -1 && c.auth === "Bearer jwt-admin2"; }));
    check("b3e. notice chao mung + chuyen ve index.html",
      noticeText(d).text.indexOf("Chào admin2") !== -1 && t.redirected() === 1,
      JSON.stringify(noticeText(d)) + " redirected=" + t.redirected());
    check("b3f. mat khau da xoa khoi o nhap sau login",
      d.querySelector("#password").value === "");
  }

  /* b4: sai mat khau */
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector("#username").value = "nhatdeptrai";
    d.querySelector("#password").value = "sairoi";
    submitForm(w, d);
    await sleep(600);
    check("b4a. sai TK/MK: notice loi tieng Viet",
      noticeText(d).cls.indexOf("error") !== -1 &&
      noticeText(d).text.indexOf("Sai tên đăng nhập hoặc mật khẩu") !== -1,
      JSON.stringify(noticeText(d)));
    check("b4b. sai TK/MK: nut mo khoa lai, khong luu token, khong chuyen trang",
      d.querySelector("#submitBtn").disabled === false &&
      !w.localStorage.getItem("anhdev_web_token") && t.redirected() === 0);
  }

  /* b5: dang ky moi thanh cong */
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector('[data-mode="register"]').click();
    d.querySelector("#username").value = "nguoimoi";
    d.querySelector("#password").value = "abcdef";
    d.querySelector("#confirmPassword").value = "abcdef";
    submitForm(w, d);
    await sleep(1000);
    const regCalls = f.calls.filter(function(c){ return c.url.indexOf("/api/auth/register") !== -1; });
    check("b5a. register goi dung POST /api/auth/register",
      regCalls.length === 1 && regCalls[0].method === "POST");
    check("b5b. payload co password_confirm",
      regCalls.length === 1 && regCalls[0].body &&
      regCalls[0].body.username === "nguoimoi" &&
      regCalls[0].body.password === "abcdef" &&
      regCalls[0].body.password_confirm === "abcdef",
      JSON.stringify(regCalls[0] && regCalls[0].body));
    check("b5c. register xong luu token + chuyen trang",
      w.localStorage.getItem("anhdev_web_token") === "jwt-nguoimoi" && t.redirected() === 1,
      String(w.localStorage.getItem("anhdev_web_token")) + " redirected=" + t.redirected());
  }

  /* b6: register mat khau < 6 ky tu -> chan o client, khong goi fetch */
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector('[data-mode="register"]').click();
    d.querySelector("#username").value = "nguoimoi2";
    d.querySelector("#password").value = "abc";
    d.querySelector("#confirmPassword").value = "abc";
    submitForm(w, d);
    await sleep(300);
    check("b6. register pass <6: 0 fetch + loi 'Mật khẩu tối thiểu 6 ký tự.'",
      f.calls.length === 0 && noticeText(d).text.indexOf("Mật khẩu tối thiểu 6 ký tự") !== -1,
      "calls=" + f.calls.length + " notice=" + JSON.stringify(noticeText(d)));
  }

  /* b7: register xac nhan lech */
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector('[data-mode="register"]').click();
    d.querySelector("#username").value = "nguoimoi3";
    d.querySelector("#password").value = "abcdef";
    d.querySelector("#confirmPassword").value = "fedcba";
    submitForm(w, d);
    await sleep(300);
    check("b7. register xac nhan lech: 0 fetch + loi 'không khớp'",
      f.calls.length === 0 && noticeText(d).text.indexOf("không khớp") !== -1,
      "calls=" + f.calls.length + " notice=" + JSON.stringify(noticeText(d)));
  }

  /* b8: register trung ten (backend 409) */
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector('[data-mode="register"]').click();
    d.querySelector("#username").value = "admin2";
    d.querySelector("#password").value = "abcdef";
    d.querySelector("#confirmPassword").value = "abcdef";
    submitForm(w, d);
    await sleep(600);
    check("b8. register trung ten: hien loi backend, khong chuyen trang",
      noticeText(d).text.indexOf("Tên đăng nhập đã tồn tại") !== -1 && t.redirected() === 0,
      JSON.stringify(noticeText(d)));
  }

  /* b9: double-submit chi goi 1 request (QT-36) */
  {
    const f = makeFetch({ delay: 150 });
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector("#username").value = "nhatdeptrai";
    d.querySelector("#password").value = "123456";
    submitForm(w, d);
    submitForm(w, d);
    const busyNow = d.querySelector("#submitBtn").disabled === true;
    await sleep(1400);
    const loginCalls = f.calls.filter(function(c){ return c.url.indexOf("/api/auth/login") !== -1; });
    check("b9a. double-submit: nut disabled ngay khi gui", busyNow);
    check("b9b. double-submit: chi 1 request login", loginCalls.length === 1,
      "loginCalls=" + loginCalls.length);
  }

  /* b10: loi mang */
  {
    const netFail = function(){ return Promise.reject(new TypeError("Failed to fetch")); };
    const t = makeDom(netFail);
    const d = t.d, w = t.w;
    d.querySelector("#username").value = "nhatdeptrai";
    d.querySelector("#password").value = "123456";
    submitForm(w, d);
    await sleep(600);
    check("b10. loi mang: notice 'Không kết nối được máy chủ' + nut mo khoa",
      noticeText(d).text.indexOf("Không kết nối được máy chủ") !== -1 &&
      d.querySelector("#submitBtn").disabled === false,
      JSON.stringify(noticeText(d)));
  }

  /* b11: /me loi van giu phien + chuyen trang (fallback nhu app.js) */
  {
    const f = makeFetch({ meFail: 500 });
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector("#username").value = "nhatdeptrai";
    d.querySelector("#password").value = "123456";
    submitForm(w, d);
    await sleep(1000);
    check("b11. /me 500: van luu token + chuyen trang",
      w.localStorage.getItem("anhdev_web_token") === "jwt-nhatdeptrai" && t.redirected() === 1,
      String(w.localStorage.getItem("anhdev_web_token")) + " redirected=" + t.redirected());
  }

  /* b12: hien/an mat khau */
  {
    const t = makeDom(makeFetch());
    const d = t.d;
    const btn = d.querySelector('.toggle-password[data-target="password"]');
    btn.click();
    check("b12a. bam mat: password type=text + aria 'Ẩn mật khẩu'",
      d.querySelector("#password").type === "text" &&
      btn.getAttribute("aria-label") === "Ẩn mật khẩu");
    btn.click();
    check("b12b. bam lai: password type=password + aria 'Hiện mật khẩu'",
      d.querySelector("#password").type === "password" &&
      btn.getAttribute("aria-label") === "Hiện mật khẩu");
  }

  /* b13: ghi nho dang nhap */
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector("#username").value = "nhatdeptrai";
    d.querySelector("#password").value = "123456";
    submitForm(w, d);
    await sleep(1000);
    check("b13a. ghi nho (mac dinh check): remember='1', khong sessionStorage",
      w.localStorage.getItem("anhdev_web_remember") === "1" &&
      !w.sessionStorage.getItem("anhdev_web_token"));
  }
  {
    const f = makeFetch();
    const t = makeDom(f);
    const d = t.d, w = t.w;
    d.querySelector("#remember").checked = false;
    d.querySelector("#username").value = "nhatdeptrai";
    d.querySelector("#password").value = "123456";
    submitForm(w, d);
    await sleep(1000);
    check("b13b. bo ghi nho: remember='0' + token trong sessionStorage",
      w.localStorage.getItem("anhdev_web_remember") === "0" &&
      w.sessionStorage.getItem("anhdev_web_token") === "jwt-nhatdeptrai",
      "remember=" + w.localStorage.getItem("anhdev_web_remember") +
      " ss=" + w.sessionStorage.getItem("anhdev_web_token"));
  }

  /* b14: Telegram */
  {
    const t = makeDom(makeFetch());
    const d = t.d, w = t.w;
    const wg = d.querySelector('#telegramLoginWrap script[data-telegram-login="devbn_bot"]');
    check("b14a. widget Telegram dung bot devbn_bot + onauth onTelegramAuth",
      !!wg && wg.getAttribute("data-onauth") === "onTelegramAuth(user)" &&
      wg.getAttribute("src").indexOf("telegram.org/js/telegram-widget.js") !== -1);
    check("b14b. co link fallback mo bot @devbn_bot",
      !!d.querySelector('a[href="https://t.me/devbn_bot"]'));
    check("b14c. window.onTelegramAuth la function",
      typeof w.onTelegramAuth === "function");
    w.onTelegramAuth({ id: 123456, first_name: "Anh", username: "anhdev", auth_date: 1799999999 });
    await sleep(900);
    let saved = null;
    try { saved = JSON.parse(w.localStorage.getItem("anhdev_user")); } catch (e) { saved = null; }
    check("b14d. onTelegramAuth luu anhdev_user dung dinh dang store",
      !!saved && saved.telegram_id === 123456 && saved.username === "anhdev" &&
      saved.via === "Telegram" && typeof saved.login_data === "string" &&
      saved.login_data.indexOf("id=123456") !== -1,
      JSON.stringify(saved));
    check("b14e. Telegram xong chuyen ve index.html, khong con token web",
      t.redirected() === 1 && !w.localStorage.getItem("anhdev_web_token"),
      "redirected=" + t.redirected());
  }

  /* b15: quen mat khau -> huong dan lien he admin (khong nut chet) */
  {
    const t = makeDom(makeFetch());
    const d = t.d, w = t.w;
    d.querySelector("#forgotLink").click();
    check("b15. quen mat khau: notice huong dan mo bot @devbn_bot",
      noticeText(d).text.indexOf("@devbn_bot") !== -1,
      JSON.stringify(noticeText(d)));
  }

  console.log("\nKET QUA: " + pass + " PASS, " + fail + " FAIL");
  process.exit(fail ? 1 : 0);
}
main().catch(function(e){ console.error(e); process.exit(2); });
