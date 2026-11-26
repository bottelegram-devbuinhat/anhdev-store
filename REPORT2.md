# AnhDev Store — Batch 2 Upgrade Report (Performance + Autocomplete + Sidebar Fix)

Batch 2, built on top of batch 1 (already deployed: anhdev-store main `6159c27`).
Files changed in place in `files/store-upgrade/` — **nothing pushed; deploy is the parent's step**.

| File | Before | After |
|---|---|---|
| `index.html` | 65,638 B | 68,470 B |
| `assets/app.js` | 75,267 B | 102,924 B |
| `assets/animations.js` | 8,620 B | 9,583 B |
| `assets/animations.css` | 11,635 B | 13,479 B |
| `assets/*.webp` (4 images) | — | unchanged from batch 1 |
| `REPORT2.md` | — | new (this file) |

Deploy: upload `index.html`, `assets/app.js`, `assets/animations.js`, `assets/animations.css`
(all small — connector push works). Images are unchanged from batch 1, no re-upload needed.
Do NOT include `stock.json`.

---

## 1. Sidebar jump / flash-to-Home bug — root cause + fix

### Root cause (verified in code, `assets/app.js`)

There were **no hash anchor links** in the sidebar (all controls were already
`<button>`), so `preventDefault` on hashes was not the issue. The real cause was
two smooth scrolls fighting each other:

1. `showView()` **unconditionally** ran `window.scrollTo({top:0, behavior:"smooth"})`
   on every view switch.
2. The `[data-catlink]` handler (e.g. "Random Liên Quân", "Acc sẵn thông tin") and
   the `[data-scroll]` handler (quick cards, bottom-nav "Kho acc") then ran
   `setTimeout(..., 60)` → `scrollIntoView(#products, smooth)`.

So clicking a category did: switch view → **smooth-scroll up to the top (hero
"Trang Chủ" visible)** → 60 ms later smooth-scroll back down to the catalog.
That is the flash. Plain nav items (Lịch Sử, Bảng Xếp Hạng, Ngân Hàng, Nạp Thẻ,
Hoá Đơn) also smooth-scrolled to top from deep scroll positions, which read as a
jump. `html{scroll-behavior:smooth}` made even the "plain" `scrollTo(0,0)` animate.

A second, related bug: **two items highlighted at once.** `showView()` toggled
`.active` on every `[data-nav]` — but the bottom-nav "Kho acc" button ALSO has
`data-nav="home"`, so "Trang Chủ" (sidebar) and "Kho acc" (bottom nav) lit up
together. Category links (`data-catlink`) have no `data-nav` at all, so "Trang Chủ"
stayed lit while the user was browsing Random.

### Fix (`assets/app.js`, `assets/animations.js`, `assets/animations.css`)

- **`setActiveNav(key)` is now the single source of truth** — the only function
  allowed to change `.active` in the sidebar + bottom nav. Keys:
  `home`, `home:products`, `orders`, `leaderboard`, `topup:qr`, `topup:card`,
  `invoices`, `account`, `payment` (clears all — it is not a nav tab),
  `cat:<category>`. `showView()` and `setTopupTab()` both go through it.
  Category selection marks the submenu item active, keeps the "Mua Tài Khoản"
  submenu expanded, and marks bottom-nav "Kho acc" active.
- **Atomic view switching**: `showView(name, opts)` swaps the `.view` classes in
  one synchronous pass, then scrolls exactly once — no `setTimeout`, no
  intermediate scroll to top:
  - target view ≠ home, or home with no scroll target → **instant** scroll to
    top (`instantScrollTop()` — temporarily sets `scroll-behavior:auto` because
    the CSS `smooth` would otherwise animate it).
  - home with a scroll target → `scrollIntoView(target, smooth)` **directly**,
    after the filtered state is already rendered (`renderProducts()` runs first
    in the catlink handler, same JS task — nothing paints in between).
  - `prefers-reduced-motion` → `behavior:"auto"` everywhere.
- **Modals open in place, no scroll reset**: `animations.js` scroll-lock was
  `body{overflow:hidden}` only, which can jump the page to top on some WebViews.
  Replaced with the standard fixed-body lock: on open, `body{position:fixed;
  top:-scrollY}`; on close, restore `scrollY` instantly. CSS:
  `body.modal-lock{position:fixed;left:0;right:0;overflow:hidden}`.
- The sliding nav indicator (`animations.js`, MutationObserver on `.active`)
  now tracks exactly one active item, so it no longer jumps between two.

---

## 2. Smart search autocomplete

### What is indexed

`buildSearchIndex()` runs **once** whenever `PRODUCTS` changes (initial demo
catalog, then again when live `stock.json` arrives; if the network returns the
same `updated_at` as the cache, only `_searchKey` is recomputed — `keyProducts()`).
It reads **only the public `PRODUCTS` array** (post-`apiProduct()`), never the raw
stock fields.

Per product:
- **`_searchKey`** — `normText(name + " " + desc)` (diacritics stripped + lowercased
  once). Live filtering is then just `indexOf` per token.
- **Phrases** (for suggestions), extracted from the public name/desc:
  - full skin names: `"Nakroth Lôi Quang Sứ"`, `"Murad Siêu việt"`,
    `"Tulen Tân thần thiên hà"` (each `rare_skins` entry, split on `,`);
  - hero names: first word of each skin name (`"Nakroth"`, `"Murad"`, `"Tulen"`,
    `"Yorn"`, …);
  - skin tiers with a real count: `SSS / SS+ / SS / S+ / SSM / Anime` — an account
    counts for a tier only if its stats say `N > 0` (`sss:2`, …). The coarse label
    `"[100% Skin SS / SS+]"` is deliberately **not** used (it is a group name:
    an account labelled that way can have `ss+:0`);
  - ranks: `"Cao Thủ"`, `"Tinh Anh"`, `"Chiến Tướng"`, … (from `Rank …`);
  - full demo-pack names (`"100% Skin SSS"`, `"Random Tài Khoản 100% Có Skin
    Thứ Nguyên Vệ Thần"`) and category names (`"Acc sẵn thông tin"`, …).
  - **excluded**: account codes (`Acc LQxxxxx` — searchable via the grid filter,
    never suggested), generic stop-words (`acc`, `random`, `skin`, `tài`, `khoản`),
    the stats tail (`(sss:0, …)`), and sentence tails after `—`.

On the live stock (12,126 accounts: 11,246 random + 880 detail) the index holds
**201 phrases**. Top "Popular Keywords" (empty-focus, 6): `S+ (866)`, `SS (862)`,
`Anime (850)`, `SS+ (742)`, `Tinh Anh (726)`, `Yorn (490)`.

### Anti-leak (verified by test)

Random accounts contribute **only** the generic phrase `"Acc Random"` (plus the
category phrase). Their hidden skins/heroes/rank/notes never enter the index or
the filter, because both read the masked `apiProduct()` output. Verified on real
stock: queries `nakroth, murad, tulen, florentino, sss, ss, anime, cao thủ,
tinh anh, killua, thu nguyen` match **0 random accounts**, in both suggestions
and grid filtering.

**Important measurement note:** batch 1 reported `"nakroth ki" = 60 acc` and
`"murad" = 1,119 acc` against raw `stock.json` fields. Those counts **included
random accounts' hidden data** (51 of the 60 "nakroth ki" hits and 957 of the
1,119 "murad" hits are random accounts). The correct public counts are
`"nakroth ki" = 9` and `"murad" = 162` (detail accounts only). This is the
anti-leak rule working as specified, not a regression — the old numbers could
only be reached by reading hidden random-account data. Likewise `"thu nguyen"`
(56 raw hits) correctly yields **no suggestion**: all 56 are hidden random data,
and the skin names `"Nakroth Thứ Nguyên Vệ Thần"`, `"Nakroth Killua"`,
`"Florentino Tinh Hệ"` do not occur in **any** account in this stock snapshot
(0 hits in raw data too) — they will appear automatically once such skins exist
in public (detail) stock.

### Matching, ranking, UX

- `120ms` debounce on input; suggestions: **6–8**, ranked (1) exact prefix of
  the whole query → (2) every token is a word-prefix → (3) every token is a
  substring; ties by higher account count. Only phrases with ≥ 1 account.
- Multi-word + partial-word: `"nakroth ki"` prioritises phrases containing both
  tokens; `"nak"` (alias) → Nakroth phrases; `"thu nguyen"` matches
  `"Thứ Nguyên …"` (diacritics normalised once at index time).
- Empty focus shows 5–6 Popular Keywords (one-tap filter). Keyboard:
  `ArrowUp/Down`, `Enter` (apply), `Escape`/outside-click/focus-out closes,
  `input.blur()` on selection for coarse pointers, native `×` (`search` event)
  resets immediately.
- Rendering is **XSS-safe**: rows are built with `createElement` +
  `createTextNode()`; matched characters are bolded with `<strong>` +
  `textContent` (`labelWithHighlight`, ranges computed on the normalised label —
  Vietnamese normalisation preserves string length, so indices map 1:1; a
  length-mismatch guard falls back to plain text). No `innerHTML` for highlights.
- Styles: `assets/animations.css` §13 (`.search-suggest`, `.sug-row`,
  `.sug-count`, …), light + dark via semantic variables, `150ms`
  opacity + translateY open/close.

### Adding a new hero/skin alias later

Edit **one map** in `assets/app.js` — `SEARCH_ALIASES` (top of the search
section):

