# AnhDev Store — Comprehensive Upgrade Report

**Repo:** `bottelegram-devbuinhat/anhdev-store` (branch `main`)
**Base commit:** `7d2f4ee` — "Fix multi-word search, rename logo ANHDEV.STORE to AnhDev Store"
**Date:** 2026-11-25
**Scope:** Parts 1–4 of the upgrade spec — performance, animations, security audit + patches, this report.
**Status:** Implemented locally in `store-upgrade/`. **NOT pushed or deployed** — the parent agent handles deployment.

---

## 0. Deliverables & sizes

| File | Before | After | Notes |
|---|---|---|---|
| `index.html` | 18,698,204 B | **65,638 B** | −99.6%. All base64 images extracted; main script moved out |
| `assets/app.js` | — (was inline) | 75,267 B | Main app script, byte-exact extraction + security patches |
| `assets/animations.js` | — | 8,620 B | Vanilla animation logic (no library) |
| `assets/animations.css` | — | 11,635 B | All Part 2 animation styles |
| `assets/banner-hero.webp` | — (inline base64) | 389,420 B | Hero banner, 2736×912 |
| `assets/cover-1.webp` | — (inline base64) | 616,094 B | Demo product cover, 1280×1920 |
| `assets/cover-2.webp` | — (inline base64) | 764,112 B | Demo product cover, 1920×1280 |
| `assets/cover-3.webp` | — (inline base64) | 737,576 B | Demo product cover, 1280×1920 |
| **Total (all 8 files)** | **18,698,204 B** | **2,668,362 B** | **−85.7% overall** (images are now cacheable files, not re-downloaded inline) |

**Verification:** `node --check` passes on `assets/app.js` and `assets/animations.js`. No `data:image/webp;base64` remains in `index.html`. All local asset references resolve (HTTP 200 in a local serve test). HTML tags balanced; inline `<style>` braces/parens balanced. `API_BASE` is still the real Worker URL. Pagination (12/page), multi-word search, emerald + gold theme, and the "AnhDev Store" logo are all intact.

**How the 18.7 MB was composed:** the file contained 22 inline `data:image/webp;base64` blobs but only **4 unique images** (the same 4 pictures reused across the hero + demo products). All 4 were extracted to `assets/` and every reference replaced with the asset path. The hero image is used 5× (1× hero + 4× demo products); each cover is used 5–6×.

---

## 1. Part 1 — Performance

### 1.1 Image extraction (the big win)
- All 4 unique WebP images extracted to `assets/` (see table above). `index.html` drops from 18.7 MB to ~64 KB.
- Hero `<img>` (`index.html:549`) now uses `src="assets/banner-hero.webp"` with `loading="eager" decoding="async" width="2736" height="912"`.
  - `width`/`height` reserve the aspect ratio → **no CLS** (the hero already has `min-height:340px` + `object-fit:cover` as a second guard).
  - `decoding="async"` keeps image decode off the main thread.
- Demo product `img` fields in the `PRODUCTS` array (`assets/app.js`) now point at `assets/cover-1/2/3.webp` and `assets/banner-hero.webp`.
- Card images (`assets/app.js:308`) keep `loading="lazy"` and gained `decoding="async"`.

### 1.2 Script extraction (enables a strict CSP)
- The single large inline `<script>` (~1,325 lines) was extracted byte-exact to `assets/app.js` and is now loaded as `<script src="assets/app.js" defer></script>` (`index.html:868`).
- `assets/animations.js` loads after it, also with `defer` (`index.html:869`), preserving execution order.
- Verified safe to defer: the script is an IIFE that runs after DOM parse (defer preserves that timing); it uses no `document.currentScript`; `window.onTelegramAuth` is set as a global and the Telegram Login Widget only calls it after user interaction, so it is defined by then; `telegram-web-app.js` and `qrcodejs` still load blocking in `<head>`.

### 1.3 Animation performance rules
- All new animations use **only `transform` and `opacity`** — no layout-triggering properties.
- `prefers-reduced-motion` is respected (base CSS already had it; `assets/animations.css` extends it to every new animation).
- Hover animations are gated behind `@media (hover:hover) and (pointer:fine)`; touch devices get a `scale(0.97)` tap feedback instead (`:active`).

---

## 2. Part 2 — Animation changelog (UI)

New files: `assets/animations.css` (styles) + `assets/animations.js` (logic). The app logic in `assets/app.js` was **not** changed for animation except for 3 tiny event hooks (see §2.12).

| # | Component | What was added |
|---|---|---|
| 1 | **Logo** | Shimmer sweep across the "A" mark (`brandShine`, 5 s loop) + gold glow on hover. |
| 2 | **Balance** | Count-up ticker (JS, `easeOutCubic`, ~650 ms) driven by the `anhdev:balance` event; a gold beam sweeps the balance card border when a **synced** balance updates. Number formatting reuses the app's exact `fmt()` rules (VND `vi-VN` + `đ`, USD `$` / 25,400). |
| 3 | **Check-in** | Pulse ring on the balance card + **vanilla confetti** (42 divs, no library, no CDN) + a floating `+xxxđ` particle anchored to the check-in modal. Triggered by the `anhdev:checkin` event. |
| 4 | **Sidebar** | Sliding full-width indicator pill that glides to the active nav item (JS positions it from `offsetTop`/`offsetHeight`; `MutationObserver` on nav class changes + resize). "Mua Tài Khoản" submenu is now a `grid-template-rows: 0fr → 1fr` accordion (HTML gained an inner `.nav-sub-inner` wrapper, `index.html:458-459`; the toggle in `app.js` now flips an `open` class instead of the `hidden` attribute). Mobile drawer slides in with `transform:translateX` instead of the abrupt `display:none → flex` swap. |
| 5 | **Topbar** | Glass intensifies on scroll (`.scrolled` class via passive scroll listener + rAF throttle) + shine sweep on the primary `.btn-wine` on hover. |
| 6 | **Hero** | Ken Burns (slow `scale(1 → 1.07)`, 16 s alternate) + staggered entrance for hero text (4 steps, 0.05–0.40 s delays). |
| 7 | **Cards** | Skeleton cards (shimmer) shown while `syncStock` fetches (only on first load — no flicker on refresh); staggered fade-up on render (60 ms/card, capped at 12); hover lift `translateY(-4px)` + image zoom + **tier glow** via the new `data-cat` attribute on each card (`random-tele` gold, `detail` emerald, `random-lq` green, `products` gold). |
| 8 | **Switcher** | Language/currency selects get focus ring + border transition; on currency change the prices in the product grid do a short crossfade flip (`.flip` class, 350 ms) on top of the card re-render stagger. |
| 9 | **Leaderboard** | Rows stagger in (70 ms/row) + metallic shimmer sweep on the top-3 rank badges (gold/silver/bronze `::after`). |
| 10 | **Modals** | Spring scale-in (`cubic-bezier(0.16,1,0.3,1)`, overriding the old `.22s slideup`) + backdrop blur fade. **Scroll lock:** `body.modal-lock` is now toggled by a `MutationObserver` on `.modal-wrap.open` (Esc + backdrop-click close already existed and are untouched). |
| 11 | **Toasts** | Moved from bottom-center to **top-right** (below the sticky topbar; full-width on mobile) with a slide-in and a gold `✓` checkmark (`::before`). |
| 12 | **Pager / chips** | Subtle hover lift + transition on pager buttons and category chips. |

