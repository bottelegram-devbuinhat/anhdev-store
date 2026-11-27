"use strict";
/* A = URL API backend. T = JWT phiên admin (chỉ RAM, không lưu trữ). U = user đang đăng nhập. */

const A = "https://anhdev-store-backend.onrender.com";
let T = "";
let U = null;

function el(i){ return document.getElementById(i); }
function ce(t, c, x){
  let n = document.createElement(t);
  if (c) n.className = c;
  if (x != null) n.textContent = x;
  return n;
}
function clr(n){ while (n.firstChild) n.removeChild(n.firstChild); }
function fmt(n){ return Number(n).toLocaleString("vi-VN"); }
function err(w, m){ el(w).textContent = m || ""; }

function ic(a){
  let s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  a.forEach(function(p){
    let n = document.createElementNS("http://www.w3.org/2000/svg", p[0]);
    let b = p[1];
    for (let k in b) n.setAttribute(k, b[k]);
    s.appendChild(n);
  });
  return s;
}

function tbl(h, r){
  let w = ce("div", "table-wrap");
  let t = ce("table");
  if (h) {
    let a = ce("thead");
    let b = ce("tr");
    h.forEach(function(c){
      let d = ce("th", c.c || "");
      d.textContent = c.t || "";
      b.appendChild(d);
    });
    a.appendChild(b);
    t.appendChild(a);
  }
  let y = ce("tbody");
  r.forEach(function(row){
    let q = ce("tr");
    row.forEach(function(c){
      let d = ce("td", c.c || "");
      if (c.e) d.appendChild(c.e);
      else d.textContent = c.t == null ? "" : String(c.t);
      q.appendChild(d);
    });
    y.appendChild(q);
  });
  t.appendChild(y);
  w.appendChild(t);
  return w;
}

function emptyBox(m, a){
  let w = ce("div", "empty");
  if (a) w.appendChild(ic(a));
  w.appendChild(ce("p", "", m));
  return w;
}

function kv(pairs){
  return pairs.map(function(p){
    return [{ t: p[0] }, { t: p[1], c: p[2] || "" }];
  });
}

function clearToken(){ T = ""; U = null; }

async function api(p, o){
  o = o || {};
  let h = { "Content-Type": "application/json" };
  if (T) h["Authorization"] = "Bearer " + T;
  let r = await fetch(A + p, { method: o.method || "GET", headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  let d = null;
  try { d = await r.json(); } catch (e) { d = null; }
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) { clearToken(); showLogin(); }
    let m = (d && (d.message || d.error)) || ("Lỗi " + r.status);
    let x = new Error(m);
    x.status = r.status;
    throw x;
  }
  return d;
}

function toast(m, ok){
  let w = el("toast");
  let n = ce("div", "toast-item" + (ok === false ? " bad" : ok === true ? " ok" : ""), m);
  w.appendChild(n);
  let kill = function(){ if (n.parentNode) n.parentNode.removeChild(n); };
  let t = setTimeout(kill, 4000);
  n.addEventListener("mouseenter", function(){ clearTimeout(t); });
  n.addEventListener("mouseleave", function(){ t = setTimeout(kill, 4000); });
  while (w.children.length > 3) w.removeChild(w.firstChild);
}

function lock(b, on){
  b.disabled = on;
  if (on) {
    b.dataset.t = b.textContent;
    clr(b);
    b.appendChild(ce("span", "spin"));
    b.appendChild(document.createTextNode(" Đang xử lý…"));
  } else if (b.dataset.t) {
    b.textContent = b.dataset.t;
    delete b.dataset.t;
  }
}

function skel(w, n){
  let o = el(w);
  clr(o);
  for (let i = 0; i < n; i++) o.appendChild(ce("div", "skel"));
}

