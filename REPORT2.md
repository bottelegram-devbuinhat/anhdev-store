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
