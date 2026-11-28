/* ============================================================================
   Test frontend — Music player (floating bar) tren AnhDev Store
   ----------------------------------------------------------------------------
   Chay:  NODE_PATH=/tmp/node_modules node tests/test-music-player.js
   (tu thu muc files/store-upgrade/)
   Can: jsdom (da co o /tmp/node_modules).

   Kich ban:
     A. Static: markup player trong index.html + nhung CSS/JS + app.js
        expose ANHDEV_BACKEND_URL + CSP cho phep media-src tu backend +
        khong hardcode URL backend trong music-player.js + icon SVG
        (khong emoji).
     B. Co nhac (mock fetch): tai trang chon NGAU NHIEN 1 bai de phat,
        het bai ('ended') tu chuyen bai khac, nut Next/Prev, Play/Pause,
        am luong, thu gon/mo lai.
     C. Autoplay bi chan (NotAllowedError): hien "Bam de phat nhac",
        bam Play 1 lan la phat binh thuong.
     D. Khong co nhac (list rong / API loi / chua cau hinh backend):
        player an, khong vo layout, khong goi fetch thua.
     E. URL bai hat: filename -> BASE + /api/music/<file>; url tuyet
        doi giu nguyen; bai khong co url/filename bi loc bo.
     F. Doi ngon ngu VI -> EN: aria-label doi theo.
   ============================================================================ */
const fs = require("fs");
const path = require("path");
let JSDOM;
try { JSDOM = require("jsdom").JSDOM; }
catch (e) { JSDOM = require("/tmp/node_modules/jsdom").JSDOM; }

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const mpCss = fs.readFileSync(path.join(ROOT, "assets/music-player.css"), "utf8");
const mpJs = fs.readFileSync(path.join(ROOT, "assets/music-player.js"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "assets/app.js"), "utf8");

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; failures.push(name); console.log("FAIL " + name + (extra !== undefined ? " :: " + extra : "")); }
}
function flush(ms) { return new Promise(function (res) { setTimeout(res, ms || 20); }); }

const BASE = "https://anhdev-store-backend.onrender.com";
const SONGS = [
  { filename: "a.mp3", title: "Bài A" },
  { filename: "b.mp3", title: "Bài B" },
  { url: "https://cdn.example.com/c.mp3", title: "Bài C" },
  { title: "Bài hỏng (không url)" }
];
const URL_A = BASE + "/api/music/a.mp3";
const URL_B = BASE + "/api/music/b.mp3";
const URL_C = "https://cdn.example.com/c.mp3";

