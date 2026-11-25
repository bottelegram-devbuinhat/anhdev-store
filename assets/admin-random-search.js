/* ============================================================================
   AnhDev Store — ADMIN: tìm kiếm skin Acc Random (chỉ role === "admin")
   ----------------------------------------------------------------------------
   File module riêng, CHỈ được nạp bằng dynamic import từ assets/app.js khi
   /api/auth/me xác nhận role === "admin". Tài khoản thường / chưa đăng nhập
   không bao giờ tải file này, không gọi API /api/admin/*, không thấy badge
   hay toggle admin.

   BẢO MẬT:
   - Dữ liệu skin thật CHỈ đến qua GET /api/admin/random-search (hoặc
     /api/admin/random-index) kèm header Authorization: Bearer <JWT> — server
     tự kiểm tra role=admin (403 nếu không phải admin).
   - KHÔNG hardcode bất kỳ dữ liệu skin thật, token hay mật khẩu nào ở đây.
   - KHÔNG lưu dữ liệu Random vào localStorage / IndexedDB / cookie — chỉ
     giữ trong biến RAM của module (results). cleanupAdminRandomSearch()
     (gọi khi đăng xuất) gán results = null và gỡ toàn bộ DOM admin.
   - Mọi chuỗi từ API đều qua esc() trước khi chèn vào DOM (chống XSS).
   - Module không import file nào khác; mọi thứ cần dùng đều nhận qua ctx.
   - File này là ES module (export). Test jsdom nạp bằng cách strip từ khóa
     `export` (xem tests/test-admin-frontend.js) vì Node không coi .js là ESM.
   ============================================================================ */

var ctx = null;
var initialized = false;
var on = false;               // toggle "Soi skin Acc Random" đang BẬT
var showingAdmin = false;     // đang hiển thị kết quả admin trong #productArea
var results = null;           // kết quả admin trong RAM (null = chưa có / đã xoá)
var total = 0;                // tổng số acc Random khớp query (server báo)
var currentQuery = "";
var currentOffset = 0;
var currentLimit = 20;
var reqSeq = 0;               // chống race: chỉ render response mới nhất
var toggleBtn = null;
var badge = null;
var savedPlaceholder = "";
var boundHandlers = [];       // {el, type, fn} — để gỡ listener khi cleanup

function onToggleClick(){
  setOn(!on);
}

function onChipsClick(e){
  /* Đổi danh mục / sắp xếp / lọc "Còn hàng" trong lúc đang soi: thoát chế
     độ admin trước, rồi để handler thường của app.js chạy tiếp (render lại
     lưới thường với bộ lọc mới). Listener của module gắn sau handler của
     app.js nên chạy sau — setOn(false) gọi renderProducts() lần nữa. */
  if (on) setOn(false);
}

function onProductAreaClick(e){
  if (!e.target || !e.target.closest) return;
  var back = e.target.closest("[data-admin-back]");
  if (back){ setOn(false); return; }
  var more = e.target.closest("[data-admin-more]");
  if (more){ loadMore(); }
}

function tierChips(desc){
  /* Bậc skin từ khối thống kê trong mô tả thật, vd "(sss:2, ss:0, ss+:1,
     s+:0, ssm:0, anime:3)" — chỉ hiện bậc có N > 0. */
  var out = [];
  var labels = { sss:"SSS", "ss+":"SS+", ss:"SS", "s+":"S+", ssm:"SSM", anime:"Anime" };
  var norm = ctx ? ctx.normText(desc || "") : String(desc || "");
  var re = /\b(sss|ss\+|ss|s\+|ssm|anime)\s*:\s*(\d+)/g, m;
  while ((m = re.exec(norm))){
    if (parseInt(m[2], 10) > 0 && labels[m[1]]) out.push(labels[m[1]] + " ×" + m[2]);
  }
  return out;
}

function skinList(a){
  /* rare_skins có thể là chuỗi ("A, B") hoặc mảng — chuẩn hoá thành mảng. */
  var rs = a && a.rare_skins;
  if (Array.isArray(rs)) return rs.filter(Boolean);
  if (typeof rs === "string" && rs.trim()) return rs.split(",").map(function(s){ return s.trim(); }).filter(Boolean);
  return [];
}

