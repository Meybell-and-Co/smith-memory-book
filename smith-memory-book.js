(function () {
  console.log("✅ main script started");
  console.log("🔥 SMB MAIN JS v2025-12-18 12:xx — clean + safe wiring");

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
  let zoom = Number(localStorage.getItem("flip:zoom") || "1");
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

  // Build a URL from an IMAGE number (filename number)
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
    return SMB.flipbook?.pageFlip;
  }

  let uiWired = false;
  function wireUI() {
    if (uiWired) return;
    uiWired = true;

    paintIcons();
    applyStage();

    // Buttons
    const btnFirst = $("btnFirst");
    const btnLast = $("btnLast");
    const btnPrev = $("btnPrev");
    const btnNext = $("btnNext");

    btnFirst && (btnFirst.onclick = () => getPF()?.flip(PageMap.humanToFlipIndex(PageMap.HUMAN_MIN)));
    btnLast && (btnLast.onclick = () => getPF()?.flip(PageMap.humanToFlipIndex(PageMap.HUMAN_MAX)));
    btnPrev && (btnPrev.onclick = () => getPF()?.flipPrev());
    btnNext && (btnNext.onclick = () => getPF()?.flipNext());

    // Page jump
    const pageJump = $("pageJump");
    pageJump?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const n = parseInt(e.currentTarget.value, 10);
      if (!Number.isFinite(n)) return;

      const safeHuman = Math.max(PageMap.HUMAN_MIN, Math.min(PageMap.HUMAN_MAX, n));
      getPF()?.flip(PageMap.humanToFlipIndex(safeHuman));
    });

    // quick sanity table
    console.table(
      [1, 2, 3, 4, 5].map((h) => ({
        human: h,
        image: PageMap.humanToImageNumber(h),
        flipIndex: PageMap.humanToFlipIndex(h),
      }))
    );
  }

  function init() {
    const el = $("flipbook");
    if (!el) return false;
    if (!window.St || typeof window.St.PageFlip !== "function") return false;
    if (el.dataset.flipInit === "1") return true;

    el.dataset.flipInit = "1";

    const pageFlip = new St.PageFlip(el, {
      width: 2000,
      height: 1680,
      size: "stretch",
      minWidth: 320,
      maxWidth: 2000,
      minHeight: 400,
      maxHeight: 1680,
      maxShadowOpacity: 0.18,
      showCover: false,
      mobileScrollSupport: true,
    });

    pageFlip.loadFromImages(buildPages());
    SMB.flipbook = { pageFlip };

    pageFlip.on("flip", () => playRandomTurn());

    // Now that PF exists, ensure UI is wired
    wireUI();

    return true;
  }

  // Wire UI once DOM exists (safe even before PF exists)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUI, { once: true });
  } else {
    wireUI();
  }

  // Retry init until St.PageFlip is ready
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (init() || tries > 40) clearInterval(t);
  }, 50);
})();