/* ---- A. Static ---- */
(function () {
  ["musicPlayer", "mpAudio", "mpPlayBtn", "mpPrevBtn", "mpNextBtn",
   "mpTitle", "mpVol", "mpCollapseBtn", "mpFab"].forEach(function (id) {
    check("a1. index.html co #" + id, html.indexOf('id="' + id + '"') !== -1);
  });
  check("a2. player mac dinh an (hidden)", /id="musicPlayer"[^>]*hidden/.test(html));
  check("a3. index.html nhung assets/music-player.css",
    html.indexOf('<link rel="stylesheet" href="assets/music-player.css"') !== -1);
  check("a4. index.html nhung assets/music-player.js (sau app.js)",
    html.indexOf('<script src="assets/music-player.js" defer></script>') !== -1 &&
    html.indexOf("assets/music-player.js") > html.indexOf("assets/app.js"));
  check("a5. app.js expose window.ANHDEV_BACKEND_URL = API_BASE_URL",
    appJs.indexOf("window.ANHDEV_BACKEND_URL = API_BASE_URL") !== -1);
  check("a6. CSP co media-src cho phep backend",
    /media-src 'self' https:\/\/anhdev-store-backend\.onrender\.com/.test(html));
  check("a7. music-player.js goi GET /api/music/list",
    mpJs.indexOf('"/api/music/list"') !== -1);
  check("a8. music-player.js KHONG hardcode URL backend",
    mpJs.indexOf("onrender.com") === -1 && mpJs.indexOf("anhdev-store-backend") === -1);
  check("a9. music-player.js xu ly su kien 'ended' de tu chuyen bai",
    /addEventListener\("ended"/.test(mpJs));
  check("a10. music-player.js doc URL backend tu window.ANHDEV_BACKEND_URL",
    mpJs.indexOf("window.ANHDEV_BACKEND_URL") !== -1);
  check("a11. CSS player dinh nghia .mp + .mp-fab",
    mpCss.indexOf(".mp{") !== -1 && mpCss.indexOf(".mp-fab") !== -1);
  check("a12. CSS player dung token var(--...) cua store",
    /var\(--(surface|ink|muted|line|wine)/.test(mpCss));
  const m = html.match(/id="musicPlayer"[\s\S]*?id="mpFab"[\s\S]*?<\/button>/);
  check("a13. markup player dung SVG, khong emoji lam icon",
    !!m && /<svg/.test(m[0]) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(m[0]),
    m ? m[0].slice(0, 80) : "khong tim thay markup");
})();

/* ---- Moi truong jsdom dung chung ---- */
function makeWindow(opts) {
  opts = opts || {};
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "dangerously", /* de chay music-player.js nhu trinh duyet that
      (win.eval khong thay `document` o jsdom ban nay); index.html khong co
      inline <script> nao nen khong chay code la, cac <script src> ngoai
      khong duoc tai vi resources mac dinh khong load. */
    url: "https://bottelegram-devbuinhat.github.io/anhdev-store/"
  });
  const win = dom.window;
  const doc = win.document;
  if (opts.backend !== false) win.ANHDEV_BACKEND_URL = BASE;
  let ri = 0;
  const seq = opts.randomSeq || [0.1];
  win.Math.random = function () { return seq[ri++ % seq.length]; };
  const fetchCalls = [];
  win.fetch = function (url) {
    fetchCalls.push(url);
    if (opts.fetchError) return Promise.reject(new Error("network down"));
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ ok: true, songs: opts.songs }); }
    });
  };
  const playCalls = [];
  const pauseCalls = [];
  win.HTMLMediaElement.prototype.play = function () {
    playCalls.push(this.src);
    if (opts.playReject) {
      return Promise.reject(new win.DOMException("play() failed", "NotAllowedError"));
    }
    return Promise.resolve();
  };
  win.HTMLMediaElement.prototype.pause = function () { pauseCalls.push(1); };
  const st = doc.createElement("style");
  st.textContent = mpCss;
  doc.head.appendChild(st);
  const sc = doc.createElement("script");
  sc.textContent = mpJs;
  doc.body.appendChild(sc); /* chay ngay khi append (runScripts: dangerously) */
  const mp = win.AnhDevMusicPlayer;
  const q = function (id) { return doc.getElementById(id); };
  return { dom, win, doc, mp, q, fetchCalls, playCalls, pauseCalls, opts };
}
function click(win, el) { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); }

