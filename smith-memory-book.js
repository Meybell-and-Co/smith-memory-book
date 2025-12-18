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
