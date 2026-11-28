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

/* Gọi API upload file (multipart): KHÔNG tự set Content-Type để trình
   duyệt gắn boundary; chỉ gắn Bearer. Dùng cho POST /api/admin/music/upload. */
async function apiUpload(p, f){
  let h = {};
  if (T) h["Authorization"] = "Bearer " + T;
  let b = new FormData();
  b.append("file", f);
  let r = await fetch(A + p, { method: "POST", headers: h, body: b });
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
  loadMusic();
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

/* ---------- Thêm tài khoản (bulk-add) ---------- */

function parseChatLines(x){
  let a = [], g = [];
  String(x == null ? "" : x).split(/\r\n|\r|\n/).forEach(function(s, i){
    let t = s.trim();
    if (!t || t.charAt(0) === "#") return;
    let p = t.split("|").map(function(v){ return v.trim(); });
    let u = p[0] || "", w = p[1] || "";
    if (!u || !w) { g.push({ index: i, code: null, reason: "Dòng " + (i + 1) + ": thiếu username hoặc password." }); return; }
    let r = { username: u, password: w, price: 0, kind: "random" };
    if (p[2] != null && p[2] !== "") {
      let n = Number(p[2]);
      if (!Number.isInteger(n) || n < 0) { g.push({ index: i, code: null, reason: "Dòng " + (i + 1) + ": giá phải là số nguyên không âm." }); return; }
      r.price = n;
    }
    if (p[3] != null && p[3] !== "") {
      let k = p[3].toLowerCase();
      if (k !== "random" && k !== "info" && k !== "white") { g.push({ index: i, code: null, reason: "Dòng " + (i + 1) + ": kind phải là random, info hoặc white." }); return; }
      r.kind = k;
    }
    if (p[4] != null && p[4] !== "") r.rank = p[4];
    a.push(r);
  });
  return { accounts: a, errors: g };
}

function parseJsonText(x){
  let d;
  try { d = JSON.parse(x); }
  catch (e) { return { accounts: [], errors: [{ index: -1, code: null, reason: "JSON không hợp lệ: " + e.message }] }; }
  if (!Array.isArray(d)) return { accounts: [], errors: [{ index: -1, code: null, reason: "JSON phải là một mảng các account." }] };
  let a = [], g = [];
  d.forEach(function(v, i){
    if (!v || typeof v !== "object" || Array.isArray(v)) { g.push({ index: i, code: null, reason: "Mục " + (i + 1) + ": không phải object account." }); return; }
    let u = typeof v.username === "string" ? v.username.trim() : "";
    let w = typeof v.password === "string" ? v.password.trim() : "";
    let c = v.code != null && v.code !== "" ? String(v.code).trim() : null;
    if (!u || !w) { g.push({ index: i, code: c, reason: "Mục " + (i + 1) + ": thiếu username hoặc password." }); return; }
    let r = { username: u, password: w, price: 0, kind: "random" };
    if (c) r.code = c;
    if (v.price != null && v.price !== "") {
      let n = Number(v.price);
      if (!Number.isInteger(n) || n < 0) { g.push({ index: i, code: c, reason: "Mục " + (i + 1) + ": price phải là số nguyên không âm." }); return; }
      r.price = n;
    }
    if (v.kind != null && v.kind !== "") {
      let k = String(v.kind).trim().toLowerCase();
      if (k !== "random" && k !== "info" && k !== "white") { g.push({ index: i, code: c, reason: "Mục " + (i + 1) + ": kind phải là random, info hoặc white." }); return; }
      r.kind = k;
    }
    if (v.rank != null && v.rank !== "") r.rank = String(v.rank);
    if (v.rare_skins != null && v.rare_skins !== "") r.rare_skins = String(v.rare_skins);
    if (v.description != null && v.description !== "") r.description = String(v.description);
    a.push(r);
  });
  return { accounts: a, errors: g };
}

function setBulkTab(m){
  [["chat", "bulkTabChat", "bulkChatPane"], ["json", "bulkTabJson", "bulkJsonPane"], ["txt", "bulkTabTxt", "bulkTxtPane"]].forEach(function(z){
    el(z[1]).classList.toggle("active", z[0] === m);
    el(z[1]).setAttribute("aria-selected", z[0] === m ? "true" : "false");
    el(z[2]).classList.toggle("hidden", z[0] !== m);
  });
}

async function loadBulkFile(i, t){
  let f = i.files && i.files[0];
  if (!f) return;
  let x = "";
  try {
    if (typeof f.text === "function") x = await f.text();
    else x = await new Promise(function(res, rej){
      let r = new FileReader();
      r.onload = function(){ res(r.result); };
      r.onerror = function(){ rej(r.error || new Error("Không đọc được file.")); };
      r.readAsText(f);
    });
  } catch (e) { err("bulkErr", "Không đọc được file: " + e.message); return; }
  t.value = x;
  toast("Đã load file " + f.name + ".", true);
}

async function doBulkAdd(a, g, b){
  err("bulkErr", "");
  let o = el("bulkOut");
  if (!a.length) { err("bulkErr", "Không có acc hợp lệ để gửi. Kiểm tra lại định dạng mỗi dòng."); return; }
  lock(b, true);
  try {
    let d = await api("/api/admin/shop/stock/bulk-add", { method: "POST", body: { accounts: a } });
    clr(o);
    let s = ce("p", "note mb-3");
    s.appendChild(document.createTextNode("Đã thêm "));
    s.appendChild(ce("b", "mono", fmt(d.added || 0)));
    s.appendChild(document.createTextNode(" • Bỏ qua "));
    s.appendChild(ce("b", "mono", fmt(d.skipped || 0)));
    let y = (d.errors || []).concat(g || []);
    s.appendChild(document.createTextNode(" • Lỗi "));
    s.appendChild(ce("b", "mono", fmt(y.length)));
    s.appendChild(document.createTextNode("."));
    o.appendChild(s);
    if (Array.isArray(d.codes) && d.codes.length) {
      let c = ce("p", "note");
      c.textContent = "Mã đã thêm: " + d.codes.slice(0, 20).join(", ") + (d.codes.length > 20 ? " … (+" + (d.codes.length - 20) + " mã)" : "");
      o.appendChild(c);
    }
    if (y.length) {
      let r = y.map(function(v){
        return [{ t: v.code || "—", c: "code" }, { t: v.reason || "" }];
      });
      o.appendChild(tbl([{ t: "Mã" }, { t: "Lý do" }], r));
    }
    toast("Đã thêm " + fmt(d.added || 0) + " acc vào kho.", true);
    loadDash();
  } catch (e) {
    err("bulkErr", "Lỗi: " + e.message);
  } finally { lock(b, false); }
}

function sendBulkChat(){
  let r = parseChatLines(el("bulkChat").value);
  doBulkAdd(r.accounts, r.errors, el("bulkChatBtn"));
}
function sendBulkJson(){
  let r = parseJsonText(el("bulkJson").value);
  doBulkAdd(r.accounts, r.errors, el("bulkJsonBtn"));
}
function sendBulkTxt(){
  let r = parseChatLines(el("bulkTxt").value);
  doBulkAdd(r.accounts, r.errors, el("bulkTxtBtn"));
}

/* ---------- Nhạc ---------- */

function fmtSize(n){
  n = Number(n);
  if (!isFinite(n) || n < 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

/* Chuẩn hoá danh sách nhạc trả về: backend có thể trả tracks/music/items/
   files/data; mỗi mục có thể là chuỗi tên file hoặc object có filename/
   file/url + name + size. Trả về [{filename, name, size}]. */
function normMusic(d){
  let a = (d && (d.tracks || d.music || d.items || d.files || d.data)) || [];
  if (!Array.isArray(a)) return [];
  let o = [];
  a.forEach(function(v){
    if (typeof v === "string") { o.push({ filename: v, name: v, size: null }); return; }
    if (!v || typeof v !== "object") return;
    let k = v.filename || v.file || (v.url ? String(v.url).split("/").pop() : "") || v.name || "";
    if (!k) return;
    o.push({ filename: String(k), name: v.name ? String(v.name) : String(k), size: v.size != null ? Number(v.size) : null });
  });
  return o;
}

async function loadMusic(){
  skel("musicOut", 3);
  let o = el("musicOut");
  try {
    let d = await api("/api/music/list");
    let a = normMusic(d);
    clr(o);
    if (!a.length) {
      o.appendChild(emptyBox("Chưa có bài nhạc nào.", [
        ["path", { d: "M9 18V5l12-2v13" }],
        ["circle", { cx: "6", cy: "18", r: "3" }],
        ["circle", { cx: "18", cy: "16", r: "3" }]
      ]));
      return;
    }
    let n = ce("p", "note mb-3");
    n.textContent = "Có " + a.length + " bài nhạc.";
    o.appendChild(n);
    let r = a.map(function(v){
      let g = ce("button", "btn btn-danger btn-sm", "Xóa");
      g.type = "button";
      g.addEventListener("click", function(){ delMusic(v.filename, g); });
      return [
        { t: v.name, c: "mono" },
        { t: v.size != null ? fmtSize(v.size) : "", c: "num" },
        { e: g, c: "act" }
      ];
    });
    o.appendChild(tbl(
      [{ t: "Tên bài" }, { t: "Dung lượng", c: "num" }, { t: "" }],
      r
    ));
  } catch (e) {
    clr(o);
    o.appendChild(ce("p", "err", "Không tải được danh sách nhạc: " + e.message));
  }
}

async function doMusicUpload(){
  let b = el("musicUploadBtn");
  let i = el("musicFile");
  let f = i.files && i.files[0];
  err("musicErr", "");
  if (!f) { err("musicErr", "Chọn 1 file nhạc để tải lên."); return; }
  let n = f.name || "";
  let x = n.split(".").pop().toLowerCase();
  if (["mp3", "wav", "ogg", "m4a"].indexOf(x) === -1) { err("musicErr", "Chỉ nhận file .mp3, .wav, .ogg, .m4a."); return; }
  if (f.size > 20 * 1024 * 1024) { err("musicErr", "File quá lớn (tối đa 20 MB)."); return; }
  lock(b, true);
  try {
    let d = await apiUpload("/api/admin/music/upload", f);
    toast("Đã tải lên " + (d.filename || n) + ".", true);
    i.value = "";
    loadMusic();
  } catch (e) {
    err("musicErr", "Tải lên lỗi: " + e.message);
  } finally { lock(b, false); }
}

async function delMusic(f, btn){
  if (!confirm("Xóa bài nhạc \"" + f + "\"? Hành động này không hoàn tác được.")) return;
  btn.disabled = true;
  try {
    await api("/api/admin/music/" + encodeURIComponent(f), { method: "DELETE" });
    toast("Đã xóa " + f + ".", true);
    loadMusic();
  } catch (e) {
    toast("Xóa lỗi: " + e.message, false);
    btn.disabled = false;
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
el("bulkTabChat").addEventListener("click", function(){ setBulkTab("chat"); });
el("bulkTabJson").addEventListener("click", function(){ setBulkTab("json"); });
el("bulkTabTxt").addEventListener("click", function(){ setBulkTab("txt"); });
el("bulkChatBtn").addEventListener("click", sendBulkChat);
el("bulkJsonBtn").addEventListener("click", sendBulkJson);
el("bulkTxtBtn").addEventListener("click", sendBulkTxt);
el("bulkJsonFile").addEventListener("change", function(){ loadBulkFile(el("bulkJsonFile"), el("bulkJson")); });
el("bulkTxtFile").addEventListener("change", function(){ loadBulkFile(el("bulkTxtFile"), el("bulkTxt")); });
el("musicUploadBtn").addEventListener("click", doMusicUpload);
el("musicRefreshBtn").addEventListener("click", loadMusic);
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
   t = phần tử bảng · y = tbody · b = hàng tiêu đề · q = 1 hàng dữ liệu · g = nút Xóa
   parseChatLines = parse dòng chat thành accounts + lỗi · parseJsonText = parse mảng JSON thành accounts + lỗi
   doBulkAdd = gửi bulk-add (POST /api/admin/shop/stock/bulk-add) · setBulkTab = đổi tab chế độ nhập
   loadBulkFile = đọc file .json/.txt vào textarea · sendBulkChat/Json/Txt = gửi theo từng chế độ
   g = lỗi parse client · m = chế độ tab (chat/json/txt) · z = bộ 3 [chế độ, id tab, id pane] · i = ô file input
   f = file đã chọn · x = nội dung file/text · y = tổng lỗi (server + parse) · c = dòng mã đã thêm
   apiUpload = gọi API upload file multipart (chỉ gắn Bearer, không set Content-Type)
   normMusic = chuẩn hoá danh sách nhạc (tracks/music/items/files/data, chuỗi hoặc object)
   fmtSize = định dạng dung lượng B/KB/MB · loadMusic = tải danh sách nhạc (GET /api/music/list)
   doMusicUpload = tải file nhạc lên (POST /api/admin/music/upload) · delMusic = xóa 1 bài nhạc (DELETE /api/admin/music/:filename) */