function showLogin(){
  el("loginSec").classList.remove("hidden");
  el("dashSec").classList.add("hidden");
  el("chip").classList.add("hidden");
}
function showDash(){
  el("loginSec").classList.add("hidden");
  el("dashSec").classList.remove("hidden");
  el("chip").classList.remove("hidden");
  el("who").textContent = U.username + " · " + U.role;
  el("statUser").textContent = U.username + " · id " + U.id;
}

async function checkSession(){
  if (!T) { showLogin(); return; }
  try {
    let d = await api("/api/auth/me");
    U = d.user;
    if (U.role !== "admin") {
      clearToken();
      err("loginErr", "Tài khoản này không có quyền admin.");
      showLogin();
      return;
    }
    showDash();
    loadDash();
  } catch (e) {
    clearToken();
    showLogin();
  }
}

async function doLogin(ev){
  ev.preventDefault();
  let b = el("loginBtn");
  let u = el("loginUser").value.trim();
  let p = el("loginPass").value;
  err("loginErr", "");
  if (!u || !p) { err("loginErr", "Nhập đủ tên đăng nhập và mật khẩu."); return; }
  lock(b, true);
  try {
    let d = await api("/api/auth/login", { method: "POST", body: { username: u, password: p } });
    if (d.user.role !== "admin") {
      err("loginErr", "Tài khoản này không có quyền admin. Cần đăng nhập bằng tài khoản admin.");
      lock(b, false);
      return;
    }
    T = d.token;
    U = d.user;
    toast("Đăng nhập thành công. Chào " + U.username + ".", true);
    showDash();
    loadDash();
  } catch (e) {
    err("loginErr", e.status === 401 ? "Sai tên đăng nhập hoặc mật khẩu." : ("Không đăng nhập được: " + e.message));
  } finally { lock(b, false); }
}

async function doLogout(){
  try { await api("/api/auth/logout", { method: "POST" }); } catch (e) {}
  clearToken();
  el("loginUser").value = "";
  el("loginPass").value = "";
  showLogin();
  toast("Đã đăng xuất.");
}

function setHealth(ok, ms, msg){
  let s = el("statHealth");
  clr(s);
  s.appendChild(ce("span", "dot " + (ok ? "ok" : "bad")));
  s.appendChild(document.createTextNode(ok ? "Hoạt động" : "Không kết nối"));
  el("statHealthMs").textContent = msg != null ? msg : ("Phản hồi " + ms + " ms");
}

async function loadDash(){
  el("statHealth").textContent = "…";
  el("statStock").textContent = "…";
  el("statSold").textContent = "…";
  let t0 = performance.now();
  try {
    let h = await api("/api/health");
    setHealth(!!h.ok, Math.round(performance.now() - t0));
  } catch (e) {
    setHealth(false, 0, e.message);
  }
  try {
    let d = await api("/api/admin/random-index?limit=1");
    el("statStock").textContent = fmt(d.total);
  } catch (e) { el("statStock").textContent = "—"; }
  loadSold();
}

async function loadSold(){
  skel("soldOut", 3);
  let o = el("soldOut");
  try {
    let d = await api("/api/admin/shop/sold");
    el("statSold").textContent = fmt(d.count);
    clr(o);
    if (!d.sold || d.sold.length === 0) {
      o.appendChild(emptyBox("Chưa có đơn nào bán qua web.", [
        ["path", { d: "M12 2 3 7v10l9 5 9-5V7l-9-5Z" }],
        ["path", { d: "M12 22V12" }]
      ]));
      return;
    }
    let r = d.sold.map(function(x){
      return [{ t: x.code, c: "code" }, { t: x.sold_at, c: "mono" }];
    });
    o.appendChild(tbl([{ t: "Mã acc" }, { t: "Thời gian bán" }], r));
  } catch (e) {
    clr(o);
    o.appendChild(ce("p", "err", "Không tải được danh sách đã bán: " + e.message));
  }
}