function resultCardHtml(a){
  var skins = skinList(a);
  var tiers = tierChips(a.description || "");
  var meta = [];
  if (a.rank) meta.push("Rank " + a.rank);
  if (a.level) meta.push("Lv " + a.level);
  if (a.heroes) meta.push(a.heroes + " tướng");
  if (a.skins) meta.push(a.skins + " skin");
  var skinsHtml = skins.length
    ? skins.map(function(s){ return '<span class="admin-skin">' + ctx.esc(s) + '</span>'; }).join("")
    : '<span class="admin-skin none">Không có skin hiếm</span>';
  var tiersHtml = tiers.length
    ? tiers.map(function(t){ return '<span class="admin-tier">' + ctx.esc(t) + '</span>'; }).join("")
    : "";
  return '<article class="admin-card">' +
    '<div class="admin-card-head"><b>Acc ' + ctx.esc(a.code || "?") + '</b>' +
    '<span class="admin-kind">🎲 Acc Random</span>' +
    '<span class="admin-price">' + ctx.esc(ctx.fmt(a.price || 0)) + '</span></div>' +
    (meta.length ? '<div class="admin-meta">' + ctx.esc(meta.join(" · ")) + '</div>' : "") +
    (tiersHtml ? '<div class="admin-tiers"><span class="admin-tiers-lbl">' + ctx.esc(ctx.L("adminTier")) + ':</span> ' + tiersHtml + '</div>' : "") +
    '<div class="admin-skins">' + skinsHtml + '</div>' +
    (a.description ? '<div class="admin-desc">' + ctx.esc(a.description) + '</div>' : "") +
    '</article>';
}

function renderAdminResults(){
  var area = ctx.productArea;
  if (!area) return;
  var head = '<div class="admin-head">' +
    '<button type="button" class="btn btn-ghost admin-back" data-admin-back>' + ctx.esc(ctx.L("adminBack")) + '</button>' +
    '<span class="admin-count">' + ctx.esc(ctx.L("adminFound").replace("{n}", String(total))) +
    ' · <span class="admin-q">“' + ctx.esc(currentQuery) + '”</span></span></div>';
  if (!results || !results.length){
    area.innerHTML = head + '<div class="empty-box"><b>' + ctx.esc(ctx.L("adminEmpty")) + '</b></div>';
  } else {
    var html = head + '<div class="admin-list">' + results.map(resultCardHtml).join("") + '</div>';
    if (results.length < total){
      html += '<div class="admin-more-wrap"><button type="button" class="btn btn-wine" data-admin-more>' +
        ctx.esc(ctx.L("adminMore")) + ' (' + results.length + '/' + total + ')</button></div>';
    }
    area.innerHTML = html;
  }
  if (ctx.prodCount) ctx.prodCount.textContent = total + " acc Random";
}

function showAdminLoading(){
  var area = ctx.productArea;
  if (!area) return;
  showingAdmin = true;
  ctx.setAdminSearchActive(true);
  area.innerHTML = '<div class="admin-head">' +
    '<button type="button" class="btn btn-ghost admin-back" data-admin-back>' + ctx.esc(ctx.L("adminBack")) + '</button></div>' +
    '<div class="empty-box"><b>' + ctx.esc(ctx.L("adminLoading")) + '</b></div>';
}

function restoreNormalGrid(){
  showingAdmin = false;
  results = null;
  total = 0;
  currentOffset = 0;
  ctx.setAdminSearchActive(false);
  /* Về lưới thường với đúng chữ đang gõ trong ô tìm kiếm (anti-leak). */
  ctx.applyNormalQuery(ctx.searchInput ? ctx.searchInput.value.trim() : "");
  ctx.renderProducts();
}