/* ---- B. Co nhac: chon ngau nhien, het bai doi bai, nut bam ---- */
async function scenarioB() {
  const w = makeWindow({ songs: SONGS, randomSeq: [0.1, 0.9, 0.4] });
  await flush();
  const audio = w.q("mpAudio");
  check("b1. co nhac: mo trang chi hien NUT TRON, bar an (nhac van phat nen)",
    w.q("musicPlayer").hidden === true && w.q("mpFab").hidden === false);
  check("b1b. bam nut tron: mo bar, nut tron an",
    (function(){ click(w.win, w.q("mpFab")); return w.q("musicPlayer").hidden === false && w.q("mpFab").hidden === true; })());
  check("b2. goi dung GET /api/music/list tren backend",
    w.fetchCalls.length === 1 && w.fetchCalls[0] === BASE + "/api/music/list",
    w.fetchCalls.join(","));
  check("b3. tai trang chon ngau nhien bai A (Math.random=0.1 -> index 0)",
    w.mp.current === 0 && audio.src === URL_A && w.mp.playing === true,
    "current=" + w.mp.current + " src=" + audio.src);
  check("b4. play() duoc goi 1 lan khi tai trang", w.playCalls.length === 1);
  check("b5. tieu de hien ten bai dang phat",
    w.q("mpTitle").textContent === "Bài A", w.q("mpTitle").textContent);
  check("b6. class is-playing bat khi dang phat",
    w.q("musicPlayer").classList.contains("is-playing"));

  /* Het bai -> tu chuyen sang bai ngau nhien khac (0.9 -> index 2 = bai C, url tuyet doi giu nguyen). */
  audio.dispatchEvent(new w.win.Event("ended"));
  await flush();
  check("b7. het bai: tu chuyen sang bai C (khong lap bai A)",
    w.mp.current === 2 && audio.src === URL_C,
    "current=" + w.mp.current + " src=" + audio.src);
  check("b8. bai khong co url/filename bi loc (chi con 3 bai)",
    w.mp.songs.length === 3, "songs=" + w.mp.songs.length);

  /* Nut Next -> bai B (0.4 -> index 1). */
  click(w.win, w.q("mpNextBtn"));
  await flush();
  check("b9. nut Next: chuyen sang bai B",
    w.mp.current === 1 && audio.src === URL_B,
    "current=" + w.mp.current + " src=" + audio.src);

  /* Nut Prev -> quay lai bai C (history [A, C, B] -> pop B). */
  click(w.win, w.q("mpPrevBtn"));
  await flush();
  check("b10. nut Prev: quay lai bai C vua phat",
    w.mp.current === 2 && audio.src === URL_C,
    "current=" + w.mp.current + " src=" + audio.src);

  /* Play/Pause: dang phat -> bam tam dung -> bam phat tiep. */
  const pausesBefore = w.pauseCalls.length;
  click(w.win, w.q("mpPlayBtn"));
  await flush();
  check("b11. bam Play khi dang phat: pause() duoc goi, playing=false",
    w.pauseCalls.length === pausesBefore + 1 && w.mp.playing === false &&
    !w.q("musicPlayer").classList.contains("is-playing"));
  const playsBefore = w.playCalls.length;
  click(w.win, w.q("mpPlayBtn"));
  await flush();
  check("b12. bam lai: play() duoc goi, playing=true, khong doi bai",
    w.playCalls.length === playsBefore + 1 && w.mp.playing === true && w.mp.current === 2);

  /* Am luong. */
  const vol = w.q("mpVol");
  vol.value = "50";
  vol.dispatchEvent(new w.win.Event("input", { bubbles: true }));
  check("b13. keo am luong 50 -> audio.volume = 0.5", audio.volume === 0.5, "volume=" + audio.volume);

  /* Thu gon / mo lai. */
  click(w.win, w.q("mpCollapseBtn"));
  check("b14. thu gon: bar an, nut tron hien",
    w.q("musicPlayer").hidden === true && w.q("mpFab").hidden === false);
  click(w.win, w.q("mpFab"));
  check("b15. bam nut tron: bar hien lai, nut tron an",
    w.q("musicPlayer").hidden === false && w.q("mpFab").hidden === true);
}