async function doSearch(){
  let b = el("searchBtn");
  let q = el("q").value.trim();
  let o = el("searchOut");
  if (!q) {
    clr(o);
    o.appendChild(ce("p", "err", "Nhập từ khóa để tìm (mã acc, tên tướng hoặc skin)."));
    return;
  }
  lock(b, true);
  skel("searchOut", 4);
  try {
    let d = await api("/api/admin/random-search?q=" + encodeURIComponent(q) + "&limit=20");
    clr(o);
    if (!d.results || d.results.length === 0) {
      let e = emptyBox("Không tìm thấy acc nào khớp “" + q + "”.", [
        ["circle", { cx: "11", cy: "11", r: "7" }],
        ["path", { d: "m21 21-4.3-4.3" }]
      ]);
      let x = ce("button", "btn btn-secondary", "Xóa tìm kiếm");
      x.type = "button";
      x.addEventListener("click", function(){ el("q").value = ""; clr(el("searchOut")); });
      e.appendChild(x);
      o.appendChild(e);
      return;
    }
    let n = ce("p", "note mb-3");
    n.appendChild(document.createTextNode("Tìm thấy "));
    n.appendChild(ce("b", "mono", fmt(d.total)));
    n.appendChild(document.createTextNode(" acc (hiển thị " + d.results.length + ")."));
    o.appendChild(n);
    let r = d.results.map(function(v){
      let s = ce("button", "btn btn-secondary btn-sm", "Sửa");
      s.type = "button";
      s.addEventListener("click", function(){ fillEdit(v.code, v.price); });
      let g = ce("button", "btn btn-danger btn-sm", "Xóa");
      g.type = "button";
      g.addEventListener("click", function(){ delStock(v.code, g); });
      let a = ce("span");
      a.appendChild(s);
      a.appendChild(document.createTextNode(" "));
      a.appendChild(g);
      return [
        { t: v.code, c: "code" },
        { t: fmt(v.price), c: "num" },
        { t: v.kind || v.category || "" },
        { t: v.rank || "" },
        { e: a, c: "act" }
      ];
    });
    o.appendChild(tbl(
      [{ t: "Mã acc" }, { t: "Giá (đ)", c: "num" }, { t: "Loại" }, { t: "Rank" }, { t: "" }],
      r
    ));
  } catch (e) {
    clr(o);
    o.appendChild(ce("p", "err", "Tìm kiếm lỗi: " + e.message));
  } finally { lock(b, false); }
}

function fillEdit(c, p){
  el("editCode").value = c;
  el("editPrice").value = p;
  el("editCode").focus();
  el("editPrice").select();
}

async function doEdit(){
  let b = el("editBtn");
  let c = el("editCode").value.trim();
  let p = el("editPrice").value.trim();
  err("editErr", "");
  if (!c) { err("editErr", "Nhập mã acc."); return; }
  if (p === "" || isNaN(Number(p)) || Math.trunc(Number(p)) < 0) { err("editErr", "Nhập giá mới hợp lệ (>= 0)."); return; }
  let n = Math.trunc(Number(p));
  lock(b, true);
  try {
    let d = await api("/api/admin/shop/stock/" + encodeURIComponent(c) + "/update", { method: "POST", body: { price: n } });
    let o = el("editOut");
    clr(o);
    o.appendChild(tbl(null, kv([
      ["Mã acc", d.code, "code"],
      ["Giá cũ", fmt(d.old_price) + "đ", "num"],
      ["Giá mới", fmt(d.price) + "đ", "num"]
    ])));
    toast("Đã đổi giá " + d.code + " thành " + fmt(d.price) + "đ.", true);
    if (el("q").value.trim()) doSearch();
  } catch (e) {
    err("editErr", e.status === 404 ? "Không tìm thấy acc này trong kho." : e.status === 409 ? "Acc này đã bán, không sửa được." : ("Lỗi: " + e.message));
  } finally { lock(b, false); }
}