function fetchAdminSearch(q, offset, attempt){
  /* attempt: số lần đã thử lại sau lỗi mạng (0 = lần đầu). Render free hay
     ngủ / chập chờn nên fetch có thể rớt mạng thoáng qua — thử lại tối đa
     2 lần (tổng 3 lần) trước khi báo lỗi, để khỏi bắt user bấm tìm lại. */
  attempt = attempt || 0;
  var MAX_ATTEMPTS = 3;
  var seq = ++reqSeq;
  var url = String(ctx.apiBase || "").replace(/\/$/, "") +
    "/api/admin/random-search?q=" + encodeURIComponent(q) +
    "&limit=" + currentLimit + "&offset=" + offset;
  return ctx.fetchFn(url, {
    method: "GET",
    headers: { "Authorization": "Bearer " + (ctx.getToken() || "") },
    credentials: "include"
  }).then(function(r){
    return r.text().then(function(text){
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { status: r.status, ok: r.ok, data: data };
    });
  }).then(function(res){
    if (seq !== reqSeq) return; // response cũ (user đã gõ query mới) — bỏ
    if (res.status === 403){
      /* Server nói không còn quyền admin: toast + tự tắt toggle. */
      ctx.toast(ctx.L("adminNoPerm"), "error");
      setOn(false);
      return;
    }
    if (!res.ok || !res.data || res.data.ok === false){
      ctx.toast((res.data && (res.data.message || res.data.error)) || ("HTTP " + res.status), "error");
      restoreNormalGrid(); // giữ toggle bật để gõ lại thử tiếp
      return;
    }
    var list = Array.isArray(res.data.results) ? res.data.results : [];
    if (offset > 0 && results){
      results = results.concat(list);
    } else {
      results = list;
    }
    total = (typeof res.data.total === "number") ? res.data.total : results.length;
    currentOffset = offset;
    showingAdmin = true;
    ctx.setAdminSearchActive(true);
    renderAdminResults();
  }).catch(function(err){
    if (seq !== reqSeq) return;
    if (attempt + 1 < MAX_ATTEMPTS){
      /* Lỗi mạng thoáng qua (Render đang tỉnh dậy / chập chờn): thử lại
         sau 1.5s, giữ nguyên màn hình đang tải để user không phải bấm lại.
         Dùng attempt+1 và cùng seq để lần thử lại vẫn là "mới nhất". */
      var nextAttempt = attempt + 1;
      setTimeout(function(){
        if (seq !== reqSeq) return;
        /* Giữ loading, không toast lỗi ở lần thử lại. */
        fetchAdminSearch(q, offset, nextAttempt);
      }, 1500);
      return;
    }
    /* Hết 3 lần thử vẫn rớt mạng: toast rõ ràng, giữ toggle để thử lại. */
    ctx.toast(ctx.L("netErr"), "error");
    restoreNormalGrid();
  });
}

function onAdminQuery(q){
  /* Được app.js gọi (đã debounce 120ms) khi toggle admin đang BẬT. */
  if (!initialized || !on) return;
  currentQuery = q || "";
  if (!currentQuery){
    /* Query rỗng (bấm × / xoá hết): về tìm kiếm thường, không gọi API. */
    restoreNormalGrid();
    return;
  }
  if (!ctx.backendReady || !ctx.backendReady()){
    ctx.toast(ctx.L("adminNoBackend"), "error");
    setOn(false);
    return;
  }
  showAdminLoading();
  fetchAdminSearch(currentQuery, 0);
}

function loadMore(){
  if (!initialized || !on || !results || results.length >= total) return;
  fetchAdminSearch(currentQuery, results.length);
}

function setOn(next){
  on = !!next;
  if (toggleBtn){
    toggleBtn.classList.toggle("on", on);
    toggleBtn.setAttribute("aria-pressed", String(on));
  }
  ctx.setAdminSearchMode(on);
  if (on){
    syncAdminPlaceholder(); // đặt placeholder admin (đồng thời ghi nhớ placeholder thường)
  } else if (ctx.searchInput){
    ctx.searchInput.placeholder = savedPlaceholder || "";
  }
  ctx.closeSuggest();
  if (!on){
    /* Tắt toggle: về tìm kiếm thường với đúng query đang gõ (anti-leak). */
    restoreNormalGrid();
  } else if (ctx.searchInput && ctx.searchInput.value.trim()){
    onAdminQuery(ctx.searchInput.value.trim());
  }
}

export function syncAdminPlaceholder(){
  /* Đổi ngôn ngữ (applyLang) vẽ lại placeholder ô tìm kiếm -> vẽ lại theo
     chế độ admin. Chỉ chạy khi toggle đang BẬT: ghi nhớ placeholder thường
     hiện tại (đã đổi theo ngôn ngữ mới) rồi đè bằng placeholder admin. Khi
     toggle TẮT thì không động vào placeholder (applyLang đã vẽ đúng). */
  var inp = ctx && ctx.searchInput;
  if (!inp) return;
  if (on){
    if (inp.placeholder !== ctx.L("adminSearchPh")) savedPlaceholder = inp.placeholder;
    inp.placeholder = ctx.L("adminSearchPh");
  }
  if (toggleBtn){
    var lbl = toggleBtn.querySelector(".admin-toggle-lbl");
    if (lbl) lbl.textContent = ctx.L("adminToggle");
  }
}

