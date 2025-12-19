console.log("✅ inline flipbook script loaded");
console.log("✅ main script started");

(function () {
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
        pan: ICON_BASE + "grab-open-gold.png",
        grab: ICON_BASE + "grab-closed-gold.png",
        reset: ICON_BASE + "reset-gold.png",
    };

    const STAGES = [
        ["table", "Table"],
        ["parquet", "Parquet"],
        ["kitchen", "Counter"],
        ["basement", "Basement"],
        ["lawn", "Lawn"],
        ["cancun", "Poolside"],
    ];

    const DEFAULT_ZOOM = 0.8;
    const OPTICAL_NUDGE_Y = 20;

    const $ = (id) => document.getElementById(id);

    // --- Toast: "Hi — click to open" (resting state only, once per session) ---
(() => {
  const toast = $("openToast");
  if (!toast) return;

  const KEY = "SMB_OPEN_TOAST_SEEN";

  // Only show if we're in resting mode (not reading yet)
  const isReading = document.body.classList.contains("is-reading");
  if (isReading) return;

  // Only once per browser tab/session
  try {
    if (sessionStorage.getItem(KEY) === "1") return;
    sessionStorage.setItem(KEY, "1");
  } catch (e) {
    // If sessionStorage is blocked, we’ll still show once (no biggie)
  }

  // Show
  toast.classList.remove("is-hiding");
  toast.classList.add("is-visible");

  // Hide helper
  const hide = () => {
    if (!toast.classList.contains("is-visible")) return;
    toast.classList.remove("is-visible");
    toast.classList.add("is-hiding");
    setTimeout(() => toast.classList.remove("is-hiding"), 300);
  };

  // Auto-hide after a beat
  const t = setTimeout(hide, 3200);

  // If they click anywhere on the stage/wrap, hide immediately
  const clickTarget =
    $("flipbook-wrap") || $("flipbook-stage") || document.body;

  clickTarget.addEventListener(
    "click",
    () => {
      clearTimeout(t);
      hide();
    },
    { once: true }
  );
})();
    // ---- State ----
    let soundOn = (localStorage.getItem("flip:sound") ?? "1") === "1";
    let zoom = Number(localStorage.getItem("flip:zoom") || String(DEFAULT_ZOOM));

    let stageKey = localStorage.getItem("flip:stage") || "table";
    const stageEl = $("flipbook-stage");

    let panX = 0,
        panY = 0;
    let isPanning = false,
        panSX = 0,
        panSY = 0,
        panOX = 0,
        panOY = 0;

    // For future cover physics (currently unused but harmless)
    let coverShiftX = 0;

    function makeAudio(url, vol = 0.6) {
        const a = new Audio(url);
        a.preload = "auto";
        a.volume = vol;
        return a;
    }

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
        a.play().catch(() => { });
    }

    function playRandomTurn() {
        if (!soundOn) return;
        const a = SFX.pageTurns[Math.floor(Math.random() * SFX.pageTurns.length)];
        a.currentTime = 0;
        a.play().catch(() => { });
    }

    function pageUrl(humanPageNum) {
        const n = String(humanPageNum).padStart(4, "0");
        return `${BASE}lembo_${n}.webp`;
    }

    // --- index <-> human mapping (because we added 2 ghost pages) ---
    // pages: [p1, ghost, p2..p238, ghost, p239]
    function idxToHuman(idx) {
        if (idx <= 1) return 1;
        if (idx >= TOTAL_PAGES + 1) return TOTAL_PAGES;
        return idx;
    }

    function humanToIdx(human) {
        if (human <= 1) return 0;
        if (human >= TOTAL_PAGES) return TOTAL_PAGES + 1;
        return human;
    }

    function buildPages() {
        const pages = [];
        pages.push(pageUrl(1));   // front cover
        pages.push(null);         // 👻 ghost
        for (let p = 2; p <= TOTAL_PAGES - 1; p++) pages.push(pageUrl(p));
        pages.push(null);         // 👻 ghost
        pages.push(pageUrl(TOTAL_PAGES)); // back cover
        console.log("pages sanity:", pages[0], pages[1], pages.at(-2), pages.at(-1), "len", pages.length);
        return pages;
    }

    function paintIcons() {
        document.querySelectorAll("#flipbar img[data-ikey]").forEach((img) => {
            const key = img.dataset.ikey;
            if (key === "sound") img.src = soundOn ? ICONS.soundOn : ICONS.soundOff;
            else img.src = ICONS[key] || "";
        });
    }

    function formatPageValue(n) {
        return `${n} of ${TOTAL_PAGES}`;
    }

    function extractPageNumber(value) {
        const match = String(value || "").match(/\d+/);
        return match ? parseInt(match[0], 10) : NaN;
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
        wrap.style.transform = `translate(${panX + coverShiftX}px, ${panY}px) scale(${zoom})`;
    }

    function syncPageIndicator(humanPage) {
        const pageJump = $("pageJump");
        if (!pageJump) return;
        if (document.activeElement !== pageJump) {
            pageJump.value = formatPageValue(humanPage);
        }
    }

    function updateNavLocks(human) {
        const lock = human <= 3;
        $("btnPrev")?.toggleAttribute("disabled", lock);
        $("btnFirst")?.toggleAttribute("disabled", lock);
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

    function shareLink() {
        const url = new URL(location.href);
        url.hash = `p=${Number(localStorage.getItem("flip:page") || "1")}`;
        return url.toString();
    }

    function doShare() {
        const link = shareLink();
        if (navigator.share) navigator.share({ title: document.title, url: link }).catch(() => { });
        else
            navigator.clipboard
                ?.writeText(link)
                .then(() => alert("Link copied!"))
                .catch(() => prompt("Copy this link:", link));
    }

    function doPrintCurrent() {
        const page = Number(localStorage.getItem("flip:page") || "1");
        const imgSrc = pageUrl(page);

        const w = window.open("", "_blank");
        if (!w) return;

        w.document.open();
        w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
        w.document.write("<title>Print page " + page + "</title>");
        w.document.write(
            "<style>" +
            "body{margin:0;display:flex;justify-content:center;align-items:center;}" +
            "img{max-width:100vw;max-height:100vh;}" +
            "</style>"
        );
        w.document.write("</head><body>");
        w.document.write('<img id="printImg" src="' + imgSrc + '" alt="Page ' + page + '">');
        w.document.write("</body></html>");
        w.document.close();

        w.onload = () => {
            const img = w.document.getElementById("printImg");
            if (!img) return;
            img.onload = () => {
                w.focus();
                w.print();
                setTimeout(() => w.close(), 250);
            };
            if (img.complete) img.onload();
        };
    }

    // ---- Tiles ----
    let tilesBuilt = false;
    function buildTilesOnce() {
        if (tilesBuilt) return;
        const grid = $("tilesGrid");
        if (!grid) return;

        const frag = document.createDocumentFragment();
        for (let p = 1; p <= TOTAL_PAGES; p++) {
            const d = document.createElement("div");
            d.className = "tile";
            d.innerHTML = `
        <img loading="lazy" src="${pageUrl(p)}" alt="Page ${p}">
        <div class="n"><span>Page</span><strong>${p}</strong></div>
      `;
            d.addEventListener("click", () => {
                window.__flipbook?.pageFlip?.flip(humanToIdx(p));
                $("tiles")?.classList.remove("is-open");
            });
            frag.appendChild(d);
        }
        grid.appendChild(frag);
        tilesBuilt = true;
    }

    // ---- UI wiring ----
    function wireUI() {
        paintIcons();
        applyStage();
        applyTransform();
        updatePanCursor();

        const wrap = $("flipbook-wrap");

        if (wrap) {
            wrap.addEventListener("pointerdown", (e) => {
                if (zoom <= 1) return;
                isPanning = true;
                wrap.classList.add("is-dragging");
                wrap.setPointerCapture(e.pointerId);
                panSX = e.clientX;
                panSY = e.clientY;
                panOX = panX;
                panOY = panY;
            });

            wrap.addEventListener("pointermove", (e) => {
                if (!isPanning) return;
                panX = panOX + (e.clientX - panSX);
                panY = panOY + (e.clientY - panSY);
                applyTransform();
            });

            const endPan = () => {
                isPanning = false;
                wrap.classList.remove("is-dragging");
            };
            wrap.addEventListener("pointerup", endPan);
            wrap.addEventListener("pointerleave", endPan);
            wrap.addEventListener("pointercancel", endPan);
        }

        $("btnFirst") && ($("btnFirst").onclick = () => window.__flipbook?.pageFlip?.flip(0));
        $("btnPrev") && ($("btnPrev").onclick = () => window.__flipbook?.pageFlip?.flipPrev());
        $("btnNext") && ($("btnNext").onclick = () => window.__flipbook?.pageFlip?.flipNext());
        $("btnLast") && ($("btnLast").onclick = () => window.__flipbook?.pageFlip?.flip(TOTAL_PAGES + 1));

        const pageJump = $("pageJump");

        pageJump?.addEventListener("focus", () => {
            const n = extractPageNumber(pageJump.value);
            if (Number.isFinite(n)) pageJump.value = String(n);
        });

        pageJump?.addEventListener("blur", () => {
            const n = extractPageNumber(pageJump.value);
            const clamped = Number.isFinite(n)
                ? Math.max(1, Math.min(TOTAL_PAGES, n))
                : Number(localStorage.getItem("flip:page") || 1);
            pageJump.value = formatPageValue(clamped);
        });

        pageJump?.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            const n = extractPageNumber(e.currentTarget.value);
            if (!Number.isFinite(n)) return;

            const clamped = Math.max(1, Math.min(TOTAL_PAGES, n));
            window.__flipbook?.pageFlip?.flip(humanToIdx(clamped));
            localStorage.setItem("flip:page", String(clamped));
            syncPageIndicator(clamped);
            updateNavLocks(clamped);
            e.currentTarget.blur();
        });

        $("zoomIn") && ($("zoomIn").onclick = () => setZoom(zoom + 0.1));
        $("zoomOut") && ($("zoomOut").onclick = () => setZoom(zoom - 0.1));

        function centerBookVertically() {
            const wrap = $("flipbook-wrap");
            const book = $("flipbook");
            if (!wrap || !book) return;

            const wrapRect = wrap.getBoundingClientRect();
            const bookRect = book.getBoundingClientRect();
            panY = Math.round((wrapRect.height - bookRect.height) / 2);
        }

        function resetViewToComfort() {
            setZoom(DEFAULT_ZOOM);
            panX = 0;
            centerBookVertically();
            panY += OPTICAL_NUDGE_Y;
            applyTransform();
        }

        $("zoomReset") &&
            ($("zoomReset").onclick = () => {
                console.log("🔄 Reset view");
                resetViewToComfort();
            });

        $("btnTiles") &&
            ($("btnTiles").onclick = () => {
                $("tiles")?.classList.toggle("is-open");
                buildTilesOnce();
            });

        $("tilesClose") && ($("tilesClose").onclick = () => $("tiles")?.classList.remove("is-open"));

        $("btnMore") && ($("btnMore").onclick = () => $("moreMenu")?.classList.toggle("is-open"));

        document.addEventListener("click", (e) => {
            if (!e.target.closest("#btnMore") && !e.target.closest("#moreMenu")) {
                $("moreMenu")?.classList.remove("is-open");
            }
        });

        $("btnShare") && ($("btnShare").onclick = doShare);
        $("btnPrint") && ($("btnPrint").onclick = doPrintCurrent);

        $("btnFull") &&
            ($("btnFull").onclick = () => {
                const stage = $("flipbook-stage");
                if (!stage) return;
                if (!document.fullscreenElement) stage.requestFullscreen?.();
                else document.exitFullscreen?.();
            });

        $("btnSearch") && ($("btnSearch").onclick = () => alert("Search UI next step 😈"));

        $("btnSound") &&
            ($("btnSound").onclick = () => {
                soundOn = !soundOn;
                localStorage.setItem("flip:sound", soundOn ? "1" : "0");
                paintIcons();
                (soundOn ? SFX.soundOn : SFX.soundOff).play().catch(() => { });
            });

        // Stage menu wiring (safe if markup not present yet)
        const stageMenu = $("stageMenu");
        const btnStage = $("btnStage");

        function renderStageMenu() {
            if (!stageMenu) return;
            stageMenu.innerHTML = STAGES.map(
                ([k, label]) =>
                    `<button type="button" data-stage="${k}">${k === stageKey ? "■" : "□"} ${label}</button>`
            ).join("");
        }

        if (btnStage && stageMenu) {
            renderStageMenu();

            btnStage.onclick = () => {
                playSfx("click");
                stageMenu.classList.toggle("is-open");
            };

            stageMenu.addEventListener("click", (e) => {
                const btn = e.target.closest("button[data-stage]");
                if (!btn) return;
                stageKey = btn.dataset.stage;
                localStorage.setItem("flip:stage", stageKey);
                applyStage();
                renderStageMenu();
            });
        }

        // Button SFX
        function wireButtonSfx(...ids) {
            ids.forEach((id) => {
                const el = $(id);
                if (!el) return;
                el.addEventListener("pointerenter", () => playSfx("hover"));
                el.addEventListener("click", () => playSfx("click"));
            });
        }

        wireButtonSfx(
            "btnFirst",
            "btnPrev",
            "btnNext",
            "btnLast",
            "zoomOut",
            "zoomIn",
            "btnTiles",
            "btnMore",
            "btnShare",
            "btnPrint",
            "btnFull",
            "btnSearch",
            "btnSound",
            "btnStage"
        );
    }

    // ---- Flipbook init ----
    function init() {
        const el = $("flipbook");
        if (!el) return false;
        if (!window.St?.PageFlip) return false;
        if (el.dataset.flipInit === "1") return true;
        el.dataset.flipInit = "1";

        const pageFlip = new window.St.PageFlip(el, {
            width: 2000,
            height: 1680,
            size: "stretch",
            minWidth: 320,
            maxWidth: 2000,
            minHeight: 400,
            maxHeight: 1680,
            maxShadowOpacity: 0.18,
            showCover: true,
            mobileScrollSupport: true,
        });

        const pages = buildPages();

        const container = $("flipbook");
        if (!container) {
            console.error("❌ #flipbook not found");
            return false;
        }
        container.innerHTML = "";

        pages.forEach((src, i) => {
            const page = document.createElement("div");
            page.className = "page";

            // 👻 ghost page
            if (!src) {
                page.classList.add("page-ghost");
                container.appendChild(page);
                return;
            }

            // covers: first + last real pages only
            if (i === 0 || i === pages.length - 1) {
                page.setAttribute("data-density", "hard");
                page.classList.add("page-cover");
                if (i === 0) page.classList.add("page-cover-top");
                else page.classList.add("page-cover-bottom");
            }

            page.innerHTML = `
        <div class="page-content">
          <div class="page-image" style="background-image:url('${src}')"></div>
        </div>
      `;

            container.appendChild(page);
        });

        pageFlip.loadFromHTML(container.querySelectorAll(".page"));
        window.__flipbook = { pageFlip };

        // choose start page: hash beats localStorage beats 1
        const m = location.hash.match(/p=(\d+)/);
        const hashHuman = m ? Number(m[1]) : null;
        const storedHuman = Number(localStorage.getItem("flip:page") || "1");
        const desiredHuman = Number.isFinite(hashHuman) ? hashHuman : storedHuman;
        const desiredHumanClamped = Math.max(1, Math.min(TOTAL_PAGES, desiredHuman));
        const desiredIndex = humanToIdx(desiredHumanClamped);

        pageFlip.flip(desiredIndex);
        syncPageIndicator(desiredHumanClamped);
        updateNavLocks(desiredHumanClamped);

        pageFlip.on("flip", (e) => {
            playRandomTurn();
            const idx = e?.data ?? e;
            const human = idxToHuman(idx);
            localStorage.setItem("flip:page", String(human));
            syncPageIndicator(human);
            updateNavLocks(human);
        });

        setTimeout(wireUI, 50);
        return true;
    }

    document.getElementById("startBtn")?.addEventListener("click", () => {
        // enter reading
        document.body.classList.add("is-reading");
        document.getElementById("flipbook-stage")?.classList.remove("is-resting");

        // force default stage: kitchen TABLE surface (your "tabletop.webp")
        localStorage.setItem("flip:stage", "table");

        // show flipbar + animate in
        const flipbar = document.getElementById("flipbar");
        if (flipbar) {
            flipbar.style.display = "";
            flipbar.classList.remove("is-entering");
            void flipbar.offsetWidth;
            flipbar.classList.add("is-entering");
        }

        // toast: hide immediately on entry + mark seen
        const toast = document.getElementById("openToast");
        try { sessionStorage.setItem("SMB_OPEN_TOAST_SEEN", "1"); } catch (e) { }
        if (toast) {
            toast.classList.remove("is-visible");
            toast.classList.add("is-hiding");
            setTimeout(() => toast.classList.remove("is-hiding"), 300);
        }

        setTimeout(() => {
            init();
            window.__flipbook?.pageFlip?.flip(humanToIdx(3));
            localStorage.setItem("flip:page", "3");
            syncPageIndicator(3);
            updateNavLocks(3);
        }, 0);
    });


    // If you ever want auto-init without the cover screen, uncomment:
    // setTimeout(() => init(), 0);

})();
/* ================================
   SMB: Resting -> Reading behaviors
   - Hide flipbar in resting view
   - Click book to enter: flipbar bounce-in
   - Start at human page 3
   - Default stage: kitchen table
   - Lock interactions on page 1 (no peel-back)
   - Cover icons for first/last controls
================================== */