### 2.12 Hooks added to `app.js` (minimal, behaviour-preserving)
- `anhdev:balance` dispatched at the end of `refreshUserUI()` (`app.js:237`) with `{value, synced}`.
- `anhdev:checkin` dispatched in the check-in handler with `{amount}`.
- `anhdev:stock-syncing` dispatched at the start of `syncStock()` (`app.js:471`) so skeletons can show.
- `data-cat` attribute added to each card `<article>` in `cardHtml()` (tier-glow hook).

### Left out / deliberately not done
- **Native `<select>` dropdowns cannot be animated** (the open dropdown list is OS-rendered). Only the control itself (border/focus) and the label/price crossfade are animated — noted here rather than faked.
- The inline `<style>` block was **not** moved to an external file (see §3.5 — inline `style="..."` attributes throughout the HTML would still force `style-src 'unsafe-inline'`).

---

## 3. Part 3 — Security audit

Audit scope: the whole `index.html` (now split into `index.html` + `assets/app.js`). All findings were verified against the actual code; nothing was invented. Severity: **Critical / High / Medium / Low / Info**.

### 3.1 Secrets — none found (Info, verified)
- **No hardcoded bot token, admin password, or API key exists in the page.** `THESIEURE.partnerId` / `partnerKey` are empty strings (`app.js:23-24`) — the user fills them; the code comments (`app.js:15-19`) already warn that the real signing key must stay server-side. `API_BASE` (`app.js:74`) is the public Cloudflare Worker URL, not a secret. The bank account `05817666778899` / `BUI NGUYEN XUAN NHAT` is the public receiving account shown intentionally for VietQR.
- **No credentials in stock data:** the live `stock.json` (12,126 accounts) carries only public fields (`code, price, rank, level, heroes, skins, rare_skins, category, kind, description, photos, warranty_days, status, skin_tiers`) — no `tk`/`mk`. The real credentials live only in the bot's `bot.db` on the host. Verified by inspecting the stock file.
- Secret-pattern grep (`bot_token`, `api_key`, `password`, `secret`, `AKIA`, `ghp_`, `sk-`, `xox`) returned nothing. If a real secret is ever found in future, it must be revoked/rotated and scrubbed from Git history — none was found here.

### 3.2 Client-side trust — real balance/purchase/check-in are server-side; demo state is now isolated
- **Balance:** real balances come only from the Worker (`apiFetch` → `GET /api/balance`, `app.js` balance sync). `localStorage` holds **no balance**. Demo balance is in-memory only and is explicitly labelled "số dư demo — CHƯA đồng bộ với bot" with a `warn` style until the Worker confirms it. ✅ Already correct; no change needed.
- **Check-in:** the web check-in generates a random 1–500đ **client-side** and adds it to the in-memory demo balance (`markBalanceUnsynced()`). This is demo-only — the real check-in/reward lives in the bot. The label makes that clear. **Patched:** the check-in button is now disabled on click (submit lock) so a double-click cannot credit twice in one modal open.
- **Purchases:** real (`api`) products route to the bot via `openBotBuyModal` — no local deduction, no local order. Only **demo** products use the local `completePurchase()` path. **Patched (Medium):** demo orders are now flagged `demo: true` (`app.js:790`) and render with a visible **"Demo"** badge in the order list (`app.js:838`), so a demo purchase can never be mistaken for a real delivered order. The fake `user`/`pass` in demo orders are random strings, not real credentials.
- **Discounts / prices:** no client-side discount logic exists; prices come from `stock.json` / the demo catalog. The bot is the authority for real pricing.

### 3.3 Telegram auth — no bypass found (verified)
- **No `?tg_id=` or URL-param auth:** grep for `URLSearchParams`, `location.search`, `location.href`, `tg_id` → 0 matches. Auth is only via (a) the official Telegram Login Widget signed payload (`data-telegram-login="devbn_bot"`, `data-onauth="onTelegramAuth(user)"`, `index.html:839`) and (b) Mini App signed `initData` (`Telegram.WebApp.initDataUnsafe.user` + signed `initData`). Both are sent to the Worker for server-side HMAC verification (`X-Telegram-Init-Data` / `X-Telegram-Login-Data` headers). ✅ Correct pattern.
- **localStorage session (`anhdev_user`):** stores the Telegram user + signed `login_data` payload. A faked localStorage entry cannot obtain a real balance because `apiFetch` requires the signed payload and the Worker verifies it; `loadSavedUser` validates `telegram_id`. Acceptable for a static page (the Worker is the authority).
- **Backend contract item (for the Worker):** the web sends `telegram_id` as a query param **and** the auth header on balance calls — the Worker must verify they match (see §4).

