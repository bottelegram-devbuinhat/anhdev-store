/* ============================================================================
   Test frontend — Acc trang tach rieng + xao tron thu tu hien thi
   ----------------------------------------------------------------------------
   Chay:  NODE_PATH=/tmp/node_modules node tests/test-white-shuffle.js
   (tu thu muc files/store-upgrade/)
   Can: jsdom (da co o /tmp/node_modules), stock.json that o
   ../anhdev-store-push/stock.json (de co acc that trong luoi).

   Kich ban:
     a. Acc trang (kind=white, 13 acc) duoc tach rieng thanh muc "white":
        - chip + nut nav "white" ton tai trong DOM.
        - loc cat=white -> dung 13 acc, the hien "Acc trang thong tin",
          khong kem mo ta goc ("acc ban").
        - loc cat=detail (san thong tin) -> dung 867 acc (khong con 13 acc
          trang tron chung nua; truoc day detail gom 880 = 867 + 13).
     b. Acc random van o muc rieng: loc cat=random-tele -> 11246 acc.
     c. Thu tu hien thi duoc xao tron:
        - sort mac dinh la "shuffle", option shuffle ton tai trong select.
        - 12 the trang 1 (xem "Tat ca") KHONG theo thu tu ma trong stock.json
          (chi so stock.json cua 12 the khong tang dan — xac suat trung hop
          ~1/12! nen gan nhu khong the sai).
        - doi sort sang "price-asc" -> the re nhat len dau; doi lai
          "shuffle" -> thu tu khong con tang theo gia nua (xao lai).
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
const ACCOUNTS = stock.accounts || [];
const TOTAL = ACCOUNTS.length; // tong kho that, tu stock.json
const IDX = {};   // code -> vi tri trong stock.json
const PRICE = {}; // code -> gia
ACCOUNTS.forEach(function(a, i){ IDX[a.code] = i; PRICE[a.code] = a.price; });
const WHITE_CODES = ACCOUNTS.filter(function(a){ return a.kind === "white"; }).map(function(a){ return a.code; });
const INFO_COUNT = ACCOUNTS.filter(function(a){ return a.kind === "info"; }).length;
const RANDOM_COUNT = ACCOUNTS.filter(function(a){ return a.kind === "random"; }).length;

/* ---------- fake backend -------------------------------------------------- */
function makeResp(status, obj){
  return { ok: status >= 200 && status < 300, status: status,
           text: function(){ return Promise.resolve(JSON.stringify(obj)); },
           json: function(){ return Promise.resolve(obj); } };
}
function fakeFetch(url, opts){
  const u = String(url);
  if (u.indexOf("stock.json") !== -1) return Promise.resolve(makeResp(200, stock));
  if (u.indexOf("/api/shop/sold-codes") !== -1)
    return Promise.resolve(makeResp(200, { ok: true, codes: [] }));
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

async function makePage(){
  const appSrc = appJs.replace(/var API_BASE_URL = "[^"]*";/,
    'var API_BASE_URL = "' + API_URL + '";');
  const dom = new JSDOM(html, { url: "https://bottelegram-devbuinhat.github.io/anhdev-store/",
    runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = function(){ return { matches: false, media: "", addEventListener: function(){}, removeEventListener: function(){} }; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return null; };
  w.fetch = fakeFetch;
  dom.window.eval(animJs);
  dom.window.eval(appSrc);
  for (let i = 0; i < 40; i++){
    await sleep(150);
    const pc = w.document.querySelector("#prodCount");
    if (pc && pc.textContent.indexOf(String(TOTAL)) !== -1) break;
  }
  await sleep(600);
  return { dom: dom, w: w };
}
function prodCount(w){
  const el = w.document.querySelector("#prodCount");
  return el ? el.textContent : "";
}
function pageCodes(w){
  // Ma acc cua 12 the dang hien tren trang, theo dung thu tu DOM.
  return Array.from(w.document.querySelectorAll("#productArea [data-buy]"))
    .map(function(b){ return (b.getAttribute("data-buy") || "").replace(/^api-/, ""); })
    .filter(function(c){ return !!c; });
}
function clickChip(w, cat){
  const chip = w.document.querySelector('#catChips [data-cat="' + cat + '"]');
  if (!chip) return false;
  chip.click();
  return true;
}
function setSort(w, value){
  const sel = w.document.querySelector("#sortSelect");
  sel.value = value;
  sel.dispatchEvent(new w.Event("change", { bubbles: true }));
}
function isAscending(arr){
  // Tang chat (dung cho chi so stock.json — cac chi so la duy nhat).
  for (let i = 1; i < arr.length; i++) if (arr[i] <= arr[i - 1]) return false;
  return true;
}
function isNonDecreasing(arr){
  // Khong giam (dung cho gia — nhieu acc cung gia 3000d nen bang nhau la binh thuong).
  for (let i = 1; i < arr.length; i++) if (arr[i] < arr[i - 1]) return false;
  return true;
}

(async function(){
  console.log("== a. Acc trang tach rieng thanh muc 'white' ==");
  const p1 = await makePage();
  const w = p1.w;
  check("a0. luoi du " + TOTAL + " acc luc tai trang",
    prodCount(w).indexOf(TOTAL + " / " + TOTAL) !== -1, prodCount(w));
  check("a1. chip 'Acc trang thong tin' ton tai",
    !!w.document.querySelector('#catChips [data-cat="white"]'));
  check("a2. nut nav sidebar 'Acc trang thong tin' ton tai",
    !!w.document.querySelector('[data-catlink="white"]'));
  check("a3. loc cat=white -> dung " + WHITE_CODES.length + " acc",
    clickChip(w, "white") && prodCount(w).indexOf(WHITE_CODES.length + " / " + TOTAL) !== -1, prodCount(w));
  const whiteCards = Array.from(w.document.querySelectorAll("#productArea .card"));
  check("a4. the acc trang hien nhan 'Acc trang thong tin'",
    whiteCards.length > 0 && whiteCards.every(function(c){
      return c.querySelector(".desc") && c.querySelector(".desc").textContent.indexOf("Acc trắng thông tin") !== -1;
    }), "cards=" + whiteCards.length);
  check("a5. the acc trang KHONG lo mo ta goc ('acc ban')",
    whiteCards.every(function(c){
      return !c.querySelector(".desc") || c.querySelector(".desc").textContent.indexOf("acc ban") === -1;
    }));
  check("a6. loc cat=detail (san thong tin) -> dung " + INFO_COUNT + " acc, khong con acc trang tron chung",
    clickChip(w, "detail") && prodCount(w).indexOf(INFO_COUNT + " / " + TOTAL) !== -1, prodCount(w));
  const detailCodes = pageCodes(w);
  check("a7. trang 1 cua detail khong co acc trang nao",
    detailCodes.every(function(c){ return WHITE_CODES.indexOf(c) === -1; }),
    "detail page1: " + detailCodes.slice(0, 5).join(","));

  console.log("== b. Acc random van o muc rieng ==");
  check("b1. loc cat=random-tele -> dung " + RANDOM_COUNT + " acc",
    clickChip(w, "random-tele") && prodCount(w).indexOf(RANDOM_COUNT + " / " + TOTAL) !== -1, prodCount(w));

  console.log("== c. Thu tu hien thi duoc xao tron ==");
  const p2 = await makePage();
  const w2 = p2.w;
  const sel = w2.document.querySelector("#sortSelect");
  check("c1. sort mac dinh la 'shuffle'",
    sel && sel.value === "shuffle", "value=" + (sel && sel.value));
  check("c2. option 'shuffle' ton tai trong select",
    !!w2.document.querySelector('#sortSelect option[value="shuffle"]'));
  clickChip(w2, "all");
  const codes1 = pageCodes(w2);
  check("c3. trang 1 co du 12 the", codes1.length === 12, "got " + codes1.length);
  const idxSeq = codes1.map(function(c){ return IDX[c]; });
  check("c4. 12 the trang 1 KHONG theo thu tu ma stock.json (da xao tron)",
    codes1.length === 12 && !isAscending(idxSeq),
    "idx: " + idxSeq.join(","));
  check("c5. the dau tien khong phai acc dau tien cua stock.json (" + ACCOUNTS[0].code + ")",
    codes1[0] !== ACCOUNTS[0].code, "first=" + codes1[0]);

  console.log("== d. Doi sort sang gia roi doi lai shuffle ==");
  setSort(w2, "price-asc");
  const ascCodes = pageCodes(w2);
  const ascPrices = ascCodes.map(function(c){ return PRICE[c]; });
  const minPrice = Math.min.apply(null, ACCOUNTS.map(function(a){ return a.price; }));
  check("d1. sort price-asc: 12 the trang 1 khong giam theo gia",
    ascCodes.length === 12 && isNonDecreasing(ascPrices),
    "prices: " + ascPrices.slice(0, 6).join(","));
  check("d2. sort price-asc: the dau tien co gia re nhat (" + minPrice + "d)",
    ascCodes.length > 0 && PRICE[ascCodes[0]] === minPrice,
    "first=" + ascCodes[0] + " price=" + PRICE[ascCodes[0]]);
  setSort(w2, "shuffle");
  const shufCodes = pageCodes(w2);
  const shufIdx = shufCodes.map(function(c){ return IDX[c]; });
  // [VA 2026-11-26] d3 cu dung gia (!isNonDecreasing): 92.3% acc gia 3000d
  // nen 12 the xao ngau nhien thuong toan 3000d -> "khong giam" -> FAIL do
  // may rui, khong phai loi. Doi sang chi so stock (duy nhat): 12 the xao
  // hau nhu khong bao gio theo thu tu tang dan cua stock.json.
  check("d3. doi lai shuffle: 12 the trang 1 khong con theo thu tu cu (da xao lai)",
    shufCodes.length === 12 && !isAscending(shufIdx),
    "idx: " + shufIdx.join(","));
  check("d4. doi lai shuffle: thu tu the doi khac luc price-asc",
    shufCodes.join(",") !== ascCodes.join(","));

  console.log("\n" + pass + " PASS, " + fail + " FAIL");
  if (failures.length) console.log("FAILURES: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})().catch(function(e){ console.error(e); process.exit(1); });
