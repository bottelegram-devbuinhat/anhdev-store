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

  /* ===== BACKEND VPS — TÀI KHOẢN WEB + NẠP THẺ CÀO (Flask) =====
     API_BASE_URL là CHỖ DUY NHẤT giữ địa chỉ backend Flask (VPS) — chỉ
     cần dán 1 link https://... vào đây là cả web dùng được (đăng nhập
     TK/MK, nạp thẻ cào, điểm danh). Vd "https://api.anhdev.store".
     Để trống "" = chưa cấu hình: form nạp thẻ qua máy chủ + đăng nhập TK/MK
     sẽ báo "chưa cấu hình backend", còn đăng nhập Telegram + các luồng demo
     vẫn chạy bình thường.
     KHI ĐÃ ĐIỀN: nhớ thêm domain này vào connect-src của CSP trong
     index.html (meta Content-Security-Policy — tìm dòng có ghi chú
     "DOI-DOMAIN-BACKEND") — nếu không trình duyệt sẽ chặn fetch tới backend.
     TUYỆT ĐỐI KHÔNG điền PARTNER_ID / PARTNER_KEY / JWT_SECRET vào file này
     — chúng chỉ nằm trong file .env trên VPS. Frontend không bao giờ gọi
     thẳng cổng gạch thẻ (TheSieuRe): mọi thẻ cào đi qua backend, backend
     mới ký sign = md5(partnerKey + code + serial) và gọi cổng thẻ.
     API số dư / nạp tiền SePay qua Cloudflare Worker là API_BASE riêng
     (đừng nhầm với API_BASE_URL này). */
  var API_BASE_URL = "https://anhdev-store-backend.onrender.com";
  function backendReady(){ return !!API_BASE_URL && API_BASE_URL.indexOf("REPLACE-WITH") === -1; }

  /* ===== BẢNG CHIẾT KHẤU NẠP THẺ (CHỈ ĐỂ HIỂN THỊ) =====
     % chiết khấu theo từng nhà mạng — hiển thị trong form "Nạp Thẻ" để khách
     xem trước số thực nhận dự kiến.
     SỐ TIỀN THỰC NHẬN THẬT DO BACKEND TÍNH theo CARD_DISCOUNT_RATES trong
     file .env trên VPS (backend là nguồn duy nhất đúng). Khi backend đổi
     bảng phí, sửa lại bảng này cho khớp. */
  var CARD_DISCOUNT_RATES = { VIETTEL: 20, VINAPHONE: 20, MOBIFONE: 20, ZING: 20, GARENA: 20, VTC: 20, GATE: 20 };
  var CARD_TELCOS = ["VIETTEL", "VINAPHONE", "MOBIFONE", "ZING", "GARENA", "VTC", "GATE"];

  /* ================= DATA (mẫu catalog theo accaov.store) ================= */
  var CATS = {
    "random-tele": { title:"Acc Random", sub:"Kho Telegram" },
    "detail":      { title:"Acc sẵn thông tin", sub:"Kho Telegram" },
    "white":       { title:"Acc trắng thông tin", sub:"Kho Telegram" },
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
    {id:"d6", cat:"white", kind:"acc", name:"Acc #01590", desc:"Acc trắng thông tin", price:10000, stock:1, img:"assets/cover-1.webp"},
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
  var BALANCE = { synced:false, web:false, updatedAt:null };

  /* ================= STATE (in-session) ================= */
  var state = {
    user: null,            // {name, username, telegram_id, photo_url, auth_date, via} — chỉ user Telegram thật
    balance: 0,
    coins: 0,              // xu trong bot (số dư thật do bot giữ)
    discount: 0,           // % giảm giá của tài khoản web (từ /api/auth/me)
    webToken: null,        // JWT tài khoản web (từ /api/auth/login|register)
    userRole: null,        // "user" | "admin" | null — role từ /api/auth/me (JWT); null = chưa biết/chưa đăng nhập web
    adminSearchActive: false, // true khi đang hiển thị kết quả soi skin Acc Random (module admin quản lý #productArea; renderProducts() tạm nghỉ)
    tgInitData: "",        // Telegram.WebApp.initData (Mini App) để Worker xác thực
    tgLoginData: "",       // query string Telegram Login Widget đã ký (web thường)
    depositTimer: null,    // bộ đếm poll trạng thái lệnh nạp
    orders: [],            // {code, productName, price, time, user, pass}
    invoices: [],          // {code, amount, method, time}
    filter: { cat:"all", q:"", sort:"shuffle", onlyStock:false, page:1 },
    pendingTopup: null,    // (giữ tương thích)
    currentPay: null,      // hoá đơn ngân hàng đang mở ở trang thanh toán
    checkin: null,         // số tiền đã điểm danh trong phiên (null = chưa điểm danh)
    checkinDone: false,   // true khi server báo đã điểm danh hôm nay (409)
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
    pgPage:{ vi:"Trang", en:"Page" },
    sugPopular:{ vi:"Từ khoá phổ biến", en:"Popular keywords" },
    buyProd:{ vi:"Sản phẩm", en:"Product" },
    buyPrice:{ vi:"Giá", en:"Price" },
    buyBal:{ vi:"Số dư ví hiện tại", en:"Current wallet balance" },
    buyAfter:{ vi:"Sau khi mua còn", en:"Balance after purchase" },
    shortA:{ vi:"Ví chưa đủ tiền: giá ", en:"Not enough in wallet: price " },
    shortB:{ vi:" · số dư ", en:" · balance " },
    shortC:{ vi:" · còn thiếu ", en:" · short " },
    shortD:{ vi:". Nạp thêm qua VietQR là mua được ngay.", en:". Top up via VietQR and you can buy right away." },
    botNote:{ vi:"Acc thật được giao và trừ ví ngay trong bot Telegram @devbn_bot. Bấm nút bên dưới rồi chọn đúng sản phẩm này trong bot.", en:"Real accounts are delivered and paid for inside the Telegram bot @devbn_bot. Tap the button below and pick this exact product in the bot." },
    credUser:{ vi:"Tài khoản", en:"Username" },
    credPass:{ vi:"Mật khẩu", en:"Password" },
    credNote:{ vi:"Thông tin này cũng nằm trong “Đơn hàng của tôi” và đồng bộ sang bot Telegram — mua ở đâu cũng xem lại được.", en:"This also appears under “My orders” and syncs to the Telegram bot — buy anywhere, view it here." },
    ordLoginB:{ vi:"Đăng nhập ngay", en:"Log in now" },
    ordLoginS:{ vi:"Đăng nhập để xem đơn hàng của bạn.", en:"Log in to view your orders." },
    ordEmptyT:{ vi:"Chưa có đơn hàng nào", en:"No orders yet" },
    ordEmptyS:{ vi:"Acc bạn mua ở web, Mini App hay bot Telegram sẽ hiện ở đây.", en:"Accounts you buy on the web, Mini App or Telegram bot will appear here." },
    ordRecv:{ vi:"Nhận acc", en:"Delivery" },
    ordRecvBot:{ vi:"Mở bot @devbn_bot → Đơn hàng của tôi để xem tài khoản + mật khẩu.", en:"Open the bot @devbn_bot → My orders to view the username + password." },
    ordRecvOnce:{ vi:"Tài khoản + mật khẩu đã hiển thị 1 lần ngay sau khi mua — hãy lưu lại khi mua để xem lại tại đây.", en:"Username + password were shown once right after purchase — save them when you buy to view them here." },
    invEmptyT:{ vi:"Chưa có hoá đơn nạp nào", en:"No top-up invoices yet" },
    invEmptyS:{ vi:"Nạp tiền qua VietQR / SePay hoặc thẻ cào qua TheSieuRe, hoá đơn và trạng thái xử lý sẽ lưu tại đây.", en:"Top up via VietQR / SePay or TheSieuRe prepaid cards — invoices and their status will be saved here." },
    accLoginB:{ vi:"Đăng nhập ngay", en:"Log in now" },
    accLoginS:{ vi:"Đăng nhập để xem thông tin tài khoản, số dư và lịch sử của bạn.", en:"Log in to view your account info, balance and history." },
    accName:{ vi:"Tên hiển thị", en:"Display name" },
    accUser:{ vi:"Tên đăng nhập", en:"Username" },
    accVia:{ vi:"Đăng nhập qua", en:"Signed in via" },
    accBal:{ vi:"Số dư ví", en:"Wallet balance" },
    accOrders:{ vi:"Tổng đơn đã mua", en:"Total orders" },
    accTopup:{ vi:"Nạp tiền", en:"Top up" },
    accNote:{ vi:"Liên kết Telegram: mở bot @devbn_bot, mọi acc mua trên bot cũng hiện trong ví và lịch sử này.", en:"Telegram link: open the bot @devbn_bot — accounts bought in the bot also appear in this wallet and history." },
    accSynced:{ vi:"✓ đồng bộ bot", en:"✓ synced with bot" },
    accUnsync:{ vi:"chưa đồng bộ", en:"not synced" },
    ordUnit:{ vi:" đơn", en:" orders" },
    viaWeb:{ vi:"Tài khoản web", en:"Web account" },
    sending:{ vi:"Đang gửi…", en:"Sending…" },
    eyeShow:{ vi:"Hiện mật khẩu", en:"Show password" },
    eyeHide:{ vi:"Ẩn mật khẩu", en:"Hide password" },
    authErrUser:{ vi:"Tên đăng nhập 4–24 ký tự, chỉ gồm chữ không dấu, số và dấu _.", en:"Username must be 4–24 characters: letters (no accents), numbers and _ only." },
    authErrPass:{ vi:"Mật khẩu tối thiểu 6 ký tự.", en:"Password must be at least 6 characters." },
    authErrPassEmpty:{ vi:"Mật khẩu không được để trống.", en:"Password must not be empty." },
    authPassPhLogin:{ vi:"Mật khẩu", en:"Password" },
    authPassPhReg:{ vi:"Mật khẩu (từ 6 ký tự)", en:"Password (6+ characters)" },
    /* Uiverse Phase 1: chu loader + nhan nut tim kiem (doi theo VN/EN) */
    loadingStock:{ vi:"Đang đồng bộ kho thật…", en:"Syncing the real warehouse…" },
    filterOnlyStock:{ vi:"Chỉ xem còn hàng", en:"In stock only" },
    clearSearch:{ vi:"Xoá tìm kiếm", en:"Clear search" },
    /* Admin — soi skin Acc Random (chỉ role=admin; xem mục ADMIN trong app.js) */
    adminToggle:{ vi:"Soi skin Acc Random", en:"Inspect Random skins" },
    adminSearchPh:{ vi:"Tìm skin Acc Random: nakroth ki, florentino, sss...", en:"Search Random skins: nakroth ki, florentino, sss..." },
    adminNoBackend:{ vi:"Chưa cấu hình Backend API — tính năng soi skin Acc Random chưa dùng được.", en:"Backend API is not configured — the admin Random-skin search is unavailable." },
    adminNoPerm:{ vi:"Không có quyền Admin.", en:"No admin permission." },
    adminLoadFail:{ vi:"Không nạp được module quản trị, thử tải lại trang.", en:"Could not load the admin module, please reload the page." },
    adminBack:{ vi:"← Quay lại tìm kiếm thường", en:"← Back to normal search" },
    adminLoading:{ vi:"Đang soi kho Random…", en:"Searching the Random warehouse…" },
    adminEmpty:{ vi:"Không tìm thấy Acc Random nào chứa từ khoá này.", en:"No Random account matches this keyword." },
    adminFound:{ vi:"Tìm thấy {n} acc Random", en:"Found {n} Random accounts" },
    adminMore:{ vi:"Tải thêm", en:"Load more" },
    adminTier:{ vi:"Bậc skin", en:"Skin tiers" },
    authErrMatch:{ vi:"Mật khẩu nhập lại không khớp.", en:"Passwords do not match." },
    authErrGeneric:{ vi:"Sai tên đăng nhập hoặc mật khẩu.", en:"Wrong username or password." },
    authNoBackend:{ vi:"Chưa cấu hình backend — đăng nhập bằng tài khoản web chưa dùng được. Đăng nhập bằng Telegram bên dưới nhé.", en:"Backend is not configured yet — web-account login is unavailable. Log in with Telegram below." },
    netErr:{ vi:"Không kết nối được máy chủ. Kiểm tra lại mạng hoặc thử lại sau.", en:"Cannot reach the server. Check your connection and try again." },
    authWelcome:{ vi:"Chào ", en:"Welcome " },
    balWebSynced:{ vi:"✓ Số dư thật từ máy chủ", en:"✓ Real balance from server" },
    accSyncedWeb:{ vi:"✓ số dư thật (máy chủ)", en:"✓ real balance (server)" },
    accNoteWeb:{ vi:"Tài khoản web có ví riêng trên máy chủ. Muốn nhận acc qua Telegram, mở bot @devbn_bot và liên kết tài khoản.", en:"Web accounts have their own wallet on the server. To receive accounts via Telegram, open the bot @devbn_bot and link your account." },
    cardNoBackend:{ vi:"Chưa cấu hình backend: nạp thẻ đang chạy ở chế độ demo — thẻ không được gạch thật, số dư chỉ là demo.", en:"Backend not configured: card top-up is running in demo mode — cards are not really charged, the balance is only a demo." },
    cardNeedBoth:{ vi:"Nhập đủ số seri và mã thẻ.", en:"Enter both the serial and the card code." },
    cardBadFormat:{ vi:"Seri (10–16 số) và mã thẻ (10–15 số) chỉ gồm chữ số — kiểm tra lại.", en:"Serial (10–16 digits) and card code (10–15 digits) must be digits only — please check." },
    cardDemoSent:{ vi:"Đã gửi thẻ (demo) — trạng thái: Chờ xử lý.", en:"Card sent (demo) — status: Pending." },
    cardDemoOk:{ vi:"Nạp thẻ demo thành công! Cộng ", en:"Demo card top-up succeeded! Added " },
    cardDemoNote:{ vi:"Demo — chưa qua máy chủ", en:"Demo — not via server" },
    cardSentOk:{ vi:"Đã gửi thẻ lên máy chủ — trạng thái: Chờ xử lý. Tiền sẽ cộng sau khi cổng thẻ xác nhận.", en:"Card sent to the server — status: Pending. The balance will be credited once the card gateway confirms." },
    cardSendFail:{ vi:"Gửi thẻ thất bại", en:"Failed to send the card" },
    discRate:{ vi:"chiết khấu {r}% · thực nhận {v} / 100.000đ", en:"fee {r}% · you get {v} per 100,000đ" },
    cardExpectedA:{ vi:"Thực nhận dự kiến: ", en:"Estimated credit: " },
    cardExpectedB:{ vi:" (chiết khấu {r}%) — số tiền thật do máy chủ tính.", en:" (fee {r}%) — the server computes the final amount." },
    ciOkA:{ vi:"Điểm danh thành công! Cộng ", en:"Check-in successful! Added " },
    ciOkB:{ vi:" vào ví · Số dư mới: ", en:" to your wallet · New balance: " },
    ciAlready:{ vi:"Bạn đã điểm danh hôm nay rồi. Quay lại ngày mai nhé.", en:"You already checked in today. Come back tomorrow." },
    ciErrGeneric:{ vi:"Điểm danh thất bại. Thử lại sau.", en:"Check-in failed. Please try again." },
    /* Mua acc truc tiep tren web (tra tk|mk ngay) */
    buyWebProcessing:{ vi:"Đang xử lý mua hàng…", en:"Processing your purchase…" },
    buyWebSoldOut:{ vi:"Acc này vừa được người khác mua mất rồi.", en:"This account was just sold to someone else." },
    buyWebFail:{ vi:"Mua trên web hiện không dùng được — chuyển sang mua trong bot nhé.", en:"Web purchase is unavailable right now — please buy in the bot instead." },
    buyOneTime:{ vi:"Lưu lại ngay — tài khoản và mật khẩu chỉ hiện một lần duy nhất ở đây.", en:"Save these now — the username and password are only shown once here." }
  };
  function L(k){ var d = DYN[k]; return d ? (d[state.lang] || d.vi) : k; }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function prefersReduced(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  /* Cuộn về đầu NGAY LẬP TỨC (không smooth): html{scroll-behavior:smooth} làm
     cả window.scrollTo() thường cũng trượt mượt — tắt tạm rồi trả lại. */
  function instantScrollTop(){
    if (window.__lenis){ window.__lenis.scrollTo(0, { immediate:true }); return; }
    var de = document.documentElement, prev = de.style.scrollBehavior;
    de.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    de.style.scrollBehavior = prev;
  }
  /* Toast Sonner-style: container phai tren, toi da 3 item, tu dong dong sau 2.6s.
     type: "success" | "info" | "warning" | "error". Mac dinh "success" de giu
     tuong thich voi cac loi goi cu toast(msg). */
  var TOAST_ICONS = { success:"✓", info:"ℹ", warning:"⚠", error:"✕" };
  function toast(msg, type){
    var c = $("#toastContainer"); if(!c) return;
    var t = (type && TOAST_ICONS[type]) ? type : "success";
    var item = document.createElement("div");
    item.className = "toast-item toast-" + t;
    var ic = document.createElement("span");
    ic.className = "toast-ic"; ic.textContent = TOAST_ICONS[t]; ic.setAttribute("aria-hidden", "true");
    var tx = document.createElement("span");
    tx.className = "toast-tx"; tx.textContent = msg;
    var bar = document.createElement("span");
    bar.className = "toast-bar"; bar.setAttribute("aria-hidden", "true");
    item.appendChild(ic); item.appendChild(tx); item.appendChild(bar);
    c.appendChild(item);
    while(c.children.length > 3) c.removeChild(c.firstChild);
    requestAnimationFrame(function(){ item.classList.add("show"); });
    setTimeout(function(){
      item.classList.add("hide");
      setTimeout(function(){ if(item.parentNode) item.parentNode.removeChild(item); }, 340);
    }, 2600);
  }
  function nowStr(){
    var d = new Date();
    return d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) + " · " + d.toLocaleDateString("vi-VN");
  }
  function randCode(prefix){
    return prefix + Math.random().toString(36).slice(2,8).toUpperCase();
  }

  /* ================= THEME (mac dinh TOI; luu lua chon vao localStorage) ================= */
  var THEME_KEY = "anhdev_theme";
  function readSavedTheme(){
    try { var t = localStorage.getItem(THEME_KEY); return (t === "light" || t === "dark") ? t : null; } catch (e) { return null; }
  }
  function applyThemeButtons(){
    var dark = document.documentElement.getAttribute("data-theme") !== "light";
    $("#themeDark").classList.toggle("on", dark);
    $("#themeLight").classList.toggle("on", !dark);
  }
  function setTheme(t){
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* trinh duyet chan localStorage */ }
    applyThemeButtons();
  }
  (function initTheme(){
    var saved = readSavedTheme();
    document.documentElement.setAttribute("data-theme", saved || "dark");
    applyThemeButtons();
  })();
  $("#themeLight").addEventListener("click", function(){ setTheme("light"); });
  $("#themeDark").addEventListener("click", function(){ setTheme("dark"); });

  /* ================= NAV / VIEWS ================= */
  /* ============ NAV: 1 NGUỒN SỰ THẬT DUY NHẤT CHO MỤC ĐANG ACTIVE ============
     Trước đây showView() tự toggle .active trên [data-nav] — nhưng nút "Kho acc"
     ở bottom-nav cũng có data-nav="home" nên "Trang Chủ" và "Kho acc" sáng cùng
     lúc; còn link danh mục (data-catlink) không có data-nav nên "Trang Chủ" cứ
     sáng mãi dù đang xem Random. Giờ chỉ setActiveNav() được phép đổi .active. */
  function setActiveNav(key){
    $$("#sidebar .nav-item, .bottom-nav button").forEach(function(b){ b.classList.remove("active"); });
    var sb = $("#sidebar"), bn = $(".bottom-nav");
    var mark = function(sel, root){ var el = root ? $(sel, root) : $(sel); if (el) el.classList.add("active"); };
    if (key === "home"){
      mark('.nav-item[data-nav="home"]:not([data-scroll])', sb);
      mark('button[data-nav="home"]:not([data-scroll])', bn);
    } else if (key === "home:products"){
      mark('.nav-item[data-nav="home"]:not([data-scroll])', sb);
      mark('button[data-nav="home"][data-scroll="products"]', bn);
    } else if (key === "orders" || key === "leaderboard" || key === "invoices"){
      mark('.nav-item[data-nav="' + key + '"]', sb);
      mark('button[data-nav="' + key + '"]', bn);
    } else if (key === "account"){
      mark('button[data-nav="account"]', bn);
    } else if (key === "topup:qr" || key === "topup:card"){
      var tab = key.split(":")[1];
      mark('.nav-item[data-nav="topup"][data-tab="' + tab + '"]', sb);
      mark('button[data-nav="topup"]', bn);
    } else if (key && key.indexOf("cat:") === 0){
      var cat = key.slice(4);
      mark('.nav-item[data-catlink="' + cat + '"]', sb);
      mark('button[data-nav="home"][data-scroll="products"]', bn);
      /* Giữ submenu "Mua Tài Khoản" mở khi đang xem 1 danh mục con. */
      var sub = $("#buySubmenu"), tog = $("#buyMenuToggle");
      if (sub) sub.classList.add("open");
      if (tog){ tog.classList.add("open"); tog.setAttribute("aria-expanded", "true"); }
    }
    /* "payment" và các key lạ: không mục nào sáng — đúng vì đó không phải tab nav. */
  }
  function navKeyForView(name){
    if (name === "topup") return "topup:" + (state.topupTab || "qr");
    return name; /* home | orders | leaderboard | invoices | account | payment */
  }
  function navKeyForClick(btn){
    var name = btn.getAttribute("data-nav");
    var tb = btn.getAttribute("data-tab");
    if (name === "topup") return "topup:" + (tb || state.topupTab || "qr");
    if (btn.getAttribute("data-scroll")) return "home:products";
    return name;
  }
  /* ============ CHUYỂN VIEW NGUYÊN TỬ (KHÔNG FLASH VỀ TRANG CHỦ) ============
     NGUYÊN NHÂN GỐC CỦA BUG: showView() cũ luôn window.scrollTo({top:0,
     behavior:"smooth"}) — rồi handler [data-catlink]/[data-scroll] lại
     setTimeout(60ms) scrollIntoView(#products). Hai lần cuộn mượt nối nhau:
     trang trượt lên đầu (thấy hero Trang Chủ) rồi mới trượt xuống kho.
     Sửa: đổi view trong 1 lần DOM duy nhất; view khác thì về đầu NGAY LẬP TỨC
     (không animation); ở Trang Chủ mà có đích cuộn thì cuộn THẲNG tới đích,
     không qua đầu trang, không setTimeout. Modal không đụng tới scroll. */
  function showView(name, opts){
    opts = opts || {};
    $$(".view").forEach(function(v){ v.classList.remove("active"); });
    var el = $("#view-" + name); if (el) el.classList.add("active");
    if (opts.navKey !== false) setActiveNav(opts.navKey || navKeyForView(name));
    closeSidebar();
    if (opts.targetId){
      var t = document.getElementById(opts.targetId);
      if (t) t.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
    } else {
      instantScrollTop();
    }
    // Quay lại shop / ví → lấy lại số dư thật từ bot.
    if ((name === "home" || name === "topup" || name === "account") && state.user) refreshWebBalance();
    if (name === "orders"){ renderOrders(); refreshBackendOrders(); }
    if (name === "invoices"){ renderInvoices(); refreshBackendInvoices(); }
    if (name === "account") renderAccount();
    if (name === "leaderboard") renderLeaderboard();
  }
  document.addEventListener("click", function(e){
    var navBtn = e.target.closest("[data-nav]");
    if (navBtn){
      var name = navBtn.getAttribute("data-nav");
      var tb = navBtn.getAttribute("data-tab");
      showView(name, { targetId: navBtn.getAttribute("data-scroll") || null, navKey: navKeyForClick(navBtn) });
      if (tb) setTopupTab(tb);
      return;
    }
    var scBtn = e.target.closest("[data-scroll]");
    if (scBtn){
      showView("home", { targetId: scBtn.getAttribute("data-scroll"), navKey: "home:products" });
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
    var note;
    if (BALANCE.synced){
      note = BALANCE.web ? L("balWebSynced")
        : ("✓ Đồng bộ bot" + coinsLine + (BALANCE.updatedAt ? " · " + BALANCE.updatedAt : ""));
    } else {
      note = state.user ? "Chưa đồng bộ với bot — số dư demo trên trình duyệt"
        : "Chưa đăng nhập — đăng nhập để đồng bộ ví";
    }
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
    // Badge "Giảm x%" ở thẻ số dư: lấy từ discount_percent của tài khoản web.
    var db = $("#discountBadge");
    if (db) db.textContent = state.lang === "en" ? (state.discount + "% off") : ("Giảm " + state.discount + "%");
    // Hook cho animations.js: số dư thay đổi -> ticker + tia sáng viền.
    document.dispatchEvent(new CustomEvent("anhdev:balance", { detail:{ value: state.balance, synced: BALANCE.synced } }));
    refreshMoneyLabels();
  }
  /* Nhãn tiền tệ động: mọi chuỗi "đ" cứng trong HTML đều được vẽ lại bằng fmt()
     mỗi khi đổi tiền tệ / ngôn ngữ — badge điểm danh, label/hint nạp tiền,
     các nút chọn mệnh giá. */
  function refreshMoneyLabels(){
    var b = $("#checkinBadge");
    if (b) b.textContent = fmt(1) + "–" + fmt(500);
    var sub = $("#ciSub");
    if (sub) sub.textContent = state.lang === "en"
      ? "Check in once a day to receive a random " + fmt(1) + "–" + fmt(500) + " straight into your wallet."
      : "Mỗi ngày điểm danh 1 lần, nhận ngẫu nhiên " + fmt(1) + "–" + fmt(500) + " cộng thẳng vào ví.";
    var unit = state.currency === "USD" ? "$" : "đ";
    var amtL = $("[data-i18n=\"amtLabel\"]");
    if (amtL) amtL.textContent = (state.lang === "en" ? "Top-up amount (" : "Số tiền nạp (") + unit + ")";
    var amtH = $("[data-i18n=\"amtHint\"]");
    if (amtH) amtH.textContent = state.lang === "en"
      ? "Minimum " + fmt(1000) + ". After creating the invoice, transfer the exact amount with the invoice code as the note — SePay credits the right wallet automatically."
      : "Tối thiểu " + fmt(1000) + ". Tạo hoá đơn xong, chuyển khoản đúng số tiền và ghi đúng nội dung là mã hoá đơn — SePay tự cộng tiền vào đúng ví của bạn.";
    $$("#amountGrid .amount-btn").forEach(function(x){
      var v = parseInt(x.getAttribute("data-amt"), 10);
      if (!isNaN(v)) x.textContent = fmt(v);
    });
    $$("#cardAmount option").forEach(function(o){
      var v = parseInt(o.value, 10);
      if (!isNaN(v)) o.textContent = fmt(v);
    });
    if (typeof renderCardDiscount === "function") renderCardDiscount();
    if (typeof updateCardExpected === "function") updateCardExpected();
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
      state.balance = 0; state.coins = 0; state.discount = 0;
      state.checkin = null; state.checkinDone = false;
      BALANCE.synced = false; BALANCE.web = false; BALANCE.updatedAt = null;
      state.userRole = null;
      state.orders = []; // đăng xuất: xoá đơn khỏi bộ nhớ
      teardownAdminModule(); // đăng xuất: xoá sạch dữ liệu + DOM admin khỏi RAM
      clearWebToken(true); // đăng xuất tài khoản web ở backend (nếu đang có phiên web)
      saveUser(null);
    } else if (u.web){
      state.discount = (typeof u.discount_percent === "number") ? u.discount_percent : state.discount;
      /* Đổi tài khoản sang acc thường khi module admin đang nạp: gỡ admin ngay. */
      if (u.role && u.role !== "admin") teardownAdminModule();
      saveUser(null); // phiên web thắng: xoá phiên Telegram đã lưu để lần mở sau không nhảy lại
      loadWebOrders(); refreshBackendOrders(); // đơn web: khôi phục từ localStorage + đồng bộ từ backend
    } else {
      state.discount = 0; // tài khoản Telegram: mức giảm giá lấy từ bot, không dùng discount web
      clearWebToken(false); // phiên Telegram thắng: xoá token web đã lưu (không gọi logout backend)
      saveUser(u);
    }
    refreshUserUI(); renderAccount();
    loadInvoices();
    if (u) resumePendingDeposit();
  }

  /* ================= PRODUCTS ================= */
  /* Xáo trộn thứ tự hiển thị (Fisher-Yates) — acc random + sẵn thông tin +
     trắng không còn xếp theo mã/giá cố định, lúc nào cũng có acc khác lên
     đầu trang. Thứ tự đã xáo được giữ nguyên trong phiên (phân trang ổn
     định); chỉ xáo lại khi kho tải lại hoặc khi chọn kiểu sắp xếp "shuffle". */
  function shuffleArray(arr){
    for (var i = arr.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function visibleProducts(){
    var f = state.filter;
    var list = PRODUCTS.filter(function(p){
      if (isSoldCode(p.code)) return false; // acc da ban tren web — an khoi luoi
      if (f.cat !== "all" && p.cat !== f.cat) return false;
      if (f.onlyStock && p.stock <= 0) return false;
      if (f.q){
        // Lọc trên _searchKey đã chuẩn hoá sẵn lúc index (chỉ còn indexOf, <15ms cho 12k acc).
        // Random chỉ có từ chung chung trong _searchKey nên gõ tên skin không bao giờ
        // moi được acc random ra — chống cherry-pick.
        var hay = p._searchKey || normText(p.name + " " + p.desc);
        var words = expandQueryTokens(f.q);
        for (var i = 0; i < words.length; i++){
          if (hay.indexOf(words[i]) === -1) return false;
        }
      }
      return true;
    });
    /* sort "shuffle"/"default": giữ nguyên thứ tự gốc của PRODUCTS — thứ tự
       này đã được xáo trộn lúc kho tải về (xem useLiveStock/useDemoStock),
       nên lưới mặc định là xáo trộn, không xếp theo mã hay giá. */
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
      ? '<button class="buy-btn uiv-shine-btn" data-buy="' + p.id + '">' + L("buyNow") + '</button>'
      : '<button class="buy-btn out" disabled>' + L("soldOut") + '</button>';
    return '<article class="card" data-cat="' + esc(p.cat) + '">' + head +
      '<div class="card-body"><div class="name">' + esc(p.name) + '</div><div class="desc">' + esc(p.desc) + '</div>' +
      '<div class="card-meta">' + stockHtml(p) + priceHtml(p) + '</div>' + btn + '</div></article>';
  }
  var CATS_EN = {
    "random-tele": { title:"Random Accounts", sub:"Telegram Warehouse" },
    "detail":      { title:"Ready-info Accounts", sub:"Telegram Warehouse" },
    "white":       { title:"White Accounts", sub:"Telegram Warehouse" },
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
  /* Chèn HTML đã build vào #productArea qua DocumentFragment — 1 lần append,
     tránh nhiều lần reflow khi render. (Chuỗi HTML vẫn build bằng cardHtml/esc
     như cũ nên không đổi hành vi XSS-safe.) */
  function setAreaHtml(area, html){
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    var frag = document.createDocumentFragment();
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    area.textContent = "";
    area.appendChild(frag);
  }
  function renderProducts(){
    /* Đang hiển thị kết quả soi skin Acc Random: module admin tự quản lý
       #productArea, render thường tạm nghỉ để không ghi đè kết quả admin. */
    if (state.adminSearchActive) return;
    var list = visibleProducts();
    var area = $("#productArea");
    $("#prodCount").textContent = list.length + " / " + PRODUCTS.length + (state.lang === "en" ? " products" : " sản phẩm");
    if (!list.length){
      /* Có từ khoá tìm kiếm mà không ra acc nào -> báo "không tìm thấy" (đừng báo
         "kho hết hàng" gây hiểu nhầm là kho trống, trong khi kho vẫn có 12k acc). */
      if ((SYNC.mode === "live" || SYNC.mode === "saved") && !state.filter.q){
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
        setAreaHtml(area, '<div class="grid">' + list.map(cardHtml).join("") + '</div>');
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
      setAreaHtml(area, html);
      return;
    }
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.filter.page > totalPages) state.filter.page = totalPages;
    if (state.filter.page < 1) state.filter.page = 1;
    var start = (state.filter.page - 1) * PAGE_SIZE;
    var pageItems = list.slice(start, start + PAGE_SIZE);
    setAreaHtml(area, '<div class="grid">' + pageItems.map(cardHtml).join("") + '</div>' + pagerHtml(list.length, totalPages, start));
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
  /* ================= TÌM KIẾM THÔNG MINH (autocomplete + index 1 lần) =================
     Index build 1 lần sau mỗi lần PRODUCTS thay đổi (kho thật / catalog mẫu).
     CHỐNG LỘ ACC RANDOM: index chỉ đọc các field CÔNG KHAI của PRODUCTS
     (đã qua apiProduct() — acc random chỉ còn tên "Acc LQxxxx" + mô tả chung),
     KHÔNG BAO GIỜ đọc field gốc của stock.json (rank/skin/desc gốc của acc
     random). Gõ tên skin không thể moi acc random ra khỏi kho. */
  /* ==SEARCH-CORE-BEGIN== */
  function normText(s){
    /* Bỏ dấu tiếng Việt + chữ thường. Độ dài chuỗi giữ nguyên với tiếng Việt
       (mỗi ký tự có dấu tách thành base + dấu kết hợp, loại dấu còn đúng 1 ký
       tự) nên vị trí highlight map 1:1 về chuỗi gốc. */
    return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  }
  /* Alias tốc ký Liên Quân — THÊM ALIAS MỚI TẠI ĐÂY (key: từ người dùng gõ,
     value: từ chuẩn). Key/value đều được normText() trước khi so khớp. */
  var SEARCH_ALIASES = {
    nak:"nakroth", flo:"florentino", mu:"murad", lili:"liliana", vio:"violet",
    tel:"tel'annas", raz:"raz", tul:"tulen", lau:"lauriel", tri:"triệu vân",
    ngo:"ngộ không", ngokhong:"ngộ không", but:"butterfly", ryo:"ryoma",
    yan:"yan", val:"valhein"
  };
  var SEARCH_INDEX = { phrases:{}, popular:[], built:false, updatedAt:null };
  function expandToken(tok){
    var a = SEARCH_ALIASES[tok];
    return a ? normText(a) : tok;
  }
  /* Tách query thành token đã mở alias (alias nhiều từ như "triệu vân" tách tiếp). */
  function expandQueryTokens(q){
    var out = [];
    normText(q).split(/\s+/).forEach(function(t){
      if (!t) return;
      expandToken(t).split(/\s+/).forEach(function(w){ if (w) out.push(w); });
    });
    return out;
  }
  var TIER_LABEL = { "sss":"SSS", "ss+":"SS+", "ss":"SS", "s+":"S+", "ssm":"SSM", "anime":"Anime" };
  var TIER_RES = [
    ["sss", /(^|[^a-z0-9])sss([^a-z0-9]|$)/],
    ["ss+", /(^|[^a-z0-9])ss\+([^a-z0-9]|$)/],
    ["ss", /(^|[^a-z0-9])ss(?!\+)([^a-z0-9]|$)/],
    ["s+", /(^|[^a-z0-9])s\+([^a-z0-9]|$)/],
    ["ssm", /(^|[^a-z0-9])ssm([^a-z0-9]|$)/],
    ["anime", /(^|[^a-z0-9])anime([^a-z0-9]|$)/]
  ];
  var STOP_WORDS = { acc:1, random:1, skin:1, "tài":1, "khoản":1, "khoan":1 };
  /* Tách mô tả CÔNG KHAI của 1 sản phẩm thành các cụm có thể gợi ý:
     tên skin đầy đủ ("Nakroth Thứ Nguyên Vệ Thần"), tên tướng (từ đầu của
     tên skin), bậc skin (SSS/SS/...) có thật trong acc, rank ("Cao Thủ"). */
  function extractPhrases(p){
    var found = {};
    var text = (p.name || "") + " · " + (p.desc || "");
    var norm = normText(text);
    /* Bậc skin: chỉ tính khi acc có >=1 skin bậc đó ("sss:2" trong mô tả). */
    var m, re = /\b(sss|ss\+|ss|s\+|ssm|anime)\s*:\s*(\d+)/g;
    while ((m = re.exec(norm))){
      if (parseInt(m[2], 10) > 0) found[TIER_LABEL[m[1]] || m[1]] = true;
    }
    /* Bậc skin trong tên gói mẫu ("100% Skin SSS") — CHỈ áp cho gói demo
       (kind "pack"): acc thật lấy bậc từ chuỗi ":số" ở trên. Nhãn
       "[100% Skin SS / SS+]" trong mô tả acc thật là tên NHÓM chung, không có
       nghĩa acc có đủ cả 2 bậc (vd có acc ss+:0 nhưng vẫn mang nhãn đó) nên
       không được quét nhãn này — nếu không số acc SS+ sẽ bị đội lên. */
    if (p.kind === "pack"){
      var normNoStats = norm.replace(/\([^)]*(?:sss|ss\+|ss|s\+|ssm|anime)\s*:\s*\d[^)]*\)/g, "");
      TIER_RES.forEach(function(pair){
        if (pair[1].test(normNoStats)) found[TIER_LABEL[pair[0]]] = true;
      });
    }
    /* Rank: "Rank Cao Thủ" -> "Cao Thủ". */
    var rm = /(?:^|·)\s*rank\s+([^·—]+)/i.exec(p.desc || "");
    if (rm){
      var rank = rm[1].trim().replace(/\s+/g, " ");
      if (rank) found[rank] = true;
    }
    /* Tên skin: mỗi đoạn sau "·" rồi tách "," — bỏ các đoạn đếm (Rank/Lv/N tướng/N skin)
       và đoạn thống kê [Skin thường...] (sss:0...). Mỗi tên skin -> cụm đầy đủ +
       từ đầu tiên (= tên tướng). */
    /* Tên sản phẩm (gói demo): cả tên là 1 cụm ("Random Tài Khoản 100% Có Skin
       Thứ Nguyên Vệ Thần", dài tới 60 ký tự). Acc thật có tên là mã LQxxxxx —
       đã loại ở dưới. Tên không tách từ đầu (= tên tướng) vì từ đầu của tên
       gói luôn là từ chung ("Random", "100%"). */
    var namePh = (p.name || "").trim().replace(/\s+/g, " ").replace(/\s*\[[^\]]*\]\s*$/, "").trim();
    if (namePh && namePh.length >= 2 && namePh.length <= 60 && !/^acc\s+[a-z]{0,3}\d+$/i.test(namePh)) found[namePh] = true;
    (p.desc || "").split("·").forEach(function(seg){
      if (/^\s*(rank|lv\b|\d+\s*tướng|\d+\s*skin)/i.test(seg)) return;
      if (/\[skin thường/i.test(seg)) return;
      /* Cắt câu sau dấu "—" TRƯỚC khi tách "," — nếu không, đuôi câu của mô tả
         chung ("..., không xem trước thông tin") sẽ thành cụm gợi ý rác. */
      seg.split("—")[0].split(",").forEach(function(part){
        var ph = part.trim().replace(/\s+/g, " ");
        ph = ph.replace(/^[\(\[][^\)\]]*[\)\]]\s*/, "").replace(/\s*\[[^\]]*\]\s*$/, "").trim();
        if (!ph || ph.length < 2 || ph.length > 40 || /^\d+$/.test(ph)) return;
        if (/^acc\s+[a-z]{0,3}\d+$/i.test(ph)) return; /* mã acc (LQxxxxx) không làm gợi ý */
        if (ph.indexOf(" ") === -1 && STOP_WORDS[normText(ph)]) return;
        found[ph] = true;
        var first = ph.split(" ")[0];
        if (first && first.length >= 2 && !/^\d/.test(first) && !STOP_WORDS[normText(first)]) found[first] = true;
      });
    });
    return Object.keys(found);
  }
  /* Chỉ chuẩn hoá _searchKey (không build lại cụm) — dùng khi kho về lại đúng
     bản đã index rồi (cache + mạng trùng updated_at). */
  function keyProducts(list){
    list.forEach(function(p){ p._searchKey = normText((p.name || "") + " " + (p.desc || "")); });
  }
  function buildSearchIndex(){
    keyProducts(PRODUCTS);
    var phrases = {};
    PRODUCTS.forEach(function(p){
      extractPhrases(p).forEach(function(ph){
        var key = normText(ph);
        if (!key) return;
        if (!phrases[key]) phrases[key] = { label: ph, count: 0, norm: key };
        phrases[key].count++;
      });
    });
    /* Cụm tên danh mục ("Acc sẵn thông tin", "Random Liên Quân", ...) */
    Object.keys(CATS).forEach(function(cat){
      var n = 0;
      PRODUCTS.forEach(function(p){ if (p.cat === cat) n++; });
      if (!n) return;
      var label = CATS[cat].title, key = normText(label);
      if (!phrases[key]) phrases[key] = { label: label, count: 0, norm: key };
      phrases[key].count = Math.max(phrases[key].count, n);
    });
    var all = Object.keys(phrases).map(function(k){ return phrases[k]; });
    /* Từ khoá phổ biến: top tướng/skin/bậc theo số acc, bỏ cụm danh mục chung. */
    var generic = { "acc random":1, "acc san thong tin":1, "random tai khoan lien quan":1, "san pham so":1 };
    var popular = all.filter(function(e){ return !generic[e.norm]; })
      .sort(function(a, b){ return b.count - a.count || (a.label < b.label ? -1 : 1); })
      .slice(0, 6);
    SEARCH_INDEX = { phrases: phrases, popular: popular, built: true, updatedAt: SYNC.updatedAt || null };
  }
  /* Gợi ý 6–8 cụm: (1) prefix nguyên cụm -> (2) mọi token là tiền tố của 1 từ
     trong cụm -> (3) mọi token là chuỗi con; trong cùng hạng thì số acc nhiều
     lên trước. Chỉ cụm có >=1 acc (mọi cụm trong index đều có >=1). */
  function searchSuggestions(q){
    var nq = normText(q).trim();
    if (!nq) return { type: "popular", items: SEARCH_INDEX.popular };
    var tokens = expandQueryTokens(q);
    var cands = [];
    Object.keys(SEARCH_INDEX.phrases).forEach(function(key){
      var e = SEARCH_INDEX.phrases[key];
      var words = e.norm.split(/\s+/);
      var ok = tokens.every(function(t){
        return words.some(function(w){ return w.indexOf(t) !== -1; });
      });
      if (!ok) return;
      var rank;
      if (e.norm.indexOf(nq) === 0) rank = 0;
      else if (tokens.every(function(t){ return words.some(function(w){ return w.indexOf(t) === 0; }); })) rank = 1;
      else rank = 2;
      cands.push({ e: e, rank: rank });
    });
    cands.sort(function(a, b){
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (b.e.count !== a.e.count) return b.e.count - a.e.count;
      return a.e.label < b.e.label ? -1 : 1;
    });
    return { type: "suggest", items: cands.slice(0, 8).map(function(c){ return c.e; }) };
  }
  /* Vị trí các đoạn khớp trong chuỗi đã chuẩn hoá (để bold trên chuỗi gốc). */
  function highlightRanges(normLabel, rawTokens){
    var ranges = [];
    rawTokens.forEach(function(t){
      if (!t) return;
      var idx = 0;
      for (;;){
        var i = normLabel.indexOf(t, idx);
        if (i === -1) break;
        ranges.push([i, i + t.length]);
        idx = i + t.length;
      }
    });
    ranges.sort(function(a, b){ return a[0] - b[0]; });
    var merged = [];
    ranges.forEach(function(r){
      var last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    });
    return merged;
  }
  /* ==SEARCH-CORE-END== */
  /* Bold đoạn khớp bằng DOM node (createTextNode + <strong>), KHÔNG innerHTML. */
  function labelWithHighlight(label, ranges){
    var frag = document.createDocumentFragment();
    if (!ranges.length || label.length !== normText(label).length){
      frag.appendChild(document.createTextNode(label));
      return frag;
    }
    var pos = 0;
    ranges.forEach(function(r){
      if (r[0] > pos) frag.appendChild(document.createTextNode(label.slice(pos, r[0])));
      var st = document.createElement("strong");
      st.textContent = label.slice(r[0], r[1]);
      frag.appendChild(st);
      pos = r[1];
    });
    if (pos < label.length) frag.appendChild(document.createTextNode(label.slice(pos)));
    return frag;
  }
  var sugBox = null, sugInput = null, sugActive = -1, sugItems = [], sugTimer = null, sugOpen = false;
  function sugIconSvg(){
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "11"); c.setAttribute("cy", "11"); c.setAttribute("r", "7");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "m20 20-3.8-3.8");
    svg.appendChild(c); svg.appendChild(p);
    return svg;
  }
  function closeSuggest(){
    if (!sugBox) return;
    sugOpen = false; sugActive = -1; sugItems = [];
    sugBox.classList.remove("open");
    sugBox.hidden = true;
    if (sugInput) sugInput.setAttribute("aria-expanded", "false");
  }
  function openSuggest(){
    if (!sugBox) return;
    sugOpen = true;
    sugBox.hidden = false;
    requestAnimationFrame(function(){ if (sugBox) sugBox.classList.add("open"); });
    if (sugInput) sugInput.setAttribute("aria-expanded", "true");
  }
  function renderSuggest(res, rawQuery){
    if (!sugBox) return;
    sugBox.textContent = "";
    sugItems = res.items || [];
    sugActive = -1;
    if (!sugItems.length){ closeSuggest(); return; }
    if (res.type === "popular"){
      var head = document.createElement("div");
      head.className = "sug-head";
      head.textContent = L("sugPopular");
      sugBox.appendChild(head);
    }
    var rawTokens = normText(rawQuery).split(/\s+/).filter(Boolean);
    sugItems.forEach(function(it){
      var row = document.createElement("button");
      row.type = "button";
      row.className = "sug-row";
      row.setAttribute("role", "option");
      var ic = document.createElement("span");
      ic.className = "sug-ic";
      ic.appendChild(sugIconSvg());
      row.appendChild(ic);
      var lb = document.createElement("span");
      lb.className = "sug-label";
      if (res.type === "suggest") lb.appendChild(labelWithHighlight(it.label, highlightRanges(it.norm, rawTokens)));
      else lb.textContent = it.label;
      row.appendChild(lb);
      var ct = document.createElement("span");
      ct.className = "sug-count";
      ct.textContent = it.count.toLocaleString("vi-VN") + " acc";
      row.appendChild(ct);
      row.addEventListener("mousedown", function(e){
        e.preventDefault(); /* chặn blur input trước khi chọn kịp chạy */
        applySuggestion(it.label);
      });
      sugBox.appendChild(row);
    });
    openSuggest();
  }
  function applySuggestion(label){
    if (!sugInput) return;
    sugInput.value = label;
    syncUivClearBtn();
    state.filter.q = label.trim();
    state.filter.page = 1;
    closeSuggest();
    renderProducts();
    if (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) sugInput.blur();
  }
  function updateSuggest(){
    /* Chế độ soi skin admin: gợi ý thường (lấy từ dữ liệu công khai) phải
       ẩn — module admin tự xử lý query, không gợi ý skin random cho khách. */
    if (adminSearchMode){ closeSuggest(); return; }
    if (!SEARCH_INDEX.built || !sugInput) return;
    var q = sugInput.value;
    renderSuggest(searchSuggestions(q), q);
  }
  /* ================= UIVERSE — GLOW SEARCH: nut × + nut filter (Phase 1) ====
     Nut × tuy chinh (#uivSearchClear): hien khi o co chu, bam thi xoa + chay
     lai luong reset cua su kien "search" hien co. Nut filter (#uivFilterBtn):
     <button> that, bat/tat loc "Chi xem con hang" bang cach bam lai
     #stockToggle (1 nguon su that) roi dong bo trang thai hien thi. */
  function syncUivClearBtn(){
    var b = $("#uivSearchClear");
    if (!b || !sugInput) return;
    b.hidden = !sugInput.value.trim();
  }
  function syncUivFilterBtn(){
    var b = $("#uivFilterBtn");
    if (!b) return;
    var on = !!state.filter.onlyStock;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
  function initSearch(){
    sugBox = $("#searchSuggest");
    sugInput = $("#searchInput");
    if (!sugBox || !sugInput) return;
    /* Nut × tuy chinh: xoa o tim kiem + reset luong loc nhu su kien "search". */
    var uivClearBtn = $("#uivSearchClear");
    if (uivClearBtn) uivClearBtn.addEventListener("click", function(){
      if (!sugInput) return;
      sugInput.value = "";
      syncUivClearBtn();
      sugInput.focus();
      sugInput.dispatchEvent(new Event("search"));
    });
    /* Nut filter that: bat/tat loc "Chi xem con hang" (dung lai #stockToggle). */
    var uivFilterBtn = $("#uivFilterBtn");
    if (uivFilterBtn) uivFilterBtn.addEventListener("click", function(){
      var st = $("#stockToggle");
      if (st) st.click();
      syncUivFilterBtn();
    });
    syncUivClearBtn();
    syncUivFilterBtn();
    sugInput.addEventListener("input", function(){
      syncUivClearBtn();
      if (sugTimer) clearTimeout(sugTimer);
      sugTimer = setTimeout(function(){
        /* Chế độ soi skin admin đang BẬT: query đi qua module admin (API
           /api/admin/random-search kèm JWT), không chạy lọc thường. */
        if (adminSearchMode && adminQueryHandler){
          adminQueryHandler(sugInput.value.trim());
          return;
        }
        state.filter.q = sugInput.value.trim();
        state.filter.page = 1;
        renderProducts();
        updateSuggest();
      }, 120); /* debounce 120ms — gõ 60fps, không lọc 12k acc mỗi phím */
    });
    /* Nút × mặc định của input[type=search]: reset ngay, không chờ debounce. */
    sugInput.addEventListener("search", function(){
      syncUivClearBtn();
      if (sugTimer) clearTimeout(sugTimer);
      if (adminSearchMode && adminQueryHandler){
        adminQueryHandler("");
        return;
      }
      state.filter.q = "";
      state.filter.page = 1;
      renderProducts();
      updateSuggest();
    });
    sugInput.addEventListener("focus", function(){
      syncUivClearBtn();
      if (!sugInput.value.trim()) updateSuggest(); /* focus ô trống -> từ khoá phổ biến */
    });
    sugInput.addEventListener("keydown", function(e){
      if (!sugOpen){ if (e.key === "ArrowDown") updateSuggest(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp"){
        e.preventDefault();
        var rows = $$(".sug-row", sugBox);
        if (!rows.length) return;
        sugActive = e.key === "ArrowDown"
          ? (sugActive + 1) % rows.length
          : (sugActive - 1 + rows.length) % rows.length;
        rows.forEach(function(r, i){ r.classList.toggle("active", i === sugActive); });
      } else if (e.key === "Enter"){
        if (sugActive >= 0 && sugItems[sugActive]){
          e.preventDefault();
          applySuggestion(sugItems[sugActive].label);
        } else {
          closeSuggest(); /* Enter không chọn gợi ý -> lọc theo chữ đã gõ */
        }
      } else if (e.key === "Escape"){
        closeSuggest();
      }
    });
    document.addEventListener("click", function(e){
      if (sugOpen && sugBox && !sugBox.contains(e.target) && e.target !== sugInput){
        closeSuggest();
      }
    });
    document.addEventListener("focusin", function(e){
      if (sugOpen && sugBox && !sugBox.contains(e.target) && e.target !== sugInput){
        closeSuggest();
      }
    });
  }

  /* ================= ĐỒNG BỘ KHO THẬT (stock.json tĩnh) ================= */
  /* ==APIPRODUCT-BEGIN== */
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
    if (a.kind === "white"){
      // Acc trắng thông tin: tách riêng thành mục "white", KHÔNG gộp chung
      // với acc sẵn thông tin nữa. Chỉ hiện nhãn trắng + rank/level, không
      // kèm mô tả gốc (trong đó có ghi "acc ban" gây hiểu lầm cho khách).
      var wparts = ["Acc trắng thông tin"];
      if (a.rank) wparts.push("Rank " + a.rank);
      if (a.level) wparts.push("Lv " + a.level);
      return {
        id:"api-" + a.code, code:a.code, api:true,
        cat:"white",
        kind:"acc", name:"Acc " + a.code, desc:wparts.join(" · "),
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
  /* ==APIPRODUCT-END== */
  /* ================= UIVERSE — LIQUID LOADER (Phase 1) =================
     Loader hien trong banner #syncStatus khi dang dong bo kho va trong modal
     mua khi dang cho backend. Chu loader lay qua L() + data-uiv-loading nen
     doi VN/EN theo he thong i18n hien co (syncUivLoaderText() goi trong
     applyLang). Mau chu dung var(--ink) theo theme (xem uiverse.css). */
  function uivLoaderHtml(key){
    return '<div class="uiv-liquid-loader" role="status"><div class="uiv-loading-text"><span data-uiv-loading="' + key + '">' + esc(L(key)) + '</span><span class="uiv-dot">.</span><span class="uiv-dot">.</span><span class="uiv-dot">.</span></div><div class="uiv-loader-track"><div class="uiv-liquid-fill"></div></div></div>';
  }
  function syncUivLoaderText(){
    $$("[data-uiv-loading]").forEach(function(el){ el.textContent = L(el.getAttribute("data-uiv-loading")); });
  }
  function setSyncStatus(mode, text){
    SYNC.mode = mode;
    var el = $("#syncStatus");
    if (el){
      el.className = "sync-status " + mode;
      /* Dang dong bo: hien liquid loader (chu theo ngon ngu hien tai) thay
         cho dong chu don. Cac mode khac giu chu nhu cu. */
      if (mode === "syncing") el.innerHTML = uivLoaderHtml("loadingStock");
      else el.textContent = text;
      /* Banner cảnh báo kho mẫu đã gỡ: kho thật đang live nên không hiện banner
         đỏ "catalog mẫu" nữa. Khi stock.json lại mới, banner kho thật tự hiện lại. */
      el.hidden = (mode === "demo");
    }
  }
  function useLiveStock(data, label){
    var sameData = !!(SYNC.updatedAt && data.updated_at && SYNC.updatedAt === data.updated_at);
    var accs = (data.accounts || []).map(apiProduct);
    var prods = (data.products || []).map(apiProductForProduct);
    // Kho ve lai tu stock.json tinh: loc het acc da ban tren web (biet
    // qua SOLD_CODES) de chung khong hien lai sau moi lan sync.
    PRODUCTS = accs.concat(prods).filter(function(p){ return !isSoldCode(p.code); });
    // Xáo trộn thứ tự hiển thị ngay khi kho về — acc random + sẵn thông tin
    // (+ trắng) không còn xếp theo mã cố định; thứ tự này giữ nguyên trong
    // phiên nên phân trang ổn định, chỉ xáo lại khi kho tải lại hoặc khi
    // người dùng chọn kiểu sắp xếp "shuffle".
    shuffleArray(PRODUCTS);
    state.filter.page = 1;
    SYNC.updatedAt = data.updated_at || null;
    /* Kho về lại đúng bản đã index (cache + mạng trùng nhau) thì chỉ chuẩn hoá
       _searchKey cho object mới, khỏi build lại cụm. */
    if (sameData && SEARCH_INDEX.built) keyProducts(PRODUCTS);
    else buildSearchIndex();
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
    PRODUCTS = DEMO_PRODUCTS.slice();
    shuffleArray(PRODUCTS);
    buildSearchIndex();
    state.filter.page = 1;
    setSyncStatus("demo", "Không kết nối được kho thật — đang hiển thị catalog mẫu (không phải kho thật). Mua acc thật qua bot Telegram @devbn_bot.");
    renderProducts(); renderStats();
  }
  /* ===== CACHE stock.json BẰNG IndexedDB (stale-while-revalidate) =====
     stock.json ~15 MB — KHÔNG bỏ vào localStorage (chậm + giới hạn ~5 MB).
     Lần đầu: mạng → lưu IDB. Lần sau: hiện bản cache ngay lập tức, rồi fetch
     mạng nền để làm mới. Tuổi kho vẫn tính theo data.updated_at (quá 7 ngày
     thì coi như cũ → catalog mẫu), không tính theo giờ lưu cache. */
  var STOCK_DB = { db:null };
  function idbOpen(){
    return new Promise(function(res){
      if (STOCK_DB.db) return res(true);
      try {
        var rq = indexedDB.open("anhdev-store", 1);
        rq.onupgradeneeded = function(){ rq.result.createObjectStore("kv"); };
        rq.onsuccess = function(){ STOCK_DB.db = rq.result; res(true); };
        rq.onerror = function(){ res(false); };
        rq.onblocked = function(){ res(false); };
      } catch (e){ res(false); }
    });
  }
  function idbGet(key){
    return new Promise(function(res){
      if (!STOCK_DB.db) return res(null);
      try {
        var rq = STOCK_DB.db.transaction("kv", "readonly").objectStore("kv").get(key);
        rq.onsuccess = function(){ res(rq.result || null); };
        rq.onerror = function(){ res(null); };
      } catch (e){ res(null); }
    });
  }
  function idbPut(key, val){
    try {
      if (STOCK_DB.db) STOCK_DB.db.transaction("kv", "readwrite").objectStore("kv").put(val, key);
    } catch (e){ /* cache lỗi thì bỏ qua, kho vẫn chạy bằng mạng */ }
  }
  function stockAgeOk(data){
    if (!data || !data.updated_at) return false;
    var age = Date.now() - new Date(data.updated_at).getTime();
    return !isNaN(age) && age <= 7*24*60*60*1000;
  }
  function syncStock(){
    document.dispatchEvent(new CustomEvent("anhdev:stock-syncing"));
    setSyncStatus("syncing", "Đang đồng bộ kho thật...");
    // Nguồn kho thật duy nhất: stock.json tĩnh trong repo (cùng GitHub
    // Pages). Admin API /api/stock trên host chưa chạy được (app Flask
    // không spawn) nên KHÔNG gọi API nữa — tránh chờ timeout rồi mới
    // fallback. stock.json quá 7 ngày thì dùng catalog mẫu.
    var fromNetwork = function(){
      return fetch("stock.json", { cache:"no-store" })
        .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function(data){
          if (!data || !data.ok || !Array.isArray(data.accounts) || !data.updated_at) throw new Error("stock.json không hợp lệ");
          if (!stockAgeOk(data)) throw new Error("stock.json quá cũ");
          idbPut("stock", { data:data, savedAt: Date.now() });
          useLiveStock(data, "saved");
          return true;
        });
    };
    idbOpen().then(function(){ return idbGet("stock"); }).then(function(cached){
      var shownFromCache = false;
      if (cached && cached.data && Array.isArray(cached.data.accounts) && stockAgeOk(cached.data)){
        useLiveStock(cached.data, "saved"); // hiện kho cache ngay — lần sau vào lại là thấy liền
        shownFromCache = true;
      }
      return fromNetwork().catch(function(){
        if (!shownFromCache) useDemoStock();
      });
    });
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
  /* ===== GỌI BACKEND VPS (tài khoản web + nạp thẻ) =====
     Backend trả JSON {ok, ...} hoặc {error}. Gửi kèm:
     - Authorization: Bearer <jwt> nếu đã đăng nhập web (token lấy từ
       /api/auth/login hoặc /api/auth/register; backend cũng set HttpOnly
       cookie — fetch dùng credentials:"include" để cookie đi kèm).
     - Content-Type: application/json. */
  var WEB_TOKEN_KEY = "anhdev_web_token";
  function isNetworkError(err){
    /* Loi mang (VPS tat / mat mang / het timeout): fetch khong nhan duoc
       HTTP response nen err khong co .status — khac voi loi HTTP tu server
       (backendFetch gan .status + .data cho loi HTTP). Dung de hien Toast
       ro rang thay vi message ky thuat ("Failed to fetch"). */
    return !!err && typeof err.status !== "number";
  }
  function backendFetch(path, options){
    options = options || {};
    if (!backendReady()) return Promise.reject(new Error(L("authNoBackend")));
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, API_TIMEOUT_MS);
    var headers = { "Content-Type":"application/json" };
    if (state.webToken) headers["Authorization"] = "Bearer " + state.webToken;
    var init = { method: options.method || "GET", headers: headers, credentials:"include", signal: ctrl.signal };
    if (options.body != null) init.body = JSON.stringify(options.body);
    return fetch(API_BASE_URL.replace(/\/$/, "") + path, init)
      .then(function(r){
        return r.text().then(function(text){
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!r.ok){
            var e = new Error((data && (data.message || data.error)) || ("HTTP " + r.status));
            e.data = data; e.status = r.status;
            throw e;
          }
          return data;
        });
      })
      .then(function(data){ clearTimeout(timer); return data; },
            function(err){ clearTimeout(timer); throw err; });
  }
  /* ===== AN ACC DA BAN KHOI LUOI HIEN THI (sold-codes) =====
     Store doc kho tu stock.json TINH (GitHub Pages) nen khong biet acc
     nao da ban tren web — acc vua mua van hien lai sau khi tai lai trang.
     Backend co GET /api/shop/sold-codes (CONG KHAI, chi tra ma acc,
     khong co tk|mk) — lay danh sach do ve va LOC het khoi luoi.
     Neu backend khong tra loi duoc (Render ngu / mat mang / chua cau
     hinh) thi GIU NGUYEN luoi nhu cu — kho khong bao gio vo vi loi nay. */
  var SOLD_CODES = {}; // { "LQ12126": true, ... } — ma acc da ban tren web
  function isSoldCode(code){ return !!code && !!SOLD_CODES[code]; }
  function applySoldCodes(codes){
    /* Ghi nho danh sach ma da ban + loc het khoi PRODUCTS hien tai.
       Tra ve so acc vua bi loc. Goi lai sau moi lan sync kho (kho ve
       lai tu stock.json se mang ca acc da ban tro lai neu khong loc). */
    var set = {};
    (codes || []).forEach(function(c){ if (c) set[String(c)] = true; });
    SOLD_CODES = set;
    var before = PRODUCTS.length;
    PRODUCTS = PRODUCTS.filter(function(p){ return !isSoldCode(p.code); });
    return before - PRODUCTS.length;
  }
  function fetchSoldCodes(){
    /* Lay ma acc da ban tu backend roi an khoi luoi. Loi nao cung fallback
       im lang: giu nguyen luoi, khong toast, khong bao loi. */
    if (!backendReady()) return Promise.resolve(0);
    return backendFetch("/api/shop/sold-codes")
      .then(function(d){
        applySoldCodes((d && d.codes) || []);
        renderProducts(); renderStats();
        return 0;
      })
      .catch(function(){ return 0; });
  }
  function markSoldCode(code){
    /* Sau khi mua thanh cong (hoac 409: nguoi khac vua mua truoc): an acc
       nay khoi luoi ngay lap tuc, khong doi lan sync kho sau. */
    if (!code) return;
    SOLD_CODES[String(code)] = true;
    PRODUCTS = PRODUCTS.filter(function(p){ return p.code !== code; });
    renderProducts(); renderStats();
  }
  function saveWebToken(t){
    state.webToken = t || null;
    try {
      if (t) localStorage.setItem(WEB_TOKEN_KEY, t);
      else localStorage.removeItem(WEB_TOKEN_KEY);
    } catch (e) { /* trình duyệt chặn localStorage */ }
  }
  function loadWebToken(){
    try { return localStorage.getItem(WEB_TOKEN_KEY) || null; } catch (e) { return null; }
  }
  function clearWebToken(notifyBackend){
    var had = !!state.webToken;
    if (notifyBackend && had && backendReady()){
      backendFetch("/api/auth/logout", { method:"POST" }).catch(function(){});
    }
    saveWebToken(null);
  }
  function applyBalance(b){
    if (!b) return;
    if (typeof b.shop_balance === "number") state.balance = b.shop_balance;
    if (typeof b.coins === "number") state.coins = b.coins;
    BALANCE.synced = true; BALANCE.web = false;
    BALANCE.updatedAt = b.updated_at ? new Date(b.updated_at).toLocaleString("vi-VN") : null;
    refreshUserUI(); renderAccount();
  }
  function markBalanceUnsynced(){
    BALANCE.synced = false; BALANCE.web = false; BALANCE.updatedAt = null; refreshUserUI();
  }
  function refreshWebBalance(){
    if (state.user && state.user.web){
      // Tài khoản web: số dư thật lấy từ backend VPS (/api/auth/me).
      if (!backendReady()){ markBalanceUnsynced(); return Promise.resolve(false); }
      return backendFetch("/api/auth/me")
        .then(function(me){
          var u = me && me.user;
          if (!u || typeof u.balance !== "number"){ markBalanceUnsynced(); return false; }
          state.balance = u.balance;
          state.discount = (typeof u.discount_percent === "number") ? u.discount_percent : 0;
          BALANCE.synced = true; BALANCE.web = true; BALANCE.updatedAt = null;
          refreshUserUI(); renderAccount();
          return true;
        })
        .catch(function(){ markBalanceUnsynced(); return false; });
    }
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
    var u = state.user;
    var who = (u && u.telegram_id) || (u && u.web && u.username ? "web_" + u.username : null) || "guest";
    return "anhdev_invoices_" + who;
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
          iv.detail = "SePay đã đối soát · bot đã cộng " + fmt(iv.credited);
          if (d.balance) applyBalance(d.balance);
          else refreshWebBalance();
          saveInvoices(); renderInvoices(); updatePayStatus();
          toast("Nạp thành công! Bot đã cộng " + fmt(iv.credited) + " vào ví.");
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
        if (manual) toast("SePay chưa thấy giao dịch. Đợi 1–2 phút rồi thử lại.", "warning");
        return false;
      })
      .catch(function(){
        if (manual) toast("Không kiểm tra được trạng thái, thử lại sau.", "error");
        return false;
      });
  }
  function resumePendingDeposit(){
    var pending = state.invoices.filter(function(iv){ return iv.remote && iv.status === "pending"; })[0];
    if (pending) startDepositPoll(pending);
  }
  $("#sortSelect").addEventListener("change", function(e){
    state.filter.sort = e.target.value; state.filter.page = 1;
    // Chọn "Xáo trộn ngẫu nhiên": xáo lại toàn bộ kho để lưới đổi thứ tự mới.
    if (state.filter.sort === "shuffle") shuffleArray(PRODUCTS);
    renderProducts();
  });
  $("#stockToggle").addEventListener("click", function(){
    state.filter.onlyStock = !state.filter.onlyStock;
    this.classList.toggle("on", state.filter.onlyStock);
    this.setAttribute("aria-pressed", state.filter.onlyStock);
    state.filter.page = 1;
    renderProducts();
    syncUivFilterBtn(); /* dong bo nut filter glow-search */
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

  /* ================= AUTH — TÀI KHOẢN WEB (TK/MK qua backend VPS) =================
     Tab "Đăng nhập" / "Tạo tài khoản" gọi backend VPS (API_BASE_URL).
     Backend băm mật khẩu bằng bcrypt, cấp JWT + HttpOnly cookie (session);
     frontend chỉ giữ token trong bộ nhớ + localStorage để gửi kèm header
     Bearer. Chưa cấu hình API_BASE_URL thì form báo rõ, không tạo
     tài khoản ảo. Lỗi đăng nhập backend trả về luôn là thông báo chung
     ("Sai tên đăng nhập hoặc mật khẩu") để tránh dò tài khoản. */
  var authMode = "login";
  var authBusy = false;
  /* Uiverse glitch submit (Phase 1): ::before/::after cua nut submit dung
     attr(data-text) lam chu glitch khi hover — dong bo attr nay theo tab
     (Dang nhap/Dang ky), trang thai dang gui va VN/EN. */
  function syncAuthSubmitGlitch(){
    var btn = $("#authSubmit"); if (!btn) return;
    btn.setAttribute("data-text", authBusy ? L("sending") : (authMode === "register" ? L("submitRegister") : L("submitLogin")));
  }
  function setAuthMode(mode){
    authMode = mode;
    $("#tabLogin").classList.toggle("on", mode === "login");
    $("#tabRegister").classList.toggle("on", mode === "register");
    $("#passField2").style.display = mode === "register" ? "block" : "none";
    $("#authSubmit").textContent = mode === "register" ? L("submitRegister") : L("submitLogin");
    $("#authErr").classList.remove("show");
    syncAuthPassPlaceholder();
    syncAuthSubmitGlitch();
  }
  $("#tabLogin").addEventListener("click", function(){ setAuthMode("login"); });
  $("#tabRegister").addEventListener("click", function(){ setAuthMode("register"); });
  function authError(msg){ var e = $("#authErr"); e.textContent = msg; e.classList.add("show"); }
  function normalizeUsername(v){ return String(v || "").trim().toLowerCase(); }
  function validateAuth(username, pass, pass2){
    if (!/^[a-z0-9_]{4,24}$/.test(username)) return L("authErrUser");
    /* Đăng nhập: chỉ cần mật khẩu không trống (KHÔNG giới hạn độ dài tối
       thiểu — acc admin có mật khẩu 1 ký tự vẫn đăng nhập được).
       Đăng ký (pass2 != null): vẫn giữ tối thiểu 6 ký tự. */
    if (!pass) return L("authErrPassEmpty");
    if (pass2 != null && pass.length < 6) return L("authErrPass");
    if (pass2 != null && pass !== pass2) return L("authErrMatch");
    return null;
  }
  /* Placeholder ô mật khẩu đổi theo tab: đăng nhập chỉ ghi "Mật khẩu",
     đăng ký nhắc "(từ 6 ký tự)". applyLang() cũng gọi lại hàm này sau khi
     vẽ lại placeholder theo ngôn ngữ. */
  function syncAuthPassPlaceholder(){
    var el = $("#authPass"); if (!el) return;
    el.placeholder = authMode === "register" ? L("authPassPhReg") : L("authPassPhLogin");
  }
  function setAuthBusy(b){
    authBusy = b;
    var btn = $("#authSubmit");
    btn.disabled = b;
    btn.textContent = b ? L("sending") : (authMode === "register" ? L("submitRegister") : L("submitLogin"));
    syncAuthSubmitGlitch();
  }
  /* Nút con mắt hiện/ẩn mật khẩu (cả 2 ô, dùng chung 1 listener trên form). */
  $("#authForm").addEventListener("click", function(e){
    var b = e.target.closest(".pw-eye"); if (!b) return;
    var inp = document.getElementById(b.getAttribute("data-eye"));
    if (!inp) return;
    var show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.classList.toggle("on", show);
    b.setAttribute("aria-label", show ? L("eyeHide") : L("eyeShow"));
    inp.focus();
  });
  /* Xoá lỗi inline ngay khi người dùng sửa lại ô nhập. */
  ["authUser", "authPass", "authPass2"].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", function(){ $("#authErr").classList.remove("show"); });
  });
  $("#authForm").addEventListener("submit", function(e){
    e.preventDefault();
    if (authBusy) return;
    if (!backendReady()){ authError(L("authNoBackend")); toast(L("authNoBackend"), "error"); return; }
    var username = normalizeUsername($("#authUser").value);
    var pass = $("#authPass").value;
    var pass2 = authMode === "register" ? $("#authPass2").value : null;
    var err = validateAuth(username, pass, pass2);
    if (err){ authError(err); return; }
    setAuthBusy(true);
    var path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    var body = { username: username, password: pass };
    if (authMode === "register") body.password_confirm = pass2; // backend nhận "password_confirm"
    backendFetch(path, { method:"POST", body: body })
      .then(function(d){ return afterWebAuth(d, username); })
      .catch(function(err){
        setAuthBusy(false);
        // Loi mang (VPS tat / mat mang): hien Toast ro rang, khong de nut
        // ket o "Đang gửi…" va khong hien message ky thuat ("Failed to fetch").
        if (isNetworkError(err)){ toast(L("netErr"), "error"); authError(L("netErr")); return; }
        authError(err && err.message ? err.message : L("authErrGeneric"));
      });
  });
  function afterWebAuth(d, username){
    var token = d && (d.token || d.access_token || d.jwt);
    if (token) saveWebToken(token);
    // Lấy thông tin thật từ backend (/api/auth/me: {user:{username, balance,
    // discount_percent, telegram_id}}) rồi mới đăng nhập vào giao diện.
    return backendFetch("/api/auth/me")
      .then(function(me){
        setAuthBusy(false);
        var u = me && me.user;
        var name = (u && u.username) || username;
        state.balance = (u && typeof u.balance === "number") ? u.balance : 0;
        state.discount = (u && typeof u.discount_percent === "number") ? u.discount_percent : 0;
        BALANCE.synced = true; BALANCE.web = true; BALANCE.updatedAt = null;
        setUser({
          name: name,
          username: name,
          telegram_id: (u && u.telegram_id) || null,
          photo_url: null,
          via: L("viaWeb"),
          web: true,
          role: (u && u.role) || "user",
          discount_percent: state.discount
        });
        applyAdminRole((u && u.role) || "user");
        $("#authPass").value = ""; $("#authPass2").value = "";
        closeModal($("#authModal"));
        toast(L("authWelcome") + name + "!");
      })
      .catch(function(){
        // Đăng ký/đăng nhập đã xong nhưng /me lỗi: vẫn giữ phiên, số dư để 0
        // và thử đồng bộ lại ở lần refreshWebBalance sau. Role chưa biết ->
        // coi như "user" (không nạp module admin) cho tới khi /me thành công.
        setAuthBusy(false);
        setUser({ name: username, username: username, telegram_id: null, photo_url: null, via: L("viaWeb"), web: true, role: "user" });
        applyAdminRole("user");
        $("#authPass").value = ""; $("#authPass2").value = "";
        closeModal($("#authModal"));
        toast(L("authWelcome") + username + "!");
      });
  }
  function restoreWebSession(){
    if (!backendReady() || !state.webToken) return;
    backendFetch("/api/auth/me")
      .then(function(me){
        var u = me && me.user;
        if (!u || !u.username) throw new Error("bad /me");
        state.balance = (typeof u.balance === "number") ? u.balance : 0;
        state.discount = (typeof u.discount_percent === "number") ? u.discount_percent : 0;
        BALANCE.synced = true; BALANCE.web = true;
        setUser({
          name: u.username, username: u.username,
          telegram_id: u.telegram_id || null, photo_url: null,
          via: L("viaWeb"), web: true, role: u.role || "user", discount_percent: state.discount
        });
        applyAdminRole(u.role || "user");
      })
      .catch(function(){ saveWebToken(null); state.userRole = null; teardownAdminModule(); });
  }
  /* ================= ADMIN — TÌM KIẾM SKIN ACC RANDOM (role=admin) =================
     Chỉ tài khoản web có role === "admin" (theo /api/auth/me, JWT ký kèm role)
     mới được nạp module assets/admin-random-search.js bằng dynamic import
     (lazy-load). Tài khoản thường / chưa đăng nhập / token cũ không có role:
     KHÔNG tải file module, KHÔNG gọi API /api/admin/*, KHÔNG thấy badge hay
     toggle admin. Dữ liệu skin thật chỉ đi qua API admin kèm JWT Bearer,
     KHÔNG lưu localStorage/IndexedDB — đăng xuất là cleanupAdminRandomSearch()
     xoá sạch khỏi RAM + gỡ DOM. Module không import file nào khác ngoài ctx.
     LƯU Ý: import() động chạy trong classic script ở trình duyệt hiện đại;
     window.__adminModuleLoader chỉ là seam cho test jsdom (không có trong
     code chạy thật — test gán loader giả trước khi eval app.js). */
  var adminModule = null;         // module admin đã import (null = chưa nạp)
  var adminModulePromise = null;  // promise đang nạp (tránh import 2 lần)
  var adminSearchMode = false;    // toggle "Soi skin Acc Random" đang BẬT
  var adminQueryHandler = null;   // hàm query do module đăng ký qua ctx
  function loadAdminModule(){
    if (adminModule) return Promise.resolve(adminModule);
    if (adminModulePromise) return adminModulePromise;
    var loader = (typeof window !== "undefined" && typeof window.__adminModuleLoader === "function")
      ? window.__adminModuleLoader()
      : import("./admin-random-search.js");
    adminModulePromise = Promise.resolve(loader).then(function(m){
      adminModule = m;
      return m;
    }).catch(function(err){
      adminModulePromise = null;
      throw err;
    });
    return adminModulePromise;
  }
  /* ctx đưa cho module admin: chỉ những gì module cần, không đưa state hay
     hàm nội bộ khác. Module không được tự đọc localStorage hay stock. */
  function adminCtx(){
    return {
      doc: document,
      apiBase: API_BASE_URL,
      backendReady: backendReady,
      getToken: function(){ return state.webToken; },
      fetchFn: fetch,
      toast: toast,
      L: L,
      esc: esc,
      fmt: fmt,
      normText: normText,
      searchInput: $("#searchInput"),
      searchWrap: $(".search-wrap"),
      catChips: $("#catChips"),
      sortSelect: $("#sortSelect"),
      stockToggle: $("#stockToggle"),
      productArea: $("#productArea"),
      prodCount: $("#prodCount"),
      userChip: $("#userChip"),
      renderProducts: renderProducts,
      closeSuggest: closeSuggest,
      setAdminSearchMode: function(on){ adminSearchMode = !!on; },
      registerAdminQueryHandler: function(fn){ adminQueryHandler = (typeof fn === "function") ? fn : null; },
      setAdminSearchActive: function(on){ state.adminSearchActive = !!on; },
      applyNormalQuery: function(q){ state.filter.q = q || ""; state.filter.page = 1; },
      resetSearch: function(){ state.filter.q = ""; state.filter.page = 1; }
    };
  }
  /* Áp role sau khi /api/auth/me xác nhận. Token cũ không có role -> "user". */
  function applyAdminRole(role){
    state.userRole = (role === "admin") ? "admin" : "user";
    if (state.userRole !== "admin"){ teardownAdminModule(); return; }
    if (!backendReady()){ toast(L("adminNoBackend"), "error"); return; }
    loadAdminModule().then(function(m){
      if (state.userRole !== "admin") return; // đã đăng xuất trong lúc chờ import
      if (m && typeof m.initAdminRandomSearch === "function") m.initAdminRandomSearch(adminCtx());
    }).catch(function(){ toast(L("adminLoadFail"), "error"); });
  }
  function teardownAdminModule(){
    adminSearchMode = false;
    adminQueryHandler = null;
    state.adminSearchActive = false;
    if (adminModule && typeof adminModule.cleanupAdminRandomSearch === "function"){
      try { adminModule.cleanupAdminRandomSearch(); } catch (e) { /* bỏ qua, không chặn logout */ }
    }
  }
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
      toast("Đã đăng xuất. Hẹn gặp lại!", "info");
    } else {
      setAuthMode("login"); openModal("#authModal");
    }
  });
  function requireLogin(){
    if (state.user) return true;
    setAuthMode("login"); openModal("#authModal");
    toast("Đăng nhập trước để mua acc nhé.", "info");
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
  /* Khôi phục phiên tài khoản web (đã đăng nhập bằng TK/MK trước đó).
     Token lưu ở localStorage; /api/auth/me xác thực lại và lấy số dư thật. */
  if (!state.user){
    var wt = loadWebToken();
    if (wt){ state.webToken = wt; restoreWebSession(); }
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
      '<div class="sum-row"><span>' + L("buyProd") + '</span><b>' + esc(p.name) + '</b></div>' +
      '<div class="sum-row"><span>' + L("buyPrice") + '</span><b>' + fmt(p.price) + '</b></div>' +
      '<div class="shortfall">' + L("botNote") + '</div>';
    $("#buyActions").innerHTML =
      '<button class="btn btn-ghost" data-buy-cancel>Đóng</button>' +
      '<a class="btn btn-wine" href="' + BOT_LINK + '" target="_blank" rel="noopener noreferrer">Mua trong bot @devbn_bot</a>';
    openModal("#buyModal");
  }
  function canWebBuy(p){
    /* Chi mua truc tiep tren web khi: acc that co ma (kind=acc, co code),
       user dang dang nhap bang tai khoan web (co vi tren backend) va
       backend san sang. San pham so (kind=product, khong co tk|mk) van
       qua bot nhu cu. */
    return !!p && p.api && p.kind === "acc" && !!p.code
      && state.user && state.user.web && backendReady();
  }
  function openBuyModal(p){
    $("#buySub").textContent = p.name + " · " + CATS[p.cat].title;
    if (p.api){
      if (canWebBuy(p)){ openWebBuyModal(p); return; }
      openBotBuyModal(p); return;
    }
    var body = $("#buyBody"), actions = $("#buyActions");
    var rows =
      '<div class="sum-row"><span>' + L("buyProd") + '</span><b>' + esc(p.name) + '</b></div>' +
      '<div class="sum-row"><span>' + L("buyPrice") + '</span><b>' + fmt(p.price) + '</b></div>' +
      '<div class="sum-row"><span>' + L("buyBal") + '</span><b>' + fmt(state.balance) + '</b></div>';
    if (state.balance >= p.price){
      body.innerHTML = rows + '<div class="sum-row total"><span>' + L("buyAfter") + '</span><b>' + fmt(state.balance - p.price) + '</b></div>';
      actions.innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Hủy</button><button class="btn btn-wine uiv-shine-btn" data-buy-confirm>Xác nhận mua</button>';
    } else {
      var short = p.price - state.balance;
      body.innerHTML = rows +
        '<div class="shortfall">' + L("shortA") + '<b>' + fmt(p.price) + '</b>' + L("shortB") + '<b>' + fmt(state.balance) + '</b>' + L("shortC") + '<b>' + fmt(short) + '</b>' + L("shortD") + '</div>';
      actions.innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Để sau</button><button class="btn btn-wine" data-buy-topup>Nạp tiền ngay</button>';
    }
    openModal("#buyModal");
  }
  function openWebBuyModal(p){
    /* Mua truc tiep tren web: tru vi backend, tra tk|mk ngay trong modal.
       Nhan "Xác nhận mua" se goi completeWebBuy(p). */
    var body = $("#buyBody"), actions = $("#buyActions");
    var rows =
      '<div class="sum-row"><span>' + L("buyProd") + '</span><b>' + esc(p.name) + '</b></div>' +
      '<div class="sum-row"><span>' + L("buyPrice") + '</span><b>' + fmt(p.price) + '</b></div>' +
      '<div class="sum-row"><span>' + L("buyBal") + '</span><b>' + fmt(state.balance) + '</b></div>';
    if (state.balance >= p.price){
      body.innerHTML = rows + '<div class="sum-row total"><span>' + L("buyAfter") + '</span><b>' + fmt(state.balance - p.price) + '</b></div>';
      actions.innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Hủy</button><button class="btn btn-wine uiv-shine-btn" data-buy-confirm>Xác nhận mua</button>';
    } else {
      var short = p.price - state.balance;
      body.innerHTML = rows +
        '<div class="shortfall">' + L("shortA") + '<b>' + fmt(p.price) + '</b>' + L("shortB") + '<b>' + fmt(state.balance) + '</b>' + L("shortC") + '<b>' + fmt(short) + '</b>' + L("shortD") + '</div>';
      actions.innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Để sau</button><button class="btn btn-wine" data-buy-topup>Nạp tiền ngay</button>';
    }
    openModal("#buyModal");
  }
  function completeWebBuy(p){
    /* Nut "Xác nhận mua" da bi disable o handler click (chong double-click).
       Trong luc cho backend: hien trang thai dang xu ly, khong cho bam lai. */
    $("#buyBody").innerHTML = uivLoaderHtml("buyWebProcessing");
    $("#buyActions").innerHTML = "";
    backendFetch("/api/shop/buy", { method:"POST", body:{ code: p.code } })
      .then(function(d){
        var order = d.order || {}, acc = d.account || {};
        state.balance = order.balance;
        markSoldCode(p.code); // acc da ban — an khoi luoi ngay, khong cho mua lai
        state.orders.unshift({
          code: order.code, demo: false, productName: p.name,
          price: order.price, time: nowStr(),
          user: acc.username, pass: acc.password
        });
        saveWebOrders(); // lưu đơn + tk|mk xuống localStorage để Lịch sử còn sau khi tải lại trang
        refreshUserUI(); renderProducts(); renderStats();
        $("#buySub").textContent = "Mua thành công · Mã đơn " + order.code;
        $("#buyBody").innerHTML =
          '<div class="sum-row"><span>' + L("buyProd") + '</span><b>' + esc(p.name) + '</b></div>' +
          '<div class="sum-row"><span>' + L("buyPrice") + '</span><b>' + fmt(order.price) + '</b></div>' +
          '<div class="sum-row total"><span>' + L("buyAfter") + '</span><b>' + fmt(order.balance) + '</b></div>' +
          '<div class="cred"><div class="cred-row"><span class="k">' + L("credUser") + '</span><code>' + esc(acc.username) + '</code><button class="copy-btn" data-copy="' + esc(acc.username) + '">Sao chép</button></div>' +
          '<div class="cred-row"><span class="k">' + L("credPass") + '</span><code>' + esc(acc.password) + '</code><button class="copy-btn" data-copy="' + esc(acc.password) + '">Sao chép</button></div></div>' +
          '<p class="buy-once">' + L("buyOneTime") + '</p>';
        $("#buyActions").innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Đóng</button><button class="btn btn-wine" data-buy-orders>Xem đơn hàng</button>';
        toast("Mua thành công! Đã trừ " + fmt(order.price) + " khỏi ví.");
      })
      .catch(function(err){
        if (err && err.status === 409){
          /* Acc vua bi nguoi khac mua: an khoi luoi ngay, giu modal mo. */
          markSoldCode(p.code);
          toast(L("buyWebSoldOut"), "error");
          $("#buyBody").innerHTML = '<div class="shortfall">' + L("buyWebSoldOut") + '</div>';
          $("#buyActions").innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Đóng</button><a class="btn btn-wine" href="' + BOT_LINK + '" target="_blank" rel="noopener noreferrer">Mua trong bot @devbn_bot</a>';
          return;
        }
        if (err && err.data && err.data.error === "insufficient_balance"){
          var d = err.data;
          var bal = (typeof d.balance === "number") ? d.balance : state.balance;
          var short = (typeof d.shortfall === "number") ? d.shortfall : (p.price - bal);
          $("#buyBody").innerHTML =
            '<div class="sum-row"><span>' + L("buyProd") + '</span><b>' + esc(p.name) + '</b></div>' +
            '<div class="sum-row"><span>' + L("buyPrice") + '</span><b>' + fmt(p.price) + '</b></div>' +
            '<div class="sum-row"><span>' + L("buyBal") + '</span><b>' + fmt(bal) + '</b></div>' +
            '<div class="shortfall">' + L("shortA") + '<b>' + fmt(p.price) + '</b>' + L("shortB") + '<b>' + fmt(bal) + '</b>' + L("shortC") + '<b>' + fmt(short) + '</b>' + L("shortD") + '</div>';
          $("#buyActions").innerHTML = '<button class="btn btn-ghost" data-buy-cancel>Để sau</button><button class="btn btn-wine" data-buy-topup>Nạp tiền ngay</button>';
          toast(L("shortA") + fmt(p.price) + L("shortB") + fmt(bal) + L("shortC") + fmt(short) + L("shortD"), "error");
          return;
        }
        /* Loi mang / 500 (giai ma that bai) / loi khac: ve modal bot cu. */
        toast(L("buyWebFail"), "error");
        openBotBuyModal(p);
      });
  }
  $("#buyModal").addEventListener("click", function(e){
    if (e.target.closest("[data-buy-cancel]")) closeModal($("#buyModal"));
    if (e.target.closest("[data-buy-topup]")){ closeModal($("#buyModal")); showView("topup"); }
    var cb = e.target.closest("[data-buy-confirm]");
    if (cb && buyTarget){
      if (cb.disabled) return;
      cb.disabled = true;
      if (canWebBuy(buyTarget)) completeWebBuy(buyTarget);
      else completePurchase(buyTarget);
    }
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
      '<div class="cred"><div class="cred-row"><span class="k">' + L("credUser") + '</span><code>' + esc(order.user) + '</code><button class="copy-btn" data-copy="' + esc(order.user) + '">Copy</button></div>' +
      '<div class="cred-row"><span class="k">' + L("credPass") + '</span><code>' + esc(order.pass) + '</code><button class="copy-btn" data-copy="' + esc(order.pass) + '">Copy</button></div></div>' +
      '<p style="font-size:13px;color:var(--muted);margin:12px 0 0">' + L("credNote") + '</p>';
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
      box.innerHTML = '<div class="empty-box"><b>' + L("guest") + '</b>' + L("ordLoginS") + '<br /><br /><button class="btn btn-wine" id="ordersLogin">' + L("ordLoginB") + '</button></div>';
      var b = $("#ordersLogin"); if (b) b.addEventListener("click", function(){ setAuthMode("login"); openModal("#authModal"); });
      return;
    }
    if (!state.orders.length){
      box.innerHTML = '<div class="empty-box"><b>' + L("ordEmptyT") + '</b>' + L("ordEmptyS") + '</div>';
      return;
    }
    box.innerHTML = state.orders.map(function(o){
      var cred;
      if (o.user && o.pass){
        cred = '<div class="cred"><div class="cred-row"><span class="k">' + L("credUser") + '</span><code>' + esc(o.user) + '</code><button class="copy-btn" data-copy="' + esc(o.user) + '">Copy</button></div>' +
          '<div class="cred-row"><span class="k">' + L("credPass") + '</span><code>' + esc(o.pass) + '</code><button class="copy-btn" data-copy="' + esc(o.pass) + '">Copy</button></div></div>';
      } else {
        cred = '<div class="cred"><div class="cred-row"><span class="k">' + L("ordRecv") + '</span><span style="font-size:13px">' + L("ordRecvOnce") + '</span></div></div>';
      }
      return '<div class="order"><div class="order-top"><b>' + esc(o.productName) + '</b>' + (o.demo ? '<span class="badge pend">Demo</span>' : '') + '<span class="badge">Đã bàn giao</span></div>' +
        '<div class="meta">Mã đơn ' + o.code + ' · ' + o.time + ' · ' + fmt(o.price) + '</div>' + cred + '</div>';
    }).join("");
  }
  function invoiceBadge(iv){
    if (iv.status === "pending") return '<span class="badge pend">Chờ xử lý</span>';
    if (iv.status === "wrong_amount") return '<span class="badge pend">Sai mệnh giá</span>';
    if (iv.status === "failed") return '<span class="badge fail">Thất bại</span>';
    if (iv.status === "cancelled") return '<span class="badge fail">Đã huỷ</span>';
    return '<span class="badge">Thành công</span>';
  }
  function renderInvoices(){
    var box = $("#invoicesList");
    if (!state.invoices.length){
      box.innerHTML = '<div class="empty-box"><b>' + L("invEmptyT") + '</b>' + L("invEmptyS") + '</div>';
      return;
    }
    box.innerHTML = state.invoices.map(function(iv){
      var amountHtml = (iv.status === "success" || iv.status === "wrong_amount")
        ? '<b>+' + fmt(iv.credited != null ? iv.credited : iv.amount) + '</b>'
        : '<b>' + fmt(iv.amount) + '</b>';
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
      box.innerHTML = '<div class="empty-box"><b>' + L("guest") + '</b>' + L("accLoginS") + '<br /><br /><button class="btn btn-wine" id="accLogin">' + L("accLoginB") + '</button></div>';
      var b = $("#accLogin"); if (b) b.addEventListener("click", function(){ setAuthMode("login"); openModal("#authModal"); });
      return;
    }
    box.innerHTML =
      '<div class="sum-row"><span>' + L("accName") + '</span><b>' + esc(state.user.name) + '</b></div>' +
      '<div class="sum-row"><span>' + L("accUser") + '</span><b>' + esc(state.user.username) + '</b></div>' +
      '<div class="sum-row"><span>' + L("accVia") + '</span><b>' + esc(state.user.via) + '</b></div>' +
      '<div class="sum-row"><span>' + L("accBal") + '</span><b>' + fmt(state.balance) +
        (BALANCE.synced
          ? ' <span style="font-size:11px;color:var(--ok)">' + (BALANCE.web ? L("accSyncedWeb") : L("accSynced")) +
            (state.coins > 0 ? ' · ' + Number(state.coins).toLocaleString("vi-VN") + ' xu' : '') + '</span>'
          : ' <span style="font-size:11px;color:var(--danger)">' + L("accUnsync") + '</span>') + '</b></div>' +
      '<div class="sum-row"><span>' + L("accOrders") + '</span><b>' + state.orders.length + L("ordUnit") + '</b></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="accTopup">' + L("accTopup") + '</button><button class="btn btn-wine" id="accLogout">' + L("logout") + '</button></div>' +
      '<p style="font-size:12.5px;color:var(--muted);margin-top:14px">' + ((state.user.web && !state.user.telegram_id) ? L("accNoteWeb") : L("accNote")) + '</p>';
    $("#accTopup").addEventListener("click", function(){ showView("topup"); });
    $("#accLogout").addEventListener("click", function(){ setUser(null); state.balance = 0; refreshUserUI(); toast("Đã đăng xuất.", "info"); showView("home"); });
  }

  /* ĐƠN MUA ACC — lưu localStorage + đồng bộ từ backend.
     NGUYÊN NHÂN GỐC CỦA BUG "lịch sử không lưu được gì": state.orders trước
     đây chỉ được thêm trong bộ nhớ khi mua ngay trong phiên (completeWebBuy /
     completePurchase) — app KHÔNG BAO GIỜ gọi GET /api/shop/orders và KHÔNG
     lưu đơn xuống localStorage. Tải lại trang là state.orders = [] nên
     renderOrders() hiện "Chưa có đơn hàng nào" dù backend đã lưu đơn trong
     shop_orders. Sửa: (a) loadWebOrders() khôi phục đơn web đã mua (kèm
     tk|mk) từ localStorage theo từng tài khoản web; (b)
     refreshBackendOrders() lấy đơn thật từ GET /api/shop/orders rồi gộp
     (đơn local có tk|mk thắng khi trùng mã); (c) completeWebBuy() lưu đơn
     mới xuống localStorage ngay sau khi mua. tk|mk chỉ nằm trong trình
     duyệt của chính người mua (để xem lại trong Lịch sử) — không gửi lên
     server, không lưu trong shop_orders; đăng xuất thì xoá khỏi bộ nhớ. */
  var WEB_ORDERS_KEY_PREFIX = "anhdev_web_orders_";
  function webOrdersKey(){
    var u = state.user;
    return (u && u.web && u.username) ? WEB_ORDERS_KEY_PREFIX + u.username : null;
  }
  function loadWebOrders(){
    var key = webOrdersKey();
    if (!key) return;
    try {
      var raw = localStorage.getItem(key);
      var list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) state.orders = list.filter(function(x){ return x && x.code && !x.demo; }).slice(0, 50);
    } catch (e) { /* bỏ qua */ }
  }
  function saveWebOrders(){
    var key = webOrdersKey();
    if (!key) return;
    try {
      var creds = state.orders.filter(function(x){ return x && x.code && !x.demo && x.user && x.pass; }).slice(0, 50);
      localStorage.setItem(key, JSON.stringify(creds));
    } catch (e) { /* trình duyệt chặn localStorage */ }
  }
  function productNameForCode(code){
    var found = null;
    (PRODUCTS || []).forEach(function(p){ if (p && p.code === code) found = p; });
    return found ? found.name : ("Acc " + code);
  }
  function fmtOrderTime(ts){
    /* created_at backend là "YYYY-MM-DD HH:MM:SS" (giờ UTC của SQLite) —
       đổi sang giờ máy người dùng, cùng dạng với nowStr(). */
    if (!ts) return "";
    var m = String(ts).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return String(ts);
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " · " + d.toLocaleDateString("vi-VN");
  }
  /* Đồng bộ ĐƠN MUA ACC từ backend (GET /api/shop/orders — đơn thật đã lưu
     trong shop_orders). Chỉ chạy cho tài khoản web; đơn backend thắng khi
     trùng mã, trừ đơn local đã có tk|mk (giữ lại để hiện trong Lịch sử). */
  function refreshBackendOrders(){
    if (!state.user || !state.user.web || !backendReady()) return;
    backendFetch("/api/shop/orders")
      .then(function(d){
        var list = d && d.orders;
        if (!Array.isArray(list)) return;
        var byCode = {};
        state.orders.forEach(function(o){ if (o && o.code) byCode[o.code] = o; });
        var merged = [];
        var changed = false;
        list.forEach(function(bo){
          if (!bo || !bo.code) return;
          var local = byCode[bo.code];
          if (local && local.user && local.pass){
            merged.push(local); // giữ tk|mk đã mua trong phiên này
          } else {
            merged.push({
              code: bo.code, demo: false,
              productName: productNameForCode(bo.code),
              price: (typeof bo.price === "number") ? bo.price : 0,
              time: fmtOrderTime(bo.created_at),
              status: bo.status || "delivered"
            });
            changed = true;
          }
          delete byCode[bo.code];
        });
        /* Đơn chỉ có trong bộ nhớ (demo, hoặc vừa mua chưa kịp đồng bộ):
           giữ nguyên thứ tự, đặt trước đơn backend. */
        var leftovers = state.orders.filter(function(o){ return o && o.code && byCode[o.code]; });
        if (leftovers.length){ merged = leftovers.concat(merged); changed = true; }
        if (changed){
          state.orders = merged.slice(0, 50);
          renderOrders();
        }
      })
      .catch(function(){ /* backend chưa sẵn / hết phiên — giữ đơn local */ });
  }

  /* Đồng bộ Hoá Đơn nạp thẻ từ backend (trạng thái thật sau callback cổng thẻ).
     Chỉ chạy cho tài khoản web; hoá đơn backend thắng khi trùng request_id. */
  function refreshBackendInvoices(){
    if (!state.user || !state.user.web || !backendReady()) return;
    backendFetch("/api/topup/invoices")
      .then(function(d){
        var list = d && d.invoices;
        if (!Array.isArray(list)) return;
        var changed = false;
        list.forEach(function(bi){
          if (!bi || !bi.request_id) return;
          var status = bi.status === "wrong_amount" ? "wrong_amount"
            : bi.status === "success" ? "success"
            : bi.status === "failed" ? "failed" : "pending";
          var detail = (bi.telco || "Thẻ cào") + " · mệnh giá " + fmt(bi.amount || 0);
          if (status === "wrong_amount") detail += " · sai mệnh giá";
          var item = {
            code: bi.request_id, amount: bi.amount || 0,
            credited: (typeof bi.credited_amount === "number") ? bi.credited_amount : null,
            method: "Thẻ cào · TheSieuRe", status: status,
            time: bi.created_at || "", detail: detail
          };
          var ex = null;
          state.invoices.forEach(function(x){ if (x.code === item.code) ex = x; });
          if (ex){
            if (ex.status !== item.status || ex.credited !== item.credited){
              ex.status = item.status; ex.credited = item.credited; ex.detail = item.detail;
              changed = true;
            }
          } else {
            state.invoices.unshift(item);
            changed = true;
          }
        });
        if (changed){ saveInvoices(); renderInvoices(); }
      })
      .catch(function(){ /* backend chưa sẵn / hết phiên — giữ hoá đơn local */ });
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
    setActiveNav("topup:" + which); // 1 nguồn sự thật — không tự toggle .active lẻ nữa
  }
  $("#tabQr").addEventListener("click", function(){ setTopupTab("qr"); });
  $("#tabCard").addEventListener("click", function(){ setTopupTab("card"); });
  $("#makeQrBtn").addEventListener("click", function(){
    if (!requireLogin()) return;
    if (!selectedAmount || selectedAmount < 1000){ toast("Chọn hoặc nhập số tiền nạp từ 1.000đ.", "warning"); return; }
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
      toast(message, "warning");
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
        toast("Đã tạo lệnh nạp " + code + " — quét VietQR để thanh toán.", "info");
        startDepositPoll(iv);
      })
      .catch(function(err){
        var why = (err && err.message) ? err.message : "lỗi mạng";
        createLocal("Không gọi được API (" + why + ") — hoá đơn demo, chưa đồng bộ bot.");
      })
      .then(function(){ btn.disabled = false; });
  });
  /* Anh QR VietQR: an khi chua co src (chua tao hoa don) — bao ve khi co
     code nao do gan src="" ma quen an lai, hoac khi renderPayment bi goi
     voi hoa don khong co URL QR. */
  function syncPayQrVisibility(){
    var img = $("#payQrImg"); if (!img) return;
    if (!img.getAttribute("src")) img.hidden = true;
  }
  function renderPayment(){
    var iv = state.currentPay; if (!iv) return;
    var bank = iv.bank || BANK;
    $("#payCodeLbl").textContent = iv.code;
    $("#payBank").textContent = bank.name || bank.code || BANK.name;
    $("#payAcc").textContent = bank.account || BANK.account;
    $("#payHolder").textContent = bank.holder || BANK.holder;
    /* Số tiền CHUYỂN KHOẢN THẬT (VND) — cố tình giữ fmtVND, không đổi theo
       tiền tệ hiển thị: khách phải chuyển đúng số VND này thì SePay mới khớp. */
    $("#payAmount").textContent = fmtVND(iv.amount);
    $("#payNote").textContent = iv.code;
    $("#payAccCopy").setAttribute("data-copy", bank.account || BANK.account);
    $("#payNoteCopy").setAttribute("data-copy", iv.code);
    var img = $("#payQrImg");
    $("#payQrFallback").hidden = true;
    img.src = iv.qr_url ? iv.qr_url
      : "https://img.vietqr.io/image/" + (bank.code || BANK.code) + "-" + (bank.account || BANK.account) + "-qr_only.png?amount=" + iv.amount +
        "&addInfo=" + encodeURIComponent(iv.code) + "&accountName=" + encodeURIComponent(bank.holder || BANK.holder);
    /* Chi bo hidden khi that su co src — tranh anh trong (src="") hien khung vo. */
    img.hidden = !img.getAttribute("src");
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
        (iv.remote ? " · bot đã cộng " + fmt(iv.credited != null ? iv.credited : iv.amount) : " · demo, chưa đồng bộ bot");
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
      toast("Đang kiểm tra giao dịch với SePay...", "info");
      checkDeposit(iv, true);
      return;
    }
    iv.status = "success";
    iv.credited = iv.amount;
    iv.detail = "Demo cục bộ · chưa đồng bộ bot";
    state.balance += iv.amount;
    markBalanceUnsynced();
    saveInvoices(); renderInvoices(); updatePayStatus();
    toast("Đã cộng " + fmt(iv.amount) + " vào số dư demo (chưa đồng bộ bot).");
  });
  $("#payBackBtn").addEventListener("click", function(){
    var iv = state.currentPay;
    if (iv && iv.status === "pending"){
      iv.status = "cancelled";
      iv.detail = "MBBank · Nội dung CK: " + iv.code + " · Đã huỷ";
      saveInvoices(); renderInvoices();
      toast("Đã huỷ hoá đơn " + iv.code + ".", "info");
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
  /* ===== NẠP THẺ CÀO — QUA BACKEND VPS (TheSieuRe) =====
     Luồng: web gửi thẻ lên backend (POST /api/topup/card) → backend ký sign
     và gạch thẻ với TheSieuRe → callback của cổng thẻ cộng tiền vào ví.
     Frontend KHÔNG bao giờ gọi thẳng thesieure.com (partnerKey chỉ nằm trong
     .env trên VPS). Chưa cấu hình API_BASE_URL thì chạy chế độ demo
     (mô phỏng cục bộ, ghi rõ "Demo", số dư chỉ là demo). */
  function cardExpectedCredit(amount, telco){
    var fee = (CARD_DISCOUNT_RATES[telco] || 0) / 100;
    return Math.round(amount * (1 - fee));
  }
  function renderCardDiscount(){
    var box = $("#cardDiscountTable");
    if (!box) return;
    var sel = $("#cardTelco");
    var rows = CARD_TELCOS.map(function(code){
      var name = code;
      if (sel){
        for (var i = 0; i < sel.options.length; i++){
          if (sel.options[i].value === code){ name = sel.options[i].text; break; }
        }
      }
      var rate = CARD_DISCOUNT_RATES[code] || 0;
      return '<div class="card-disc-row"><b>' + esc(name) + '</b><span class="disc-rate">' +
        esc(L("discRate").replace("{r}", String(rate)).replace("{v}", fmt(cardExpectedCredit(100000, code)))) + '</span></div>';
    }).join("");
    box.innerHTML = rows;
  }
  function updateCardExpected(){
    var el = $("#cardExpected"); if (!el) return;
    var amount = parseInt($("#cardAmount").value, 10) || 0;
    var telco = $("#cardTelco").value;
    var rate = CARD_DISCOUNT_RATES[telco] || 0;
    el.textContent = L("cardExpectedA") + fmt(cardExpectedCredit(amount, telco)) +
      L("cardExpectedB").replace("{r}", String(rate));
  }
  function refreshCardBackendNote(){
    var n = $("#cardBackendNote"); if (!n) return;
    if (backendReady()){ n.hidden = true; return; }
    n.hidden = false;
    n.textContent = L("cardNoBackend");
  }
  $("#cardTelco").addEventListener("change", function(){ updateCardExpected(); });
  $("#cardAmount").addEventListener("change", function(){ updateCardExpected(); });
  $("#cardSubmit").addEventListener("click", function(){
    if (!requireLogin()) return;
    var telcoSel = $("#cardTelco");
    var telco = telcoSel.value;
    var telcoName = telcoSel.options[telcoSel.selectedIndex].text;
    var amount = parseInt($("#cardAmount").value, 10);
    var serial = $("#cardSerial").value.replace(/\s+/g, "");
    var pin = $("#cardPin").value.replace(/\s+/g, "");
    if (!serial || !pin){ toast(L("cardNeedBoth"), "warning"); return; }
    // Thẻ cào VN: chỉ gồm chữ số — seri 10–16 số, mã thẻ 10–15 số (khớp backend).
    if (!/^\d{10,16}$/.test(serial) || !/^\d{10,15}$/.test(pin)){
      toast(L("cardBadFormat"), "warning");
      return;
    }
    var cardBtn = this;
    cardBtn.disabled = true; // khoá nút chống gửi trùng trong khi chờ
    var btnLabel = cardBtn.textContent;
    cardBtn.textContent = L("sending");
    var finish = function(){ cardBtn.disabled = false; cardBtn.textContent = btnLabel; };
    if (!backendReady()){
      // Chưa có backend: chế độ demo — tạo hoá đơn "Chờ xử lý" rồi mô phỏng
      // kết quả cục bộ (không gọi cổng thẻ thật). Số dư cộng vào là demo.
      var ivDemo = {
        code: randCode("THE"),
        amount: amount, credited: null,
        method: "Thẻ cào · TheSieuRe · Demo",
        status: "pending", time: nowStr(), demo: true,
        detail: telcoName + " · mệnh giá " + fmt(amount) + " · seri …" + serial.slice(-4)
      };
      state.invoices.unshift(ivDemo);
      saveInvoices(); renderInvoices();
      $("#cardSerial").value = ""; $("#cardPin").value = "";
      toast(L("cardDemoSent"), "info");
      setTimeout(function(){
        finish();
        ivDemo.status = "success";
        ivDemo.credited = cardExpectedCredit(amount, telco);
        ivDemo.detail += " · thực nhận " + fmt(ivDemo.credited) + " (" + L("cardDemoNote") + ")";
        state.balance += ivDemo.credited;
        markBalanceUnsynced();
        refreshUserUI();
        saveInvoices(); renderInvoices(); renderAccount();
        toast(L("cardDemoOk") + fmt(ivDemo.credited) + ".");
      }, 2500);
      return;
    }
    // Có backend: gửi thẻ lên VPS, backend gạch thẻ với TheSieuRe.
    backendFetch("/api/topup/card", { method:"POST", body:{ telco: telco, amount: amount, serial: serial, code: pin } })
      .then(function(d){
        finish();
        var iv = {
          code: (d && d.request_id) || randCode("THE"),
          amount: amount,
          credited: (d && typeof d.credited_amount === "number") ? d.credited_amount : null,
          method: "Thẻ cào · TheSieuRe",
          status: (d && d.status) || "pending",
          time: nowStr(),
          detail: telcoName + " · mệnh giá " + fmt(amount) + " · seri …" + serial.slice(-4)
        };
        state.invoices.unshift(iv);
        saveInvoices(); renderInvoices();
        $("#cardSerial").value = ""; $("#cardPin").value = "";
        toast(L("cardSentOk"));
        // Callback của cổng thẻ cộng tiền ở phía server; hỏi lại số dư +
        // trạng thái hoá đơn sau ít giây.
        if (state.user && state.user.web){
          setTimeout(function(){ refreshWebBalance(); refreshBackendInvoices(); }, 15000);
        }
      })
      .catch(function(err){
        finish();
        var d = err && err.data;
        if (d && d.request_id){
          // Backend đã tạo hoá đơn (cổng từ chối hoặc không gọi được) —
          // vẫn hiện vào Hoá Đơn với trạng thái thật để khách thấy.
          var iv = {
            code: d.request_id,
            amount: amount, credited: null,
            method: "Thẻ cào · TheSieuRe",
            status: d.status || "failed",
            time: nowStr(),
            detail: telcoName + " · mệnh giá " + fmt(amount) + " · seri …" + serial.slice(-4) +
              " · " + (err.message || "")
          };
          state.invoices.unshift(iv);
          saveInvoices(); renderInvoices();
          $("#cardSerial").value = ""; $("#cardPin").value = "";
        }
        toast(isNetworkError(err) ? L("netErr") : (L("cardSendFail") + (err && err.message ? ": " + err.message : "")), "error");
      });
  });

  /* ================= ĐIỂM DANH ================= */
  function renderCheckin(){
    var body = $("#checkinBody");
    if (state.checkin != null){
      body.innerHTML = '<div class="checkin-done">' + L("ciDoneA") + fmt(state.checkin) + L("ciDoneB") + '</div>';
    } else if (state.checkinDone){
      body.innerHTML = '<div class="checkin-done">' + L("ciAlready") + '</div>';
    } else {
      body.innerHTML = '<button class="btn btn-wine" id="checkinBtn" style="width:100%">' + L("ciBtn") + '</button>';
      $("#checkinBtn").addEventListener("click", function(){
        var btn = this;
        btn.disabled = true; // khoá nút chống điểm danh 2 lần trong cùng 1 lần mở modal
        if (state.user && state.user.web && backendReady()){
          // Tài khoản web: điểm danh thật qua backend (POST /api/checkin).
          // Server cộng ngẫu nhiên 1–500đ, giới hạn 1 lần/user/ngày +
          // 2 lần/IP/ngày (kèm cờ yêu cầu liên kết Telegram / đã nạp thẻ).
          backendFetch("/api/checkin", { method:"POST" })
            .then(function(d){
              var amt = (d && typeof d.amount === "number") ? d.amount : 0;
              state.checkin = amt;
              if (d && typeof d.balance === "number") state.balance = d.balance;
              BALANCE.synced = true; BALANCE.web = true;
              refreshUserUI();
              renderCheckin();
              document.dispatchEvent(new CustomEvent("anhdev:checkin", { detail:{ amount: amt } }));
              toast(L("ciOkA") + fmt(amt) + L("ciOkB") + fmt(state.balance) + ".");
            })
            .catch(function(err){
              btn.disabled = false; // cho bấm lại (trừ khi server nói đã điểm danh)
              var code = err && err.data && err.data.error;
              if (code === "already_checked_in"){
                state.checkinDone = true;
                renderCheckin();
              }
              // Thông báo lỗi lấy từ server (409 đã điểm danh / 429 vượt IP /
              // 403 chưa đủ điều kiện) — server luôn trả message tiếng Việt rõ ràng.
              // Lỗi mạng (VPS tắt / mất mạng) thì hiện Toast rõ ràng thay vì
              // message kỹ thuật.
              toast(isNetworkError(err) ? L("netErr") : (err && err.message ? err.message : L("ciErrGeneric")), "error");
            });
          return;
        }
        // Telegram / demo: giữ nguyên điểm danh demo cục bộ.
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
    // Render trạng thái lọc TRƯỚC, rồi cuộn thẳng tới kho — cùng 1 task JS,
    // không render/scroll qua hero Trang Chủ trước (đó là cái flash cũ).
    renderProducts();
    showView("home", { targetId: "products", navKey: "cat:" + cat });
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
    prodTitle:"Products in warehouse", sortDefault:"Default", sortShuffle:"Shuffle", sortAsc:"Price low → high", sortDesc:"Price high → low", sortStock:"Most in stock", stockOnly:"In stock",
    chipAll:"All", chipRandom:"Random Accounts", chipDetail:"Ready-info Accounts", chipWhite:"White Accounts", chipRandomLq:"Random AoV",
    "ph:searchPh":"Search product names...",
    topupTitle:"Top up wallet", topupSub:"Bank transfer via VietQR — SePay matches your transfer note automatically and credits your wallet as soon as the bank confirms.",
    tabQr:"VietQR · Scan code", tabCard:"Prepaid card",
    amtLabel:"Top-up amount (đ)", amtHint:"Minimum 1,000đ. After creating the invoice, transfer the exact amount with the invoice code as the note — SePay credits the right wallet automatically.",
    makeQr:"Create invoice & VietQR code", bankLine:"Receiving bank: MBBank · Account 05817666778899 · BUI NGUYEN XUAN NHAT", "ph:amtPh":"Or enter another amount...",
    cardTelcoL:"Card type", cardAmountL:"Card denomination", cardAmountHint:"Pick the exact denomination printed on the card — if you declare it wrong, TheSieuRe settles at the real value and the card may be lost.",
    cardSerialL:"Serial number", "ph:cardSerialPh":"Enter the serial printed on the card", cardPinL:"Card code", "ph:cardPinPh":"Scratch the silver layer and enter the code",
    cardSubmit:"Send card",
    cardDiscT:"Card discount rates",
    ordersTitle:"My orders", ordersSub:"All purchased accounts appear here.",
    invTitle:"Top-up invoices", invSub:"History of top-ups via SePay / VietQR and TheSieuRe prepaid cards — cards clearly show pending, success or failed status.",
    accTitle:"My account", accSub:"Link Telegram for quick sign-in everywhere.",
    lbTitle:"Leaderboard", lbSub:"Top buyers at the shop — ranked by total spending.",
    authTitle:"Welcome to AnhDev Store", authSub:"Log in to buy accounts and top up.",
    authLoginTab:"Log In", authRegTab:"Register",
    authUserL:"Username", "ph:authUserPh":"Your username", authPassL:"Password", "ph:authPassPh":"Password",
    authPass2L:"Confirm password", "ph:authPass2Ph":"Repeat the password",
    authUserHint:"4–24 characters: letters (no accents), numbers, _",
    authWebHint:"Web accounts live on the AnhDev server — or log in with Telegram below.",
    tgBtn:"Log in with Telegram", tgHint:"Open the shop inside the Telegram Mini App and this step is automatic — the shop recognises the Telegram account you are using.",
    ciTitle:"Daily check-in", ciSub:"Check in once a day to receive a random 1–500đ straight into your wallet.",
    paySecure:"Secure transaction", payBack:"Cancel",
    bnHome:"Home", bnShop:"Accounts", bnTopup:"Top up", bnOrders:"Orders", bnAccount:"Account",
  };
  var I18N_EN_HTML = {
    heroTitle:'Account warehouse <br />ANHDEV',
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
    syncAuthPassPlaceholder(); // placeholder mật khẩu theo tab đăng nhập/đăng ký
    syncUivLoaderText(); // chu loader (sync kho / mua hang) theo ngon ngu moi
    syncAuthSubmitGlitch(); // data-text glitch cua nut submit theo tab + VN/EN
    /* Nhan aria cua nut × va nut filter tren o tim kiem glow theo ngon ngu. */
    var uivFb = $("#uivFilterBtn");
    if (uivFb){ uivFb.setAttribute("aria-label", L("filterOnlyStock")); uivFb.title = L("filterOnlyStock"); }
    var uivCb = $("#uivSearchClear");
    if (uivCb) uivCb.setAttribute("aria-label", L("clearSearch"));
    /* Đổi ngôn ngữ vẽ lại placeholder ô tìm kiếm -> module admin vẽ lại
       placeholder chế độ soi skin nếu toggle đang bật. */
    if (adminModule && typeof adminModule.syncAdminPlaceholder === "function") adminModule.syncAdminPlaceholder();
    var as = $("#authSubmit");
    if (as && !authBusy) as.textContent = authMode === "register" ? L("submitRegister") : L("submitLogin");
    refreshUserUI();
    renderProducts();
    renderStats();
    renderLeaderboard();
    renderOrders();
    renderInvoices();
    renderAccount();
    if ($("#checkinModal") && $("#checkinModal").classList.contains("open")) renderCheckin();
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
    renderInvoices();
    renderLeaderboard();
    renderAccount();
    if (state.currentPay) updatePayStatus();
    toast(this.value === "USD" ? "Đã đổi tiền tệ hiển thị sang USD (giao dịch vẫn tính bằng VND)." : "Đã đổi tiền tệ hiển thị sang VND.", "info");
  });

  /* ===== HERO BANNER — TỰ ĐỔI SKIN MỖI LẦN TẢI LẠI TRANG =====
     Mỗi lần tải trang, chọn ngẫu nhiên 1 ảnh trong assets/heroes/
     (hero-01..hero-20), nhưng KHÔNG trùng ảnh của lần tải trước.
     Chỉ số lần trước lưu trong localStorage (fallback sessionStorage).
     Ảnh mặc định trong index.html là hero-01 — nếu ảnh chọn bị lỗi
     thì quay về hero-01, không để banner vỡ. Ken Burns chạy lại
     từ đầu cho ảnh mới. */
  var HERO_COUNT = 20;
  var HERO_KEY = "anhdev_hero_idx";
  var HERO_DEFAULT = "assets/heroes/hero-01.webp";
  function heroSrc(i){ return "assets/heroes/hero-" + String(i + 1).padStart(2, "0") + ".webp"; }
  function heroStorage(){
    try { if (window.localStorage) return window.localStorage; } catch (e) {}
    try { if (window.sessionStorage) return window.sessionStorage; } catch (e) {}
    return null;
  }
  function rotateHero(){
    var img = document.querySelector(".hero img.bg");
    if (!img) return;
    var store = heroStorage();
    var last = -1;
    if (store) {
      try { last = parseInt(store.getItem(HERO_KEY), 10); } catch (e) { last = -1; }
      if (isNaN(last) || last < 0 || last >= HERO_COUNT) last = -1;
    }
    var idx = Math.floor(Math.random() * HERO_COUNT);
    if (HERO_COUNT > 1) { while (idx === last) idx = Math.floor(Math.random() * HERO_COUNT); }
    var src = heroSrc(idx);
    /* Nếu ảnh chọn lỗi thì quay về ảnh mặc định (chỉ fallback 1 lần). */
    img.onerror = function(){
      img.onerror = null;
      if (img.getAttribute("src") !== HERO_DEFAULT) img.src = HERO_DEFAULT;
    };
    if (store) { try { store.setItem(HERO_KEY, String(idx)); } catch (e) {} }
    if (img.getAttribute("src") !== src) {
      img.src = src;
      /* Chạy lại hiệu ứng Ken Burns từ đầu cho ảnh mới. */
      img.style.animation = "none";
      void img.offsetWidth; /* reflow */
      img.style.animation = "";
    }
  }

  /* ================= INIT ================= */
  rotateHero();
  captureVi();
  syncPayQrVisibility(); /* QR VietQR an khi chua co src (chua tao hoa don) */
  syncAuthSubmitGlitch(); /* data-text glitch nut submit theo tab mac dinh */
  setSyncStatus("syncing", "Đang đồng bộ kho thật...");
  buildSearchIndex(); // index trên catalog mẫu trước, syncStock() build lại khi kho thật về
  initSearch();
  renderProducts();
  renderStats();
  refreshUserUI();
  renderOrders();
  renderInvoices();
  renderAccount();
  refreshCardBackendNote();
  syncStock();
  fetchSoldCodes(); // an acc da ban tren web khoi luoi (loi thi giu nguyen luoi)
  /* Số dư thật: làm mới mỗi 60 giây khi tab đang hiển thị, và ngay khi
     người dùng quay lại tab (mở lại shop). */
  setInterval(function(){
    if (document.visibilityState === "visible" && state.user) refreshWebBalance();
  }, 60000);
  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState === "visible" && state.user) refreshWebBalance();
  });
})();

