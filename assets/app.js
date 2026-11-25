(function(){
  "use strict";
  /* ================= CONFIG ================= */
  // Tài khoản ngân hàng nhận tiền nạp — dùng để tạo mã VietQR thật (quét được bằng app ngân hàng).
  var BANK = { code:"MB", name:"MBBank", account:"05817666778899", holder:"BUI NGUYEN XUAN NHAT" };

  /* ===== LINK HỖ TRỢ / TÀI KHOẢN ADMIN =====
     Link mà chữ "Hỗ trợ" (màu xanh) ở trang thanh toán trỏ tới — khách đã chuyển khoản
     xong bấm vào đây để nhắn admin. ĐỔI LINK NÀY thành acc admin của bạn khi có
     (vd "https://t.me/ten_admin"). Mặc định đang trỏ về bot @devbn_bot. */
  var ADMIN_SUPPORT_URL = "https://t.me/devbn_bot";

  /* ===== THESIEURE — NẠP THẺ CÀO (thesieure.com) =====
     Điền 2 giá trị lấy từ trang quản trị đối tác của thesieure.com vào đây:
       partnerId  : Partner ID của bạn trên TheSieuRe
       partnerKey : Partner Key (API key) — dùng để ký chữ ký sign cho mỗi thẻ gửi lên
     Để trống thì form nạp thẻ vẫn tạo giao dịch "Chờ xử lý" nhưng chưa gạch được thẻ thật.
     Lưu ý khi nối thật: chữ ký sign = md5(partnerKey + code + serial) và lệnh gạch thẻ
     nên gọi từ phía server để không lộ partnerKey trên trình duyệt.
     fees: chiết khấu % theo từng loại thẻ — để 0 nếu chưa có bảng phí, số thực nhận lấy theo
     giá trị TheSieuRe trả về (trường "value") khi có callback. */
  var THESIEURE = {
    partnerId: "",
    partnerKey: "",
    apiUrl: "https://thesieure.com/chargingws/v2",
    fees: { VIETTEL: 0, VINAPHONE: 0, MOBIFONE: 0, VIETNAMOBILE: 0, ZING: 0 }
  };

  /* ================= DATA (mẫu catalog theo accaov.store) ================= */
  var CATS = {
    "random-tele": { title:"Acc Random", sub:"Kho Telegram" },
    "detail":      { title:"Acc sẵn thông tin", sub:"Kho Telegram" },
    "random-lq":   { title:"Random Tài Khoản Liên Quân", sub:"" },
    "products":    { title:"Sản phẩm số", sub:"Kho bot" }
  };
  var PRODUCTS = [
    // Acc Random — Kho Telegram
    {id:"r1", cat:"random-tele", kind:"pack", name:"100% Skin SSS [ 80+ Uy Tín ]", desc:"Tài Khoản Random Bảo Kê Log Lỗi & Uy Tín Thấp", price:12800, old:32000, stock:117},
    {id:"r2", cat:"random-tele", kind:"pack", name:"100% Skin SS / SS+ [ 80+ Uy Tín ]", desc:"Tài Khoản Random Bảo Kê Log Lỗi & Uy Tín Thấp", price:7200, old:18000, stock:7546},
    {id:"r3", cat:"random-tele", kind:"pack", name:"100% Skin SSS", desc:"Tài Khoản Random Không Bảo Kê", price:9600, old:24000, stock:0},
    {id:"r4", cat:"random-tele", kind:"pack", name:"100% Skin SS / SS+", desc:"Tài Khoản Random Không Bảo Kê", price:4800, old:12000, stock:683},
    {id:"r5", cat:"random-tele", kind:"pack", name:"100% Skin Anime", desc:"Tài Khoản Random Không Bảo Kê", price:4000, old:10000, stock:0},
    {id:"r6", cat:"random-tele", kind:"pack", name:"100% Skin Anime [ 80+ Uy Tín ]", desc:"Tài Khoản Random Bảo Kê Log Lỗi & Uy Tín Thấp", price:6400, old:16000, stock:0},
    // Acc sẵn thông tin
    {id:"d1", cat:"detail", kind:"acc", name:"Acc #01608", desc:"Acc thông tin xấu", price:3000, stock:1, img:"assets/cover-1.webp"},
    {id:"d2", cat:"detail", kind:"acc", name:"Acc #01602", desc:"Acc thông tin xấu", price:2000, stock:1, img:"assets/cover-2.webp"},
    {id:"d3", cat:"detail", kind:"acc", name:"Acc #01600", desc:"Acc thông tin xấu", price:5000, stock:1, img:"assets/cover-3.webp"},
    {id:"d4", cat:"detail", kind:"acc", name:"Acc #01596", desc:"Acc thông tin xấu", price:2500, stock:1, img:"assets/banner-hero.webp"},
    {id:"d5", cat:"detail", kind:"acc", name:"Acc #01593", desc:"Acc thông tin xấu", price:3000, stock:1, img:"assets/cover-2.webp"},
    {id:"d6", cat:"detail", kind:"acc", name:"Acc #01590", desc:"Acc trắng thông tin", price:10000, stock:1, img:"assets/cover-1.webp"},
    {id:"d7", cat:"detail", kind:"acc", name:"Acc #01587", desc:"Acc thông tin xấu", price:5000, stock:1, img:"assets/cover-3.webp"},
    {id:"d8", cat:"detail", kind:"acc", name:"Acc #01584", desc:"Acc thông tin xấu", price:10000, stock:1, img:"assets/banner-hero.webp"},
    {id:"d9", cat:"detail", kind:"acc", name:"Acc #01583", desc:"Acc thông tin xấu", price:4000, stock:1, img:"assets/cover-1.webp"},
    {id:"d10", cat:"detail", kind:"acc", name:"Acc #01579", desc:"Acc thông tin xấu", price:5000, stock:1, img:"assets/cover-2.webp"},
    {id:"d11", cat:"detail", kind:"acc", name:"Acc #01577", desc:"Acc thông tin xấu", price:3000, stock:1, img:"assets/cover-3.webp"},
    {id:"d12", cat:"detail", kind:"acc", name:"Acc #01575", desc:"Acc thông tin xấu", price:3000, stock:1, img:"assets/banner-hero.webp"},
    // Random Tài Khoản Liên Quân
    {id:"q1", cat:"random-lq", kind:"pack", name:"Random Tài Khoản Ngẫu Nhiên", desc:"Tài khoản hoàn toàn ngẫu nhiên & không bảo kê", price:1, stock:0, img:"assets/cover-3.webp"},
    {id:"q2", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Đúng Thông Tin", desc:"Tài khoản hoàn toàn ngẫu nhiên & không bảo kê", price:10, stock:0, img:"assets/cover-2.webp"},
    {id:"q3", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Log", desc:"Tài khoản 100% đăng nhập được & không bảo kê", price:50, stock:0, img:"assets/cover-1.webp"},
    {id:"q4", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Có Skin Anime", desc:"Tài khoản 100% đăng nhập được & bảo kê lỗi hoàn 100%", price:1500, stock:0, img:"assets/cover-3.webp"},
    {id:"q5", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Có Skin SS", desc:"Tài khoản 100% đăng nhập được & bảo kê lỗi hoàn 100%", price:3500, stock:158, img:"assets/cover-2.webp"},
    {id:"q6", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Rank Tinh Anh", desc:"Tài khoản 100% đăng nhập được & bảo kê lỗi hoàn 100%", price:4500, stock:0, img:"assets/cover-1.webp"},
    {id:"q7", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Rank Cao Thủ – Đại Cao Thủ", desc:"Tài khoản 100% đăng nhập được & bảo kê lỗi hoàn 100%", price:8000, stock:0, img:"assets/banner-hero.webp"},
    {id:"q8", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Có Skin SSS / SSS+", desc:"Tài khoản 100% đăng nhập được & bảo kê lỗi hoàn 100%", price:24500, stock:54, img:"assets/cover-2.webp"},
    {id:"q9", cat:"random-lq", kind:"pack", name:"Random Tài Khoản 100% Có Skin Thứ Nguyên Vệ Thần", desc:"Tài khoản 100% đăng nhập được & bảo kê lỗi hoàn 100%", price:29000, stock:0, img:"assets/cover-1.webp"}
  ];
  var DEMO_PRODUCTS = PRODUCTS.slice(); // catalog mẫu — chỉ hiển thị khi API kho thật không kết nối được

  /* ================= API CLOUDFLARE (Worker + D1) =================
     Worker xác thực Telegram initData phía server rồi trả ĐÚNG số dư của
     chính người dùng. Thay URL dưới đây bằng URL Worker sau khi deploy;
     còn placeholder thì web dùng số dư demo cục bộ và ghi rõ "chưa đồng bộ". */
  var API_BASE = "https://anhdev-balance.nhatdz2k011.workers.dev";
  var API_TIMEOUT_MS = 8000;
  var BOT_LINK = "https://t.me/devbn_bot";
  var SYNC = { mode:"syncing", updatedAt:null }; // mode: "syncing" | "live" | "saved" | "demo"
  // Số dư thật lấy từ bot; synced=false nghĩa là đang dùng số dư demo cục bộ.
  var BALANCE = { synced:false, updatedAt:null };

  /* ================= STATE (in-session) ================= */
  var state = {
    user: null,            // {name, username, telegram_id, photo_url, auth_date, via} — chỉ user Telegram thật
    balance: 0,
    coins: 0,              // xu trong bot (số dư thật do bot giữ)
    tgInitData: "",        // Telegram.WebApp.initData (Mini App) để Worker xác thực
    tgLoginData: "",       // query string Telegram Login Widget đã ký (web thường)
    depositTimer: null,    // bộ đếm poll trạng thái lệnh nạp
    orders: [],            // {code, productName, price, time, user, pass}
    invoices: [],          // {code, amount, method, time}
    filter: { cat:"all", q:"", sort:"default", onlyStock:false, page:1 },
    pendingTopup: null,    // (giữ tương thích)
    currentPay: null,      // hoá đơn ngân hàng đang mở ở trang thanh toán
    checkin: null,         // số tiền đã điểm danh trong phiên (null = chưa điểm danh)
    lang: "vi",
    currency: "VND",
    topupTab: "qr"
  };

  /* ================= HELPERS ================= */
  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function fmtVND(n){ return Number(n).toLocaleString("vi-VN") + "đ"; }
  var USD_RATE = 25400; // 1 USD ≈ 25.400đ — chỉ dùng để HIỂN THỊ giá khi chọn tiền tệ USD; giao dịch thật vẫn là VND
  function fmt(n){
    if (state.currency === "USD"){
      return "$" + (Number(n) / USD_RATE).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
    }
    return fmtVND(n);
  }
  /* Chuỗi động theo ngôn ngữ (nút bấm / trạng thái do JS sinh ra) */
  var DYN = {
    login:{ vi:"Đăng Nhập", en:"Log In" },
    logout:{ vi:"Đăng xuất", en:"Log Out" },
    guest:{ vi:"Bạn chưa đăng nhập", en:"You are not logged in" },
    buyNow:{ vi:"Mua ngay", en:"Buy now" },
    soldOut:{ vi:"Hết hàng", en:"Out of stock" },
    submitLogin:{ vi:"Đăng nhập", en:"Log In" },
    submitRegister:{ vi:"Tạo tài khoản", en:"Create account" },
    soon:{ vi:"Sắp có", en:"Coming soon" },
    payConfirm:{ vi:"Xác nhận đã chuyển", en:"I've transferred" },
    payWaiting:{ vi:"Đang chờ thanh toán", en:"Waiting for payment" },
    payDone:{ vi:"Đã chuyển khoản", en:"Transferred" },
    payCancelled:{ vi:"Đã huỷ hoá đơn", en:"Invoice cancelled" },
    payViewInv:{ vi:"Xem hoá đơn", en:"View invoices" },
    ciBtn:{ vi:"Điểm danh ngay", en:"Check in now" },
    ciDoneA:{ vi:"Hôm nay bạn đã điểm danh: +", en:"You checked in today: +" },
    ciDoneB:{ vi:" đã cộng vào ví.", en:" added to your wallet." },
    lbYou:{ vi:"Bạn", en:"You" },
    lbOrders:{ vi:"đơn", en:"orders" },
    payInvoiceBtn:{ vi:"Thanh toán hoá đơn", en:"Pay this invoice" },
    pgPrev:{ vi:"Trang trước", en:"Previous" },
    pgNext:{ vi:"Trang sau", en:"Next" },
    pgShowing:{ vi:"Hiển thị", en:"Showing" },
    pgPage:{ vi:"Trang", en:"Page" }
  };
  function L(k){ var d = DYN[k]; return d ? (d[state.lang] || d.vi) : k; }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  var toastTimer = null;
  function toast(msg){
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2600);
  }
  function nowStr(){
    var d = new Date();
    return d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) + " · " + d.toLocaleDateString("vi-VN");
  }
  function randCode(prefix){
    return prefix + Math.random().toString(36).slice(2,8).toUpperCase();
  }

  /* ================= THEME ================= */
  function applyThemeButtons(){
    var dark = document.documentElement.getAttribute("data-theme") === "dark" ||
      (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    $("#themeDark").classList.toggle("on", dark);
    $("#themeLight").classList.toggle("on", !dark);
  }
  $("#themeLight").addEventListener("click", function(){ document.documentElement.setAttribute("data-theme","light"); applyThemeButtons(); });
  $("#themeDark").addEventListener("click", function(){ document.documentElement.setAttribute("data-theme","dark"); applyThemeButtons(); });
  applyThemeButtons();

  /* ================= NAV / VIEWS ================= */
  function showView(name){
    $$(".view").forEach(function(v){ v.classList.remove("active"); });
    var el = $("#view-" + name); if (el) el.classList.add("active");
    $$("[data-nav]").forEach(function(b){
      if (b.classList.contains("nav-item") || (b.parentElement && b.parentElement.classList.contains("bottom-nav"))){
        var act = b.getAttribute("data-nav") === name;
        if (b.hasAttribute("data-tab")) act = name === "topup" && b.getAttribute("data-tab") === state.topupTab;
        b.classList.toggle("active", act);
      }
    });
    closeSidebar();
    window.scrollTo({top:0, behavior:"smooth"});
    // Quay lại shop / ví → lấy lại số dư thật từ bot.
    if ((name === "home" || name === "topup" || name === "account") && state.user) refreshWebBalance();
    if (name === "orders") renderOrders();
    if (name === "invoices") renderInvoices();
    if (name === "account") renderAccount();
    if (name === "leaderboard") renderLeaderboard();
  }
  document.addEventListener("click", function(e){
    var navBtn = e.target.closest("[data-nav]");
    if (navBtn){
      showView(navBtn.getAttribute("data-nav"));
      var tb = navBtn.getAttribute("data-tab");
      if (tb) setTopupTab(tb);
      var sc = navBtn.getAttribute("data-scroll");
      if (sc) setTimeout(function(){ var t = document.getElementById(sc); if (t) t.scrollIntoView({behavior:"smooth"}); }, 60);
      return;
    }
    var scBtn = e.target.closest("[data-scroll]");
    if (scBtn){
      showView("home");
      var id = scBtn.getAttribute("data-scroll");
      setTimeout(function(){ var t = document.getElementById(id); if (t) t.scrollIntoView({behavior:"smooth"}); }, 60);
    }
  });
  function closeSidebar(){ $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); }
  $("#burger").addEventListener("click", function(){ $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); });
  $("#scrim").addEventListener("click", closeSidebar);

  /* ================= USER / BALANCE UI ================= */
  function refreshUserUI(){
    $$("[data-balance]").forEach(function(el){
      el.textContent = fmt(state.balance);
      el.title = BALANCE.synced
        ? "Số dư thật từ bot Telegram" + (BALANCE.updatedAt ? " · cập nhật " + BALANCE.updatedAt : "")
        : "Số dư demo trên trình duyệt — CHƯA đồng bộ với bot";
    });
    var coinsLine = (BALANCE.synced && state.coins > 0)
      ? " · " + Number(state.coins).toLocaleString("vi-VN") + " xu" : "";
    var note = BALANCE.synced
      ? "✓ Đồng bộ bot" + coinsLine + (BALANCE.updatedAt ? " · " + BALANCE.updatedAt : "")
      : (state.user ? "Chưa đồng bộ với bot — số dư demo trên trình duyệt"
                    : "Chưa đăng nhập Telegram — số dư demo, chưa đồng bộ");
    $$("[data-balance-note]").forEach(function(el){
      el.className = "sync-note" + (BALANCE.synced ? "" : " warn");
      el.textContent = note;
    });
    var nameEl = $("#userName"), av = $("#userAvatar"), loginBtn = $("#topLoginBtn");
    if (state.user){
      nameEl.textContent = state.user.name;
      if (state.user.photo_url && /^https:\/\//.test(state.user.photo_url)){
        av.innerHTML = '<img src="' + esc(state.user.photo_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" />';
      } else {
        av.textContent = state.user.name.trim().charAt(0).toUpperCase() || "A";
      }
      loginBtn.textContent = L("logout");
    } else {
      nameEl.textContent = L("guest");
      av.textContent = "?";
      loginBtn.textContent = L("login");
    }
    // Hook cho animations.js: số dư thay đổi -> ticker + tia sáng viền.
    document.dispatchEvent(new CustomEvent("anhdev:balance", { detail:{ value: state.balance, synced: BALANCE.synced } }));
  }
  /* Đăng nhập Telegram THẬT — lưu phiên vào localStorage để tải lại trang vẫn còn đăng nhập.
     Bản demo trước đây chỉ giữ user trong bộ nhớ (tải lại trang là mất) nên chưa có key cũ;
     key mới là "anhdev_user". Chỉ lưu user Telegram thật (có telegram_id). */
  var USER_KEY = "anhdev_user";
  function saveUser(u){
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch (e) { /* trình duyệt chặn localStorage thì phiên chỉ còn trong bộ nhớ */ }
  }
  function loadSavedUser(){
    try {
      var raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      var u = JSON.parse(raw);
      if (!u || typeof u !== "object" || !u.telegram_id) return null;
      return u;
    } catch (e) { return null; }
  }
  function setUser(u){
    stopDepositPoll();
    state.user = u;
    if (u && u.login_data) state.tgLoginData = u.login_data;
    if (!u){
      state.tgInitData = ""; state.tgLoginData = "";
      state.balance = 0; state.coins = 0;
      BALANCE.synced = false; BALANCE.updatedAt = null;
    }
    saveUser(u); refreshUserUI(); renderAccount();
    loadInvoices();
    if (u) resumePendingDeposit();
  }

  /* ================= PRODUCTS ================= */
  function visibleProducts(){
    var f = state.filter;
    var list = PRODUCTS.filter(function(p){
      if (f.cat !== "all" && p.cat !== f.cat) return false;
      if (f.onlyStock && p.stock <= 0) return false;
      if (f.q){
        var hay = (p.name + " " + p.desc).toLowerCase();
        var words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
        for (var i = 0; i < words.length; i++){
          if (hay.indexOf(words[i]) === -1) return false;
        }
      }
      return true;
    });
    if (f.sort === "price-asc") list.sort(function(a,b){ return a.price - b.price; });
    if (f.sort === "price-desc") list.sort(function(a,b){ return b.price - a.price; });
    if (f.sort === "stock-desc") list.sort(function(a,b){ return b.stock - a.stock; });
    return list;
  }
  function stockHtml(p){
    return '<span class="stock">Còn bán <b class="' + (p.stock>0?"":"zero") + '">' + p.stock.toLocaleString("vi-VN") + '</b></span>';
  }
  function priceHtml(p){
    var old = "";
    if (p.old){
      var off = Math.round((1 - p.price/p.old) * 100);
      old = '<span class="old">' + fmt(p.old) + '</span><span class="off">-' + off + '%</span>';
    }
    return '<div class="price-box">' + old + '<span class="price">' + fmt(p.price) + '</span><span class="per">Ví website</span></div>';
  }
  function cardHtml(p){
    var head = "";
    if (p.kind === "pack" && p.cat === "random-tele"){
      head = '<div class="card-head"><div class="game">Liên Quân Mobile</div><div class="ttl">Acc Random</div></div>';
    } else if (p.img){
      head = '<div class="card-cover"><img src="' + esc(p.img) + '" alt="Ảnh bìa ' + esc(p.name) + '" loading="lazy" decoding="async" /></div>';
    } else {
      head = '<div class="card-head"><div class="game">AnhDev Store · Liên Quân</div><div class="ttl">LIÊN QUÂN</div></div>';
    }
    var btn = p.stock > 0
      ? '<button class="buy-btn" data-buy="' + p.id + '">' + L("buyNow") + '</button>'
      : '<button class="buy-btn out" disabled>' + L("soldOut") + '</button>';
    return '<article class="card" data-cat="' + esc(p.cat) + '">' + head +
      '<div class="card-body"><div class="name">' + esc(p.name) + '</div><div class="desc">' + esc(p.desc) + '</div>' +
      '<div class="card-meta">' + stockHtml(p) + priceHtml(p) + '</div>' + btn + '</div></article>';
  }
  var CATS_EN = {
    "random-tele": { title:"Random Accounts", sub:"Telegram Warehouse" },
    "detail":      { title:"Ready-info Accounts", sub:"Telegram Warehouse" },
    "random-lq":   { title:"Random Arena of Valor Accounts", sub:"" },
    "products":    { title:"Digital Products", sub:"Bot Warehouse" }
  };
  function catInfo(key){
    return state.lang === "en" && CATS_EN[key] ? CATS_EN[key] : CATS[key];
  }
  var PAGE_SIZE = 12; // 1 trang chỉ render 12 acc — render 12.126 acc cùng lúc làm trình duyệt đứng
  function pagerHtml(total, totalPages, start){
    if (totalPages <= 1) return "";
    var p = state.filter.page;
    var end = Math.min(start + PAGE_SIZE, total);
    var nums = "";
    var from = Math.max(1, p - 2), to = Math.min(totalPages, p + 2);
    if (from > 1) nums += '<button class="pg-num" data-page="1">1</button><span class="pg-dots">…</span>';
    for (var i = from; i <= to; i++){
      nums += '<button class="pg-num' + (i === p ? ' on' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (to < totalPages) nums += '<span class="pg-dots">…</span><button class="pg-num" data-page="' + totalPages + '">' + totalPages + '</button>';
    return '<div class="pager"><button class="pg-btn" data-page="' + (p - 1) + '"' + (p <= 1 ? ' disabled' : '') + '>&larr; ' + L("pgPrev") + '</button>'
      + '<span class="pg-info">' + L("pgShowing") + ' ' + (start + 1) + '–' + end + ' / ' + total + ' · ' + L("pgPage") + ' ' + p + '/' + totalPages + '</span>'
      + '<div class="pg-nums">' + nums + '</div>'
      + '<button class="pg-btn" data-page="' + (p + 1) + '"' + (p >= totalPages ? ' disabled' : '') + '>' + L("pgNext") + ' &rarr;</button></div>';
  }
  function renderProducts(){
    var list = visibleProducts();
    var area = $("#productArea");
    $("#prodCount").textContent = list.length + " / " + PRODUCTS.length + " sản phẩm";
    if (!list.length){
      if (SYNC.mode === "live" || SYNC.mode === "saved"){
        area.innerHTML = '<div class="empty-box"><b>Kho thật hiện đang hết hàng</b>Chưa có acc hay sản phẩm nào đang bán. Quay lại sau hoặc mua qua bot Telegram @devbn_bot.</div>';
      } else {
      area.innerHTML = '<div class="empty-box"><b>Không tìm thấy sản phẩm</b>Thử đổi từ khoá hoặc bỏ lọc “Còn hàng”.</div>';
      }
      return;
    }
    // Kho nhỏ (catalog mẫu) thì giữ kiểu nhóm theo danh mục như cũ.
    // Kho lớn thì phân trang phẳng — chỉ render 12 thẻ/trang, không render hết 12.126 acc cùng lúc.
    if (list.length <= PAGE_SIZE){
      if (state.filter.cat !== "all" || state.filter.q){
        area.innerHTML = '<div class="grid">' + list.map(cardHtml).join("") + '</div>';
        return;
      }
      var html = "";
      Object.keys(CATS).forEach(function(key){
        var items = list.filter(function(p){ return p.cat === key; });
        if (!items.length) return;
        var ci = catInfo(key);
        html += '<div class="cat-title">' + esc(ci.title) + (ci.sub ? ' <small>' + esc(ci.sub) + '</small>' : '') + '</div>';
        html += '<div class="grid">' + items.map(cardHtml).join("") + '</div>';
      });
      area.innerHTML = html;
      return;
    }
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.filter.page > totalPages) state.filter.page = totalPages;
    if (state.filter.page < 1) state.filter.page = 1;
    var start = (state.filter.page - 1) * PAGE_SIZE;
    var pageItems = list.slice(start, start + PAGE_SIZE);
    area.innerHTML = '<div class="grid">' + pageItems.map(cardHtml).join("") + '</div>' + pagerHtml(list.length, totalPages, start);
  }
  function renderStats(){
    var totalStock = PRODUCTS.reduce(function(s,p){ return s + p.stock; }, 0);
    $("#statStock").textContent = totalStock.toLocaleString("vi-VN");
    $("#statModels").textContent = PRODUCTS.length;
    var min = PRODUCTS.length ? Math.min.apply(null, PRODUCTS.map(function(p){ return p.price; })) : 0;
    $("#statFrom").textContent = fmt(min);
    var buckets = [
      {label:"< " + fmt(20000), n:0, test:function(p){ return p.price < 20000; }},
      {label:fmt(20000) + " – " + fmt(100000), n:0, test:function(p){ return p.price >= 20000 && p.price < 100000; }},
      {label:"≥ " + fmt(100000), n:0, test:function(p){ return p.price >= 100000; }}
    ];
    PRODUCTS.forEach(function(p){ if (p.stock > 0) buckets.forEach(function(b){ if (b.test(p)) b.n++; }); });
    var max = Math.max(1, Math.max.apply(null, buckets.map(function(b){ return b.n; })));
    $("#distRows").innerHTML = buckets.map(function(b){
      return '<div class="dist-row"><span>' + b.label + '</span><span class="dist-bar"><i style="width:' + Math.round(b.n/max*100) + '%"></i></span><b>' + b.n + '</b></div>';
    }).join("");
  }
  /* ================= ĐỒNG BỘ KHO THẬT (stock.json tĩnh) ================= */
  function apiProduct(a){
    var img = null;
    if (a.photos && a.photos.length && /^https?:\/\//.test(a.photos[0])) img = a.photos[0];
    if (a.kind === "random"){
      // Acc random: ẩn thông tin tới khi mua — chỉ hiện mô tả chung chung,
      // không lộ rank/level/tướng/skin hay mô tả gốc trong stock.json.
      return {
        id:"api-" + a.code, code:a.code, api:true,
        cat:"random-tele",
        kind:"acc", name:"Acc " + a.code, desc:"Acc Random — nhận 1 acc ngẫu nhiên, không xem trước thông tin",
        price: a.price, stock: 1, img: img, warranty_days: a.warranty_days
      };
    }
    var parts = [];
    if (a.rank) parts.push("Rank " + a.rank);
    if (a.level) parts.push("Lv " + a.level);
    if (a.heroes) parts.push(a.heroes + " tướng");
    if (a.skins) parts.push(a.skins + " skin");
    if (a.rare_skins) parts.push(a.rare_skins);
    var desc = parts.join(" · ") || "Acc Liên Quân";
    if (a.description) desc += " — " + String(a.description).slice(0, 120);
    return {
      id:"api-" + a.code, code:a.code, api:true,
      cat: a.kind === "random" ? "random-tele" : "detail",
      kind:"acc", name:"Acc " + a.code, desc:desc,
      price: a.price, stock: 1, img: img, warranty_days: a.warranty_days
    };
  }
  function apiProductForProduct(p){
    var parts = [];
    if (p.category) parts.push(p.category);
    if (p.product_type === "invite") parts.push("Mời vào nhóm/kênh");
    else if (p.product_type === "preorder") parts.push("Đặt trước");
    if (p.subscription_days) parts.push(p.subscription_days + " ngày dùng");
    if (p.delivery_hours) parts.push("Giao trong " + p.delivery_hours + " giờ");
    var desc = parts.join(" · ") || "Sản phẩm số";
    if (p.description) desc += " — " + String(p.description).slice(0, 120);
    if (p.note) desc += " (" + String(p.note).slice(0, 80) + ")";
    return {
      id:"prod-" + p.id, code:null, api:true,
      cat:"products", kind:"product", name:p.name, desc:desc,
      price: p.price, stock: p.stock, img: null, warranty_days: p.warranty_days
    };
  }
  function setSyncStatus(mode, text){
    SYNC.mode = mode;
    var el = $("#syncStatus");
    if (el){ el.className = "sync-status " + mode; el.textContent = text; }
  }
  function useLiveStock(data, label){
    var accs = (data.accounts || []).map(apiProduct);
    var prods = (data.products || []).map(apiProductForProduct);
    PRODUCTS = accs.concat(prods);
    state.filter.page = 1;
    SYNC.updatedAt = data.updated_at || null;
    var when = SYNC.updatedAt ? new Date(SYNC.updatedAt).toLocaleString("vi-VN") : "";
    var counts = accs.length + " acc · " + prods.length + " sản phẩm";
    if (label === "saved"){
      setSyncStatus("saved", "Kho thật (bản lưu lúc " + when + ") · " + counts + " — có thể chưa mới nhất, mua chắc chắn qua bot @devbn_bot.");
    } else {
      setSyncStatus("live", "Kho thật đã đồng bộ · " + counts + " đang bán" + (when ? " · cập nhật " + when : "") + ".");
    }
    renderProducts(); renderStats();
  }
  function useDemoStock(){
    PRODUCTS = DEMO_PRODUCTS;
    state.filter.page = 1;
    setSyncStatus("demo", "Không kết nối được kho thật — đang hiển thị catalog mẫu (không phải kho thật). Mua acc thật qua bot Telegram @devbn_bot.");
    renderProducts(); renderStats();
  }
  function syncStock(){
    document.dispatchEvent(new CustomEvent("anhdev:stock-syncing"));
    setSyncStatus("syncing", "Đang đồng bộ kho thật...");
    // Nguồn kho thật duy nhất: stock.json tĩnh trong repo (cùng GitHub
    // Pages). Admin API /api/stock trên host chưa chạy được (app Flask
    // không spawn) nên KHÔNG gọi API nữa — tránh chờ timeout rồi mới
    // fallback. stock.json quá 7 ngày thì dùng catalog mẫu.
    fetch("stock.json", { cache:"no-store" })
      .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(data){
        if (!data || !data.ok || !Array.isArray(data.accounts) || !data.updated_at) throw new Error("stock.json không hợp lệ");
        var age = Date.now() - new Date(data.updated_at).getTime();
        if (isNaN(age) || age > 7*24*60*60*1000) throw new Error("stock.json quá cũ");
        useLiveStock(data, "saved");
      })
      .catch(function(){ useDemoStock(); });
  }
  /* ===== GỌI API CLOUDFLARE: số dư thật do bot giữ ===== */
  function apiReady(){ return !!API_BASE && API_BASE.indexOf("REPLACE-WITH") === -1; }
  function tgHeaders(){
    var h = { "Content-Type":"application/json" };
    if (state.tgInitData) h["X-Telegram-Init-Data"] = state.tgInitData;
    else if (state.tgLoginData) h["X-Telegram-Login-Data"] = state.tgLoginData;
    return h;
  }
  function apiFetch(path, options){
    options = options || {};
    if (!apiReady()) return Promise.reject(new Error("API Cloudflare chưa cấu hình"));
    if (!state.tgInitData && !state.tgLoginData) return Promise.reject(new Error("Chưa có xác thực Telegram"));
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, API_TIMEOUT_MS);
    var init = { method: options.method || "GET", headers: tgHeaders(), cache:"no-store", signal: ctrl.signal };
    if (options.body != null) init.body = JSON.stringify(options.body);
    return fetch(API_BASE.replace(/\/$/, "") + path, init)
      .then(function(r){
        return r.text().then(function(text){
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!r.ok) throw new Error((data && data.error) || ("HTTP " + r.status));
          return data;
        });
      })
      .then(function(data){ clearTimeout(timer); return data; },
            function(err){ clearTimeout(timer); throw err; });
  }
  function applyBalance(b){
    if (!b) return;
    if (typeof b.shop_balance === "number") state.balance = b.shop_balance;
    if (typeof b.coins === "number") state.coins = b.coins;
    BALANCE.synced = true;
    BALANCE.updatedAt = b.updated_at ? new Date(b.updated_at).toLocaleString("vi-VN") : null;
    refreshUserUI(); renderAccount();
  }
  function markBalanceUnsynced(){
    BALANCE.synced = false; BALANCE.updatedAt = null; refreshUserUI();
  }
  function refreshWebBalance(){
    var tid = state.user && state.user.telegram_id;
    if (!tid){ markBalanceUnsynced(); return Promise.resolve(false); }
    // apiFetch tự từ chối khi thiếu URL Worker hoặc thiếu xác thực Telegram.
    return apiFetch("/api/balance?telegram_id=" + encodeURIComponent(tid))
      .then(function(b){
        if (!b || typeof b.shop_balance !== "number"){ markBalanceUnsynced(); return false; }
        applyBalance(b); return true;
      })
      .catch(function(){ markBalanceUnsynced(); return false; });
  }

  /* ===== HOÁ ĐƠN NẠP: lưu localStorage + poll trạng thái từ Worker ===== */
  function invoiceStorageKey(){
    return "anhdev_invoices_" + ((state.user && state.user.telegram_id) || "guest");
  }
  function saveInvoices(){
    try { localStorage.setItem(invoiceStorageKey(), JSON.stringify(state.invoices.slice(0, 20))); } catch (e) { /* bị chặn */ }
  }
  function loadInvoices(){
    try {
      var raw = localStorage.getItem(invoiceStorageKey());
      var list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) state.invoices = list.filter(function(x){ return x && x.code; }).slice(0, 20);
    } catch (e) { /* bỏ qua */ }
    renderInvoices();
  }
  function stopDepositPoll(){
    if (state.depositTimer){ clearTimeout(state.depositTimer); state.depositTimer = null; }
  }
  function startDepositPoll(iv){
    stopDepositPoll();
    if (!iv || !iv.remote || iv.status !== "pending") return;
    var tries = 0;
    var tick = function(){
      state.depositTimer = null;
      if (!iv || iv.status !== "pending") return;
      tries += 1;
      if (tries > 100) return; // ~10 phút là dừng
      checkDeposit(iv, false).then(function(){
        if (iv.status === "pending") state.depositTimer = setTimeout(tick, 6000);
      });
    };
    state.depositTimer = setTimeout(tick, 4000);
  }
  function checkDeposit(iv, manual){
    if (!iv || !iv.remote) return Promise.resolve(false);
    // Gửi cả mã lệnh nạp lẫn mã hoá đơn trong một request — Worker đọc tham số nào nó dùng.
    var q = "/api/deposit/status?deposit_id=" + encodeURIComponent(iv.depositId || iv.code) +
            "&code=" + encodeURIComponent(iv.code);
    return apiFetch(q)
      .then(function(d){
        if (!d) return false;
        var st = d.status || (d.approved ? "approved" : "");
        if (st === "approved" || st === "success" || st === "credited"){
          iv.status = "success";
          iv.credited = (typeof d.credited_amount === "number") ? d.credited_amount
            : (typeof d.amount === "number" ? d.amount : iv.amount);
          iv.detail = "SePay đã đối soát · bot đã cộng " + fmtVND(iv.credited);
          if (d.balance) applyBalance(d.balance);
          else refreshWebBalance();
          saveInvoices(); renderInvoices(); updatePayStatus();
          toast("Nạp thành công! Bot đã cộng " + fmtVND(iv.credited) + " vào ví.");
          stopDepositPoll();
          return true;
        }
        if (st === "rejected" || st === "cancelled" || st === "failed"){
          iv.status = "failed";
          iv.detail = "Lệnh nạp bị huỷ hoặc từ chối";
          saveInvoices(); renderInvoices(); updatePayStatus();
          stopDepositPoll();
          return false;
        }
        if (manual) toast("SePay chưa thấy giao dịch. Đợi 1–2 phút rồi thử lại.");
        return false;
      })
      .catch(function(){
        if (manual) toast("Không kiểm tra được trạng thái, thử lại sau.");
        return false;
      });
  }
  function resumePendingDeposit(){
    var pending = state.invoices.filter(function(iv){ return iv.remote && iv.status === "pending"; })[0];
    if (pending) startDepositPoll(pending);
  }
  $("#searchInput").addEventListener("input", function(e){ state.filter.q = e.target.value.trim(); state.filter.page = 1; renderProducts(); });
  $("#sortSelect").addEventListener("change", function(e){ state.filter.sort = e.target.value; state.filter.page = 1; renderProducts(); });
  $("#stockToggle").addEventListener("click", function(){
    state.filter.onlyStock = !state.filter.onlyStock;
    this.classList.toggle("on", state.filter.onlyStock);
    this.setAttribute("aria-pressed", state.filter.onlyStock);
    state.filter.page = 1;
    renderProducts();
  });
  $("#catChips").addEventListener("click", function(e){
    var chip = e.target.closest(".chip"); if (!chip) return;
    $$("#catChips .chip").forEach(function(c){ c.classList.remove("on"); });
    chip.classList.add("on");
    state.filter.cat = chip.getAttribute("data-cat");
    state.filter.page = 1;
    renderProducts();
  });
  $("#productArea").addEventListener("click", function(e){
    var b = e.target.closest("[data-page]"); if (!b || b.disabled) return;
    state.filter.page = parseInt(b.getAttribute("data-page"), 10) || 1;
    renderProducts();
    var t = document.getElementById("products"); if (t) t.scrollIntoView({ behavior:"smooth" });
  });

  /* ================= MODALS ================= */
  function openModal(id){ $(id).classList.add("open"); }
  function closeModal(el){ el.classList.remove("open"); }
  $$(".modal-wrap").forEach(function(w){
    w.addEventListener("click", function(e){ if (e.target === w) closeModal(w); });
    $$("[data-close]", w).forEach(function(b){ b.addEventListener("click", function(){ closeModal(w); }); });
  });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") $$(".modal-wrap.open").forEach(closeModal);
  });

  /* ================= AUTH ================= */
  var authMode = "login";
  function setAuthMode(mode){
    authMode = mode;
    $("#tabLogin").classList.toggle("on", mode === "login");
    $("#tabRegister").classList.toggle("on", mode === "register");
    $("#nameField").style.display = mode === "register" ? "block" : "none";
    $("#authSubmit").textContent = L("soon"); // tài khoản web sắp có — nút luôn hiển thị "Sắp có"
    $("#authErr").classList.remove("show");
  }
  $("#tabLogin").addEventListener("click", function(){ setAuthMode("login"); });
  $("#tabRegister").addEventListener("click", function(){ setAuthMode("register"); });
  function authError(msg){ var e = $("#authErr"); e.textContent = msg; e.classList.add("show"); }
  /* Đăng nhập bằng tài khoản web: SẮP CÓ — form đã bị vô hiệu hoá ở HTML.
     Giữ lại submit handler chỉ để chặn và báo, không tạo tài khoản ảo nữa. */
  $("#authForm").addEventListener("submit", function(e){
    e.preventDefault();
    authError("Đăng nhập bằng tài khoản web sắp có. Đăng nhập bằng Telegram bên dưới để dùng ngay nhé.");
  });
  /* Đăng nhập Telegram THẬT (Telegram Login Widget, bot @devbn_bot).
     Telegram gọi hàm này sau khi người dùng bấm nút và xác nhận trong popup.
     LƯU Ý: trang tĩnh không có server nên KHÔNG xác thực được hash mà Telegram trả về.
     Việc này chấp nhận được ở đây vì shop chỉ dùng telegram_id để đối chiếu số dư/đơn
     với bot, không dùng nó để cấp quyền nhạy cảm. Khi nào có backend thì xác thực hash ở server. */
  window.onTelegramAuth = function(user){
    if (!user || !user.id) return;
    var name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Khách Telegram";
    // Giữ nguyên toàn bộ payload Telegram đã ký để Worker tự xác thực hash.
    var authParts = [];
    Object.keys(user).forEach(function(k){
      var v = user[k];
      if (v === null || v === undefined || v === "") return;
      authParts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    var loginData = authParts.join("&");
    state.tgLoginData = loginData;
    setUser({
      name: name,
      username: user.username || ("tg" + user.id),
      telegram_id: user.id,
      photo_url: user.photo_url || null,
      auth_date: user.auth_date || null,
      via: "Telegram",
      login_data: loginData
    });
    refreshWebBalance();
    closeModal($("#authModal"));
    toast("Đăng nhập Telegram thành công, chào " + name + "!");
  };
  $("#topLoginBtn").addEventListener("click", function(){
    if (state.user){
      setUser(null); state.balance = 0; refreshUserUI();
      toast("Đã đăng xuất. Hẹn gặp lại!");
    } else {
      setAuthMode("login"); openModal("#authModal");
    }
  });
  function requireLogin(){
    if (state.user) return true;
    setAuthMode("login"); openModal("#authModal");
    toast("Đăng nhập trước để mua acc nhé.");
    return false;
  }

  /* Telegram Mini App: tự nhận diện tài khoản Telegram */
  try {
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user){
      var tgUser = Telegram.WebApp.initDataUnsafe.user;
      Telegram.WebApp.ready(); Telegram.WebApp.expand();
      state.tgInitData = Telegram.WebApp.initData || ""; // chuỗi đã ký để Worker xác thực
      setUser({
        name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || tgUser.username || "Khách Telegram",
        username: tgUser.username || ("tg" + tgUser.id),
        telegram_id: tgUser.id,
        photo_url: tgUser.photo_url || null,
        via:"Telegram Mini App"
      });
      refreshWebBalance();
    }
  } catch (err) { /* mở trên web thường thì bỏ qua */ }

  /* Khôi phục phiên Telegram đã đăng nhập trước đó (web thường).
     Mini App ở trên đã tự đăng nhập thì không ghi đè. */
  if (!state.user){
    var savedUser = loadSavedUser();
    if (savedUser){
      setUser(savedUser);
      refreshWebBalance();
    }
  }

  /* ================= BUY FLOW ================= */
  var buyTarget = null;
  document.addEventListener("click", function(e){
    var btn = e.target.closest("[data-buy]");
    if (!btn) return;
    var p = PRODUCTS.filter(function(x){ return x.id === btn.getAttribute("data-buy"); })[0];
    if (!p || p.stock <= 0) return;
    if (!requireLogin()) return;
    buyTarget = p;
    openBuyModal(p);
  });
  function openBotBuyModal(p){
    /* Acc thật: kho, ví và giao acc nằm trong bot — web chỉ dẫn sang bot,
       không tự trừ ví và không gọi /api/buy trên Worker. */
    $("#buyBody").innerHTML =
      '<div class="sum-row"><span>Sản phẩm</span><b>' + esc(p.name) + '</b></div>' +
      '<div class="sum-row"><span>Giá</span><b>' + fmt(p.price) + '</b></div>' +
      '<div class="shortfall">Acc thật được giao và trừ ví ngay trong bot Telegram <b>@devbn_bot</b>. Bấm nút bên dưới rồi chọn đúng sản phẩm này trong bot.</div>';
    $("#buyActions").innerHTML =
      '<button class="btn btn-ghost" data-buy-cancel>Đóng</button>' +
      '<a class="btn btn-wine" href="' + BOT_LINK + '" target="_blank" rel="noopener noreferrer">Mua trong bot @devbn_bot</a>';
    openModal("#buyModal");
  }
  function openBuyModal(p){
    $("#buySub").textContent = p.name + " · " + CATS[p.cat].title;
    if (p.api){ openBotBuyModal(p); return; }
    var body = $("#buyBody"), actions = $("#buyActions");
    var rows =
      '<div class="sum-row"><span>Sản phẩm</span><b>' + esc(p.name) + '</b></div>' +
      '<div class="sum-row"><span>Giá</span><b>' + fmt(p.price) + '</b></div>' +
      '<div class="sum-row"><span>Số dư ví hiện tại</span><b>' + fmt(state.balance) + '</b></div>';
    if (state.balance >= p.price){
      body.innerHTML = rows + '<div class="sum-row total"><span>Sau khi mua còn</span><b>' + fmt(state.balance - p.price) + '</b></div>';
      actions.innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Hủy</button><button class="btn btn-wine" data-buy-confirm>Xác nhận mua</button>';
    } else {
      var short = p.price - state.balance;
      body.innerHTML = rows +
        '<div class="shortfall">Ví chưa đủ tiền: giá <b>' + fmt(p.price) + '</b> · số dư <b>' + fmt(state.balance) + '</b> · còn thiếu <b>' + fmt(short) + '</b>. Nạp thêm qua VietQR là mua được ngay.</div>';
      actions.innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Để sau</button><button class="btn btn-wine" data-buy-topup>Nạp tiền ngay</button>';
    }
    openModal("#buyModal");
  }
  $("#buyModal").addEventListener("click", function(e){
    if (e.target.closest("[data-buy-cancel]")) closeModal($("#buyModal"));
    if (e.target.closest("[data-buy-topup]")){ closeModal($("#buyModal")); showView("topup"); }
    var cb = e.target.closest("[data-buy-confirm]");
    if (cb && buyTarget){ if (cb.disabled) return; cb.disabled = true; completePurchase(buyTarget); }
  });
  function completePurchase(p){
    state.balance -= p.price;
    p.stock -= 1;
    var order = {
      code: randCode("AD"),
      demo: true, // mua thử bằng số dư demo trên trình duyệt — KHÔNG phải giao dịch thật qua bot
      productName: p.name,
      price: p.price,
      time: nowStr(),
      user: "acc" + Math.random().toString(36).slice(2,10),
      pass: Math.random().toString(36).slice(2,8) + Math.floor(Math.random()*90+10)
    };
    state.orders.unshift(order);
    refreshUserUI(); renderProducts(); renderStats();
    $("#buySub").textContent = "Mua thành công · Mã đơn " + order.code;
    $("#buyBody").innerHTML =
      '<div class="cred"><div class="cred-row"><span class="k">Tài khoản</span><code>' + esc(order.user) + '</code><button class="copy-btn" data-copy="' + esc(order.user) + '">Copy</button></div>' +
      '<div class="cred-row"><span class="k">Mật khẩu</span><code>' + esc(order.pass) + '</code><button class="copy-btn" data-copy="' + esc(order.pass) + '">Copy</button></div></div>' +
      '<p style="font-size:13px;color:var(--muted);margin:12px 0 0">Thông tin này cũng nằm trong “Đơn hàng của tôi” và đồng bộ sang bot Telegram — mua ở đâu cũng xem lại được.</p>';
    $("#buyActions").innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Đóng</button><button class="btn btn-wine" data-buy-orders>Xem đơn hàng</button>';
    toast("Mua thành công! Đã trừ " + fmt(p.price) + " khỏi ví.");
  }
  $("#buyModal").addEventListener("click", function(e){
    if (e.target.closest("[data-buy-orders]")){ closeModal($("#buyModal")); showView("orders"); }
  });
  document.addEventListener("click", function(e){
    var c = e.target.closest("[data-copy]");
    if (!c) return;
    var text = c.getAttribute("data-copy");
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function(){ toast("Đã copy: " + text); });
    else toast(text);
  });

  /* ================= ORDERS / INVOICES / ACCOUNT ================= */
  function renderOrders(){
    var box = $("#ordersList");
    if (!state.user){
      box.innerHTML = '<div class="empty-box"><b>Bạn chưa đăng nhập</b>Đăng nhập để xem đơn hàng của mình.<br /><br /><button class="btn btn-wine" id="ordersLogin">Đăng nhập ngay</button></div>';
      var b = $("#ordersLogin"); if (b) b.addEventListener("click", function(){ setAuthMode("login"); openModal("#authModal"); });
      return;
    }
    if (!state.orders.length){
      box.innerHTML = '<div class="empty-box"><b>Chưa có đơn hàng nào</b>Acc bạn mua ở web, Mini App hay bot Telegram sẽ hiện ở đây.</div>';
      return;
    }
    box.innerHTML = state.orders.map(function(o){
      var cred;
      if (o.user && o.pass){
        cred = '<div class="cred"><div class="cred-row"><span class="k">Tài khoản</span><code>' + esc(o.user) + '</code><button class="copy-btn" data-copy="' + esc(o.user) + '">Copy</button></div>' +
          '<div class="cred-row"><span class="k">Mật khẩu</span><code>' + esc(o.pass) + '</code><button class="copy-btn" data-copy="' + esc(o.pass) + '">Copy</button></div></div>';
      } else {
        cred = '<div class="cred"><div class="cred-row"><span class="k">Nhận acc</span><span style="font-size:13px">Mở bot <b>@devbn_bot</b> → Đơn hàng của tôi để xem tài khoản + mật khẩu.</span></div></div>';
      }
      return '<div class="order"><div class="order-top"><b>' + esc(o.productName) + '</b>' + (o.demo ? '<span class="badge pend">Demo</span>' : '') + '<span class="badge">Đã bàn giao</span></div>' +
        '<div class="meta">Mã đơn ' + o.code + ' · ' + o.time + ' · ' + fmt(o.price) + '</div>' + cred + '</div>';
    }).join("");
  }
  function invoiceBadge(iv){
    if (iv.status === "pending") return '<span class="badge pend">Chờ xử lý</span>';
    if (iv.status === "failed") return '<span class="badge fail">Thất bại</span>';
    if (iv.status === "cancelled") return '<span class="badge fail">Đã huỷ</span>';
    return '<span class="badge">Thành công</span>';
  }
  function renderInvoices(){
    var box = $("#invoicesList");
    if (!state.invoices.length){
      box.innerHTML = '<div class="empty-box"><b>Chưa có hoá đơn nạp nào</b>Nạp tiền qua VietQR / SePay hoặc thẻ cào qua TheSieuRe, hoá đơn và trạng thái xử lý sẽ lưu tại đây.</div>';
      return;
    }
    box.innerHTML = state.invoices.map(function(iv){
      var amountHtml = iv.status === "success"
        ? '<b>+' + fmtVND(iv.credited != null ? iv.credited : iv.amount) + '</b>'
        : '<b>' + fmtVND(iv.amount) + '</b>';
      var detail = iv.detail ? '<div class="meta">' + esc(iv.detail) + '</div>' : '';
      var payBtn = iv.status === "pending" && iv.method.indexOf("Ngân Hàng") === 0
        ? '<div style="margin-top:11px"><button class="btn btn-wine" data-pay-invoice="' + esc(iv.code) + '" style="padding:7px 15px;min-height:38px;font-size:13px">' + L("payInvoiceBtn") + ' · ' + esc(iv.code) + '</button></div>'
        : '';
      return '<div class="order"><div class="order-top">' + amountHtml + invoiceBadge(iv) + '</div>' +
        '<div class="meta">Mã nạp ' + esc(iv.code) + ' · ' + esc(iv.method) + ' · ' + iv.time + '</div>' + detail + payBtn + '</div>';
    }).join("");
  }
  function renderAccount(){
    var box = $("#accountBody");
    if (!state.user){
      box.innerHTML = '<div class="empty-box"><b>Bạn chưa đăng nhập</b>Đăng nhập bằng Telegram để mua acc và nạp tiền.<br /><br /><button class="btn btn-wine" id="accLogin">Đăng nhập bằng Telegram</button></div>';
      var b = $("#accLogin"); if (b) b.addEventListener("click", function(){ setAuthMode("login"); openModal("#authModal"); });
      return;
    }
    box.innerHTML =
      '<div class="sum-row"><span>Tên hiển thị</span><b>' + esc(state.user.name) + '</b></div>' +
      '<div class="sum-row"><span>Tên đăng nhập</span><b>' + esc(state.user.username) + '</b></div>' +
      '<div class="sum-row"><span>Đăng nhập qua</span><b>' + esc(state.user.via) + '</b></div>' +
      '<div class="sum-row"><span>Số dư ví</span><b>' + fmt(state.balance) +
        (BALANCE.synced
          ? ' <span style="font-size:11px;color:var(--ok)">✓ đồng bộ bot' +
            (state.coins > 0 ? ' · ' + Number(state.coins).toLocaleString("vi-VN") + ' xu' : '') + '</span>'
          : ' <span style="font-size:11px;color:var(--danger)">chưa đồng bộ</span>') + '</b></div>' +
      '<div class="sum-row"><span>Tổng đơn đã mua</span><b>' + state.orders.length + ' đơn</b></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="accTopup">Nạp tiền</button><button class="btn btn-wine" id="accLogout">Đăng xuất</button></div>' +
      '<p style="font-size:12.5px;color:var(--muted);margin-top:14px">Liên kết Telegram: mở bot <b>@devbn_bot</b>, mọi acc mua trên bot cũng hiện trong ví và lịch sử này.</p>';
    $("#accTopup").addEventListener("click", function(){ showView("topup"); });
    $("#accLogout").addEventListener("click", function(){ setUser(null); state.balance = 0; refreshUserUI(); toast("Đã đăng xuất."); showView("home"); });
  }

  /* ================= TOPUP ================= */
  var selectedAmount = 0;
  $("#amountGrid").addEventListener("click", function(e){
    var b = e.target.closest(".amount-btn"); if (!b) return;
    $$("#amountGrid .amount-btn").forEach(function(x){ x.classList.remove("on"); });
    b.classList.add("on");
    selectedAmount = parseInt(b.getAttribute("data-amt"), 10);
    $("#amountInput").value = selectedAmount;
  });
  $("#amountInput").addEventListener("input", function(e){
    selectedAmount = parseInt(e.target.value, 10) || 0;
    $$("#amountGrid .amount-btn").forEach(function(x){ x.classList.toggle("on", parseInt(x.getAttribute("data-amt"),10) === selectedAmount); });
  });
  /* ===== HOÁ ĐƠN NGÂN HÀNG + TRANG THANH TOÁN (kiểu accaov.store/client/payment/MÃ) =====
     Mỗi lần nạp tạo 1 hoá đơn có mã riêng (vd WKZO13). Nội dung chuyển khoản = mã hoá đơn,
     SePay đối soát theo mã này. Mã QR là VietQR thật trỏ về MBBank 05817666778899. */
  function invoiceCode(){
    var letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    var s = "";
    for (var i = 0; i < 4; i++) s += letters[Math.floor(Math.random() * letters.length)];
    return s + Math.floor(Math.random() * 90 + 10);
  }
  function setTopupTab(which){
    state.topupTab = which;
    $("#tabQr").classList.toggle("on", which === "qr");
    $("#tabCard").classList.toggle("on", which === "card");
    $("#topupQr").style.display = which === "qr" ? "block" : "none";
    $("#topupCard").style.display = which === "card" ? "block" : "none";
    $$(".nav-item[data-tab]").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-tab") === which); });
  }
  $("#tabQr").addEventListener("click", function(){ setTopupTab("qr"); });
  $("#tabCard").addEventListener("click", function(){ setTopupTab("card"); });
  $("#makeQrBtn").addEventListener("click", function(){
    if (!requireLogin()) return;
    if (!selectedAmount || selectedAmount < 1000){ toast("Chọn hoặc nhập số tiền nạp từ 1.000đ."); return; }
    var btn = this;
    var amount = selectedAmount;
    var createLocal = function(message){
      var code = invoiceCode();
      var iv = {
        code: code, amount: amount, credited: null,
        method: "Ngân Hàng · Demo (chưa đồng bộ bot)", status: "pending",
        time: nowStr(), remote: false,
        detail: "MBBank · Nội dung CK: " + code
      };
      state.invoices.unshift(iv);
      state.currentPay = iv;
      saveInvoices(); renderInvoices(); renderPayment(); showView("payment");
      toast(message);
    };
    if (!apiReady()){
      createLocal("Chưa cấu hình API Worker — hoá đơn demo, chưa đồng bộ bot.");
      return;
    }
    btn.disabled = true;
    apiFetch("/api/deposit", {
      method: "POST",
      body: { telegram_id: (state.user && state.user.telegram_id) || null, amount: amount, method: "sepay" }
    })
      .then(function(d){
        var code = d && (d.code || d.invoice_code || d.deposit_id || d.id);
        if (!code) throw new Error((d && d.error) || "Không tạo được lệnh nạp");
        var iv = {
          code: code,
          amount: (typeof d.amount === "number" ? d.amount : amount),
          credited: null,
          method: "Ngân Hàng · SePay / VietQR",
          status: "pending",
          time: nowStr(),
          remote: true,
          depositId: d.deposit_id || d.id || code,
          bank: d.bank,
          qr_url: d.qr_url,
          detail: "Chuyển đúng số tiền + nội dung " + code + " — bot tự cộng ví"
        };
        state.invoices.unshift(iv);
        state.currentPay = iv;
        saveInvoices(); renderInvoices(); renderPayment(); showView("payment");
        toast("Đã tạo lệnh nạp " + code + " — quét VietQR để thanh toán.");
        startDepositPoll(iv);
      })
      .catch(function(err){
        var why = (err && err.message) ? err.message : "lỗi mạng";
        createLocal("Không gọi được API (" + why + ") — hoá đơn demo, chưa đồng bộ bot.");
      })
      .then(function(){ btn.disabled = false; });
  });
  function renderPayment(){
    var iv = state.currentPay; if (!iv) return;
    var bank = iv.bank || BANK;
    $("#payCodeLbl").textContent = iv.code;
    $("#payBank").textContent = bank.name || bank.code || BANK.name;
    $("#payAcc").textContent = bank.account || BANK.account;
    $("#payHolder").textContent = bank.holder || BANK.holder;
    $("#payAmount").textContent = fmtVND(iv.amount);
    $("#payNote").textContent = iv.code;
    $("#payAccCopy").setAttribute("data-copy", bank.account || BANK.account);
    $("#payNoteCopy").setAttribute("data-copy", iv.code);
    var img = $("#payQrImg");
    $("#payQrFallback").hidden = true;
    img.hidden = false;
    img.src = iv.qr_url ? iv.qr_url
      : "https://img.vietqr.io/image/" + (bank.code || BANK.code) + "-" + (bank.account || BANK.account) + "-qr_only.png?amount=" + iv.amount +
        "&addInfo=" + encodeURIComponent(iv.code) + "&accountName=" + encodeURIComponent(bank.holder || BANK.holder);
    updatePayStatus();
    if (iv.remote && iv.status === "pending") startDepositPoll(iv);
  }
  function updatePayStatus(){
    var iv = state.currentPay; if (!iv) return;
    if (iv.status === "approved") iv.status = "success";
    var st = $("#payStatus"), btn = $("#payConfirmBtn"), back = $("#payBackBtn"), sup = $("#paySupport");
    var link = $("#paySupportLink"); if (link) link.href = ADMIN_SUPPORT_URL;
    st.classList.remove("done", "cancelled");
    if (iv.status === "success"){
      // ĐÃ CHUYỂN: trạng thái xanh + hiện dòng Hỗ trợ (link acc admin)
      st.innerHTML = "✓ " + L("payDone") +
        (iv.remote ? " · bot đã cộng " + fmtVND(iv.credited != null ? iv.credited : iv.amount) : " · demo, chưa đồng bộ bot");
      st.classList.add("done");
      btn.style.display = "";
      btn.textContent = L("payViewInv");
      btn.setAttribute("data-pay-done", "1");
      back.style.display = "none";
      sup.hidden = false;
    } else if (iv.status === "cancelled"){
      st.textContent = L("payCancelled");
      st.classList.add("cancelled");
      btn.style.display = "none";
      back.style.display = "none";
      sup.hidden = false;
    } else {
      // ĐANG CHỜ: icon quay tròn liên tục + đúng 2 nút Xác nhận đã chuyển / Huỷ
      st.innerHTML = '<span class="spinner"></span> ' + L("payWaiting");
      btn.style.display = "";
      btn.textContent = L("payConfirm");
      btn.removeAttribute("data-pay-done");
      back.style.display = "";
      sup.hidden = true;
    }
  }
  $("#payQrImg").addEventListener("error", function(){
    this.hidden = true;
    $("#payQrFallback").hidden = false;
  });
  $("#payConfirmBtn").addEventListener("click", function(){
    var iv = state.currentPay; if (!iv) return;
    if (this.hasAttribute("data-pay-done")){ showView("invoices"); return; }
    if (iv.remote){
      // Lệnh nạp thật: tiền do SePay/bot xác nhận, không tự cộng trên trình duyệt.
      toast("Đang kiểm tra giao dịch với SePay...");
      checkDeposit(iv, true);
      return;
    }
    iv.status = "success";
    iv.credited = iv.amount;
    iv.detail = "Demo cục bộ · chưa đồng bộ bot";
    state.balance += iv.amount;
    markBalanceUnsynced();
    saveInvoices(); renderInvoices(); updatePayStatus();
    toast("Đã cộng " + fmtVND(iv.amount) + " vào số dư demo (chưa đồng bộ bot).");
  });
  $("#payBackBtn").addEventListener("click", function(){
    var iv = state.currentPay;
    if (iv && iv.status === "pending"){
      iv.status = "cancelled";
      iv.detail = "MBBank · Nội dung CK: " + iv.code + " · Đã huỷ";
      saveInvoices(); renderInvoices();
      toast("Đã huỷ hoá đơn " + iv.code + ".");
    }
    showView("topup");
  });
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-pay-invoice]");
    if (!b) return;
    var code = b.getAttribute("data-pay-invoice");
    var iv = state.invoices.filter(function(x){ return x.code === code; })[0];
    if (iv){ state.currentPay = iv; renderPayment(); showView("payment"); }
  });
  /* ===== NẠP THẺ QUA THESIEURE =====
     Luồng: tạo giao dịch "Chờ xử lý" → gửi thẻ lên API TheSieuRe → callback/truy vấn trả về
     thành công thì cộng ví theo số thực nhận (đã trừ chiết khấu), thất bại thì ghi rõ lý do. */
  function submitCardToThesieure(card, done){
    // Payload đúng format API gạch thẻ của thesieure.com (chargingws/v2).
    var payload = {
      telco: card.telco,
      code: card.pin,
      serial: card.serial,
      amount: card.amount,
      request_id: card.requestId,
      partner_id: THESIEURE.partnerId,
      sign: "" // sign = md5(partnerKey + code + serial) — tính ở phía bot/server khi nối thật
    };
    if (THESIEURE.partnerId && THESIEURE.partnerKey){
      // Đã có cấu hình: gửi thẻ lên TheSieuRe (giữ bí mật partnerKey).
      fetch(THESIEURE.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function(r){ return r.json(); }).then(function(res){
        if (res && (res.status === 1 || res.status === "1" || res.status === 99)){
          // status 99 = thẻ đúng, đang chờ xử lý tiếp; status 1 = thành công
          if (res.status === 99) return; // giữ "Chờ xử lý", callback sau sẽ chốt
          var value = Number(res.value || res.amount || card.amount);
          done({ ok:true, value:value });
        } else {
          done({ ok:false, message: (res && (res.message || res.msg)) || "TheSieuRe từ chối thẻ" });
        }
      }).catch(function(){
        done({ ok:false, message:"Không gọi được API TheSieuRe — kiểm tra lại cấu hình partner" });
      });
      return;
    }
    // Chưa điền partnerId/partnerKey: mô phỏng vòng đời giao dịch để xem trạng thái chạy đúng.
    setTimeout(function(){
      var digits = /^\d+$/;
      if (!digits.test(card.serial) || !digits.test(card.pin) || card.serial.length < 10 || card.pin.length < 10){
        done({ ok:false, message:"Mã thẻ / seri không đúng định dạng số của " + card.telcoName });
      } else {
        var fee = (THESIEURE.fees[card.telco] || 0) / 100;
        done({ ok:true, value: Math.round(card.amount * (1 - fee)) });
      }
    }, 3500);
  }
  $("#cardSubmit").addEventListener("click", function(){
    if (!requireLogin()) return;
    var telcoSel = $("#cardTelco");
    var telco = telcoSel.value;
    var telcoName = telcoSel.options[telcoSel.selectedIndex].text;
    var amount = parseInt($("#cardAmount").value, 10);
    var serial = $("#cardSerial").value.replace(/\s+/g, "");
    var pin = $("#cardPin").value.replace(/\s+/g, "");
    if (!serial || !pin){ toast("Nhập đủ số seri và mã thẻ."); return; }
    // Thẻ cào VN: chỉ gồm chữ số — seri 10–16 số, mã thẻ 10–15 số.
    if (!/^\d{10,16}$/.test(serial) || !/^\d{10,15}$/.test(pin)){
      toast("Seri (10–16 số) và mã thẻ (10–15 số) chỉ gồm chữ số — kiểm tra lại.");
      return;
    }
    var iv = {
      code: randCode("THE"),
      amount: amount,
      credited: null,
      method: "Thẻ cào · TheSieuRe",
      status: "pending",
      time: nowStr(),
      detail: telcoName + " · mệnh giá " + fmt(amount) + " · seri …" + serial.slice(-4)
    };
    state.invoices.unshift(iv);
    saveInvoices(); renderInvoices();
    $("#cardSerial").value = ""; $("#cardPin").value = "";
    var cardBtn = this;
    cardBtn.disabled = true; // khoá nút chống gửi trùng trong khi chờ TheSieuRe
    toast("Đã gửi thẻ " + telcoName + " " + fmt(amount) + " lên TheSieuRe — trạng thái: Chờ xử lý.");
    submitCardToThesieure(
      { telco: telco, telcoName: telcoName, amount: amount, serial: serial, pin: pin, requestId: iv.code },
      function(result){
        cardBtn.disabled = false;
        if (result.ok){
          iv.status = "success";
          iv.credited = result.value;
          state.balance += result.value;
          markBalanceUnsynced(); // thẻ cào trên web chưa đi qua bot
          iv.detail += " · thực nhận " + fmt(result.value) + " (đã trừ chiết khấu TheSieuRe)";
          refreshUserUI();
          toast("Nạp thẻ thành công! Cộng " + fmt(result.value) + " vào ví.");
        } else {
          iv.status = "failed";
          iv.detail += " · Lý do: " + result.message;
          toast("Nạp thẻ thất bại: " + result.message);
        }
        renderInvoices();
        renderAccount();
      }
    );
  });

  /* ================= ĐIỂM DANH ================= */
  function renderCheckin(){
    var body = $("#checkinBody");
    if (state.checkin != null){
      body.innerHTML = '<div class="checkin-done">' + L("ciDoneA") + fmt(state.checkin) + L("ciDoneB") + '</div>';
    } else {
      body.innerHTML = '<button class="btn btn-wine" id="checkinBtn" style="width:100%">' + L("ciBtn") + '</button>';
      $("#checkinBtn").addEventListener("click", function(){
        this.disabled = true; // khoá nút chống điểm danh 2 lần trong cùng 1 lần mở modal
        var amt = 1 + Math.floor(Math.random() * 500);
        state.checkin = amt;
        state.balance += amt;
        markBalanceUnsynced(); // điểm danh thật nằm trong bot
        refreshUserUI();
        renderCheckin();
        document.dispatchEvent(new CustomEvent("anhdev:checkin", { detail:{ amount: amt } }));
        toast("Điểm danh thành công! +" + fmt(amt) + " vào ví.");
      });
    }
  }
  $("#checkinItem").addEventListener("click", function(){
    if (!requireLogin()) return;
    renderCheckin();
    openModal("#checkinModal");
    closeSidebar();
  });

  /* ================= BẢNG XẾP HẠNG ================= */
  var LEADERS = [
    { name:"anh***dev", spent:4920000, orders:61 },
    { name:"kho***99",  spent:3850000, orders:48 },
    { name:"lq***pro",  spent:2740000, orders:37 },
    { name:"tra***07",  spent:1980000, orders:29 },
    { name:"min***x",   spent:1560000, orders:24 },
    { name:"phu***12",  spent:1210000, orders:19 },
    { name:"duc***88",  spent:940000,  orders:15 },
    { name:"hai***vn",  spent:720000,  orders:12 },
    { name:"son***34",  spent:515000,  orders:9 },
    { name:"tua***56",  spent:380000,  orders:7 }
  ];
  function renderLeaderboard(){
    var box = $("#lbList");
    if (!box) return;
    var rows = LEADERS.map(function(x){ return { name:x.name, spent:x.spent, orders:x.orders, me:false }; });
    if (state.user){
      var mySpent = state.orders.reduce(function(s, o){ return s + o.price; }, 0);
      rows.push({ name: state.user.username, spent: mySpent, orders: state.orders.length, me:true });
      rows.sort(function(a, b){ return b.spent - a.spent; });
    }
    box.innerHTML = rows.map(function(r, i){
      var medal = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
      return '<div class="lb-row' + (r.me ? " me" : "") + '"><span class="lb-rank ' + medal + '">' + (i + 1) + '</span>' +
        '<span class="lb-name">' + esc(r.name) + (r.me ? ' <span class="lb-you">' + L("lbYou") + '</span>' : '') + '</span>' +
        '<span class="lb-orders">' + r.orders + ' ' + L("lbOrders") + '</span>' +
        '<span class="lb-spent">' + fmt(r.spent) + '</span></div>';
    }).join("");
  }

  /* ================= MENU CON "MUA TÀI KHOẢN" ================= */
  $("#buyMenuToggle").addEventListener("click", function(){
    var sub = $("#buySubmenu");
    var willOpen = !sub.classList.contains("open");
    sub.classList.toggle("open", willOpen);
    this.setAttribute("aria-expanded", willOpen);
    this.classList.toggle("open", willOpen);
  });
  document.addEventListener("click", function(e){
    var link = e.target.closest("[data-catlink]");
    if (!link) return;
    var cat = link.getAttribute("data-catlink");
    state.filter.cat = cat;
    state.filter.page = 1;
    $$("#catChips .chip").forEach(function(c){ c.classList.toggle("on", c.getAttribute("data-cat") === cat); });
    showView("home");
    renderProducts();
    setTimeout(function(){ var t = document.getElementById("products"); if (t) t.scrollIntoView({ behavior:"smooth" }); }, 60);
  });
  $("#userChip").addEventListener("click", function(){ showView("account"); });

  /* ================= NGÔN NGỮ & TIỀN TỆ (mục TÙY CHỌN) ================= */
  var I18N_VI = {}, I18N_VI_HTML = {}, I18N_VI_PH = {};
  var I18N_EN = {
    brandSub:"Arena of Valor account shop", walletLbl:"Wallet:", balLabel:"Balance", balDisc:"0% off",
    navCheckin:"Daily Check-in", navHome:"Home", navBuy:"Buy Accounts", navOrders:"Purchase History", navRank:"Leaderboard",
    grpTopup:"Top up", navBank:"Bank", navCard:"Card Top-up", navInvoices:"Invoices",
    grpOptions:"Options", optLang:"Language", optCur:"Currency", grpMore:"More",
    heroKicker:"Arena of Valor Mobile · Telegram & Website Warehouse",
    heroText:"Find accounts by name, price and stock status. Buy and receive your account right under Orders.",
    heroExplore:"Explore the warehouse ↓", heroTopup:"Top up with VietQR",
    quick1T:"Warehouse from Telegram", quick1S:"Random and ready-info accounts",
    quick2T:"My orders", quick2S:"View orders and delivered account details",
    statsTitle:"Warehouse overview", statStock:"In stock", statModels:"Products", statFrom:"From", distTitle:"In-stock products by price",
    stepsTitle:"Buy an account in 4 steps",
    step1T:"Create an account", step1P:"Register with a username + password, or log in with Telegram. Opened inside the Mini App, you are recognised automatically.",
    step2T:"Top up your wallet", step2P:"Scan the VietQR code and transfer with the exact note — SePay credits your wallet automatically, no receipt needed.",
    step3T:"Pick an account & Buy now", step3P:"Filter by account type and price, then hit Buy now. If your wallet covers it, stock is deducted instantly.",
    step4T:"Receive your account", step4P:"Username + password appear right in My Orders.",
    prodTitle:"Products in warehouse", sortDefault:"Default", sortAsc:"Price low → high", sortDesc:"Price high → low", sortStock:"Most in stock", stockOnly:"In stock",
    chipAll:"All", chipRandom:"Random Accounts", chipDetail:"Ready-info Accounts", chipRandomLq:"Random AoV",
    "ph:searchPh":"Search product names...",
    topupTitle:"Top up wallet", topupSub:"Bank transfer via VietQR — SePay matches your transfer note automatically and credits your wallet as soon as the bank confirms.",
    tabQr:"VietQR · Scan code", tabCard:"Prepaid card",
    amtLabel:"Top-up amount (đ)", amtHint:"Minimum 1,000đ. After creating the invoice, transfer the exact amount with the invoice code as the note — SePay credits the right wallet automatically.",
    makeQr:"Create invoice & VietQR code", bankLine:"Receiving bank: MBBank · Account 05817666778899 · BUI NGUYEN XUAN NHAT", "ph:amtPh":"Or enter another amount...",
    cardTelcoL:"Card type", cardAmountL:"Card denomination", cardAmountHint:"Pick the exact denomination printed on the card — if you declare it wrong, TheSieuRe settles at the real value and the card may be lost.",
    cardSerialL:"Serial number", "ph:cardSerialPh":"Enter the serial printed on the card", cardPinL:"Card code", "ph:cardPinPh":"Scratch the silver layer and enter the code",
    cardSubmit:"Send card via TheSieuRe",
    ordersTitle:"My orders", ordersSub:"All purchased accounts appear here.",
    invTitle:"Top-up invoices", invSub:"History of top-ups via SePay / VietQR and TheSieuRe prepaid cards — cards clearly show pending, success or failed status.",
    accTitle:"My account", accSub:"Link Telegram for quick sign-in everywhere.",
    lbTitle:"Leaderboard", lbSub:"Top buyers at the shop — ranked by total spending.",
    authTitle:"Welcome to AnhDev Store", authSub:"Log in to buy accounts and top up.",
    authLoginTab:"Log In", authRegTab:"Register", authNameL:"Display name", "ph:authNamePh":"E.g.: Anh Dev",
    authUserL:"Username", "ph:authUserPh":"Your username", authPassL:"Password", "ph:authPassPh":"Password (6+ characters)",
    tgBtn:"Log in with Telegram", tgHint:"Open the shop inside the Telegram Mini App and this step is automatic — the shop recognises the Telegram account you are using.",
    ciTitle:"Daily check-in", ciSub:"Check in once a day to receive a random 1–500đ straight into your wallet.",
    paySecure:"Secure transaction", payBack:"Cancel",
    bnHome:"Home", bnShop:"Accounts", bnTopup:"Top up", bnOrders:"Orders", bnAccount:"Account",
  };
  var I18N_EN_HTML = {
    heroTitle:'Account warehouse<br />ANHDEV<span class="dot">.</span>',
    payQrSub:'Use your <b>Internet Banking app</b> or a QR-capable camera app to scan the code',
    paySupport:'Already transferred but the balance has not arrived? Contact <a id="paySupportLink" href="https://t.me/devbn_bot" target="_blank" rel="noopener noreferrer">Support</a> — the admin will check and credit you.'
  };
  function captureVi(){
    $$("[data-i18n]").forEach(function(el){ I18N_VI[el.getAttribute("data-i18n")] = el.textContent; });
    $$("[data-i18n-html]").forEach(function(el){ I18N_VI_HTML[el.getAttribute("data-i18n-html")] = el.innerHTML; });
    $$("[data-i18n-ph]").forEach(function(el){ I18N_VI_PH[el.getAttribute("data-i18n-ph")] = el.getAttribute("placeholder") || ""; });
  }
  function applyLang(lang){
    state.lang = lang;
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "vi");
    $("#langVal").textContent = lang === "en" ? "English" : "Vietnamese";
    $$("[data-i18n]").forEach(function(el){
      var k = el.getAttribute("data-i18n");
      var v = lang === "en" ? I18N_EN[k] : I18N_VI[k];
      if (v != null) el.textContent = v;
    });
    $$("[data-i18n-html]").forEach(function(el){
      var k = el.getAttribute("data-i18n-html");
      var v = lang === "en" ? I18N_EN_HTML[k] : I18N_VI_HTML[k];
      if (v != null) el.innerHTML = v;
    });
    $$("[data-i18n-ph]").forEach(function(el){
      var k = el.getAttribute("data-i18n-ph");
      var v = lang === "en" ? I18N_EN["ph:" + k] : I18N_VI_PH[k];
      if (v != null) el.setAttribute("placeholder", v);
    });
    refreshUserUI();
    renderProducts();
    renderStats();
    renderLeaderboard();
    if (state.currentPay) updatePayStatus();
  }
  $("#langSelect").addEventListener("change", function(){ applyLang(this.value); });
  $("#curSelect").addEventListener("change", function(){
    state.currency = this.value;
    $("#curVal").textContent = this.value;
    refreshUserUI();
    renderProducts();
    renderStats();
    renderOrders();
    renderLeaderboard();
    renderAccount();
    toast(this.value === "USD" ? "Đã đổi tiền tệ hiển thị sang USD (giao dịch vẫn tính bằng VND)." : "Đã đổi tiền tệ hiển thị sang VND.");
  });

  /* ================= INIT ================= */
  captureVi();
  setSyncStatus("syncing", "Đang đồng bộ kho thật...");
  renderProducts();
  renderStats();
  refreshUserUI();
  renderOrders();
  renderInvoices();
  renderAccount();
  syncStock();
  /* Số dư thật: làm mới mỗi 60 giây khi tab đang hiển thị, và ngay khi
     người dùng quay lại tab (mở lại shop). */
  setInterval(function(){
    if (document.visibilityState === "visible" && state.user) refreshWebBalance();
  }, 60000);
  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState === "visible" && state.user) refreshWebBalance();
  });
})();