### 3.4 XSS — audit of every `innerHTML` use; 3 real issues patched
Grep for `eval`, `new Function`, `outerHTML`, `document.write`, `insertAdjacentHTML` → 0 matches. No `onclick` attributes → 0 matches (all handlers use `addEventListener`). The page has an `esc()` helper (escapes `&<>"'`) and it is used for names, descriptions, usernames, leaderboard names, order/invoice fields, and buy-modal content. `toast()` and `setSyncStatus()` use `textContent`. `data-i18n-html` innerHTML uses only static trusted HTML from the file itself.

| # | Location | Severity | Issue & fix |
|---|---|---|---|
| 1 | `app.js:308` `cardHtml()` | **High** | `p.img` was inserted **raw** into `src="..."`. `apiProduct` only validated photos with `/^https?:\/\//`, which does not block a `"` break-out (`https://x" onerror="...`). **Fixed:** `src="' + esc(p.img) + '"`. |
| 2 | `app.js:860,863` `renderInvoices()` | **Medium** | `iv.code` was **not escaped** — used in the meta line and in a `data-pay-invoice` attribute. `iv.code` comes from `randCode()` (safe) **or from the Worker response `d.code`** (server-controlled, but defence in depth). **Fixed:** both occurrences now use `esc(iv.code)`. |
| 3 | `app.js:225` avatar | **Low** | `photo_url` was `esc()`-ed but had no scheme check. **Fixed:** only render the avatar `<img>` when `photo_url` starts with `https://` (Telegram CDN); otherwise fall back to the initial letter. |

Remaining `innerHTML` uses were reviewed and are safe (static trusted HTML, or values already passed through `esc()`).

### 3.5 Content Security Policy — added (`index.html:9`)
The main script was moved to `assets/app.js` first, so `script-src` needs **no `'unsafe-inline'`**. Directives (whitelist-only, based on the resources the page actually loads):

```
default-src 'self';
script-src 'self' https://telegram.org https://cdnjs.cloudflare.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https://img.vietqr.io https://t.me https://cdn.telegram.org;
connect-src 'self' https://anhdev-balance.nhatdz2k011.workers.dev https://thesieure.com;
frame-src https://oauth.telegram.org;
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'self' https://web.telegram.org https://telegram.org;
upgrade-insecure-requests
```

Notes / limitations:
- **`style-src 'unsafe-inline'` is kept** because the page has one inline `<style>` block **and** many inline `style="..."` attributes. Removing it would require moving all inline styles into a stylesheet — a large, risky refactor. The CSP still blocks inline *scripts*, which is the higher-risk vector.
- **`img-src` includes `data:`** — required because `qrcodejs` renders the VietQR QR code as a `data:image/png` URL, and the favicon is `data:,`.
- **`img-src` does NOT allow arbitrary hosts.** Today no stock account has a `photos` URL (verified: 0 of 12,126), so nothing is blocked. **If the bot later attaches product photos from a new host, that host must be added to `img-src`** or the images will be blocked by the CSP.
- **`frame-ancestors`** allows only the page itself and Telegram (`web.telegram.org`, `telegram.org`) to frame it — this keeps the Mini App working (Telegram loads the Web App in a top-level WebView / Telegram Web frame) while blocking clickjacking from arbitrary sites. **Verify in the Mini App after deploy:** if any Telegram client loads the Web App inside an unexpected ancestor, this directive is the first thing to check.
- `connect-src` covers the Worker + TheSieuRe; `stock.json` is same-origin (`'self'`). All external hosts found in the code were checked against this list — every host is allowed (see verification log §5).

### 3.6 Random-account info leak — FIXED on the web (High)
`apiProduct()` (`app.js:403-415`) now returns a **generic description for `kind="random"`** and does not expose `rank`, `level`, `heroes`, `skins`, `rare_skins`, or the raw `description` from `stock.json`. Example of what was leaking: a random account's public `description` field (e.g. `"[Skin thường (theo rank)] (sss:0, ss:0, ss+:0, ssm:0, anime:0) - acc full"`) was copied verbatim onto random cards. Random cards now show only: *"Acc Random — nhận 1 acc ngẫu nhiên, không xem trước thông tin"*. Full info is kept for ready-info/VIP accounts. Search still works by account code (e.g. `LQ12126`) but no longer matches hidden skin info on random accounts. This supersedes `files/prompt-fix-random-info-leak-en.md` for the web side. (The same leak in the **bot** was already fixed in BOTLQ commit `cb1df44`.)

### 3.7 Submit locks & form validation — patched
| Area | Before | After |
|---|---|---|
| Card top-up (`#cardSubmit`) | No lock; validation was only non-empty + length ≥ 6 | **Strict validation:** serial must be digits-only, 10–16 digits; PIN digits-only, 10–15 digits (Vietnamese scratch-card format); whitespace stripped first. **Submit lock:** button disabled during the TheSieuRe call, re-enabled in the callback. |
| Buy confirm (`[data-buy-confirm]`) | No explicit lock (modal re-rendered synchronously, but a fast double-click could fire twice) | Button disabled on click + guard against re-entry. |
| Check-in (`#checkinBtn`) | No lock | Button disabled on click. |
| VietQR (`#makeQrBtn`) | Already had a lock (`btn.disabled = true`, re-enabled in `.then`) | No change needed. ✅ |

### 3.8 `target="_blank"` — patched (Low)
All 4 links now use `rel="noopener noreferrer"` (previously `noopener` only — missing `noreferrer`):
- `index.html` — sidebar link to `https://t.me/devbn_bot`; payment-page "Hỗ trợ" link.
- `app.js` — buy-modal "Mua trong bot @devbn_bot" link; English `paySupport` link.
(`target="_blank"` + `rel="noopener noreferrer"` prevents the opened page from accessing `window.opener` and from leaking the referrer.)