/* ---- C. Autoplay bi chan ---- */
async function scenarioC() {
  const w = makeWindow({ songs: SONGS, playReject: true, randomSeq: [0.1] });
  await flush();
  check("c1. autoplay bi chan: blocked=true, van hien NUT TRON (bar an)",
    w.mp.blocked === true && w.mp.playing === false && w.q("mpFab").hidden === false && w.q("musicPlayer").hidden === true);
  check("c1b. autoplay bi chan: nut tron co vong nhan need-tap",
    w.q("mpFab").classList.contains("need-tap"),
    w.q("mpFab").className);
  check("c2. autoplay bi chan: hien chu 'Bấm để phát nhạc' + class need-tap",
    w.q("mpTitle").textContent === "Bấm để phát nhạc" &&
    w.q("musicPlayer").classList.contains("need-tap"),
    w.q("mpTitle").textContent);
  check("c3. autoplay bi chan: bai da chon san (khong mat bai)",
    w.mp.current === 0, "current=" + w.mp.current);
  /* Nguoi dung bam Play 1 lan -> phat binh thuong. */
  w.opts.playReject = false;
  click(w.win, w.q("mpPlayBtn"));
  await flush();
  check("c4. bam Play sau khi bi chan: phat duoc, het need-tap, hien ten bai",
    w.mp.playing === true && w.mp.blocked === false &&
    !w.q("musicPlayer").classList.contains("need-tap") &&
    w.q("mpTitle").textContent === "Bài A",
    "playing=" + w.mp.playing + " title=" + w.q("mpTitle").textContent);
}

/* ---- D. Khong co nhac ---- */
async function scenarioD() {
  const w1 = makeWindow({ songs: [] });
  await flush();
  check("d1. list rong: player an (bar + nut tron deu hidden)",
    w1.q("musicPlayer").hidden === true && w1.q("mpFab").hidden === true);

  const w2 = makeWindow({ songs: SONGS, fetchError: true });
  await flush();
  check("d2. API loi: player an, khong vo layout",
    w2.q("musicPlayer").hidden === true && w2.q("mpFab").hidden === true);

  const w3 = makeWindow({ songs: SONGS, backend: false });
  await flush();
  check("d3. chua cau hinh backend: khong goi fetch, player an",
    w3.fetchCalls.length === 0 && w3.q("musicPlayer").hidden === true,
    "fetchCalls=" + w3.fetchCalls.length);
}

/* ---- E. URL tuong doi goc cua backend (hoi quy loi 28/11) ----
   Backend tra url dang "/api/music/<file>" (xem music.py). Neu player tra
   ve nguyen chuoi nay, trinh duyet se hieu la duong dan tren GitHub Pages
   (404) thay vi tren backend Render -> nhac khong bao gio phat. */
async function scenarioE() {
  const w = makeWindow({
    songs: [{ url: "/api/music/d.mp3", title: "Bài D" }],
    randomSeq: [0.1]
  });
  await flush();
  const audio = w.q("mpAudio");
  check("e1. url '/api/music/d.mp3' cua backend -> ghep voi BASE, khong giu nguyen",
    w.mp.current === 0 && audio.src === BASE + "/api/music/d.mp3",
    "src=" + audio.src);
  check("e2. src KHONG tro ve GitHub Pages",
    audio.src.indexOf("bottelegram-devbuinhat.github.io") === -1,
    "src=" + audio.src);
}

/* ---- F. Doi ngon ngu ---- */
async function scenarioF() {
  const w = makeWindow({ songs: SONGS, randomSeq: [0.1] });
  await flush();
  w.doc.documentElement.setAttribute("lang", "en");
  await flush();
  check("f1. doi sang EN: aria-label nut Play doi theo (Pause khi dang phat)",
    w.q("mpPlayBtn").getAttribute("aria-label") === "Pause",
    w.q("mpPlayBtn").getAttribute("aria-label"));
  check("f2. doi sang EN: aria-label nut tron mo player doi theo",
    w.q("mpFab").getAttribute("aria-label") === "Open music player",
    w.q("mpFab").getAttribute("aria-label"));
}

(async function main() {
  try {
    await scenarioB();
    await scenarioC();
    await scenarioD();
    await scenarioE();
    await scenarioF();
  } catch (e) {
    fail++;
    failures.push("exception: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e));
    console.log("FAIL exception :: " + e);
  }
  console.log("\n" + pass + " PASS, " + fail + " FAIL");
  if (failures.length) console.log("FAILURES: " + failures.join(" | "));
  process.exit(fail ? 1 : 0);
})();
