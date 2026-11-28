/* ============================================================================
   Music player — phat nhac nen cua AnhDev Store (file rieng)
   ----------------------------------------------------------------------------
   - Danh sach bai lay tu backend Flask: GET /api/music/list
     -> {ok, songs:[{filename, url, title}]}; file phat qua
     GET /api/music/<filename> (hoac url tuyet doi neu backend tra san).
   - URL backend doc tu window.ANHDEV_BACKEND_URL (app.js expose tu
     API_BASE_URL — KHONG hardcode lai o day).
   - Hanh vi: tai trang -> chon NGAU NHIEN 1 bai de phat (moi lan refresh
     la 1 bai ngau nhien khac); het bai ('ended') -> tu dong chuyen sang
     bai ngau nhien khac (khong lap lai bai vua phat ngay).
   - Mac dinh mo trang: chi hien NUT TRON (FAB), khong mo thanh bar.
     Nhac van TU PHAT nen ngay khi tai trang; bam nut tron moi mo bar
     de bam Play/Pause/Next/Prev, chinh am luong. Nut thu gon tren bar
     dua ve nut tron.
   - Trinh duyet chan autoplay co tieng truoc khi nguoi dung tuong tac:
     thu phat khi tai trang; neu bi chan (NotAllowedError) thi nut tron
     hien vong nhan nhap nhay; nguoi dung bam 1 lan (vao nut tron hoac
     bat cu dau) la phat binh thuong, cac lan chuyen bai sau do tu dong.
   - Chua co bai nao (list rong / API loi / chua cau hinh backend):
     player AN di, khong vo layout, khong spam loi console.
   - Khong dung localStorage/sessionStorage; trang thai chi trong RAM.
   ============================================================================ */
