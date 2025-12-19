(function () {
  console.log("✅ main script started");
  console.log("🔥 SMB MAIN JS v2025-12-18 — full UI wired + stable stage/tiles/zoom");

  // ---- App namespace (ONE global, intentionally) ----
  window.SMB = window.SMB || {};
  const SMB = window.SMB;

  // ---- Config ----
  const BASE = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/pages/";
  const TOTAL_IMAGES = 239;

  const ROOT = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/";
  const ICON_BASE = ROOT + "flipbook-ui-icons/";
  const SOUND_BASE = ROOT + "sounds/";

  const ICONS = {
    zoomIn: ICON_BASE + "add-gold.png",
    zoomOut: ICON_BASE + "subtract-gold.png",
    tiles: ICON_BASE + "tiles-gold.png",
    search: ICON_BASE + "search-gold.png",
    share: ICON_BASE + "share-gold.png",
    print: ICON_BASE + "print-gold.png",
    fullscreen: ICON_BASE + "maximize-gold.png",
    more: ICON_BASE + "ellipsis-gold.png",
    start: ICON_BASE + "start-gold.png",
    end: ICON_BASE + "end-gold.png",
    soundOn: ICON_BASE + "sound-gold.png",
    soundOff: ICON_BASE + "sound-off-gold.png",
    prev: ICON_BASE + "previous-gold.png",
    next: ICON_BASE + "next-gold.png",
    pan: ICON_BASE + "pan-gold.png",
  };

  const $ = (id) => document.getElementById(id);

  function makeAudio(url, vol = 0.6) {
    const a = new Audio(url);
    a.preload = "auto";
    a.volume = vol;
    return a;
  }

  // ===============================
  // Page Mapping: Human ↔ Image (skip Edition page)
  // ===============================
  const PageMap = (() => {
    const HUMAN_MIN = 1;
    const SKIP_IMAGE_NUMBERS = new Set([3]); // lembo_0003.webp is Edition page
    const HUMAN_MAX = TOTAL_IMAGES - SKIP_IMAGE_NUMBERS.size;

    const isInt = (n) => Number.isInteger(n);
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

    const assertHuman = (humanPage) => {
      if (!isInt(humanPage)) throw new Error(`Human page must be an integer. Got: ${humanPage}`);
      if (humanPage < HUMAN_MIN || humanPage > HUMAN_MAX) {
        throw new Error(`Human page out of range (${HUMAN_MIN}–${HUMAN_MAX}). Got: ${humanPage}`);
      }
    };

    const humanToImageNumber = (humanPage) => {
      assertHuman(humanPage);
      let img = 0;
      let count = 0;
      while (count < humanPage) {
        img++;
        if (!SKIP_IMAGE_NUMBERS.has(img)) count++;
      }
      return img;
    };

    const imageNumberToHuman = (imageNumber) => {
      if (!isInt(imageNumber)) throw new Error(`Image number must be an integer. Got: ${imageNumber}`);
      let count = 0;
      for (let img = 1; img <= imageNumber; img++) {
        if (!SKIP_IMAGE_NUMBERS.has(img)) count++;
      }
      return clamp(count, HUMAN_MIN, HUMAN_MAX);
    };

    const humanToFlipIndex = (humanPage) => humanToImageNumber(humanPage) - 1;
    const flipIndexToHuman = (flipIndex) => imageNumberToHuman(flipIndex + 1);

    return { HUMAN_MIN, HUMAN_MAX, humanToImageNumber, imageNumberToHuman, humanToFlipIndex, flipIndexToHuman };
  })();

  SMB.PageMap = PageMap;

  // ---- State ----
  let soundOn = (localStorage.getItem("flip:sound") ?? "1") === "1";
  let zoom = Number(localStorage.getItem("flip:zoom") || "1"); // 1.00, 1.10, 1.20...
  let stageKey = localStorage.getItem("flip:stage") || "table";

  const stageEl = $("flipbook-stage");

  const SFX = {
    hover: makeAudio(SOUND_BASE + "hover.mp3", 0.35),
    click: makeAudio(SOUND_BASE + "light-click.mp3", 0.45),
    tiles: makeAudio(SOUND_BASE + "tiles-popping-up.mp3", 0.55),
    soundOn: makeAudio(SOUND_BASE + "notification-enable.mp3", 0.55),
    soundOff: makeAudio(SOUND_BASE + "notification-disable.mp3", 0.55),
    pageTurns: [
      makeAudio(SOUND_BASE + "page-turn-01.mp3", 0.7),
      makeAudio(SOUND_BASE + "page-turn-02.mp3", 0.7),
      makeAudio(SOUND_BASE + "page-turn-03.mp3", 0.7),
      makeAudio(SOUND_BASE + "page-turn-04.mp3", 0.7),
      makeAudio(SOUND_BASE + "page-turn-05.mp3", 0.7),
    ],
  };

  function playRandomTurn() {
    if (!soundOn) return;
    const a = SFX.pageTurns[Math.floor(Math.random() * SFX.pageTurns.length)];
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function pageUrlFromImageNumber(imageNumber) {
    const n = String(imageNumber).padStart(4, "0");
    return `${BASE}lembo_${n}.webp`;
  }

  function buildPages() {
    return Array.from({ length: TOTAL_IMAGES }, (_, i) => pageUrlFromImageNumber(i + 1));
  }

  function paintIcons() {
    document.querySelectorAll("#flipbar img[data-ikey]").forEach((img) => {
      const key = img.dataset.ikey;
      if (key === "sound") img.src = soundOn ? ICONS.soundOn : ICONS.soundOff;
      else img.src = ICONS[key] || "";
    });
  }

  function applyStage() {
    if (!stageEl) return;
    const stageVar =
      {
        table: "var(--stage-table)",
        parquet: "var(--stage-parquet)",
        kitchen: "var(--stage-kitchen)",
        basement: "var(--stage-basement)",
        lawn: "var(--stage-lawn)",
        cancun: "var(--stage-cancun)",
      }[stageKey] || "var(--stage-table)";
    stageEl.style.setProperty("--stage-img", stageVar);
  }

  function applyZoom() {
    const wrap = $("flipbook-wrap");
    if (!wrap) return;
    wrap.style.transformOrigin = "center center";
    wrap.style.transform = zoom === 1 ? "" : `scale(${zoom})`;
    localStorage.setItem("flip:zoom", String(zoom));
  }

  function getPF() {
    return SMB.flipbook || null;
  }

  // ---- Force vendor wrapper to behave ----
  function SMB_forceFlipbookFill(el) {
    if (!el) return;
    const wrapper = el.querySelector(".stf__wrapper");
    if (!wrapper) return;
    wrapper.style.paddingBottom = "0px";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
  }

  function SMB_forceFlipbookFillBurst(el) {
    SMB_forceFlipbookFill(el);
    requestAnimationFrame(() => SMB_forceFlipbookFill(el));
    setTimeout(() => SMB_forceFlipbookFill(el), 0);
    setTimeout(() => SMB_forceFlipbookFill(el), 60);
    setTimeout(() => SMB_forceFlipbookFill(el), 180);
  }

  // ---- Measure wrap ----
  function getWrapSize() {
    const wrap = $("flipbook-wrap");
    if (!wrap) return { w: 0, h: 0 };
    const r = wrap.getBoundingClientRect();
    return { w: Math.floor(r.width), h: Math.floor(r.height) };
  }

  // ---- Safe update (deferred one frame so PF can create canvas/DOM) ----
  function safeUpdatePF(pf, w, h) {
    if (!pf) return;

    requestAnimationFrame(() => {
      try {
        if (typeof pf.update === "function") pf.update();
        else if (typeof pf.updateRender === "function") pf.updateRender();

        applyStage();          // keep stage stable across reinit/resize
        applyZoom();           // keep zoom stable across reinit/resize

        const el = $("flipbook");
        SMB_forceFlipbookFillBurst(el);
      } catch (e) {
        console.warn("PF update warning:", e);
      }
    });
  }

  // ---- Tiles (thumbnails) ----
  let tilesBuilt = false;
  function openTiles() {
    const tiles = $("tiles");
    if (!tiles) return;

    if (!tilesBuilt) {
      buildTilesGrid();
      tilesBuilt = true;
    }

    tiles.classList.add("open");
    try { SFX.tiles.currentTime = 0; SFX.tiles.play().catch(() => {}); } catch (_) {}
  }

  function closeTiles() {
    const tiles = $("tiles");
    if (!tiles) return;
    tiles.classList.remove("open");
  }

  function buildTilesGrid() {
    const grid = $("tilesGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const pages = buildPages();
    const frag = document.createDocumentFragment();

    // keep it lightweight: build all, but each is a small <img loading="lazy">
    pages.forEach((src, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = src;
      img.alt = `Page ${idx + 1}`;

      const label = document.createElement("span");
      // show HUMAN page number (skipping edition) for user clarity
      const human = PageMap.flipIndexToHuman(idx);
      label.textContent = String(human);

      btn.appendChild(img);
      btn.appendChild(label);

      btn.addEventListener("click", () => {
        const safeHuman = Math.max(PageMap.HUMAN_MIN, Math.min(PageMap.HUMAN_MAX, human));
        getPF()?.flip(PageMap.humanToFlipIndex(safeHuman));
        closeTiles();
      });

      frag.appendChild(btn);
    });

    grid.appendChild(frag);
  }

  // ---- More menu / Stage menu ----
  function setMoreOpen(open) {
    const m = $("moreMenu");
    if (!m) return;
    m.classList.toggle("open", !!open);
  }

  function toggleMore() {
    const m = $("moreMenu");
    if (!m) return;
    setMoreOpen(!m.classList.contains("open"));
  }

  function buildStageMenu() {
    const box = $("stageMenu");
    if (!box) return;

    const stages = [
      ["table", "Table"],
      ["parquet", "Parquet"],
      ["kitchen", "Counter"],
      ["basement", "Basement"],
      ["lawn", "Lawn"],
      ["cancun", "Cancun"],
    ];

    box.innerHTML = "";
    stages.forEach(([key, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stageItem";
      b.textContent = (key === stageKey ? "■ " : "□ ") + label;

      b.addEventListener("click", () => {
        stageKey = key;
        localStorage.setItem("flip:stage", stageKey);
        applyStage();
        buildStageMenu(); // refresh checks
      });

      box.appendChild(b);
    });
  }

  // ---- UI wiring ----
  let uiWired = false;
  function wireUI() {
    if (uiWired) return;
    uiWired = true;

    paintIcons();
    applyStage();
    applyZoom();
    buildStageMenu();

    // left nav
    $("btnFirst") && ($("btnFirst").onclick = () => getPF()?.flip(PageMap.humanToFlipIndex(PageMap.HUMAN_MIN)));
    $("btnLast") && ($("btnLast").onclick = () => getPF()?.flip(PageMap.humanToFlipIndex(PageMap.HUMAN_MAX)));
    $("btnPrev") && ($("btnPrev").onclick = () => getPF()?.flipPrev());
    $("btnNext") && ($("btnNext").onclick = () => getPF()?.flipNext());

    // page jump
    const pageJump = $("pageJump");
    pageJump?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const n = parseInt(e.currentTarget.value, 10);
      if (!Number.isFinite(n)) return;

      const safeHuman = Math.max(PageMap.HUMAN_MIN, Math.min(PageMap.HUMAN_MAX, n));
      getPF()?.flip(PageMap.humanToFlipIndex(safeHuman));
    });

    // zoom buttons (IDs are zoomOut/zoomIn)
    $("zoomOut") && ($("zoomOut").onclick = () => {
      zoom = Math.max(0.8, Math.round((zoom - 0.1) * 10) / 10);
      applyZoom();
      safeUpdatePF(getPF(), ...Object.values(getWrapSize()));
    });

    $("zoomIn") && ($("zoomIn").onclick = () => {
      zoom = Math.min(1.6, Math.round((zoom + 0.1) * 10) / 10);
      applyZoom();
      safeUpdatePF(getPF(), ...Object.values(getWrapSize()));
    });

    // tiles
    $("btnTiles") && ($("btnTiles").onclick = () => openTiles());
    $("tilesClose") && ($("tilesClose").onclick = () => closeTiles());

    // sound toggle
    $("btnSound") && ($("btnSound").onclick = () => {
      soundOn = !soundOn;
      localStorage.setItem("flip:sound", soundOn ? "1" : "0");
      paintIcons();
      const a = soundOn ? SFX.soundOn : SFX.soundOff;
      a.currentTime = 0;
      a.play().catch(() => {});
    });

    // more menu toggle
    $("btnMore") && ($("btnMore").onclick = () => toggleMore());

    // click outside closes more menu
    document.addEventListener("click", (e) => {
      const m = $("moreMenu");
      const btn = $("btnMore");
      if (!m || !btn) return;
      if (!m.classList.contains("open")) return;
      if (m.contains(e.target) || btn.contains(e.target)) return;
      setMoreOpen(false);
    });

    // ESC closes overlays
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      setMoreOpen(false);
      closeTiles();
    });

    // share
    $("btnShare") && ($("btnShare").onclick = async () => {
      const url = location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          alert("Link copied to clipboard.");
        } else {
          prompt("Copy this link:", url);
        }
      } catch (_) {}
      setMoreOpen(false);
    });

    // stage menu focus (just opens more + scroll to stage list)
    $("btnStage") && ($("btnStage").onclick = () => {
      setMoreOpen(true);
      buildStageMenu();
      $("stageMenu")?.scrollIntoView({ block: "nearest" });
    });

    // print
    $("btnPrint") && ($("btnPrint").onclick = () => {
      window.print();
      setMoreOpen(false);
    });

    // fullscreen
    $("btnFull") && ($("btnFull").onclick = async () => {
      try {
        const target = $("flipbook-stage") || document.documentElement;
        if (!document.fullscreenElement) {
          await target.requestFullscreen?.();
        } else {
          await document.exitFullscreen?.();
        }
      } catch (_) {}
      setMoreOpen(false);
    });

    // search = focus the page jump (simple + useful)
    $("btnSearch") && ($("btnSearch").onclick = () => {
      setMoreOpen(false);
      pageJump?.focus();
      pageJump?.select?.();
    });
  }

  // ---- Init / Re-init PageFlip ----
  let initInFlight = false;

  function destroyExisting() {
    try {
      const pf = getPF();
      if (pf && typeof pf.destroy === "function") pf.destroy();
    } catch (e) {
      console.warn("destroyExisting warning:", e);
    }
    SMB.flipbook = null;
  }

  function initOrReinit(reason = "init") {
    const el = $("flipbook");
    if (!el) return false;

    if (!window.St || typeof window.St.PageFlip !== "function") return false;
    if (initInFlight) return true;

    const { w, h } = getWrapSize();
    if (w < 100 || h < 100) return false;

    initInFlight = true;

    // preserve current page (human) if possible
    const prevPf = getPF();
    let keepHuman = PageMap.HUMAN_MIN;
    try {
      if (prevPf && typeof prevPf.getCurrentPageIndex === "function") {
        keepHuman = PageMap.flipIndexToHuman(prevPf.getCurrentPageIndex());
      }
    } catch (_) {}

    destroyExisting();

    try {
      console.log(`🧱 PageFlip build (${reason}) using wrap:`, w, h);

      const pageFlip = new St.PageFlip(el, {
        width: w,
        height: h,
        size: "stretch",
        minWidth: 320,
        maxWidth: w,
        minHeight: 320,
        maxHeight: h,
        maxShadowOpacity: 0.18,
        showCover: false,
        mobileScrollSupport: true,
      });

      pageFlip.loadFromImages(buildPages());
      SMB.flipbook = pageFlip;

      pageFlip.on("flip", () => playRandomTurn());
      pageFlip.on("init", () => safeUpdatePF(pageFlip, w, h));
      pageFlip.on("changeOrientation", () => safeUpdatePF(pageFlip, w, h));

      wireUI();

      const safeHuman = Math.max(PageMap.HUMAN_MIN, Math.min(PageMap.HUMAN_MAX, keepHuman));
      pageFlip.flip(PageMap.humanToFlipIndex(safeHuman));

      safeUpdatePF(pageFlip, w, h);
      requestAnimationFrame(() => safeUpdatePF(pageFlip, w, h));
      setTimeout(() => safeUpdatePF(pageFlip, w, h), 120);

      return true;
    } catch (e) {
      console.error("❌ PageFlip init failed:", e);
      return false;
    } finally {
      setTimeout(() => (initInFlight = false), 120);
    }
  }

  // ---- Bootstrap ----
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUI, { once: true });
  } else {
    wireUI();
  }

  // retry init until St.PageFlip is ready
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    const ok = initOrReinit("retry");
    if (ok || tries > 80) clearInterval(t);
  }, 50);

  window.addEventListener("load", () => {
    setTimeout(() => initOrReinit("load"), 50);
  });

  let resizeTO = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => initOrReinit("resize"), 180);
  });
})();