export function initAdminRandomSearch(c){
  if (initialized) return; // gọi 2 lần (vd /me chạy lại) thì giữ nguyên
  if (!c || !c.searchInput || !c.productArea) return;
  ctx = c;
  if (!ctx.backendReady || !ctx.backendReady()){
    ctx.toast(ctx.L("adminNoBackend"), "error");
    ctx = null;
    return;
  }
  savedPlaceholder = ctx.searchInput.placeholder || "";
  initialized = true;

  /* Huy hiệu ADMIN nhỏ cạnh tên user (trong #userChip, topbar). */
  if (ctx.userChip && !ctx.userChip.querySelector(".admin-badge")){
    badge = ctx.doc.createElement("span");
    badge.className = "admin-badge";
    badge.textContent = "ADMIN";
    badge.title = "Tài khoản quản trị";
    ctx.userChip.appendChild(badge);
  }

  /* Nút toggle ngay cạnh ô tìm kiếm (trong .toolbar, sau .search-wrap). */
  var wrap = ctx.searchWrap;
  if (wrap && wrap.parentNode && !wrap.parentNode.querySelector(".admin-toggle")){
    toggleBtn = ctx.doc.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "toggle-btn admin-toggle";
    toggleBtn.setAttribute("aria-pressed", "false");
    var dot = ctx.doc.createElement("span");
    dot.className = "dotsw";
    var lbl = ctx.doc.createElement("span");
    lbl.className = "admin-toggle-lbl";
    lbl.textContent = ctx.L("adminToggle");
    toggleBtn.appendChild(dot);
    toggleBtn.appendChild(lbl);
    wrap.parentNode.insertBefore(toggleBtn, wrap.nextSibling);
    toggleBtn.addEventListener("click", onToggleClick);
  }

  /* Đổi danh mục / sắp xếp / lọc "Còn hàng" trong lúc đang soi -> thoát
     chế độ admin để lưới thường render đúng bộ lọc mới. */
  function addBound(el, type, fn){
    if (!el) return;
    el.addEventListener(type, fn);
    boundHandlers.push({ el: el, type: type, fn: fn });
  }
  addBound(ctx.catChips, "click", onChipsClick);
  addBound(ctx.sortSelect, "change", onChipsClick);
  addBound(ctx.stockToggle, "click", onChipsClick);
  addBound(ctx.productArea, "click", onProductAreaClick);

  ctx.registerAdminQueryHandler(onAdminQuery);
  syncAdminPlaceholder();
}

export function cleanupAdminRandomSearch(){
  if (!initialized && !ctx) return;
  reqSeq++; // vô hiệu hoá mọi response admin đang bay (không render sau logout)
  var wasOn = on;
  on = false;
  showingAdmin = false;
  results = null; // xoá sạch dữ liệu skin Random khỏi RAM
  total = 0;
  currentQuery = "";
  currentOffset = 0;
  boundHandlers.forEach(function(h){
    try { h.el.removeEventListener(h.type, h.fn); } catch (e) { /* bỏ qua */ }
  });
  boundHandlers = [];
  if (toggleBtn && toggleBtn.parentNode) toggleBtn.parentNode.removeChild(toggleBtn);
  if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
  toggleBtn = null;
  badge = null;
  if (ctx){
    try {
      ctx.registerAdminQueryHandler(null);
      ctx.setAdminSearchMode(false);
      ctx.setAdminSearchActive(false);
      if (ctx.searchInput){
        ctx.searchInput.value = "";
        /* Chỉ khôi phục placeholder khi toggle đang bật lúc logout; còn
           toggle đã tắt thì placeholder thường đã đúng, không động vào. */
        if (wasOn) ctx.searchInput.placeholder = savedPlaceholder || "";
      }
      ctx.resetSearch();
      ctx.renderProducts(); // khôi phục lưới thường (anti-leak như khách thường)
    } catch (e) { /* không chặn logout */ }
  }
  savedPlaceholder = "";
  ctx = null;
  initialized = false;
}

/* Dùng cho test (tests/test-admin-frontend.js): chỉ trả số lượng, KHÔNG trả
   dữ liệu skin — để assert RAM đã xoá sạch sau logout mà không lộ skin. */
export function getAdminDebugState(){
  return {
    initialized: initialized,
    on: on,
    showingAdmin: showingAdmin,
    resultsCount: results ? results.length : 0,
    total: total,
    currentQuery: currentQuery
  };
}