```js
var SEARCH_ALIASES = {
  nak:"nakroth", flo:"florentino", mu:"murad", /* … */
  abc:"ten tuong moi"   // <- thêm dòng mới: key = từ người dùng gõ, value = từ chuẩn
};
```

No other code changes needed. Alias values may be multi-word (`tri:"triệu vân"`).
New hero/skin **names** need no code change at all — they are extracted from the
public stock automatically at the next index build. (Aliases only exist for
short typing; the index already contains every hero/skin name in public stock.)

---

## 3. Performance & UI audit checklist

### Performance

| # | Bottleneck / change | File |
|---|---|---|
| P1 | Live filtering re-lowercased 12,126 `name + desc` strings per keystroke → pre-computed `_searchKey` once per product at index time; filter is now pure `indexOf` | `assets/app.js` (`buildSearchIndex`, `visibleProducts`) |
| P2 | Search used to scan raw strings on every keystroke → one-time in-memory index (`SEARCH_INDEX`) + `120ms` debounce; suggestions iterate the ~200-phrase map, never the 12k accounts | `assets/app.js` |
| P3 | `renderProducts()` wrote `innerHTML` three ways → single `DocumentFragment` append via `setAreaHtml()` (detached parse + one append, no incremental reflow) | `assets/app.js` |
| P4 | Pagination already 12/page (batch 1) — kept; no thousands of DOM nodes | — (verified intact) |
| P5 | Click handling was already delegated (`#productArea` + document-level `[data-buy]`) — verified, no per-card listeners exist | — (verified) |
| P6 | `stock.json` (~15 MB) re-fetched with `cache:"no-store"` on every visit → **IndexedDB** cache (`anhdev-store` DB, `kv` store), stale-while-revalidate: cached snapshot renders instantly, network refreshes in the background, `idbPut` on success. **Never `localStorage`** (5 MB cap). Freshness still judged by `data.updated_at` (≤ 7 days), not by cache time | `assets/app.js` (`idbOpen/idbGet/idbPut/stockAgeOk/syncStock`) |
| P7 | Hero banner had no fetch priority → `fetchpriority="high"` (kept `loading="eager"`, `width/height`) | `index.html` |
| P8 | Card thumbnails already `loading="lazy" decoding="async"` (batch 1) — verified; `.card-cover` has fixed `158px` height + `content-visibility:auto; contain-intrinsic-size:auto 340px` on `.card` (skip off-screen paint, no CLS) | `index.html` |
| P9 | `qrcodejs` from cdnjs was loaded on every page but **never used** (`QRCode` appears 0× in code; VietQR is an `<img>` from `img.vietqr.io`) → script tag removed; `cdnjs.cloudflare.com` also removed from the CSP `script-src` | `index.html` |
| P10 | `telegram-web-app.js` was render-blocking → `defer` (still executes before deferred `app.js`, order preserved) | `index.html` |
| P11 | Preconnects added for `img.vietqr.io` and the Cloudflare Worker domain (fonts already had them) | `index.html` |
| P12 | `resize` listener repositioned the nav indicator on every event → `requestAnimationFrame`-throttled; scroll listener was already `{passive:true}` + rAF (animations.js) — verified, no other scroll/touch listeners exist in `app.js` | `assets/animations.js` |

Measured (Node, real 12,126-account stock, best of 7 runs): filter
`"nakroth ki"` **1.85 ms**, `"murad"` 0.63 ms, `"sss"` 0.50 ms (target < 15 ms).
Index build: **~280 ms** one-time; skipped on repeat loads with identical
`updated_at` (only `_searchKey` recomputed).

### UI bugs found & fixed

| # | Bug | Fix (file) |
|---|---|---|
| U1 | **Sidebar jump/flash to Home** — see §1 | `assets/app.js`, `assets/animations.js`, `assets/animations.css` |
| U2 | **Two sidebar items active at once** ("Trang Chủ" + bottom-nav "Kho acc", both `data-nav="home"`; category links never got `.active`) — see §1 | `assets/app.js` (`setActiveNav`) |
| U3 | Outdated sample-catalog warning banner ("Không kết nối được kho thật — đang hiển thị catalog mẫu…") shown even though real stock is live | `setSyncStatus()` now hides `#syncStatus` when `mode==="demo"` (`assets/app.js`). Demo fallback still renders; banner returns automatically when fresh stock loads |
| U4 | Sidebar top clipped the balance/demo badge when scrolling | Logo header pinned: `.brand{position:sticky;top:-20px;…}` with opaque background covering the padding area; `overscroll-behavior:contain` on `.sidebar` (`index.html`) |
| U5 | Bulky native scrollbar between sidebar and content | Thin custom scrollbar: `scrollbar-width:thin`, 6px rounded `::-webkit-scrollbar-thumb` in `var(--line)` (light/dark adaptive), applied to `.sidebar`, `.modal`, `.search-suggest` (`index.html`, `assets/animations.css`) |
| U6 | Yellow inventory banner (`#syncStatus`, "…mua chắc chắn qua bot @devbn_bot") clipped `@devbn_bot` at the right edge | `.sync-status{overflow-wrap:break-word;word-break:break-word}` (`index.html`) |
| U7 | **Currency sync gaps**: check-in badge hardcoded `1–500đ`; top-up amount buttons (`10.000đ`…), card denominations, `amtLabel` "Số tiền nạp (đ)", `amtHint` "Tối thiểu 1.000đ" never converted; invoices used `fmtVND` directly | New `refreshMoneyLabels()` (called from `refreshUserUI()`, i.e. on every currency/language change) rewrites all of them via `fmt()`; invoices / deposit toasts / pay-status now use `fmt()` (`assets/app.js`). **Intentional exception:** `#payAmount` on the payment page stays `fmtVND` — it is the real bank-transfer amount, and SePay only matches exact VND |
| U8 | **Language sync gaps**: buy modal, purchase-success credentials, orders/invoices/account empty + login states, account summary rows were hardcoded Vietnamese HTML strings | ~30 new `DYN` keys; `openBuyModal/openBotBuyModal/completePurchase/renderOrders/renderInvoices/renderAccount` now use `L()`; `applyLang()` also re-renders orders/invoices/account/check-in; `prodCount` and the "X đơn" counter are language-aware (`assets/app.js`) |
| U9 | **Dark-mode contrast**: `--wine` is light green (`#5ec49a`) in dark mode but was used as a button background with white text (`#fff` on `#5ec49a` ≈ 2.2:1) in `.btn-wine`, `.buy-btn`, `.chip.on`, `.pg-btn`, `.pg-num.on`, `.step .num`, `.theme-toggle button.on`, `.lb-you`, `.brand-mark` | New semantic pair `--wine-btn` / `--on-wine` (light: `#0d3b2e`/`#fff`; dark: `#5ec49a`/`#082a20`, ≈ 6.7:1) in all four theme blocks; all nine rules switched (`index.html`) |
| U10 | Z-indexes were scattered magic numbers (`30/35/40/45/80/120/200`) | Unified scale as CSS vars: `--z-topbar:30; --z-suggest:32; --z-scrim:35; --z-sidebar:40; --z-bottomnav:45; --z-modal:80; --z-toast:120; --z-confetti:200` — base < topbar < autocomplete < drawer/backdrop < modals < toasts < confetti (`index.html`, `assets/animations.css`) |
| U11 | Topbar could overflow at 360 px (burger + wallet + login + theme + avatar) | Wallet balance gets `min-width:0; overflow:hidden; text-overflow:ellipsis`; new `@media(max-width:400px)` tightens gaps/padding and hides the wallet icon (`index.html`) |
| U12 | Horizontal overflow safety net | `html,body{overflow-x:clip}` (unlike `hidden`, `clip` does not break `position:sticky`) (`index.html`) |
| U13 | "Mua acc trong 4 bước" guide | Already clean and compact — no change (verified) |

Contrast audit: all other surfaces (topbar, hero, quick cards, stats, search +
dropdown, cards, tables, modals, toasts, scrollbars) already use semantic
variables and passed; the payment card (`.pay-wrap`) is intentionally dark in
both themes (dark payment-card design), kept as-is.

Responsive: 360–430 px (ellipsis wallet pill, 400 px topbar tightening,
single-column grid at 328 px content width, `overflow-x:clip` guard) and
1280–1366 px (max-width 1240 px content, 3-column grid) reviewed in code.
**Not live-verified on a device** — see §4.

### Preserved (verified, not regressed)

- Batch 1: animations, CSP `<meta>`, XSS patches (`esc()` on card `img src` and
  invoice codes, avatar `photo_url` https-only), 0 inline `onclick`, random
  anti-leak in `apiProduct()`.
- Pagination 12/page (`PAGE_SIZE`, `pagerHtml`), multi-word AND search,
  emerald + champagne-gold theme, `"AnhDev Store"` logo, clear button (native
  `×` on `type="search"` + `search` event), sort selector (`"Mặc định"`),
  all category pills, `API_BASE` = real Worker URL, Telegram Login Widget /
  Mini App `initData` auth.
- 0 `onclick`, 0 `data:image` blobs, 0 `eval`/`document.write` in all files.

---

## 4. Verification log

- `node --check assets/app.js` — **PASS** (after every edit round).
- `node --check assets/animations.js` — **PASS**.
- **Search test vs real stock** (`/tmp/test_search.js`, extracted the shipped
  `==SEARCH-CORE==` + `==APIPRODUCT==` blocks verbatim, ran against
  `files/anhdev-store-push/stock.json`, 12,126 accounts): **31/31 passed** —
  index builds in ~280 ms (201 phrases); anti-leak holds for 11 skin/hero/rank
  queries (0 random matches); counts verified by independent brute-force recount
  (`nakroth` 9, `murad` 162, `tulen` 104, tiers `SSS` 46 / `SS` 862 / `SS+` 742 /
  `Anime` 850, all N>0); aliases `nak/flo/tri/mu` resolve; ranking + 8-cap hold;
  popular = 6 real keywords; filters 0.4–1.9 ms (< 15 ms); highlight ranges valid.