(function(){
  "use strict";

  var BASE = (typeof window !== "undefined" && window.ANHDEV_BACKEND_URL) || "";
  var LIST_PATH = "/api/music/list";
  var MUSIC_PATH = "/api/music/";
  var TIMEOUT_MS = 8000;
  var MAX_SKIP_ERRORS = 3;

  var root = document.getElementById("musicPlayer");
  var fab = document.getElementById("mpFab");
  var audio = document.getElementById("mpAudio");
  var playBtn = document.getElementById("mpPlayBtn");
  var prevBtn = document.getElementById("mpPrevBtn");
  var nextBtn = document.getElementById("mpNextBtn");
  var titleEl = document.getElementById("mpTitle");
  var volInput = document.getElementById("mpVol");
  var collapseBtn = document.getElementById("mpCollapseBtn");
  if (!root || !fab || !audio || !playBtn || !prevBtn || !nextBtn || !titleEl) return;

  /* Chuoi theo ngon ngu hien tai cua store (documentElement.lang do
     applyLang() trong app.js dat: "vi" | "en"). */
  var STR = {
    vi: { play:"Phát nhạc", pause:"Tạm dừng", prev:"Bài trước", next:"Bài tiếp",
          tapToPlay:"Bấm để phát nhạc", noMusic:"Chưa có nhạc", volume:"Âm lượng",
          open:"Mở trình phát nhạc", collapse:"Thu gọn trình phát", loading:"Đang tải nhạc..." },
    en: { play:"Play", pause:"Pause", prev:"Previous", next:"Next",
          tapToPlay:"Tap to play", noMusic:"No music yet", volume:"Volume",
          open:"Open music player", collapse:"Collapse player", loading:"Loading music..." }
  };
  function lang(){ return document.documentElement.getAttribute("lang") === "en" ? "en" : "vi"; }
  function t(k){ var d = STR[lang()] || STR.vi; return d[k] || STR.vi[k] || k; }

  var songs = [];      // [{title, url}]
  var current = -1;    // index dang phat
  var history = [];    // cac index da phat (phuc vu nut Previous)
  var playing = false;
  var blocked = false; // autoplay bi trinh duyet chan (NotAllowedError)
  var ready = false;   // da tai xong danh sach co bai
  var skipErrors = 0;  // so bai loi lien tiep (doi gioi han de khong lap vo han)

  function hideAll(){ root.hidden = true; fab.hidden = true; }
  function showPlayer(){ root.hidden = false; fab.hidden = true; }
  /* Mac dinh mo trang: chi hien nut tron (FAB), khong mo thanh bar —
     nhac van tu phat nen, bam nut tron moi mo bar de chinh. */
  function showFab(){ root.hidden = true; fab.hidden = false; }

  function updateTexts(){
    playBtn.setAttribute("aria-label", playing ? t("pause") : t("play"));
    prevBtn.setAttribute("aria-label", t("prev"));
    nextBtn.setAttribute("aria-label", t("next"));
    if (collapseBtn) collapseBtn.setAttribute("aria-label", t("collapse"));
    fab.setAttribute("aria-label", t("open"));
    if (volInput) volInput.setAttribute("aria-label", t("volume"));
    if (blocked) titleEl.textContent = t("tapToPlay");
    else if (current >= 0 && songs[current]) titleEl.textContent = songs[current].title;
    else titleEl.textContent = t("loading");
    titleEl.classList.toggle("mp-title-tap", blocked);
  }
  function setPlayingUI(){
    root.classList.toggle("is-playing", playing);
    root.classList.toggle("need-tap", blocked);
    fab.classList.toggle("is-playing", playing);
    fab.classList.toggle("need-tap", blocked);
    updateTexts();
  }

  function resolveUrl(s){
    if (!s) return null;
    if (typeof s.url === "string" && s.url) {
      /* Chi URL day du (http(s):// hoac //) moi tra ve nguyen.
         Duong dan tuong doi kieu "/api/music/..." la cua BACKEND, phai
         ghep voi BASE — tra ve nguyen se khien trinh duyet hieu la
         duong dan tren GitHub Pages (404), nhac khong bao gio phat. */
      if (/^(https?:)?\/\//i.test(s.url)) return s.url;
      return BASE.replace(/\/$/, "") + "/" + s.url.replace(/^\//, "");
    }
    if (typeof s.filename === "string" && s.filename) {
      return BASE.replace(/\/$/, "") + MUSIC_PATH + encodeURIComponent(s.filename);
    }
    return null;
  }
  function songTitle(s, i){
    if (s && typeof s.title === "string" && s.title.trim()) return s.title.trim();
    var f = (s && s.filename) || "";
    return f ? f.replace(/\.[^.]+$/, "") : ("Track " + (i + 1));
  }

  /* Phat <audio>: tra ve promise (trinh duyet that) hoac undefined (moi
     truong khong ho tro promise). Tap trung xu ly loi o 1 cho. */
  function startAudio(){
    var p = null;
    try { p = audio.play(); } catch (e) { p = Promise.reject(e); }
    if (p && typeof p.then === "function") {
      p.then(function(){
        playing = true; blocked = false; skipErrors = 0; setPlayingUI();
      }, function(err){ onPlayError(err); });
    } else {
      playing = true; blocked = false; setPlayingUI();
    }
  }
  function onPlayError(err){
    playing = false;
    if (err && err.name === "NotAllowedError") {
      /* Autoplay bi chan: doi nguoi dung bam 1 lan, giu nguyen bai. */
      blocked = true; setPlayingUI(); return;
    }
    /* Loi khac (file hong / mang): bo qua bai nay, thu bai khac,
       toi da MAX_SKIP_ERRORS lan lien tiep roi dung lai. */
    skipErrors++;
    if (skipErrors <= MAX_SKIP_ERRORS && songs.length > 1) nextSong();
    else setPlayingUI();
  }

  function pickRandom(exclude){
    if (!songs.length) return -1;
    if (songs.length === 1) return 0;
    var r = Math.floor(Math.random() * songs.length), guard = 0;
    while (r === exclude && guard < 10) { r = Math.floor(Math.random() * songs.length); guard++; }
    return r;
  }
  function playSong(idx, pushHist){
    if (idx < 0 || idx >= songs.length) return;
    if (pushHist && current !== idx) history.push(idx);
    current = idx;
    blocked = false;
    audio.src = songs[idx].url;
    setPlayingUI();
    startAudio();
  }
  function nextSong(){
    if (!songs.length) return;
    playSong(pickRandom(current), true);
  }
  function prevSong(){
    if (!songs.length) return;
    if (history.length > 1) {
      history.pop(); /* bo bai hien tai */
      playSong(history[history.length - 1], false);
    } else {
      playSong(pickRandom(current), true);
    }
  }
  function togglePlay(){
    if (!ready || current < 0) return;
    if (playing) {
      audio.pause();
      playing = false; blocked = false; setPlayingUI();
    } else {
      startAudio(); /* phat tiep bai hien tai, khong nap lai src */
    }
  }

  function loadList(){
    if (!BASE || BASE.indexOf("REPLACE-WITH") !== -1 || typeof fetch !== "function") {
      hideAll();
      return Promise.resolve(false);
    }
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = null;
    if (ctrl) timer = setTimeout(function(){ try { ctrl.abort(); } catch (e) {} }, TIMEOUT_MS);
    var init = ctrl ? { signal: ctrl.signal } : {};
    return fetch(BASE.replace(/\/$/, "") + LIST_PATH, init).then(function(r){
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(data){
      if (timer) clearTimeout(timer);
      var list = (data && Array.isArray(data.songs)) ? data.songs : [];
      songs = list.map(function(s, i){
        return { title: songTitle(s, i), url: resolveUrl(s) };
      }).filter(function(s){ return !!s.url; });
      if (!songs.length) { hideAll(); return false; }
      ready = true;
      showFab();
      updateTexts();
      playSong(pickRandom(-1), true); /* refresh trang = bai ngau nhien moi */
      return true;
    }).catch(function(){
      if (timer) clearTimeout(timer);
      hideAll(); /* API loi / chua co nhac: an player, khong spam console */
      return false;
    });
  }

  /* --- Su kien --- */
  playBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", prevSong);
  nextBtn.addEventListener("click", function(){ nextSong(); });
  if (collapseBtn) collapseBtn.addEventListener("click", function(){
    root.hidden = true; fab.hidden = false;
  });
  fab.addEventListener("click", function(){
    fab.hidden = true; root.hidden = false;
  });
  if (volInput) {
    audio.volume = Number(volInput.value || 80) / 100;
    volInput.addEventListener("input", function(){
      audio.volume = Number(volInput.value) / 100;
    });
  }
  audio.addEventListener("ended", function(){ nextSong(); });
  audio.addEventListener("play", function(){ playing = true; blocked = false; setPlayingUI(); });
  audio.addEventListener("pause", function(){
    /* 'ended' khong kem 'pause' theo spec, nhung van chan de tranh race
       voi nextSong() khi bai vua het. */
    if (!audio.ended) { playing = false; setPlayingUI(); }
  });
  /* Autoplay bi chan truoc do: lan tuong tac dau tien cua nguoi dung
     tren trang se thu phat lai (sau do trinh duyet cho phep). */
  function retryAutoplay(){
    if (blocked && ready && !playing && current >= 0) startAudio();
  }
  document.addEventListener("pointerdown", retryAutoplay);
  document.addEventListener("keydown", retryAutoplay);
  /* Doi ngon ngu VI/EN theo store. */
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].attributeName === "lang") { updateTexts(); break; }
      }
    }).observe(document.documentElement, { attributes:true, attributeFilter:["lang"] });
  }

  updateTexts();
  loadList();

  /* Tay cam nho cho debug/test (khong dung trong UI). */
  window.AnhDevMusicPlayer = {
    get songs(){ return songs.slice(); },
    get current(){ return current; },
    get playing(){ return playing; },
    get blocked(){ return blocked; },
    get ready(){ return ready; },
    play: togglePlay,
    next: nextSong,
    prev: prevSong,
    reload: loadList
  };
})();