(function () {
    // --- CONFIG: adjust these if your ids differ ---
    const STAGE_EL_ID = "flipbook-stage";
    const FLIPBAR_ID = "flipbar";           // your bottom UI bar
    const WRAP_ID = "flipbook-wrap";
    const SHIELD_ID = "interactionShield";

    // Buttons (update IDs if needed)
    const BTN_FIRST_ID = "btnFirst";         // "go to front cover" (A)
    const BTN_LAST_ID = "btnLast";          // "go to back cover" (Z)
    const BTN_PREV_ID = "btnPrev";          // previous spread
    // (optional) if you have next id you can add it too

    // Your icon URLs (from your screenshot)
    const ROOT = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/";
    const ICON_BASE = ROOT + "flipbook-ui-icons/";
    const COVER_A = ICON_BASE + "go-to-front-cover-a.png";
    const COVER_Z = ICON_BASE + "go-to-back-cover-z.png";

    // Desired starting state
    const START_HUMAN_PAGE = 3; // “3 of 239”
    const DEFAULT_STAGE_KEY = "tabletop"; // kitchen table surface

    // --- helpers ---
    const $ = (id) => document.getElementById(id);

    const stageEl = $(STAGE_EL_ID);
    const flipbar = $(FLIPBAR_ID);
    const wrapEl = $(WRAP_ID);
    const shield = $(SHIELD_ID);

    const btnFirst = $(BTN_FIRST_ID);
    const btnLast = $(BTN_LAST_ID);
    const btnPrev = $(BTN_PREV_ID);

    // if we can't find the stage, bail silently
    if (!stageEl) return;

    // Ensure resting mode initially (hide flipbar)
    stageEl.classList.add("is-resting");

    // Inject/ensure shield exists (in case you forgot HTML step)
    let shieldEl = shield;
    if (!shieldEl && wrapEl) {
        shieldEl = document.createElement("div");
        shieldEl.id = SHIELD_ID;
        shieldEl.setAttribute("aria-hidden", "true");
        wrapEl.style.position = wrapEl.style.position || "relative";
        wrapEl.prepend(shieldEl);
    }

    function setFlipbarVisible(isVisible) {
        if (!flipbar) return;
        flipbar.style.display = isVisible ? "" : "none";
    }

    function playFlipbarEntrance() {
        if (!flipbar) return;
        flipbar.classList.remove("is-entering");
        // force reflow so animation replays
        void flipbar.offsetWidth;
        flipbar.classList.add("is-entering");
    }

    function setShield(on) {
        if (!shieldEl) return;
        shieldEl.classList.toggle("is-on", !!on);
    }

    function setPrevDisabled(disabled) {
        if (!btnPrev) return;
        btnPrev.classList.toggle("is-disabled", !!disabled);
    }

    function paintCoverNavIcons() {
        // Convert first/last to cover-icon buttons
        if (btnFirst) {
            btnFirst.classList.add("cover-icon");
            btnFirst.style.backgroundImage = `url("${COVER_A}")`;
            btnFirst.title = btnFirst.title || "Go to Front Cover";
            // if it had an <img>, hide it so only bg shows
            const img = btnFirst.querySelector("img");
            if (img) img.style.display = "none";
        }
        if (btnLast) {
            btnLast.classList.add("cover-icon");
            btnLast.style.backgroundImage = `url("${COVER_Z}")`;
            btnLast.title = btnLast.title || "Go to Back Cover";
            const img = btnLast.querySelector("img");
            if (img) img.style.display = "none";
        }
    }

    // Stage default: kitchen table
    function setDefaultStageKitchenTable() {
        // If you already have SMB.setStage(), use it.
        if (window.SMB && typeof window.SMB.setStage === "function") {
            window.SMB.setStage(DEFAULT_STAGE_KEY);
            return;
        }

        // Otherwise fallback: set a known CSS variable if you use one
        // (update this var name if your CSS differs)
        document.documentElement.style.setProperty(
            "--stage-bg",
            `url("${ROOT}highlights/tabletop.webp")`
        );
        // If you persist stage in localStorage, match your key here:
        try { localStorage.setItem("SMB_STAGE", DEFAULT_STAGE_KEY); } catch (_) { }
    }

    // Go to the requested starting spread/page
    function goToStartHumanPage() {
        if (window.SMB && typeof window.SMB.goToHuman === "function") {
            window.SMB.goToHuman(START_HUMAN_PAGE);
            return;
        }

        // fallback if you store a PageFlip instance
        const pf =
            (window.SMB && (window.SMB.pf || window.SMB.pageFlip)) ||
            window.pageFlip ||
            window.__flip;

        // If we have PageFlip, try to go to (human-1) index
        if (pf && typeof pf.turnToPage === "function") {
            const idx = Math.max(0, START_HUMAN_PAGE - 1);
            pf.turnToPage(idx);
        }
    }

    function applyOpeningPageLockIfNeeded() {
        const humanPage =
            (window.SMB && typeof window.SMB.getHumanPage === "function" && window.SMB.getHumanPage()) ||
            (window.SMB && window.SMB.humanPage) ||
            null;

        const isOnOpening = (humanPage === 1);

        setShield(isOnOpening);
        setPrevDisabled(isOnOpening);
    }

    function wireFlipEvents() {
        const pf =
            (window.SMB && (window.SMB.pf || window.SMB.pageFlip)) ||
            window.pageFlip ||
            window.__flip;

        if (!pf || typeof pf.on !== "function") return;

        pf.on("flip", function () {
            applyOpeningPageLockIfNeeded();
        });
    }

    function enterReadingMode() {
        setDefaultStageKitchenTable();

        stageEl.classList.remove("is-resting");
        stageEl.classList.add("is-reading");

        setFlipbarVisible(true);
        playFlipbarEntrance();

        goToStartHumanPage();

        setTimeout(applyOpeningPageLockIfNeeded, 0);
    }

    paintCoverNavIcons();

    setFlipbarVisible(false);

    const clickTarget = wrapEl || stageEl;
    clickTarget.addEventListener("click", function (e) {

        if (flipbar && flipbar.contains(e.target)) return;

        if (stageEl.classList.contains("is-reading")) return;

        enterReadingMode();
        wireFlipEvents();
    });
    /* ---- Open Toast logic ---- */
    const toast = document.getElementById("openToast");

    // only show once per session
    const TOAST_SEEN_KEY = "SMB_OPEN_TOAST_SEEN";

    function showToast() {
        if (!toast) return;
        if (sessionStorage.getItem(TOAST_SEEN_KEY)) return;

        toast.classList.add("is-visible");

        // auto-hide after a beat
        setTimeout(hideToast, 3200);
    }

    function hideToast() {
        if (!toast || !toast.classList.contains("is-visible")) return;

        toast.classList.remove("is-visible");
        toast.classList.add("is-hiding");

        setTimeout(() => {
            toast.classList.remove("is-hiding");
        }, 300);

        sessionStorage.setItem(TOAST_SEEN_KEY, "1");
    }

    // show toast in resting state
    showToast();

    // hide immediately once user enters reading mode
    const originalEnterReadingMode = enterReadingMode;
    enterReadingMode = function () {
        hideToast();
        originalEnterReadingMode();
    };
})();