async function delStock(c, btn){
  if (!confirm("Xóa acc " + c + " khỏi kho? Hành động này không hoàn tác được. Acc đã bán thì không xóa được.")) return;
  btn.disabled = true;
  try {
    await api("/api/admin/shop/stock/" + encodeURIComponent(c) + "/delete", { method: "POST", body: {} });
    toast("Đã xóa " + c + " khỏi kho.", true);
    if (el("q").value.trim()) doSearch();
    loadDash();
  } catch (e) {
    toast(e.status === 404 ? "Không tìm thấy acc " + c + "." : e.status === 409 ? "Acc " + c + " đã bán, không xóa được." : ("Xóa lỗi: " + e.message), false);
    btn.disabled = false;
  }
}

async function doBal(kind){
  let u = el("balUser").value.trim();
  let a = el("balAmt").value.trim();
  err("balErr", "");
  if (!u) { err("balErr", "Nhập tên tài khoản web."); return; }
  if (a === "" || isNaN(Number(a))) { err("balErr", "Nhập số tiền hợp lệ."); return; }
  let n = Math.trunc(Number(a));
  if (kind === "set" && !confirm("Đặt lại số dư của " + u + " thành " + fmt(n) + "đ? Hành động này ghi đè số dư hiện tại.")) return;
  let b = kind === "set" ? el("setBalBtn") : el("addBalBtn");
  lock(b, true);
  try {
    let d = await api("/api/admin/balance/" + kind, { method: "POST", body: { username: u, amount: n } });
    let o = el("balOut");
    clr(o);
    o.appendChild(tbl(null, kv([
      ["Tài khoản", d.username, "code"],
      ["Số dư cũ", fmt(d.old_balance) + "đ", "num"],
      ["Số dư mới", fmt(d.balance) + "đ", "num"]
    ])));
    toast("Đã " + (kind === "set" ? "đặt lại" : "cộng/trừ") + " số dư cho " + d.username + ": " + fmt(d.balance) + "đ.", true);
    loadUsers(true);
  } catch (e) {
    err("balErr", e.status === 404 ? "Không tìm thấy tài khoản web này." : ("Lỗi: " + e.message));
  } finally { lock(b, false); }
}

async function doCheck(){
  let u = el("balUser").value.trim();
  err("balErr", "");
  if (!u) { err("balErr", "Nhập tên tài khoản web."); return; }
  let b = el("checkBalBtn");
  lock(b, true);
  try {
    let d = await api("/api/admin/users/" + encodeURIComponent(u));
    let o = el("balOut");
    clr(o);
    o.appendChild(tbl(null, kv([
      ["Tài khoản", d.user.username, "code"],
      ["Vai trò", d.user.role, ""],
      ["Số dư", fmt(d.user.balance) + "đ", "num"],
      ["Số hóa đơn", fmt(d.invoice_count), "num"]
    ])));
  } catch (e) {
    err("balErr", e.status === 404 ? "Không tìm thấy tài khoản web này." : ("Lỗi: " + e.message));
  } finally { lock(b, false); }
}

async function doChangePassword(){
  let b = el("pwBtn");
  let u = el("pwUser").value.trim();
  let p = el("pwNew").value;
  let f = el("pwConfirm").value;
  err("pwErr", "");
  if (!u) { err("pwErr", "Nhập tên tài khoản web."); return; }
  if (!p) { err("pwErr", "Nhập mật khẩu mới."); return; }
  if (p.length < 6 || p.length > 64) { err("pwErr", "Mật khẩu mới phải từ 6–64 ký tự."); return; }
  if (f !== p) { err("pwErr", "Mật khẩu nhập lại không khớp."); return; }
  if (!confirm("Đổi mật khẩu của " + u + "? Mọi phiên đăng nhập cũ của tài khoản này sẽ bị vô hiệu.")) return;
  lock(b, true);
  try {
    let d = await api("/api/admin/users/" + encodeURIComponent(u) + "/password", { method: "POST", body: { new_password: p } });
    el("pwNew").value = "";
    el("pwConfirm").value = "";
    let o = el("pwOut");
    clr(o);
    o.appendChild(tbl(null, kv([
      ["Tài khoản", d.username || u, "code"]
    ])));
    toast("Đã đổi mật khẩu cho " + (d.username || u) + ".", true);
    if (el("usersOut").children.length) loadUsers(true);
  } catch (e) {
    err("pwErr", e.status === 404 ? "Không tìm thấy tài khoản web này." : e.status === 400 ? e.message : ("Lỗi: " + e.message));
  } finally { lock(b, false); }
}