- **Demo-catalog test** (`/tmp/test_search_demo.js`): **7/7 passed** (pack
  phrases, `"thu nguyen"` suggests the public Thứ Nguyên pack, no junk phrases).
- HTML structure: tags balanced (`div` 123/123, `section` 7/7, `button` 51/51…),
  inline `<style>` braces 363/363, `animations.css` braces 131/131; all 80
  static IDs referenced by `app.js` exist in `index.html` except the 5 that
  `app.js` creates dynamically (`accLogin`, `accLogout`, `accTopup`,
  `checkinBtn`, `ordersLogin` — same as batch 1, guarded).

### Not verified (needs a live check after deploy)

- **No live browser test** (subagent has no live-browser access). After deploy,
  verify on a real phone + in the Telegram Mini App: no console errors; search
  dropdown opens with popular keywords on empty focus, suggestions appear while
  typing, arrow keys + Enter work, `×` clears; sidebar items switch views with
  **no flash to the hero** and exactly one active item; category links land
  directly on the filtered catalog; USD mode converts the check-in badge,
  top-up amounts and invoices; dark mode buttons are dark-text-on-green;
  balance shows `✓ Đồng bộ bot`; CSP does not block the Login Widget iframe or
  QR image. If anything visual misbehaves, first suspects: `content-visibility`
  on cards, the `body.modal-lock{position:fixed}` scroll lock, the sticky
  `.brand` header.
- VietQR QR scannability on a real phone (pre-existing, still open).
- USD display quirk (by design, not a bug): sub-dollar VND amounts round to
  `$0.00–$0.02` at the 25,400 rate — e.g. the check-in badge reads
  `$0.00–$0.02` in USD mode. It is consistent with the store's own conversion;
  fixing it would need a different rate/precision for tiny amounts.
- `content-visibility:auto` on cards + the stagger fade-in animation interact
  only when a card first scrolls into view (animation then plays) — intended.

---

## PART 5 — New features (frontend): web accounts + card top-up + check-in (2026-11-25)

Implements the user's two new features (card top-up via POST + username/password
accounts) plus the check-in wiring follow-up, on top of batch 1 + batch 2.
Nothing pushed — all local, awaiting the parent's deploy.

### Files changed

- `index.html` (70,966 bytes) — auth modal reworked to a real web-account form
  (username + password + confirm password `#passField2`, eye-toggle buttons with
  inline SVG, submit enabled); card telco select now
  VIETTEL/VINAPHONE/MOBIFONE/ZING/GARENA/VTC/GATE (VIETNAMOBILE removed);
  card amount select now 10000/20000/50000/100000/200000/500000
  (30000/300000/1000000 removed); discount table `#cardDiscountTable`,
  expected-credit line `#cardExpected`, backend note `#cardBackendNote`,
  submit button relabelled "Gửi thẻ"; CSP `connect-src` no longer lists
  thesieure.com (frontend never calls it directly) + HTML comment saying to
  add the backend VPS domain to `connect-src` when `BACKEND_API_BASE` is set;
  CSS for `.pw-eye` and `.card-disc`; **hero headline gold dot removed**
  (`ANHDEV<span class="dot">.</span>` → `ANHDEV`, dead `.hero h1 .dot` rule
  deleted too — see "User fixes" below).
