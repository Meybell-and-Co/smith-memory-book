(function () {
  console.log("✅ main script started");
  console.log("🔥 SMB MAIN JS v2025-12-18 — wrap-measured + update() + safe reinit");

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
  let zoom = Number(localStorage.getItem("flip:zoom") || "1"); // kept for later
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

  function getPF() {
    return SMB.flipbook || null;
  }

  // ---- UI wiring (safe to run before PF exists) ----
  let uiWired = false;
  function wireUI() {
    if (uiWired) return;
    uiWired = true;

    paintIcons();
    applyStage();

    const btnFirst = $("btnFirst");
    const btnLast = $("btnLast");
    const btnPrev = $("btnPrev");
    const btnNext = $("btnNext");

    btnFirst && (btnFirst.onclick = () => getPF()?.flip(PageMap.humanToFlipIndex(PageMap.HUMAN_MIN)));
    btnLast && (btnLast.onclick = () => getPF()?.flip(PageMap.humanToFlipIndex(PageMap.HUMAN_MAX)));
    btnPrev && (btnPrev.onclick = () => getPF()?.flipPrev());
    btnNext && (btnNext.onclick = () => getPF()?.flipNext());

    const pageJump = $("pageJump");
    pageJump?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const n = parseInt(e.currentTarget.value, 10);
      if (!Number.isFinite(n)) return;

      const safeHuman = Math.max(PageMap.HUMAN_MIN, Math.min(PageMap.HUMAN_MAX, n));
      getPF()?.flip(PageMap.humanToFlipIndex(safeHuman));
    });
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

  function safeUpdatePF(pf, w, h) {
    try {
      // Some builds expose update(), some updateRender(), some neither.
      if (pf && typeof pf.update === "function") pf.update();
      if (pf && typeof pf.updateRender === "function") pf.updateRender();
    } catch (e) {
      console.warn("PF update warning:", e);
    }

    // Also re-run wrapper fix after update
    const el = $("flipbook");
    SMB_forceFlipbookFillBurst(el);

    // Debug line you can watch in console:
    console.log("📐 wrap:", w, h, "| canvas:", document.querySelector("#flipbook canvas.stf__canvas")?.getBoundingClientRect?.());
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
    if (w < 100 || h < 100) return false; // not laid out yet

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
        // baseline size (helps some builds actually honor wrap sizing)
        width: w,
        height: h,

        // stretch envelope
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

      // events
      pageFlip.on("flip", () => playRandomTurn());
      pageFlip.on("init", () => safeUpdatePF(pageFlip, w, h));
      pageFlip.on("changeOrientation", () => safeUpdatePF(pageFlip, w, h));

      wireUI();

      // go back to current page
      const safeHuman = Math.max(PageMap.HUMAN_MIN, Math.min(PageMap.HUMAN_MAX, keepHuman));
      pageFlip.flip(PageMap.humanToFlipIndex(safeHuman));

      // immediate + delayed update (layout settles after images/fonts/paint)
      safeUpdatePF(pageFlip, w, h);
      requestAnimationFrame(() => safeUpdatePF(pageFlip, w, h));
      setTimeout(() => safeUpdatePF(pageFlip, w, h), 120);

      return true;
    } catch (e) {
      console.error("❌ PageFlip init failed:", e);
      return false;
    } finally {
      setTimeout(() => {
        initInFlight = false;
      }, 120);
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

  // One extra build after first paint (common “it measured too early” fix)
  window.addEventListener("load", () => {
    setTimeout(() => initOrReinit("load"), 50);
  });

  // resize rebuild
  let resizeTO = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => initOrReinit("resize"), 180);
  });
})();