async function loadUsers(quiet){
  skel("usersOut", 4);
  let o = el("usersOut");
  try {
    let d = await api("/api/admin/users");
    clr(o);
    if (!d.users || d.users.length === 0) {
      o.appendChild(emptyBox("Chưa có tài khoản web nào.", [
        ["path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
        ["circle", { cx: "9", cy: "7", r: "4" }],
        ["path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }],
        ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }]
      ]));
      return;
    }
    let r = d.users.map(function(v){
      return [
        { t: v.username, c: "code" },
        { t: v.role },
        { t: fmt(v.balance), c: "num" },
        { t: v.telegram_id || "", c: "mono" },
        { t: v.created_at || "", c: "mono" }
      ];
    });
    o.appendChild(tbl(
      [{ t: "Tài khoản" }, { t: "Vai trò" }, { t: "Số dư (đ)", c: "num" }, { t: "Telegram" }, { t: "Ngày tạo" }],
      r
    ));
  } catch (e) {
    clr(o);
    o.appendChild(ce("p", "err", "Không tải được danh sách: " + e.message));
  }
}

el("loginForm").addEventListener("submit", doLogin);
el("logoutBtn").addEventListener("click", doLogout);
el("searchBtn").addEventListener("click", doSearch);
el("clearBtn").addEventListener("click", function(){ el("q").value = ""; clr(el("searchOut")); });
el("q").addEventListener("keydown", function(e){ if (e.key === "Enter") doSearch(); });
el("editBtn").addEventListener("click", doEdit);
el("setBalBtn").addEventListener("click", function(){ doBal("set"); });
el("addBalBtn").addEventListener("click", function(){ doBal("add"); });
el("checkBalBtn").addEventListener("click", doCheck);
el("usersBtn").addEventListener("click", function(){ loadUsers(false); });
el("pwBtn").addEventListener("click", doChangePassword);
window.addEventListener("pagehide", clearToken);
checkSession();

/* Chú thích biến (QT-48):
   A = URL API backend · T = JWT phiên admin (chỉ RAM) · U = user đang đăng nhập
   el = lấy phần tử theo id · ce = tạo phần tử (thẻ, class, chữ) · clr = xóa hết con
   fmt = định dạng số vi-VN · err = gán chữ lỗi · ic = tạo icon SVG
   tbl = dựng bảng (tiêu đề, hàng) · kv = đổi cặp khóa/giá trị thành hàng bảng
   emptyBox = khối trạng thái rỗng · api = gọi API (trả JSON, lỗi thì throw)
   toast = thông báo nổi · lock = khóa nút khi gửi · skel = khung xương tải
   r = Response fetch · d = dữ liệu JSON · e = lỗi · n = số · s = phần tử
   b = nút bấm · u = tên user · p = mật khẩu · f = mật khẩu nhập lại · q = từ khóa tìm kiếm
   doChangePassword = đổi mật khẩu web (POST /api/admin/users/:u/password)
   h = headers · o = tùy chọn gọi API / phần tử đích · m = thông báo
   t0 = thời điểm bắt đầu đo · ms = mili giây · c = mã acc · k = khóa
   a = mảng (icon, hàng) / thead · v = 1 bản ghi · x = nút / lỗi · w = khung chứa
   t = phần tử bảng · y = tbody · b = hàng tiêu đề · q = 1 hàng dữ liệu · g = nút Xóa */