- `assets/app.js` (123,076 bytes) — `BACKEND_API_BASE = ""` placeholder (line 25)
  + `backendReady()`; `CARD_DISCOUNT_RATES` (20% fee per telco, mirrors the
  backend's 0.8 receive-rate) + `CARD_TELCOS` (7 telcos); `state.discount` +
  `state.webToken`; new DYN keys (viaWeb, sending, eyeShow/eyeHide,
  authErrUser/authErrPass/authErrMatch/authErrGeneric, authNoBackend,
  authWelcome, balWebSynced, accSyncedWeb, accNoteWeb,
  cardNoBackend/cardNeedBoth/cardBadFormat/cardDemoSent/cardDemoOk/cardDemoNote/
  cardSentOk/cardSendFail, discRate, cardExpectedA/B, accLoginS, ordLoginS,
  ciOkA/ciOkB/ciAlready/ciErrGeneric); `refreshUserUI` web balance note + live
  discount badge; `refreshMoneyLabels` calls `renderCardDiscount()` /
  `updateCardExpected()`; `invoiceStorageKey` web-aware (`web_<username>`);
  `setUser` single-session semantics (web login clears saved Telegram session,
  Telegram login clears web token, logout clears token + fires backend logout,
  and resets check-in state); `backendFetch` (Bearer header +
  `credentials:"include"`, prefers server `message` over error code, attaches
  parsed body + status to thrown errors) + `saveWebToken` / `loadWebToken` /
  `clearWebToken` (localStorage key `anhdev_web_token`); `refreshWebBalance`
  web branch via `GET /api/auth/me` (reads nested `me.user`); auth rework
  (`setAuthMode`, eye toggle, `validateAuth` username `/^[a-z0-9_]{4,24}$/` +
  password ≥6 + confirm match, submit sends `password_confirm` — the backend
  field name — not `confirm_password`); `afterWebAuth` + `restoreWebSession`;
  web session restore at init; `renderAccount` web labels; `invoiceBadge`
  `wrong_amount` case; `refreshBackendInvoices()` (`GET /api/topup/invoices`,
  backend wins on matching `request_id`) hooked into `showView("invoices")`;
  **card section rework** (deleted `submitCardToThesieure` + old `#cardSubmit`
  handler; new backend-first flow: `POST /api/topup/card` with
  `{telco, amount, serial, code}`, invoice from response `request_id` /
  `status`, 15s-later balance+invoice refresh for web users, error path creates
  an invoice from `err.data.request_id` when present — covers backend 502
  gateway-unreachable and 400 card-rejected; demo fallback when
  `BACKEND_API_BASE` is empty, clearly labelled Demo, local simulation only,
  never a direct thesieure.com fetch; `renderCardDiscount()` /
  `updateCardExpected()` / `refreshCardBackendNote()`); **check-in wiring**
  (`renderCheckin`: web user + backend ready → `POST /api/checkin`, success
  sets `state.balance` from the server's `balance`, toast shows credited
  amount + new balance; 409 `already_checked_in` → "already done" panel +
  server message toast; 429/403 → server message toast, button re-enabled for
  retry; Telegram/demo users and unconfigured backend keep the existing local
  demo check-in); I18N_EN additions (`cardSubmit:"Send card"`, `cardDiscT`,
  `authPass2L`, `authUserHint`, `authWebHint`); `applyLang` auth-submit label
  sync; INIT `refreshCardBackendNote()` call; dead EN keys `authNameL` /
  `ph:authNamePh` removed.
- `assets/animations.js`, `assets/animations.css`, `assets/*.webp` — unchanged
  from batch 1/2 (animations.js `anhdev:checkin` listener still fires confetti
  + `floatPlus` for both demo and backend check-ins; the 650ms easeOutCubic
  balance count-up on `anhdev:balance` is why e2e balance reads need a
  ~1100ms wait after a check-in).

### BACKEND_API_BASE placeholder — how to set it

- `assets/app.js` line 25: `var BACKEND_API_BASE = "";` with a Vietnamese
  comment: fill in the backend VPS domain, e.g. `https://api.anhdev.store`.
  Leave it empty = not configured.
- When empty, card top-up and username/password login show a clear
  "chưa cấu hình backend" message (not a silent failure); Telegram login,
  demo check-in and demo flows keep working exactly as before.
- When set, also add that domain to the CSP `connect-src` in `index.html`
  (there is an HTML comment at the CSP meta saying so); the finalization pass
  (parent's queued task) owns the single-config naming — note the naming gap:
  this frontend uses `BACKEND_API_BASE`, the finalization note says
  `API_BASE_URL`. Reconcile the name there, not here.
- The Cloudflare Worker `API_BASE` is a DIFFERENT constant (line 82,
  `https://anhdev-balance.nhatdz2k011.workers.dev`) and is untouched.

### What the backend must provide (already built in `files/store-backend/`)

- `POST /api/auth/register` `{username, password, password_confirm}` → 201
  `{ok, token, user:{...}}` + HttpOnly cookie. `POST /api/auth/login`
  `{username, password}` → 200 same shape. `GET /api/auth/me` →
  `{ok, user:{username, balance, discount_percent, telegram_id}}` (user
  NESTED under `user`). `POST /api/auth/logout`. `POST
  /api/auth/link-telegram` `{link_token}` — endpoint only, no UI built.
- `POST /api/topup/card` (auth) `{telco, amount, serial, code}` → 201
  `{ok, request_id, status:"pending", telco, amount}`; 502/400 still include
  `request_id` + `status` so the frontend can invoice them.
  `GET /api/topup/invoices` (auth) → `{ok, invoices:[{request_id, telco,
  amount, status, credited_amount, created_at}]}`.
- `POST /api/checkin` (auth, no body) → 200 `{ok, amount, balance}` (amount
  1–500đ, balance = new server balance); 409 `already_checked_in`; 429
  `ip_checkin_limit`; 403 `checkin_requirement_not_met`; 401
  `unauthorized`. All errors carry a clear Vietnamese `message` — the
  frontend toasts that message verbatim.
- Validation must match the frontend exactly: serial 10–16 digits, code
  10–15 digits, username `/^[a-z0-9_]{4,24}$/` after trim+lowercase,
  password ≥6. Discount rates default 0.8 per telco (customer receives 80%).

### User fixes folded in (from his 2026-11-25 ~17:19 screenshots of the LIVE site)

- **(1) Hero gold dot REMOVED.** Headline is now `Kho tài khoản ANHDEV` (VI)
  / `Account warehouse<br />ANHDEV` (EN) with no trailing `.` — removed from
  the static HTML, the EN `I18N_EN_HTML.heroTitle` string, and the dead
  `.hero h1 .dot{color:#d4af37}` CSS rule. Verified by e2e in both languages.
- **(2) Category view / overlay VERIFIED, no change needed.** `showView()`
  removes `active` from ALL `.view` sections before adding it to the target
  only, and CSS is `.view{display:none}` / `.view.active{display:block}` — a
  non-active view is fully removed from layout and cannot overlay anything.
  The catalog lives INSIDE `#view-home` (there is no separate "category
  view"); the batch-2 category handler (`[data-catlink]`) renders the filter
  FIRST and then calls `showView("home", {targetId:"products"})` in the same
  JS task — no scroll-through-hero flash, no second delayed scroll. The
  overlay/flash the user sees on the LIVE site is the old batch-1 code
  (batch 2 is not deployed yet). E2E proves it: after clicking
  `Acc Random · Telegram`, exactly one `.view` is active (`view-home`) and
  every other view computes to `display:none`; switching to Top up leaves
  exactly one active view (`view-topup`) with `view-home` at `display:none`.

### Verification (all local, jsdom e2e in `/tmp/e2e/test.js`)

- `node --check` PASS on `assets/app.js` + `assets/animations.js`.
- **E2E 57/57 PASS** (section A no-backend + section B backend stub at
  `https://api.test.local` with real stock.json, 12,126 accounts): register
  validation (bad username / mismatch → inline error, no fetch), register
  POSTs `{username, password, password_confirm}`, Bearer on `/me`, real
  balance 80.000đ, discount badge, token persisted, logout clears token,
  reload restores session; check-in success (POSTs `/api/checkin` with
  Bearer, balance = server 80.123đ, done panel 123đ, toast amount + new
  balance), 409 (toast + already-done panel, balance unchanged), 429 + 403
  (server message toast, button re-enabled); card POSTs
  `{telco, amount, serial, code}` with Bearer, invoice `CARD123ABC` pending
  then success +40.000đ via invoice sync; demo check-in (Telegram user, no
  backend call); hero dot absent in VI + EN; category click + view switch
  single-active-view checks (see above); search `murad` pager total = 162
  (no random leak).
- Batch-2 search tests re-run: **31/31 + 7/7 pass**.
- Grep checks: 0 inline `onclick`; 0 base64 blobs; 0 direct thesieure.com
  calls in code (1 remaining mention is a code comment only); 87 static
  `$("#id")` — all exist in `index.html` or are created by `innerHTML` in
  app.js immediately before use (`checkinBtn`, `accLogin`, `accLogout`,
  `accTopup`, `ordersLogin`, each with its handler attached); 83 `L()` keys,
  0 missing from DYN/EN; 91 `data-i18n` keys, 0 missing EN; 7
  `data-i18n-ph` keys, 0 missing EN; JS braces 661/661; HTML divs 128/128;
  Worker `API_BASE` still the real URL.
- **Flaky-test note (fixed in the harness, not the app):** the balance
  display counts up over 650ms (`animations.js` `anhdev:balance` listener),
  so an e2e read at 600ms after a check-in saw `80.122đ` mid-animation.
  The harness now waits 1100ms there. If a future check reads the balance
  right after a change, wait out the 650ms count-up first.

### Left out / not done here

- **No `link-telegram` UI** — the backend endpoint exists; no button/form was
  built in the frontend (was not in the frontend brief; the user never asked
  for the UI, only the endpoint). Add it later if he wants web↔Telegram
  linking from the account page.
- **No 4K image swap** — a parallel track found 11 verified 4K Liên Quân
  images (`files/store-images-4k/`); the user has not picked a hero yet, so
  no image was replaced here. The current `banner-hero.webp` + 3 covers
  are unchanged.
- **No live-browser / real-phone test** (subagent has none). After deploy,
  verify on a real phone + Mini App: register/login, card top-up end-to-end
  against the deployed VPS backend, check-in crediting the real balance,
  hero without the dot, category switching with no flash/overlay.
- The `BACKEND_API_BASE` vs `API_BASE_URL` naming reconciliation belongs to
  the queued finalization pass (CORS + CSP + curl tests + VPS guide).

## PART 6 — Auto-rotating hero banner + expanded image pool (2026-11-25)

### What the user asked

"Find more beautiful HD skin images, take the good ones, and make the web
auto-change the hero skin every time the user reloads the page."

### Image pool — expanded 11 → 26

15 more official Arena of Valor wiki splash arts were added to
`files/store-images-4k/` (all verified with PIL for real dimensions/format;
all arrived as WebP from the wiki CDN). Full list + sources in
`files/store-images-4k/IMAGE_LIST.md` ("Pool expansion" section).

New: Kaine (6242×3778, dark red vampire assassin — best new hero),
Cresht (4800×3000, stormy sea creature), Stuart, Ilumia, Arthur, Alice,
Krixi, Bright, Skud, Toro, Ishar, Helen, Lumburr, plus Raz and Fennik.

**Not usable as banners (verified):** Raz, Fennik and the older Murad are
transparent-background cutouts (RGBA, confirmed with PIL) — they are kept in
the pool but NOT in the rotating hero set; they need compositing over a
background first. Alice + Helen are full scenes but the least dramatic, kept
as spares. `aov-female-armor-4k-vertical.jpg` is portrait, not a hero.

### Installed hero set — 20 images

`assets/heroes/hero-01.webp` … `hero-20.webp`, recompressed with PIL to
1920px-wide WebP (quality 82), 89–244 KB each (3.0 MB total). Order is
darkest/most dramatic first; hero-01 is the previous best pick
(`aov-female-warrior-4k.jpg`, female assassin, red/dark). Full mapping in
`IMAGE_LIST.md`. The old `assets/banner-hero.webp` is still on disk and still
used by 4 demo products in `app.js` (d4, d8, d12, q7) — it is no longer the
hero banner.

### Covers replaced (same filenames, no code change)

- `assets/cover-1.webp` = Tel'Annas (1200px, 66 KB; was 616 KB)
- `assets/cover-2.webp` = Violet Fiery (1200px, 72 KB; was 764 KB)
- `assets/cover-3.webp` = Tulen (1200px, 74 KB; was 738 KB)

### Rotation rule (`assets/app.js` — `rotateHero()`, called first in INIT)

- On every page load, pick a random index 0–19 from `assets/heroes/`.
- Never repeat the immediately previous image: the last index is stored in
  `localStorage["anhdev_hero_idx"]` (fallback `sessionStorage` if localStorage
  is unavailable); the pick is re-rolled while it equals the stored index.
- The hero `<img>` in `index.html` has a sensible default
  `src="assets/heroes/hero-01.webp"` (renders before JS runs); JS swaps in
  the chosen image. `width="2736" height="912"` kept, and the existing CSS
  `.hero img.bg { object-fit: cover; object-position: center right }` crops
  the 16:9 images into the ~3:1 slot without stretching.
- If the chosen image fails to load, `onerror` falls back once to hero-01
  (guarded so it cannot loop).
- After swapping, the Ken Burns animation is restarted from the beginning
  (`animation: none` → reflow → clear), so each reload starts a fresh zoom.
  The animation itself is unchanged (`animations.css` `.hero img.bg`).
- All hero images are local (`assets/`), so no CSP change was needed —
  `img-src` still allows only `'self'` + the pre-existing hosts.
- Hero title still has no trailing dot ("Kho tài khoản<br />ANHDEV").
- Nothing else was touched: login modal, card top-up, check-in,
  autocomplete, sidebar view switching, search/pagination, theme/language/
  currency, anti-leak rules — all intact (see verification).

### Files changed

- `index.html` — hero `<img>` src `assets/banner-hero.webp` →
  `assets/heroes/hero-01.webp`; alt text made generic (the image now rotates).
- `assets/app.js` — added `HERO_COUNT = 20`, `rotateHero()` + helpers
  (~40 lines) and a `rotateHero()` call at the top of INIT.
- `assets/heroes/hero-01.webp` … `hero-20.webp` — new (20 files, 3.0 MB).
- `assets/cover-1.webp`, `cover-2.webp`, `cover-3.webp` — replaced
  (recompressed, same filenames).
- `files/store-images-4k/` — 15 new source images + `IMAGE_LIST.md` updated.
- `REPORT2.md` — this section.

### Verification

- `node --check` PASS on `assets/app.js` and `assets/animations.js`.
- jsdom rotation test (`/tmp/e2e-hero/test-hero.js`, real index.html + app.js):
  **17 passed, 0 failed** — default src is hero-01; width/height kept;
  `object-fit: cover` present; no trailing dot; img-src has no new remote
  host; load 1 and load 2 (same browser, seeded storage) show different
  heroes; **50-load loop: 0 repeats of the immediately previous image**,
  ≥10 distinct heroes seen; a broken hero (hero-99) falls back to hero-01;
  `PAGE_SIZE = 12`, `pagerHtml`, `buildSearchIndex`, multi-word split all
  still present.
- Batch-2 search sanity re-run against the real 12,126-account stock.json:
  **31 passed, 0 failed**; demo catalog: **7 passed, 0 failed**.
- Guards: 0 inline `onclick`, 0 base64 blobs; Worker `API_BASE` still the
  real URL; `banner-hero.webp` still referenced only by 4 demo products.

### Not verified (needs a live check after deploy)

- No live-browser / real-phone test (subagent has none). After deploy, reload
  the store a few times on a real phone + Mini App and confirm a different
  hero appears each reload (never the same twice in a row) and the banner is
  never broken or stretched.

---

## PART 6 — Finalization: kết nối Frontend (GitHub Pages) ↔ Backend Flask (VPS)

Chốt kết nối để bấm thật không bị trình duyệt chặn. Hai API của web không
đổi vai trò: Cloudflare Worker (`API_BASE`, số dư / nạp SePay) đã có URL
thật — **không đụng tới**; Flask backend (tài khoản web / nạp thẻ / điểm
danh) giờ chỉ còn **1 chỗ cấu hình duy nhất là `API_BASE_URL`**.

### Backend (store-backend/) — CORS + ProxyFix + cookie

- **CORS** (`app.py` + `config.py`): chỉ origin
  `https://bottelegram-devbuinhat.github.io` + `http://localhost` /
  `http://127.0.0.1` (bất kỳ port nào, bằng regex `re:` — vì flask-cors
  khớp chính xác nên localhost cần regex để chấp nhận :3000/:5500/:8000).
  Methods `GET, POST, OPTIONS`; headers `Content-Type, Authorization`;
  `supports_credentials=true`. Không dùng `*`.
- **Preflight**: `OPTIONS` vào `/api/*` luôn trả `200` ngay qua
  `before_request` — không bao giờ bị JWT hay rate limit chặn (vì chúng
  nằm trong view). Header CORS do flask-cors thêm ở `after_request`.
- **ProxyFix / IP thật** (`app.py` + `security.py`): `ProxyFix(x_for=1,
  x_proto=1, x_host=1, x_port=1)`; `client_ip()` ưu tiên
  `CF-Connecting-IP` (Cloudflare Tunnel) → `X-Forwarded-For` (mục đầu,
  Nginx) → `remote_addr`. Mọi rate limiter (register, login-fail, card,
  check-in IP) đều dùng IP này nên chạy sau Tunnel/Nginx không bị gom
  hết về 127.0.0.1. Server phải chạy sau proxy/tunnel tin cậy.
- **Cookie** (`auth.py` + `config.py`): thêm `COOKIE_SECURE` (mặc định
  `false`). Trên VPS đặt `true` → cookie `session` được set
  `SameSite=None; Secure` (bắt buộc để trình duyệt gửi kèm khi Frontend
  cross-site gọi API); test local qua http thì `SameSite=Lax`, không
  Secure. `logout` xóa cookie bằng cùng thuộc tính.
- Không đổi endpoint hay hành vi nào (auth, nạp thẻ + callback, điểm danh,
  giới hạn chống spam giữ nguyên).

### Frontend (store-upgrade/) — 1 config + CSP + Toast lỗi mạng

- **`API_BASE_URL`** (`assets/app.js`, dòng 29): đổi tên từ
  `BACKEND_API_BASE` → `API_BASE_URL` — **chỗ duy nhất** giữ địa chỉ
  backend Flask. Mọi tham chiếu (fetch, `backendReady()`, comment) đã
  đổi theo; 0 tham chiếu `BACKEND_API_BASE` còn lại. `API_BASE` (Worker)
  giữ nguyên URL thật. Khi `API_BASE_URL` trống, thông báo "chưa cấu
  hình backend" vẫn hiện và Telegram/demo vẫn chạy.
- **CSP** (`index.html`): `connect-src` thêm `https://api.anhdev.store`
  (placeholder — dòng có ghi chú `[DOI-DOMAIN-BACKEND]`, ghi rõ đổi thành
  domain thật khi đổi Tunnel). Phần còn lại của CSP không đổi. API phải
  là `https://` (không Mixed Content).
- **Lỗi mạng** (`assets/app.js`): thêm `isNetworkError(err)` (lỗi fetch
  không có `.status` = VPS tắt / mất mạng / timeout) + chuỗi `netErr`
  ("Không kết nối được máy chủ. Kiểm tra lại mạng hoặc thử lại sau.").
  Đăng nhập/đăng ký, nạp thẻ, điểm danh đều hiện Toast rõ ràng khi gặp
  lỗi mạng và **mở khóa nút** (không kẹt ở "Đang gửi…" / "Đang gửi thẻ").
  Lỗi từ server (sai mật khẩu, 409 đã điểm danh, 429 vượt IP…) vẫn hiện
  đúng message tiếng Việt của server.
- **Banner kho mẫu**: đã xác nhận gỡ hẳn — `setSyncStatus()` đặt
  `el.hidden = (mode === "demo")` nên banner đỏ "catalog mẫu" không bao
  giờ hiện; chỉ banner trạng thái kho thật (live/saved) hiện.
- **Mục "Mua acc trong 4 bước"**: **KHÔNG xóa** (theo lệnh của Anh — chỉ
  xóa sau khi mọi nhiệm vụ xong 100%).

### Files changed

- `store-backend/app.py` — ProxyFix, CORS regex origins + methods/headers,
  `before_request` preflight 200.
- `store-backend/config.py` — `ALLOWED_ORIGINS` mặc định thêm localhost
  regex; thêm `COOKIE_SECURE`.
- `store-backend/security.py` — `client_ip()` ưu tiên `CF-Connecting-IP`.
- `store-backend/auth.py` — cookie `SameSite=None; Secure` khi
  `COOKIE_SECURE=true`; `logout` xóa cookie cùng thuộc tính.
- `store-backend/.env.example` — `ALLOWED_ORIGINS` mới + `COOKIE_SECURE`.
- `store-backend/tests/test_self.py` — thêm mục 8 (18 test mới).
- `store-backend/tests/test_live.sh` — **mới**: test curl trên server thật.
- `store-backend/VPS_DEPLOY.md` — **mới**: hướng dẫn lên VPS.
- `store-backend/README.md` — bảng file, `COOKIE_SECURE`, link
  `VPS_DEPLOY.md` + `test_live.sh`, số test mới.
- `store-backend/API_CONTRACT.md` — mục CORS/cookie/IP/`API_BASE_URL`.
- `store-upgrade/assets/app.js` — `BACKEND_API_BASE` → `API_BASE_URL`,
  `netErr` + `isNetworkError()`, Toast lỗi mạng cho auth/card/check-in.
- `store-upgrade/index.html` — CSP `connect-src` thêm placeholder API
  domain + ghi chú `[DOI-DOMAIN-BACKEND]`; comment `API_BASE_URL`.
- `store-upgrade/REPORT2.md` — phần này.

### Verification

- Backend unit: `python tests/test_self.py` → **85 PASS, 0 FAIL**
  (67 cũ + 18 mới: preflight 200 + header CORS đúng origin, origin lạ
  không có Allow-Origin, localhost bất kỳ port nào được chấp nhận,
  preflight vào endpoint cần auth vẫn 200 (không 401),
  `client_ip` ưu tiên CF-Connecting-IP, cookie `SameSite=None; Secure`
  khi `COOKIE_SECURE=true`).
- Backend live (curl, server local port 5511, `CARD_API_URL` trỏ về
  127.0.0.1:9 để cổng thẻ không gọi được → hóa đơn giữ pending):
  `bash tests/test_live.sh http://127.0.0.1:5511` → **21 PASS, 0 FAIL,
  0 SKIP** — health, preflight (GitHub Pages + localhost:5500 + origin
  lạ), register 201 + token, login 200, `/me` balance 0, topup/card
  pending, callback JSON đúng chữ ký → success +80.000đ (100k × 0.8),
  sai chữ ký → **403**, gọi trùng → không cộng 2 lần; callback FORM
  đúng chữ ký → success +40.000đ (50k × 0.8), gọi trùng → không cộng
  2 lần (tổng 120.000đ).
- Frontend: `node --check` PASS cả `app.js` + `animations.js`;
  jsdom e2e (`/tmp/e2e/test.js`, file thật): **57 passed, 0 failed**
  (auth, card, check-in, search "murad" = 162 — không lộ random,
  logout, khôi phục phiên); search test vs stock thật: **31/31**,
  demo: **7/7**. Guards: 0 inline `onclick`, 0 base64 blob,
  0 `BACKEND_API_BASE`, Worker `API_BASE` vẫn URL thật, anti-leak
  (random chỉ hiện mô tả chung), autocomplete, sidebar fix
  (`setActiveNav`), search/pagination (`PAGE_SIZE = 12`), hero xoay
  (20 ảnh) đều còn nguyên.

### VPS guide

Xem `store-backend/VPS_DEPLOY.md`: biến `.env` bắt buộc, Cloudflare
Tunnel (nhanh + cố định) hoặc Nginx + SSL, cách lấy link dán vào
`API_BASE_URL`, đăng ký `POST https://<domain>/api/callback/card` trên
TheSieuRe, và thứ tự khởi động Flask API + bot `@devbn_bot` song song
(Flask dùng `store.db`, bot dùng `data/bot.db` — khác file nên không
xung đột).

### Not verified (needs a live check after deploy)

- Chưa test trên VPS thật (chưa có VPS/domain). Sau khi lên sóng, chạy
  `bash tests/test_live.sh https://<domain-that>` (đặt
  `CARD_PARTNER_KEY` trùng `.env` trên VPS) và kiểm tra trên điện thoại
  + Mini App: đăng nhập TK/MK, nạp thẻ thật 10.000đ, điểm danh — xem
  Toast có rõ ràng khi VPS tắt/mất mạng không.

---

## PART 7 — UI/Logic bug audit + luxury colors + Awwwards animations (2026-11-25)

Checkpoint 2 work on top of Checkpoint 1 (finalization). No push in this pass.
Files touched: `index.html`, `assets/app.js`, `assets/animations.js`,
`assets/animations.css` (all in `files/store-upgrade/`).

### PART 1 — Bugs fixed

1. **Oversized black toast (Sonner-style rebuild).**
   - Removed the conflicting old toast CSS: inline `.toast` / `.toast.show`
     (centered-bottom, dark) in `index.html` + the mobile `.toast{bottom:86px}`
     rule + the `animations.css` top-right override with a hardcoded `✓::before`.
   - New structure: `#toastContainer` (`index.html`, `role="status"`) with the
     exact spec container CSS (`position:fixed; top:20px; right:20px; bottom:auto;
     left:auto; width:auto; max-width:min(380px, calc(100vw - 32px)); height:auto;
     pointer-events:none; z-index:9999; display:flex; flex-direction:column; gap:10px`)
     and `.toast-item` (`height:auto; min-height:unset; width:fit-content;
     max-width:100%; pointer-events:auto`, glass `backdrop-filter:blur(14px)`).
   - `toast(msg, type)` in `app.js` is now typed: `success` (✓ emerald),
     `info` (ℹ blue), `warning` (⚠ amber), `error` (✕ crimson); icon + text
     via `textContent` (XSS-safe); auto-dismiss 2.6 s with a countdown
     progress bar (`.toast-bar`, `scaleX` 1→0); max 3 items (oldest dropped).
     Default type stays `"success"` so old `toast(msg)` calls keep working.
   - The unauthenticated purchase prompt (`requireLogin()`,
     "Đăng nhập trước để mua acc nhé.") is now `toast(..., "info")` — no
     green checkmark. Other call sites typed too: network/auth/card errors →
     `error`; SePay-not-seen / amount validation / card format → `warning`;
     logout / invoice-created / checking / currency-switch → `info`.
   - Verified: longest built-in message (~110 chars, authNoBackend VI) is
     3 lines ≈ 85 px tall — under the 120 px cap. See "Toast bbox" below.
2. **Squashed sidebar Balance Card.**
   - `.balance-card` now enforces `flex-shrink:0; height:auto;
     min-height:fit-content; position:relative` (inline CSS) and the
     `overflow:hidden` that clipped it in `animations.css` is removed.
   - The old one-shot beam sweep (`.beam::after`, `translateX`) is replaced by
     a Houdini `@property --beam-angle` rotating `conic-gradient` border beam
     on a dedicated `::before` layer (`pointer-events:none`, mask-composite
     ring, `padding:1.5px`) — zero height squashing / text clipping.
   - Beam is now **persistent while authenticated**: `animations.js`
     `setBeam(synced)` on `anhdev:balance` (was a 1 s one-shot). Same beam
     applied to the first VIP card (`.card[data-cat='detail']` gets `.beam`
     on every grid render).
   - Logged-out status text updated in BOTH places (`index.html` static +
     `app.js` `refreshUserUI`): "Chưa đăng nhập Telegram — số dư demo, chưa
     đồng bộ" → **"Chưa đăng nhập — đăng nhập để đồng bộ ví"**.
   - Logo header clipping: the sidebar `.brand` is `position:sticky; top:0`
     (unchanged, batch 2) — verified the top is never clipped; the balance
     card no longer contributes to the squash.
3. **Modal close button + minor logic bugs.**
   - `.modal-x` is now `display:inline-flex; align-items:center;
     justify-content:center; width:34px; height:34px; line-height:1; padding:0`
     in all 3 modals (auth / buy / check-in).
   - `#payQrImg` now has `hidden` in the HTML (was visible with an empty
     `src=""` before an invoice is generated); `renderPayment()` already
     sets `img.hidden = false` when a real QR URL is assigned, and the
     existing error handler shows `#payQrFallback` on load failure.
   - Hero headline whitespace: `index.html` h1 is now
     `Kho tài khoản <br />ANHDEV` (space before `<br />`) and the EN i18n
     string in `app.js` is `'Account warehouse <br />ANHDEV'`.
   - VND sync: already done in batch 2 — `refreshMoneyLabels()` syncs the
     check-in badge (`1–500đ`) and modal description with the VND/USD
     switcher; verified still intact (no change needed).

### PART 2 — Luxury color system

All 4 CSS variable blocks updated (`:root`, `@media (prefers-color-scheme:
dark)`, `html[data-theme="light"]`, `html[data-theme="dark"]`) with the new
semantic aliases (`--bg-main`, `--bg-surface`, `--bg-subtle`,
`--border-subtle`, `--bg-glass`, `--accent-primary`, `--accent-gold`,
`--accent-crimson`, `--text-primary`, `--text-secondary`, `--crimson`).

- Light (Warm Ivory & Deep Emerald): `--bg-main:#F7F5F0`,
  `--bg-surface:#FFFFFF`, `--bg-subtle:#EFECE4`, `--border-subtle:#E5E0D5`,
  `--accent-primary:#0C4A3B` (hover `#08352A`), `--accent-gold:#C68B2C`,
  `--accent-crimson:#DC2626`, `--text-primary:#111C18`,
  `--text-secondary:#5B6B64`. Light `--muted` darkened to `#5B6B64` for
  contrast; `--wine` → `#0C4A3B`, `--gold` → `#C68B2C`,
  `--danger`/`--crimson` → `#DC2626`.
- Dark (Luxury Obsidian Emerald & Burnished Gold): `--bg-main:#080C0B`,
  `--bg-surface:#101917`, `--bg-glass:rgba(16,25,23,0.78)`,
  `--border-subtle:rgba(52,211,153,0.14)`, `--accent-primary:#10B981`
  (hover `#34D399`), `--accent-gold:#F5B942`, `--accent-crimson:#F43F5E`,
  `--text-primary:#F1F5F3`, `--text-secondary:#94A8A0`. Dark `--bg` →
  `#080C0B`, `--surface` → `#101917`, `--line` →
  `rgba(52,211,153,.14)`, `--wine` → `#10B981`, `--gold` → `#F5B942`.
- Audit: Sidebar, Topbar, Hero, 4-step guide, Search & Autocomplete,
  Account/Random cards, Leaderboard, Invoices, Auth/QR/Check-in Modals,
  Toasts, Scrollbars — all read from the variable blocks, so no blinding
  white panels in Dark Mode and no low-contrast text in Light Mode.
  (The 4-step guide was color-audited only, NOT animated — it is deleted
  at the very end per the user's order.)

### PART 3 — Animations

- **Lenis 1.1.14** (`https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js`,
  `crossorigin="anonymous"`, `defer`, before `app.js`): `initLenis()` in
  `animations.js` §0 — guarded by `reduceMotion`, touch detection, and
  `typeof window.Lenis === "function"`; `window.__lenis` exposed so
  `app.js` `instantScrollTop()` uses `lenis.scrollTo(0, {immediate:true})`
  when available; `lenis.stop()/start()` wired into the modal scroll lock.
  `data-lenis-prevent` added to `.sidebar`, `.search-suggest`, and all 3
  `.modal-wrap`s.
- **GSAP 3.12.5** (`https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js`):
  hero entry timeline (badge → headline → subtitle → CTA, `fromTo`
  opacity/y, stagger 0.12, `power3.out`, `clearProps`); Ken Burns now
  GSAP-driven (`scale` 1→1.07, 16 s, yoyo, repeat -1, `sine.inOut`) with
  the CSS Ken Burns disabled only when GSAP loads (`html.gsap-on` class —
  CSS animation is the fallback if the CDN fails); 3D mouse parallax on
  the hero bg (`x`/`y` ±14/±10 px, `overwrite:"auto"` so it never kills
  the scale tween). Hero particles: `<canvas id="heroFx">`
  (`pointer-events:none`, `z-index:1`) with 46 floating crimson embers +
  gold aura particles (rAF, DPR-capped, cursor-reactive drift, desktop
  only). Card entrance: GSAP `fromTo` stagger 0.06 on every grid render
  (MutationObserver + initial batch), replacing the CSS `cardIn`.
- **canvas-confetti 1.9.3**
  (`https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js`):
  check-in burst is now dual-corner (gold + emerald, 70 particles each
  from bottom-left/right + 40 centre) with the vanilla `confetti()` div
  fallback if the CDN fails. The floating `+xxxđ` spring particle is
  unchanged.
- **Houdini `@property --beam-angle`**: rotating conic border beam for the
  Balance Card (persistent when authenticated) and the first VIP card
  (see PART 1.2). Fallback: browsers without `@property` show a static
  gradient ring (no error, no rotation).
- **Card tilt + grid spotlight**: `pointermove` on `#productArea` sets
  `--rx`/`--ry` (±3.5° max) and `--mx`/`--my` on the hovered card; CSS
  `transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry))`
  (0.28 s transition smooths it) + a radial spotlight `::after` at the
  cursor + a diagonal holographic foil sheen on `.card-cover::after`
  (sweeps on hover, never covers price/labels). Desktop hover-capable
  only; the hover lift (`translateY(-4px)`) now includes the tilt vars
  so it no longer wipes the tilt. Touch/reduced-motion: no tilt.
- **Magnetic CTAs**: GSAP `quickTo` x/y on `.hero-actions .btn`
  ("Khám phá kho", "Nạp tiền VietQR") + `#topLoginBtn` ("Đăng nhập"),
  max ±6 px, `power3.out`; diagonal shimmer sweep `::after` added to
  those buttons (`.btn-wine` already had one).
- **Toasts & modals**: Sonner-style glass toasts (see PART 1.1); modal
  backdrop blur raised 3 px → `blur(14px)`; inner fields stagger in
  (`.field`/`.btn`/`.tab-bar`, `fieldIn`, `--i` via `stagger()` on all
  3 modals).

### CSP

`<meta http-equiv="Content-Security-Policy">` in `index.html`:
`script-src` now includes `https://cdn.jsdelivr.net` (GSAP/Lenis/confetti);
all other directives preserved, including the VPS `connect-src`
`https://api.anhdev.store` placeholder and the Worker URL. Verified every
external host the page fetches is whitelisted: `cdn.jsdelivr.net`
(script), `telegram.org` (script), `fonts.googleapis.com` (style),
`fonts.gstatic.com` (font), `img.vietqr.io` + `t.me` + `cdn.telegram.org`
(img), Worker + `api.anhdev.store` (connect), `oauth.telegram.org`
(frame), `web.telegram.org`/`telegram.org` (frame-ancestors). Zero new
remote hosts.

### Verification (PART 4)

- `node --check` PASS on `app.js` + `animations.js`.
- jsdom harness (`/tmp/verify-part4.js`, CDN/fetch blocked to test guards):
  **69/69 passed** — 0 inline `onclick`, 0 base64, 0 `BACKEND_API_BASE`,
  `API_BASE_URL` single Flask config (line 29), Worker `API_BASE`
  untouched, `PAGE_SIZE = 12`, `HERO_COUNT = 20`, anti-leak intact,
  CSP entries (jsDelivr + VPS + Worker), all 3 CDN scripts pinned +
  `crossorigin="anonymous"`, `#heroFx` present, `#toastContainer`
  present, old `#toast` gone, `payQrImg hidden`, hero h1 space, balance
  note new text (HTML + app.js), balance-card CSS
  (`flex-shrink:0; height:auto; min-height:fit-content`), modal-x
  centering, toast container/item CSS (exact spec values), 4 variants +
  progress bar, Houdini `@property`, beam conic + no `overflow:hidden`,
  PART 2 vars (light + dark), `data-lenis-prevent` (sidebar / suggest /
  3 modal-wraps), purchase prompt `info`, `instantScrollTop` Lenis,
  all JS guards (Lenis/GSAP/confetti + vanilla fallback), tilt vars,
  magnetic quickTo ±6 px, VIP beam, 4-steps section still present,
  heroTitle EN space. Runtime: toast item created on unauthenticated
  buy (info variant, correct text, icon + text + progress bar),
  container caps at 3 items, computed styles confirm container
  `max-width:380px; position:fixed; top:20px; right:20px` and item
  `max-width:100%; width:fit-content; height:auto`; balance card shows
  all 3 lines (label row "Số Dư + Giảm 0%", figure `data-balance`,
  status note); 3 modal-x buttons; scripts run clean with CDN blocked
  (no `window.Lenis`/`gsap`/`confetti`, no `gsap-on` class, no crash).
- **Toast bbox**: container `max-width` is hard-capped at 380 px
  (computed style confirms); item height is content-driven (`height:auto`).
  Longest built-in message (~110 chars) renders 3 lines ≈ 85 px — under
  the 120 px cap. Caveat: an exceptionally long server error string
  (>~150 chars, only via `err.message` passthrough) could wrap to 5
  lines ≈ 124 px; all built-in messages are within the cap.
- **Balance card**: 3 lines render with zero clipping (no
  `overflow:hidden` on the card; beam is a separate `::before` layer).
- **Search re-run** (`/tmp/test_search_part4.js`, real 12,126-account
  stock): **31/31 passed** — murad 162, nakroth 9, tulen 104,
  "nakroth ki" 9, aliases nak/mu/tul/flo resolve, tier stats N>0
  (SSS 46 / SS 862 / SS+ 742 / Anime 850), anti-leak 0 random matches
  on 11 queries, filter 0.85 ms/query (< 15 ms). Note: the tier counts
  are N>0 stats counts, not grid-filter counts — the grid substring
  filter returns all 880 ready-info for "SSS" because every ready-info
  desc carries the `(sss:0, ss:0, ...)` stats block (longstanding
  behaviour, unchanged). "thu nguyen" grid = 25 ready-info (public skin
  names "Điêu Thuyền", "Kỷ Nguyên", "Khởi nguyên" — legitimate
  substring matches, 0 random).
- **Demo autocomplete** (`/tmp/test_demo_part4.js`): **9/9 passed** —
  popular keywords on empty focus, no junk phrases, "thu nguyen"
  suggests the public Thứ Nguyên pack, "SSS" suggests demo tier packs,
  native `type="search"` × reset. ("murad" correctly suggests nothing
  in demo — no demo product contains it.)
- **Viewport/mode matrix**: jsdom has no layout engine, so the
  1366/1920/390 px × light/dark matrix could NOT be run here. Verified
  instead by computed styles + CSS inspection (see above). A real-phone
  check after deploy is still needed for: toast ≤380×120 on a 390 px
  screen, balance card 3 lines on a real phone, GSAP/Lenis/confetti
  actually loading from the CDN (no CSP violation in the console),
  hero particles + parallax on desktop, card tilt on hover, and dark-mode
  contrast by eye.
- **Not verified without a real browser**: Lenis smooth scroll feel;
  GSAP hero timeline / Ken Burns / parallax motion; canvas particle
  rendering (jsdom has no canvas 2d context); canvas-confetti burst
  visuals; card tilt/spotlight/foil sheen on hover; magnetic button
  pull; modal spring + field stagger timing; dark-mode contrast by eye
  (values are set, but no visual check); the 1366/1920/390 viewport
  matrix; zero console errors / zero CSP violations in a real browser
  (no new host is fetched that is not whitelisted, but only a real
  load proves it).

## PART 8 — Admin: đăng nhập mật khẩu ngắn + tìm kiếm skin Acc Random độc quyền (2026-11-25)

### Bối cảnh
- Backend Flask đã có sẵn (kiểm chứng 153 test PASS): `POST /api/auth/login`
  và `GET /api/auth/me` trả `user: {username, balance, role}` (`role` là
  `"user"` hoặc `"admin"`, JWT ký kèm role); `GET /api/admin/random-search`
  và `GET /api/admin/random-index` chỉ cho role=admin (không JWT / role=user
  → 403). 5 acc test đã có trong backend, mỗi acc 250.000đ: `nhatdeptrai`,
  `nhatdz`, `muaacc`, `colonmahup` (role=user) và `admin2` (role=admin).
  (Mật khẩu acc test KHÔNG ghi trong repo công khai — xem seed.py ở repo
  backend riêng tư.)
- Phần này CHỈ làm frontend trong `files/store-upgrade/`. Không push, không
  sửa backend, không sửa file ngoài thư mục này.

### 1. Đăng nhập: bỏ chặn mật khẩu tối thiểu 6 ký tự (chỉ tab Đăng nhập)
- `assets/app.js` — `validateAuth(username, pass, pass2)`: tab Đăng nhập
  (`pass2 == null`) chỉ yêu cầu mật khẩu không trống (thông báo mới
  `authErrPassEmpty`); tab Đăng ký (`pass2 != null`) vẫn giữ tối thiểu 6 ký
  tự + nhập lại khớp. Acc `admin2` (mật khẩu 1 ký tự) đăng nhập được.
- Placeholder ô mật khẩu đổi theo tab (`syncAuthPassPlaceholder()` trong
  `setAuthMode()` + cuối `applyLang()`): đăng nhập → "Mật khẩu", đăng ký →
  "Mật khẩu (từ 6 ký tự)". Placeholder tĩnh trong `index.html` và dict EN
  `ph:authPassPh` đổi thành "Mật khẩu" / "Password" (trung tính).

### 2. Nhận diện role + lazy-load module admin
- `state` thêm `userRole` (`"user"` | `"admin"` | null) và
  `adminSearchActive` (true khi đang hiển thị kết quả admin — `renderProducts()`
  tạm nghỉ để không ghi đè). Token cũ không có role → coi như `"user"`.
- `afterWebAuth()` (cả nhánh `/me` thành công và nhánh lỗi) và
  `restoreWebSession()` (tải lại trang với token đã lưu) đều đọc `u.role` và
  gọi `applyAdminRole(role)`. Chỉ khi `role === "admin"` mới `import()` động
  `assets/admin-random-search.js` (đường dẫn tương đối từ `assets/app.js`).
  Import lỗi → toast nhẹ `adminLoadFail`, không crash app. Nếu
  `API_BASE_URL` trống → toast `adminNoBackend`, không import.
- `setUser(null)` (mọi đường đăng xuất: nút topbar + nút trong trang Tài khoản)
  đặt `userRole = null` và gọi `teardownAdminModule()` TRƯỚC KHI xoá session.
  `setUser()` với acc web có `role !== "admin"` cũng gỡ admin ngay (an toàn
  khi đổi tài khoản).
- `loadAdminModule()` có seam `window.__adminModuleLoader` CHỈ cho test jsdom
  (không có trong code chạy thật — test gán loader giả trước khi eval app.js);
  code thật dùng `import("./admin-random-search.js")` (classic script, trình
  duyệt hiện đại hỗ trợ; CSP `script-src 'self'` đã cho phép, không đổi CSP).

### 3. Module admin mới — `assets/admin-random-search.js` (ES module, tách riêng)
- Export: `initAdminRandomSearch(ctx)`, `cleanupAdminRandomSearch()`
  (+ `syncAdminPlaceholder()` và `getAdminDebugState()` phụ trợ).
- `initAdminRandomSearch`: tạo huy hiệu `ADMIN` (span `.admin-badge` trong
  `#userChip`, topbar) + nút toggle `.admin-toggle` "Soi skin Acc Random"
  (ngay sau `.search-wrap` trong toolbar, mặc định TẮT); đăng ký query handler
  qua `ctx.registerAdminQueryHandler`; gắn listener thoát chế độ admin khi đổi
  danh mục / sắp xếp / lọc "Còn hàng". Gọi 2 lần thì giữ nguyên (idempotent).
- Toggle BẬT: placeholder đổi thành "Tìm skin Acc Random: nakroth ki,
  florentino, sss..."; gợi ý tìm kiếm thường bị ẩn (`updateSuggest()` kiểm tra
  `adminSearchMode`); query đi qua `onAdminQuery` (đã debounce 120ms sẵn của
  app.js) → `GET {API_BASE_URL}/api/admin/random-search?q=…&limit=20&offset=0`
  kèm `Authorization: Bearer <JWT>`. Kết quả render vào `#productArea`: mỗi
  thẻ `.admin-card` hiện rõ mã acc + danh sách skin thật (`rare_skins`) +
  bậc skin (chips SSS/SS+/SS/S+/SSM/Anime trích từ khối thống kê trong
  `description`) + giá + Rank/Lv/số tướng/số skin; KHÔNG có nút mua (không
  `data-buy`) nên không mua nhầm từ chế độ soi. Có nút "Tải thêm" (phân trang
  offset) và nút "← Quay lại tìm kiếm thường".
- Toggle TẮT: về tìm kiếm thường với đúng chữ đang gõ (anti-leak như cũ),
  placeholder thường trở lại.
- Lỗi: 403 → toast "Không có quyền Admin" + tự tắt toggle; lỗi mạng → toast
  mạng + về lưới thường (giữ toggle để gõ lại thử tiếp); query trống → không
  gọi API; response cũ (user đã gõ query mới) bị bỏ qua bằng `reqSeq`.
- `cleanupAdminRandomSearch()` (đăng xuất): `reqSeq++` vô hiệu hoá response
  đang bay, `results = null` (xoá sạch dữ liệu skin Random khỏi RAM), gỡ
  badge + toggle + mọi listener, khôi phục placeholder + query thường, gọi
  `renderProducts()`. Không còn reference nào tới dữ liệu admin trong JS.
- Module KHÔNG import file nào khác, KHÔNG hardcode skin thật / token / mật
  khẩu, KHÔNG chạm localStorage/IndexedDB/cookie, mọi chuỗi từ API đều qua
  `esc()` (chống XSS). Mọi thứ cần dùng đều nhận qua `ctx` (API base,
  getToken, fetch, toast, L, esc, fmt, normText, các element, renderProducts,
  closeSuggest, các setter trạng thái).

### 4. Tích hợp vào `app.js` (không phá code cũ)
- `initSearch`: khi `adminSearchMode` bật, sự kiện `input` (debounce) và `search`
  (nút ×) đều chuyển query cho module, không chạy lọc thường. `updateSuggest`
  ẩn gợi ý khi admin mode bật.
- `renderProducts()`: guard `if (state.adminSearchActive) return;` ở đầu.
- `applyLang()`: cuối hàm gọi `syncAuthPassPlaceholder()` +
  `adminModule.syncAdminPlaceholder()` (placeholder admin theo đúng ngôn ngữ).
- `API_BASE` (Cloudflare Worker) và `API_BASE_URL` (Flask backend) giữ nguyên
  tên và hành vi; autocomplete, nạp thẻ POST, CORS/ProxyFix, animation, CSP/XSS,
  chống lộ Random cho khách thường đều giữ nguyên 100%.

### 5. CSS — `assets/animations.css` (cuối file)
- `.admin-badge` (đỏ crimson, chữ trắng), `.admin-toggle` / `.on` (viền/đỏ
  khi bật, khớp style `.toggle-btn` sẵn có), `.admin-card` + `.admin-head` /
  `.admin-skins` / `.admin-tier` / `.admin-desc` / `.admin-more-wrap`. Dùng
  biến theme (`--accent-crimson`, `--accent-gold`, `--wine`, `--surface`...)
  nên sáng/tối đều đúng. Không có class admin nào trong HTML tĩnh — badge và
  toggle chỉ được tạo bằng JS khi role=admin.

### 6. Verification — `tests/test-admin-frontend.js` (jsdom, Node)
Chạy: `NODE_PATH=/tmp/node_modules node tests/test-admin-frontend.js`
Fake backend trong file test CHỈ dùng dữ liệu test tự bịa (mã LQ9001–LQ9004,
skin "Nakroth/Violet/Florentino/Murad Kiểm Thử") — không chứa dữ liệu skin
thật của kho. Module admin thật được nạp bằng cách strip từ khóa `export`
(vì Node không coi `.js` là ESM).
- **44 PASS, 0 FAIL** (2026-11-25), gồm:
  - (a) acc thường `nhatdeptrai`: module KHÔNG import (loader=0), 0 request
    `/api/admin`, không badge/toggle trong DOM, tìm "nakroth ki" ra đúng 9 acc
    sẵn thông tin (0 random).
  - (b) `admin2` (mật khẩu 1 ký tự): đăng nhập OK, số dư 250.000đ, module import
    1 lần, badge + toggle hiện; bật toggle → placeholder đổi; gõ "nakroth" →
    gọi đúng `/api/admin/random-search?q=nakroth` kèm `Bearer jwt-admin2`;
    kết quả hiện mã LQ9001 + skin thật + bậc SSS + giá 24.000đ, là acc Random
    thật, không có nút mua; tắt toggle → về tìm thường, placeholder trở lại.
  - (c) đăng xuất sau khi dùng admin: badge/toggle biến mất, RAM admin
    `resultsCount=0, on=false, initialized=false`; tìm thường không gọi
    `/api/admin` nữa, không còn thẻ admin.
  - (d) `API_BASE_URL` trống: form login báo "Chưa cấu hình backend", module
    không nạp, 0 request `/api/admin`; gọi trực tiếp `init` module với
    `backendReady=false` → không fetch, toast lỗi rõ.
  - (e) JWT user gọi `/api/admin/random-search` và `/api/admin/random-index`
    → 403; admin bị thu hồi quyền giữa chừng (stub trả 403) → toast "Không
    có quyền Admin" + toggle tự tắt.
  - (f) hồi quy tìm kiếm cũ: "murad" = 162, "nakroth ki" = 9, "sss" không ra
    acc Random nào (anti-leak).
  - (g) đăng ký với mật khẩu 5 ký tự vẫn bị chặn; placeholder mật khẩu đổi
    đúng theo tab đăng nhập/đăng ký.
  - (h) tải lại trang với token admin đã lưu → badge + toggle tự hiện, số dư
    250.000đ (restore session).
- Hồi quy batch-2 (harness cũ `/tmp/test_search.js`, `/tmp/test_search_demo.js`
  trích code thật từ app.js): **31/31 + 7/7 PASS** (không đổi).
- `node --check` PASS cho `assets/app.js` và `assets/admin-random-search.js`.
- Bảo mật (grep): HTML tĩnh có 0 chuỗi admin; app.js + module admin có 0
  hardcode skin thật / token / mật khẩu (chỉ còn ví dụ query công khai
  "nakroth ki, florentino, sss" trong placeholder — đúng như spec); module
  không dùng localStorage/IndexedDB (chỉ nhắc trong comment); 0 `onclick`,
  0 base64; CSP không đổi.

### 7. Files changed / added
- Sửa: `index.html` (placeholder mật khẩu → "Mật khẩu"), `assets/app.js`
  (validate login, role + lazy-load admin, tích hợp tìm kiếm/render/i18n),
  `assets/animations.css` (CSS admin), `REPORT2.md` (mục này).
- Thêm: `assets/admin-random-search.js` (module admin, ~14 KB),
  `tests/test-admin-frontend.js` (harness jsdom, 44 test).
- KHÔNG sửa backend, KHÔNG push GitHub (theo yêu cầu task frontend).

### 8. Lưu ý / chưa kiểm chứng bằng trình duyệt thật
- Chưa kiểm tra trên trình duyệt thật + điện thoại: toggle/badge hiển thị đúng
  trên mobile 390px, dynamic `import()` chạy trên Chrome mobile, toast 403,
  và `API_BASE_URL` phải được set thành domain VPS thật thì admin mới gọi
  được API (hiện `""` trong file — đăng nhập web + admin đều báo "Chưa cấu
  hình backend" cho tới khi cấu hình).
- Khi đổi ngôn ngữ trong lúc toggle admin đang bật, nhãn toggle + placeholder
  được vẽ lại qua `syncAdminPlaceholder()`; tiêu đề kết quả admin đã render
  không tự dịch lại (giữ nguyên cho tới lần tìm tiếp theo).
- Thẻ admin không có nút mua theo thiết kế (chỉ để kiểm tra kho). Nếu admin
  muốn mua acc Random vừa soi thấy, dùng bot Telegram hoặc tắt toggle rồi mua
  như khách thường.