### 3.9 What was checked and found clean (no action)
- No `eval` / `new Function` / `document.write` / `outerHTML` / `insertAdjacentHTML` / `onclick` anywhere.
- No URL-param auth bypass (`URLSearchParams`, `location.search`, `tg_id` — 0 matches).
- No secrets in the page (see §3.1).
- No credentials in `stock.json` (see §3.1).
- VietQR QR uses the direct `img.vietqr.io` URL (public, intentional). **Phone scannability of the real QR is still unverified** — unchanged from before; test on a real phone after deploy.
- TheSieuRe `partnerId`/`partnerKey` are empty (user fills them); the signing comment already warns the key must stay server-side.

---

## 4. Backend API contract (for the Worker / bot — reference for future work)

This section documents the contract the **web page already implements** against. It is a reference, not a change: the Worker at `https://anhdev-balance.nhatdz2k011.workers.dev` is already deployed and the bot's `.env` already has the `CLOUDFLARE_SYNC_*` lines.

### 4.1 Telegram auth verification
- Web sends **either** `X-Telegram-Init-Data` (Mini App signed `initData`) **or** `X-Telegram-Login-Data` (Login Widget signed payload, JSON) on every authenticated call (`apiFetch`, `app.js`).
- **Worker MUST:** verify the HMAC signature with `BOT_TOKEN` (server-side, per Telegram's Login Widget / Web App validation algorithm), check `auth_date` freshness (max age `MAX_AUTH_AGE_SECONDS=86400`), and reject mismatched identities.
- **Worker MUST verify that the `telegram_id` query param (sent on balance calls) matches the authenticated identity** — never trust the query param alone.
- No `?tg_id=` fallback exists on the web and none must be added.

### 4.2 Balance sync
- `GET /api/balance` → `{ ok, balance, coins?, updatedAt? }`. Authenticated as above. Web polls/refreshes on view change and every 60 s while visible.
- `GET /api/health` → `{ ok:true, service:"anhdev-balance", ... }`.
- **Bot → Worker push:** the bot pushes balances to D1 (`balances` table) on a full sync every 300 s (`CLOUDFLARE_SYNC_INTERVAL=300`) and on balance change; the Worker reads from D1. The web never writes balances.
- The web displays `✓ Đồng bộ bot` only when `BALANCE.synced` is true (a real Worker response arrived); otherwise it shows the demo-balance warning.

### 4.3 Deposits (VietQR / SePay)
- `POST /api/deposit` (body: amount, method, telegram identity) → creates a deposit, returns `{ deposit_id, code, ... }`. The `code` is the transfer content (e.g. `ADxxxxxx`) shown in the VietQR QR (`img.vietqr.io` with `addInfo=<code>`).
- `GET /api/deposit/status?deposit_id=…&code=…` → `{ status: pending|paid|expired|cancelled, ... }`. The web polls this while the payment view is open.
- **SePay webhook (bot side):** the bot polls SePay every 2 min (webhook port 8080 is usually closed on shared cPanel); on a matching transfer the bot credits the wallet and the Worker picks up the new balance on the next sync. Amounts: `MIN_DEPOSIT=20000`, `MAX_DEPOSIT=5000000` (Worker vars).
- **Idempotency:** deposits are keyed by `code`/`deposit_id`; a duplicate confirm must not credit twice. The web's "Xác nhận đã chuyển" button is demo-only on the web path — the real credit happens bot-side on SePay confirmation.

### 4.4 Card top-up (TheSieuRe)
- `POST https://thesieure.com/chargingws/v2` with `partner_id`, `request_id` (= invoice code), `telco`, `amount`, `serial`, `pin`, `sign = md5(partnerKey + code + serial)`.
- **The signing key must be computed server-side** (bot/Worker), never in the browser — the web currently sends `sign: ""` and simulates the lifecycle when `partnerId`/`partnerKey` are empty. The web now validates serial (digits, 10–16) and PIN (digits, 10–15) before sending, and locks the submit button during the call.
- TheSieuRe credits 80% of face value (per the store's existing config); the credited amount is shown in the invoice detail.

### 4.5 Check-in (daily reward)
- **Real path is bot-side** (the bot owns the daily check-in and the 1–500đ reward). The web check-in is a demo that adds a random 1–500đ to the in-memory demo balance and marks it unsynced. It must never be treated as a real credit; the web re-syncs the real balance from the Worker on the next refresh.

### 4.6 Purchases (atomicity)
- **Real purchases happen in the bot** (Telegram). The bot must: reserve the account by code, hold it (5-min hold in the merged bot design), confirm payment, then deliver credentials exactly once and remove the code from sale. The web's buy flow for `api` products only opens the bot deep-link (`t.me/devbn_bot`) — it never deducts or delivers.
- **Demo purchases on the web are local-only** (deduct demo balance, create a local order with random fake credentials, now flagged `demo: true` + "Demo" badge). They must never touch a synced real balance.

### 4.7 Stock
- Single source of truth for the web: **`stock.json`** in the repo root (same-origin fetch, `cache:"no-store"`), refreshed by running `export_stock.py` against the live `bot.db` and pushing the new file. Stale > 7 days → demo catalog fallback. The web never writes stock.
- The web must never receive or display `tk`/`mk` — `export_stock.py` already excludes them.

---

## 5. Verification log

- `node --check assets/app.js` — **PASS** (before and after patches).
- `node --check assets/animations.js` — **PASS**.
- `index.html`: 0 `data:image/webp;base64`, 0 inline `<script>`, 0 `onclick`, 0 `eval`/`new Function`/`document.write`/`outerHTML`/`insertAdjacentHTML`, 0 `REPLACE-WITH` placeholder, 0 "400 Quân Huy" (removed demo product stays removed).
- `assets/app.js`: 0 `onclick`/`eval`/`new Function`/`document.write`/`outerHTML`/`insertAdjacentHTML`/`URLSearchParams`/`location.search`/`tg_id`.
- All 15 security patches confirmed present in `app.js` (see §3.4, §3.6, §3.7).
- `rel="noopener noreferrer"`: 2 in `index.html`, 2 in `app.js`; 0 bare `rel="noopener"` remain.
- DOM IDs: 77 IDs referenced by `app.js`; all exist in `index.html` except 5 that `app.js` itself creates dynamically via `innerHTML` (`accLogin`, `accLogout`, `accTopup`, `checkinBtn`, `ordersLogin`) — all guarded or created just before use. No missing static IDs.
- Local assets: `assets/animations.css`, `assets/animations.js`, `assets/app.js`, `assets/banner-hero.webp` all resolve; the 3 cover images are referenced 17× from the demo catalog and all exist. All 4 WebP files validated (correct dimensions: 2736×912, 1280×1920, 1920×1280, 1280×1920).
- HTTP serve test: all 6 main files return 200 with expected sizes.
- HTML tag balance: `div` 121/121, `section` 7/7, `nav` 2/2, `button` 51/51, `span` 65/65, `select` 5/5, `form` 1/1. Inline `<style>` braces 348/348, parens 287/287. `animations.css` braces 119/119.
- External hosts in the code vs CSP: `telegram.org`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `img.vietqr.io`, `t.me`, `cdn.telegram.org`, `anhdev-balance.nhatdz2k011.workers.dev`, `thesieure.com`, `oauth.telegram.org`, `web.telegram.org` — **all allowed** by the CSP.
- Features intact: `API_BASE` = real Worker URL; `PAGE_SIZE = 12` + `pagerHtml`; multi-word search (`split(/\s+/)`, AND match); emerald `#0d3b2e` + gold `#b08d2e`; logo "AnhDev Store" (no `ANHDEV.STORE` / `AnhDev.Store` text); Telegram Login Widget `devbn_bot`; Mini App `initData`; VietQR `img.vietqr.io`; TheSieuRe `partnerId` empty; `stock.json` fetch.

### Not verified (needs a live check after deploy)
- **No live browser test was run** (subagent has no live-browser access). After deploy, verify on a real phone + in the Telegram Mini App: page loads with no console errors, hero + covers render, balance shows `✓ Đồng bộ bot`, search/pagination work, the CSP does not block the Login Widget iframe or the QR image, and the sidebar/topbar/modal animations feel right. If the CSP blocks something, the browser console will name the directive — check `frame-ancestors` first for Mini App framing.
- VietQR QR scannability on a real phone (pre-existing, still open).
- The 4 WebP images are the original files byte-identical to the base64 blobs (decoded, not re-encoded), so visual quality is unchanged.

---

## 6. Deployment notes (for the parent agent)

- **Upload these files to the `anhdev-store` repo root** (same layout as here): `index.html`, `assets/app.js`, `assets/animations.js`, `assets/animations.css`, `assets/banner-hero.webp`, `assets/cover-1.webp`, `assets/cover-2.webp`, `assets/cover-3.webp`. `index.html` is now ~64 KB (well under the connector's 16 MiB limit), but the 4 images total ~2.5 MB — use the device-Chrome upload route for the images as before, or push `index.html` + the 3 small files via the connector and the images via Chrome.
- **Do NOT include `stock.json` in this deploy** (it is a separate file, updated only via `export_stock.py`).
- GitHub Pages serves `assets/` relative to the repo root, so the relative paths work as-is. No build step.
- After deploy, do the live checks listed in §5 (especially the Mini App + CSP + balance sync).


---

## 7. Re-check 2026-11-26 — Vá 4 điểm sót + xác nhận lại 10 kịch bản pentest

**Ngày:** 2026-11-26 ~21:15–21:45 +07. **Phạm vi:** chỉ frontend store (`index.html`, `assets/app.js`, `tests/test-topup-privacy.js` mới). Không động backend, bot, HostVN, Render, `stock.json`, dữ liệu thật. 5 acc test giữ nguyên.

### 7.1. Bốn điểm đã vá

1. **Ảnh VietQR `src=""` — ĐÃ ĐÚNG SẴN, không cần sửa code.** Kiểm tra lại HTML tĩnh live + working copy: `<img id="payQrImg" alt="Mã VietQR thanh toán hoá đơn" width="230" height="230" hidden />` — đã có `hidden`, KHÔNG có thuộc tính `src`. JS đã đúng: `syncPayQrVisibility()` ẩn khi không có src; `renderPayment()` chỉ gán src thật (URL `qr_url` hoặc VietQR `img.vietqr.io` dựng từ hoá đơn) rồi mới bỏ hidden; handler `error` ẩn ảnh + hiện fallback. Test `b18` (test-uiverse) + test mới `b1/d6` (test-topup-privacy) đều PASS: ảnh chỉ hiện sau khi tạo hoá đơn thật.
2. **Gỡ chữ "SePay đối soát tự động" — XONG.** Gỡ khỏi UI Nạp tiền + Hoá đơn (VI trong `index.html`, EN trong `I18N_EN` của `app.js`, text động `iv.detail`/toast, nhãn method hoá đơn, comment trong code): `topupSub`, `amtHint` (cả static lẫn `syncCurrency`), `invSub`, `invEmptyS`, `step2P`, `method` hoá đơn ("Ngân Hàng · VietQR"). Thay bằng mô tả đúng thực tế: chuyển đúng số tiền + ghi đúng mã hoá đơn, tiền vào ví sau khi hệ thống xác nhận. Chỉ giữ lại duy nhất giá trị API `method: "sepay"` trong body POST `/api/deposit` (app.js:2280) — đây là giá trị API Worker nhận, không phải text hiển thị; đổi nó có thể làm hỏng xử lý deposit phía Worker nên giữ nguyên.
3. **Ẩn STK + tên chủ TK khi CHƯA đăng nhập — XONG.** `index.html` dòng bankLine nay là `<p id="bankLine" hidden></p>` — rỗng, không còn STK/tên trong HTML tĩnh (đã gỡ cả khỏi `I18N_EN.bankLine`). Hàm mới `syncBankLine()` (app.js) điền text từ `BANK` và chỉ bỏ `hidden` khi **đã đăng nhập VÀ đã tạo hoá đơn** (`state.user` + `state.invoices.length > 0`); gọi ở `setUser()`, `applyLang()` (đổi ngôn ngữ vẽ lại đúng VI/EN), 2 đường tạo hoá đơn (`createLocal` + Worker `.then`), và INIT. Đăng xuất → ẩn + xoá text lại. Trang thanh toán (`view-payment`) vẫn hiện đủ thông tin sau khi tạo hoá đơn (đã yêu cầu login để tạo). Test mới `tests/test-topup-privacy.js` khoá hành vi này: 16 PASS.
4. **Console + pentest — xem 7.2 và 7.3.**

### 7.2. Kiểm tra Console (0 lỗi)

- jsdom + `VirtualConsole` bắt `jsdomError`/`console.error` lúc load trang: **0 lỗi** (test mới `a1`, test-topup-privacy).
- Kiểm tra tĩnh CSP: meta CSP có mặt (1); 7 thẻ `<script>` đều có `src=` (telegram.org, cdn.jsdelivr.net, `assets/*`) — 0 script nội tuyến; 0 thuộc tính event-handler nội tuyến trong HTML (`onclick`/`onload`/`onerror`...); 0 tài nguyên ngoài ngoài allowlist (chỉ `img.vietqr.io`, `telegram.org`, `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`, Worker, Render, `t.me`, `cdn.telegram.org`).
- `node --check` sạch: `app.js`, `admin-random-search.js`, `animations.js`.
- Lưu ý: jsdom không thực thi CSP thật — vẫn cần kiểm tra console trên trình duyệt thật sau deploy (xem §5).

### 7.3. Xác nhận lại 10 kịch bản pentest (S1–S10)

Phương pháp đợt này: KHÔNG re-fire lại toàn bộ script tấn công (backend không đổi code kể từ lần re-fire gốc, trừ commit S6C `f0c9e41` đã có test riêng 209 PASS). Thay vào đó: chạy lại toàn bộ test backend + frontend, quét lại S1, kiểm tra lại CSP tĩnh (S9), xác minh lại S6C trên file live, và đối chiếu các patch còn nguyên trong code. Kết quả:

| Kịch bản | Trạng thái sau re-check 2026-11-26 |
|---|---|
| **S1 — Git forensics** | **CHẶN (sạch).** Quét lại working copy repo công khai: mật khẩu thật không còn — fixture test dùng `"test123456"` (user) / `"x"` (admin2), không phải mật khẩu thật; 0 file `.env`/`.db`/`.sqlite`; `.gitignore` có mặt. Mật khẩu test thật vẫn chỉ nằm trong `seed.py` của repo backend RIÊNG TƯ (phải đổi/xoá trước khi công khai production — như đã ghi từ trước). |
| **S2 — Auth / JWT** | **CHẶN.** Patch `config.py:72` (JWT_SECRET ≥ 32 ký tự, từ chối khởi động nếu ngắn) còn nguyên; backend test 209 PASS (gồm auth). `LINK_SECRET` vẫn dùng chung `JWT_SECRET` theo mặc định — chưa tách (cần Anh quyết + đồng bộ env bot). |
| **S3 — Race (mua / điểm danh / callback)** | **AN TOÀN.** Không đổi code ở đường mua/điểm danh; backend test 209 PASS (gồm kiểm tra callback trùng không cộng 2 lần). |
| **S4 — Fake top-up** | **CHẶN.** Patch `cards.py:234-290` (value đối chiếu mệnh giá, code/serial khớp hoá đơn, credited ≤ 0 → 400, status ngoài {1,2,3} → 400, rollback không tiêu thụ hoá đơn) còn nguyên; backend test 209 PASS. |
| **S5 — IDOR** | **AN TOÀN.** `require_admin_jwt` kiểm tra lại role từ DB (`admin.py:44`) + `shop.py:80` còn nguyên; backend test 209 PASS (admin2 200, user/khách 403). |
| **S6 — Rò rỉ tìm kiếm random** | **A + B CHẶN; C VẪN MỞ (như đã biết).** A (leo thang admin) + B (glow search) an toàn, không đổi code. **C: file `stock.json` công khai trên GitHub Pages VẪN LÀ bản cũ 2026-11-22** (`updated_at: 2026-11-22T13:22:23`, total 12.126) — kiểm chứng live: `rare_skins` không rỗng còn đó ("Airi Kiemono", "Valhein Vũ khí tối thượng, Maloch Đại tướng Robot", "Ngộ Không Siêu việt") + description/rank đầy đủ cho acc random. Backend admin search đã đọc `shop_stock` (commit `f0c9e41`, xác minh `stock.py` không còn `fetch_stock_json`), nên lần re-export tới sẽ an toàn. **Cần re-export + push `stock.json` bằng `export_stock.py` đã lược trước ~29/11 (cần Chrome của Anh).** |
| **S7 — SQLi / XSS / logic** | **CHẶN (9/9).** Patch `config.py` (MAX_MONEY_AMOUNT 100M, MAX_CONTENT_LENGTH 5 MB, MAX_BODY_BYTES 1 MB), `admin.py` (int64 range + cap), `shop.py` (`_strip_html`), `app.py` (413 handler) còn nguyên; backend test 209 PASS. |
| **S8 — Rate-limit spoof** | **CHẶN (4/4).** Patch `security.py:211` (bỏ CF-Connecting-IP, XFF lấy mục cuối) + `config.py` HOST 127.0.0.1 còn nguyên; backend test 209 PASS. |
| **S9 — CORS / CSP / headers** | **CHẶN.** Header 4/4 (`app.py:101` after_request) còn nguyên; CORS/CSP/cookie không đổi code, vẫn an toàn; CSP tĩnh kiểm tra lại ở 7.2 (meta có, 0 script nội tuyến, 0 handler nội tuyến, 0 tài nguyên ngoài allowlist). Login CSRF đã xác minh đóng (endpoint chỉ đọc JSON). Chưa kiểm tra console CSP trên trình duyệt thật. |
| **S10 — Hồi quy giao diện** | **PASS.** Frontend **193/193 PASS** (177 cũ + 16 mới test-topup-privacy: a1, b1, c1–c6, d1–d8); backend **209/209 PASS** (test_self 86, test_admin 70, test_shop 53). Không regression. |

**Kết luận đợt re-check:** 9/10 kịch bản chặn được (như trước); **chỉ còn S6C mở** — dữ liệu `stock.json` công khai vẫn lộ cho tới khi re-export ~29/11 (đã có sẵn script lược + admin search đã chuyển sang `shop_stock`, chỉ chờ Anh đồng ý + Chrome để chạy). Không có kịch bản nào thủng thêm sau các thay đổi gần đây (S6C backend `f0c9e41`, rework Neon Aurora `acbb34df`, 3 mục vá trên).

---

## 8. UI/UX Upgrade — Worker D: kiểm tra toàn bộ + push (2026-11-26 ~21:43–22:0x +07)

**Phạm vi:** chỉ frontend store (`index.html`, `assets/app.js`, `tests/test-uiverse.js`). Không động backend, bot, HostVN, Render, `stock.json`, dữ liệu thật. 5 acc test giữ nguyên.

### 8.1. Vá 2 điểm sót Worker C2
1. **Xóa 5 key EN mồ côi trong `I18N_EN` (app.js, ~2785–2787):** `quick1S`, `quick2S`, `statModels`, `statFrom`, `distTitle`. Grep lại trước khi xóa: chỉ còn xuất hiện trong dict + 1 comment mô tả ở app.js:694–695 (ghi chú `.stats-card` đã bỏ — giữ lại vì là tài liệu đúng). Không còn HTML/JS nào dùng.
2. **Thêm `data-i18n="chipProducts"` cho chip "Sản phẩm số"** (index.html, `data-cat="products"`). Key EN `chipProducts:"Digital Products"` đã có sẵn; trước đó chip này không đổi sang EN. Đã kiểm chứng bằng jsdom: chuyển EN → chip hiện "Digital Products".

### 8.2. Dọn CSS chết
Xóa khỏi `<style>` của `index.html` (grep xác nhận 0 HTML/JS nào dùng): `.quick-row` + toàn bộ `.quick-card` (cùng block đã bỏ), `.stats-card` + `.stat-tiles`/`.stat-tile`/`.dist`/`.dist-row`/`.dist-bar`, và 2 override trong media query (`@media 760px` + `@media 420px`). Giữ lại `.steps` (đang dùng).

### 8.3. Hero thu gọn (đã làm, CSS-only, rủi ro thấp)
`.hero` min-height 340px → 260px (mobile 300px → 240px), `.hero-inner` padding 44px 46px → 32px 40px (mobile 30px 24px → 24px 20px), đoạn `p` margin-bottom 24px → 16px. Không đổi layout/cấu trúc.

### 8.4. Cập nhật test
- **test-uiverse.js a5, a6 (ripple):** Worker A đã đổi ripple sang màu brand (nền `var(--brand-secondary)`, chữ `var(--brand-secondary-text)`, hover/gợn sóng `var(--brand-primary)`) nên expectation cũ (`#0d6fb8`/`#47a7f5`, `#1D9AF2` trên `#292D3E`) fail — 2 test này là FAIL duy nhất ở baseline. Cập nhật sang assert dùng đúng biến brand + khẳng định 4 mã màu cũ không còn trong CSS.
- **test-shop-buy.js a10 + test-orders-history.js b3/b5 (eye-toggle):** Worker C đã cập nhật xong trước Worker D (thành a10a/a10b, b3a/b3b/b3c, b5a/b5b: tk/mk mặc định che `••••••••`, bấm mắt mới hiện) — baseline đã PASS, Worker D không sửa thêm.
- **test-uiverse.js mục C (tương phản):** các cặp WCAG cũ còn dùng màu Neon Aurora đã bỏ (`#7C3AED`, `#1D9AF2/#292D3E`, `#010201`, `#00f2ea`) — chỉ là literal tính tỉ lệ nên vẫn PASS nhưng không còn mô tả site. Worker D thay bằng 11 cặp brand thật (xem 8.5). Suite uiverse 48 → 50 test.

### 8.5. Kết quả test
- **Frontend jsdom — 199 PASS, 0 FAIL:** test-admin-frontend 49, test-orders-history 21, test-shop-buy 27, test-sold-codes 18, test-topup-privacy 16, test-uiverse 50, test-white-shuffle 18. Baseline trước khi sửa: 197 PASS, 2 FAIL (a5, a6).
- **Backend — 209 PASS, 0 FAIL** (chỉ chạy, không sửa): test_self 86, test_admin 70, test_shop 53. Lưu ý môi trường: `python3` hệ thống thiếu Flask/JWT/cryptography nên chạy bằng venv tạm `/tmp/be-venv` cài từ `requirements.txt` (không sửa backend).
- `node --check` sạch: `app.js`, `animations.js`, `admin-random-search.js`, toàn bộ `tests/test-*.js`. Ngoặc `{}` cân bằng: index.html 349/349, uiverse.css 116/116, animations.css 184/184.

### 8.6. Kiểm tra giao diện (jsdom + kiểm tra tĩnh)
- **Console/CSP:** jsdom VirtualConsole khi tải trang: 0 lỗi JS thật (chỉ 1 cảnh báo jsdom không hỗ trợ canvas `getContext()` cho `#heroFx` — giới hạn của jsdom, không phải lỗi trang; test-topup-privacy a1 cũng 0 lỗi). CSP meta còn nguyên, connect-src Worker + Render; 0 `<script>` nội tuyến; thuộc tính `data-onauth` trên thẻ script Telegram widget là có từ trước, không phải handler nội tuyến mới.
- **Xung đột `.uiv-*`:** 72 rule `.uiv-` trong uiverse.css, không có selector trùng lặp thật — `.uiv-shine-btn:hover` xuất hiện 2 lần là có chủ đích (rule gốc + override `transform:none` trong `@media (max-width:760px)`).
- **Cuộn ngang 390px:** `html,body{overflow-x:clip}`; mọi width ≥390px đều là `max-width` hoặc nằm trong media query (`.content` max-width 1240 + width:100%, modal max-width 480 + width:100%); test a8/a9/a11 (shine tắt scale mobile, glitch margin:0, glow input 100%) đều PASS.
- **Tương phản (WCAG, tính tay):** Light text-primary 15.57:1, text-secondary 5.25:1, ripple 8.70:1, CTA trắng trên `#0C4A3B` 10.20:1; Dark text-primary 17.93:1, text-secondary 7.63:1, ripple 10.54:1, CTA `#082A20` trên `#10B981` 6.08:1; kicker vàng `#F5B942` trên `#0C4A3B` 5.78:1; badge.pend Light `#92400E` trên `#FEF3C7` 6.37:1, Dark `#F5B942` trên `#2E2410` 8.65:1 — tất cả ≥4.5:1. Lưu ý: `--brand-gold` `#C68B2C` trên nền sáng chỉ ~2.95:1 nên KHÔNG dùng làm chữ (đã ghi trong comment index.html:34–35); chữ vàng dùng alias `--gold` như trên.
- **Light/Dark + toggle:** mặc định dark (`<html data-theme="dark">`, chưa có lựa chọn lưu → dark); jsdom: bấm `#themeLight` → light + lưu `anhdev_theme=light`, bấm `#themeDark` → dark. StockBar live: "12.126 accounts · From 3.000đ"; `#lbPodium` có mặt.
- **5 acc test + autocomplete:** backend test_admin đăng nhập cả 5 acc test (nhatdeptrai/nhatdz/muaacc/colonmahup/admin2); frontend test-admin-frontend 49 PASS (login nhatdeptrai + admin2, số dư 250.000đ). Autocomplete: `SEARCH_ALIASES` đủ 16 alias; test-uiverse b6 (dropdown gợi ý mở khi gõ) PASS.
- **Chưa kiểm chứng bằng trình duyệt thật:** console CSP thật, cuộn ngang 390px trên điện thoại, hero thu gọn nhìn thực tế — cần Anh mở store trên điện thoại + desktop sau deploy.

### 8.7. Push
- Commit (snapshot push, chỉ 4 file UTF-8: `index.html`, `assets/app.js`, `tests/test-uiverse.js`, `REPORT.md`): xem mục 8.8. Không push `stock.json` hay file nhị phân (ảnh `.webp` đã có sẵn trên repo, không đụng tới).
- Xác minh Pages sau push: xem 8.8.

### 8.8. Push — 3 lần (2 commit nội dung + 1 sửa REPORT)
- **Commit 1 — `299ca581631468fee7efa8702069a7a11bd8cab0`** ("UI/UX upgrade: emerald+gold brand palette, single-view storefront, microcopy, price filter, skeleton, eye-toggle orders"): `index.html`, `assets/app.js`, `tests/test-uiverse.js`, `REPORT.md`. Lần push đầu bị lỗi HTTP 503 phía MCP, kiểm tra head vẫn `ce3417fa` (chưa land) rồi thử lại thì thành công.
- **Phát hiện sau commit 1 (quan trọng):** so sánh blob-SHA local vs remote ở head mới cho thấy `assets/uiverse.css` và `assets/animations.css` trên remote vẫn là bản Neon Aurora cũ (last sync ở `acbb34df`) — Worker A sửa 2 file này nhưng chưa từng push; tương tự `tests/test-orders-history.js` và `tests/test-shop-buy.js` (eye-toggle của Worker C) cũng chưa lên remote. Lần push đầu chỉ gồm 4 file nên CHƯA đủ — site lúc đó ở trạng thái nửa vời (index.html/app.js mới + uiverse.css/animations.css Neon cũ).
- **Commit 2 — `708eefb353351657ab697565e36ed3926351f5af`** ("UI/UX upgrade (2/2): brand uiverse.css + animations.css, eye-toggle order tests"): `assets/uiverse.css`, `assets/animations.css`, `tests/test-orders-history.js`, `tests/test-shop-buy.js`. Sau commit này, kiểm tra lại SHA toàn bộ file text trong working copy khớp remote (trừ `REPORT.md` — xem dưới).
- **Commit 3 — sửa `REPORT.md`:** thêm chính mục 8.8 này (bản push ở commit 1 còn ghi "xem mục 8.8" nhưng chưa có mục đó). Xem sync record để lấy SHA.
- Không push `stock.json` hay file nhị phân nào (ảnh `.webp` đã có sẵn trên repo).
- **Xác minh sau push:** `get_file_contents` ở head mới: `assets/app.js` SHA `d61f274c…` khớp local; fetch raw `index.html` ở commit mới hiện nội dung mới (guide "Mua acc trong 4 bước" đã khôi phục, không còn stats-card "Tổng quan kho đang xem", hero text microcopy mới); fetch raw `uiverse.css` ở commit 1 còn hiện Neon (đúng vì lúc đó chưa push file này — đã sửa ở commit 2). Trang GitHub Pages trả 200 (mở được) nhưng bản sao text-fetch của crawler vẫn giữ snapshot cũ từ 14:52 UTC — cần mở lại sau vài phút / hard-refresh trên trình duyệt thật để thấy bản mới; nội dung commit trên GitHub đã xác minh là mới và sạch Neon (`#0B0B1A`, `--rainbow`: 0 lần trong cả 4 file đã deploy; `#8B5CF6`/`#EC4899`/`#1D9AF2`/`#292D3E`/`#010201`: 0 lần trong `uiverse.css`/`animations.css` local đã push).
