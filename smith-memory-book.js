(function () {
  console.log("✅ main script started");

  // ---- App namespace (ONE global, intentionally) ----
  window.SMB = window.SMB || {};
  const SMB = window.SMB;

  // ---- Config ----
  const BASE = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/pages/";
  const TOTAL_PAGES = 239;

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

  const STAGES = [
    ["table", "Table"],
    ["parquet", "Parquet"],
    ["kitchen", "Counter"],
    ["basement", "Basement"],
    ["lawn", "Lawn"],
    ["cancun", "Poolside"],
  ];

  const $ = (id) => document.getElementById(id);

  function makeAudio(url, vol = 0.6) {
    const a = new Audio(url);
    a.preload = "auto";
    a.volume = vol;
    return a;
  }

// ===============================
// Page Mapping: Human ↔ Image
// One source of truth for navigation
// ===============================

const PageMap = (() => {
  /**
   * CONFIG — edit these once, then forget about offsets everywhere else.
   *
   * HUMAN pages: what the user sees (page indicator, search results, TOC)
   * IMAGE numbers: your actual files (lembo_0001.webp, etc)
   */

  // Example: if you want "Cover" to be Human page 1, set HUMAN_MIN = 1.
  const HUMAN_MIN = 1;

  // Set this to the highest Human page you want users to navigate to.
  // Often equals TOTAL_IMAGES if you include cover/back, but not always.
  const HUMAN_MAX = 239;

  // The image number (as in filename number) that corresponds to HUMAN_MIN.
  // If Human page 1 = lembo_0001.webp, set IMAGE_FIRST_FOR_HUMAN_MIN = 1.
  // If Human page 1 = lembo_0002.webp, set IMAGE_FIRST_FOR_HUMAN_MIN = 2, etc.
  const IMAGE_FIRST_FOR_HUMAN_MIN = 1;

  // If your flipbook library wants a 0-based index (common), keep this true.
  // If it wants 1-based, set to false and use imageNumber directly.
  const FLIP_USES_ZERO_BASED_INDEX = true;

  // Optional: if you have "special" pages you want to label (no folio, etc.)
  // Map human page -> label override.
  // Example: 3 is your “Edition notice” page.
  const HUMAN_LABEL_OVERRIDES = new Map([
    // [3, "Edition page"], // uncomment / edit if desired
  ]);

  // ---------- helpers ----------
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const isInt = (n) => Number.isInteger(n);

  const assertHuman = (humanPage) => {
    if (!isInt(humanPage)) throw new Error(`Human page must be an integer. Got: ${humanPage}`);
    if (humanPage < HUMAN_MIN || humanPage > HUMAN_MAX) {
      throw new Error(`Human page out of range (${HUMAN_MIN}–${HUMAN_MAX}). Got: ${humanPage}`);
    }
  };

  /**
   * Human page -> imageNumber (as in filename number, e.g. 4 => lembo_0004.webp)
   */
  const humanToImageNumber = (humanPage) => {
    assertHuman(humanPage);
    const delta = humanPage - HUMAN_MIN;
    return IMAGE_FIRST_FOR_HUMAN_MIN + delta;
  };

  /**
   * imageNumber -> human page
   */
  const imageNumberToHuman = (imageNumber) => {
    if (!isInt(imageNumber)) throw new Error(`Image number must be an integer. Got: ${imageNumber}`);
    const human = HUMAN_MIN + (imageNumber - IMAGE_FIRST_FOR_HUMAN_MIN);
    return clamp(human, HUMAN_MIN, HUMAN_MAX);
  };

  /**
   * Human page -> flip index (what you pass into the flipbook)
   */
  const humanToFlipIndex = (humanPage) => {
    const imageNumber = humanToImageNumber(humanPage);
    return FLIP_USES_ZERO_BASED_INDEX ? (imageNumber - 1) : imageNumber;
  };

  /**
   * flip index -> human page (for page indicator updates)
   */
  const flipIndexToHuman = (flipIndex) => {
    if (!isInt(flipIndex)) throw new Error(`Flip index must be an integer. Got: ${flipIndex}`);
    const imageNumber = FLIP_USES_ZERO_BASED_INDEX ? (flipIndex + 1) : flipIndex;
    return imageNumberToHuman(imageNumber);
  };

  /**
   * Nice label for UI
   */
  const humanLabel = (humanPage) => {
    assertHuman(humanPage);
    return HUMAN_LABEL_OVERRIDES.get(humanPage) ?? `Page ${humanPage}`;
  };

  return {
    // config exposure (optional)
    HUMAN_MIN, HUMAN_MAX, IMAGE_FIRST_FOR_HUMAN_MIN, FLIP_USES_ZERO_BASED_INDEX,

    // core conversions
    humanToImageNumber,
    imageNumberToHuman,
    humanToFlipIndex,
    flipIndexToHuman,

    // ui
    humanLabel,
  };
})();
  
  // ---- State ----
  let soundOn = (localStorage.getItem("flip:sound") ?? "1") === "1";
  let zoom = Number(localStorage.getItem("flip:zoom") || "1");

  let stageKey = localStorage.getItem("flip:stage") || "table";
  const stageEl = $("flipbook-stage");

  let panX = 0,
    panY = 0,
    isPanning = false,
    panSX = 0,
    panSY = 0,
    panOX = 0,
    panOY = 0;

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

  function playSfx(key) {
    if (!soundOn) return;
    const a = SFX[key];
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function playRandomTurn() {
    if (!soundOn) return;
    const a = SFX.pageTurns[Math.floor(Math.random() * SFX.pageTurns.length)];
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function pageUrl(humanPageNum) {
    const n = String(humanPageNum).padStart(4, "0");
    return `${BASE}lembo_${n}.webp`;
  }

  function buildPages() {
    return Array.from({ length: TOTAL_PAGES }, (_, i) => pageUrl(i + 1));
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

  function applyTransform() {
    const wrap = $("flipbook-wrap");
    if (!wrap) return;
    wrap.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  function updatePanCursor() {
    const wrap = $("flipbook-wrap");
    if (!wrap) return;
    wrap.classList.toggle("can-pan", zoom > 1);
  }

  function setZoom(z) {
    zoom = Math.max(0.6, Math.min(2.2, z));
    localStorage.setItem("flip:zoom", String(zoom));
    applyTransform();
    updatePanCursor();
  }

  function wireUI() {
    paintIcons();
    applyStage();
    applyTransform();
    updatePanCursor();

    $("btnFirst") && ($("btnFirst").onclick = () => SMB.flipbook?.pageFlip?.flip(0));
    $("btnLast") && ($("btnLast").onclick = () => SMB.flipbook?.pageFlip?.flip(TOTAL_PAGES - 1));
    $("btnPrev") && ($("btnPrev").onclick = () => SMB.flipbook?.pageFlip?.flipPrev());
    $("btnNext") && ($("btnNext").onclick = () => SMB.flipbook?.pageFlip?.flipNext());

    const pageJump = $("pageJump");
    pageJump?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const n = parseInt(e.currentTarget.value, 10);
      if (Number.isFinite(n))
        SMB.flipbook?.pageFlip?.flip(
          Math.max(1, Math.min(TOTAL_PAGES, n)) - 1
        );
    });
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

    setTimeout(wireUI, 50);
    return true;
  }

  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (init() || tries > 20) clearInterval(t);
  }, 50);
})();
