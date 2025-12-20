console.log("✅ inline flipbook script loaded");
console.log("✅ main script started");

(function () {
    // ----------------------------
    // Config
    // ----------------------------
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
        start: ICON_BASE + "go-to-front-cover-a.png",
        end: ICON_BASE + "go-to-back-cover-z.png",
        soundOn: ICON_BASE + "sound-gold.png",
        soundOff: ICON_BASE + "sound-off-gold.png",
        prev: ICON_BASE + "previous-gold.png",
        next: ICON_BASE + "next-gold.png",
        pan: ICON_BASE + "grab-open-gold.png",
        grab: ICON_BASE + "grab-closed-gold.png",
        reset: ICON_BASE + "reset-gold.png",
        startHint: ICON_BASE + "click-me-to-start.gif",
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
    const START_HUMAN_PAGE = 3;
    const DEFAULT_STAGE_KEY = "table";

    // ----------------------------
    // DOM helpers
    // ----------------------------
    window.SMB = window.SMB || {};
    const SMB = window.SMB;

    const $ = (id) => document.getElementById(id);

    const els = {
        stage: $("flipbook-stage"),
        wrap: $("flipbook-wrap"),
        book: $("flipbook"),
        flipbar: $("flipbar"),
        startBtn: $("startBtn"),
        startScreen: $("startScreen"),
        startHint: $("startHint"),

        // Nav
        btnFirst: $("btnFirst"),
        btnPrev: $("btnPrev"),
        btnNext: $("btnNext"),
        btnLast: $("btnLast"),

        // UI
        pageJump: $("pageJump"),
        zoomIn: $("zoomIn"),
        zoomOut: $("zoomOut"),
        zoomReset: $("zoomReset"),
        btnTiles: $("btnTiles"),
        tiles: $("tiles"),
        tilesGrid: $("tilesGrid"),
        tilesClose: $("tilesClose"),
        btnMore: $("btnMore"),
        moreMenu: $("moreMenu"),
        btnShare: $("btnShare"),
        btnPrint: $("btnPrint"),
        btnFull: $("btnFull"),
        btnSearch: $("btnSearch"),
        btnSound: $("btnSound"),
        btnStage: $("btnStage"),
        stageMenu: $("stageMenu"),
    };

    // ----------------------------
    // Persistent state
    // ----------------------------
    let soundOn = (localStorage.getItem("flip:sound") ?? "1") === "1";
    let zoom = Number(localStorage.getItem("flip:zoom") || String(DEFAULT_ZOOM));
    let stageKey = localStorage.getItem("flip:stage") || DEFAULT_STAGE_KEY;

    let panX = 0,
        panY = 0;
    let isPanning = false,
        panSX = 0,
        panSY = 0,
        panOX = 0,
        panOY = 0;

    let tilesBuilt = false;

    // Flip instance
    let pageFlip = null;

    // One-time exception (only use if you ever add an explicit "go to cover" action)
    let allowBackUnder3Once = false;

    // ----------------------------
    // Audio
    // ----------------------------
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

    // ----------------------------
    // Page mapping: ghost pages
    // pages: [p1, ghost, p2..p238, ghost, p239]
    // ----------------------------
    function pageUrl(humanPageNum) {
        const n = String(humanPageNum).padStart(4, "0");
        return `${BASE}lembo_${n}.webp`;
    }

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
        pages.push(pageUrl(1)); // cover
        pages.push(null); // ghost
        for (let p = 2; p <= TOTAL_PAGES - 1; p++) pages.push(pageUrl(p));
        pages.push(null); // ghost
        pages.push(pageUrl(TOTAL_PAGES)); // back cover
        return pages;
    }

    // ----------------------------
    // UI visuals
    // ----------------------------
    function paintIcons() {
        const flipbar = els.flipbar;
        if (!flipbar) return;

        flipbar.querySelectorAll("img[data-ikey]").forEach((img) => {
            const key = img.dataset.ikey;
            if (key === "sound") img.src = soundOn ? ICONS.soundOn : ICONS.soundOff;
            else img.src = ICONS[key] || "";
        });
    }

    function applyStage() {
        if (!els.stage) return;
        const stageVar =
            {
                table: "var(--stage-table)",
                parquet: "var(--stage-parquet)",
                kitchen: "var(--stage-kitchen)",
                basement: "var(--stage-basement)",
                lawn: "var(--stage-lawn)",
                cancun: "var(--stage-cancun)",
            }[stageKey] || "var(--stage-table)";
        els.stage.style.setProperty("--stage-img", stageVar);
    }

    function applyTransform() {
        if (!els.wrap) return;
        els.wrap.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    function updatePanCursor() {
        if (!els.wrap) return;
        els.wrap.classList.toggle("can-pan", zoom > 1);
    }

    function setZoom(z) {
        zoom = Math.max(0.6, Math.min(2.2, z));
        localStorage.setItem("flip:zoom", String(zoom));
        applyTransform();
        updatePanCursor();
    }

    function centerBookVertically() {
        if (!els.wrap || !els.book) return;
        const wrapRect = els.wrap.getBoundingClientRect();
        const bookRect = els.book.getBoundingClientRect();
        panY = Math.round((wrapRect.height - bookRect.height) / 2);
    }

    function resetViewToComfort() {
        setZoom(DEFAULT_ZOOM);
        panX = 0;
        centerBookVertically();
        panY += OPTICAL_NUDGE_Y;
        applyTransform();
    }

    // ----------------------------
    // Page indicator
    // ----------------------------
    function formatPageValue(n) {
        return `${n} of ${TOTAL_PAGES}`;
    }

    function extractPageNumber(value) {
        const match = String(value || "").match(/\d+/);
        return match ? parseInt(match[0], 10) : NaN;
    }

    function syncPageIndicator(humanPage) {
        if (!els.pageJump) return;
        if (document.activeElement !== els.pageJump) {
            els.pageJump.value = formatPageValue(humanPage);
        }
    }

    // ----------------------------
    // Locking rules (your spec)
    // Lock ONLY on human page 3:
    // - disable PREV
    // - (no overlay shield; we block left-half interactions via capture listener)
    // ----------------------------
    function updateNavLocks(human) {
        const lockBack = human === START_HUMAN_PAGE;

        if (els.btnPrev) {
            els.btnPrev.toggleAttribute("disabled", lockBack);
            els.btnPrev.classList.toggle("is-disabled", lockBack);
        }
    }

    // ----------------------------
    // Hint controls
    // ----------------------------
    SMB.hideStartHint = function () {
        const hint = els.startHint || $("startHint");
        if (!hint) return;
        hint.style.opacity = "0";
        hint.style.transform = "translateY(6px)";
        setTimeout(() => (hint.style.display = "none"), 250);
    };

    function showStartHint() {
        const hint = els.startHint || $("startHint");
        if (!hint) return;
        hint.style.display = "";
        hint.style.opacity = "";
        hint.style.transform = "";
    }

    // ----------------------------
    // Share/Print
    // ----------------------------
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
        const human = Number(localStorage.getItem("flip:page") || "1");
        const imgSrc = pageUrl(human);

        const w = window.open("", "_blank");
        if (!w) return;

        w.document.open();
        w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8">');
        w.document.write("<title>Print page " + human + "</title>");
        w.document.write(
            "<style>" +
            "body{margin:0;display:flex;justify-content:center;align-items:center;}" +
            "img{max-width:100vw;max-height:100vh;}" +
            "</style>"
        );
        w.document.write("</head><body>");
        w.document.write('<img id="printImg" src="' + imgSrc + '" alt="Page ' + human + '">');
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

    // ----------------------------
    // Tiles
    // ----------------------------
    function buildTilesOnce() {
        if (tilesBuilt) return;
        if (!els.tilesGrid) return;

        const frag = document.createDocumentFragment();
        for (let p = 1; p <= TOTAL_PAGES; p++) {
            const d = document.createElement("div");
            d.className = "tile";
            d.innerHTML = `
        <img loading="lazy" src="${pageUrl(p)}" alt="Page ${p}">
        <div class="n"><strong>${p}</strong></div>
      `;
            d.addEventListener("click", () => {
                goToHuman(p);
                els.tiles?.classList.remove("is-open");
            });
            frag.appendChild(d);
        }
        els.tilesGrid.appendChild(frag);
        tilesBuilt = true;
    }

    // ----------------------------
    // Flipbook init
    // ----------------------------
    function initFlipbookOnce() {
        if (!els.book) return false;
        if (!window.St?.PageFlip) {
            console.error("❌ PageFlip not found (window.St.PageFlip)");
            return false;
        }
        if (els.book.dataset.flipInit === "1") return true;
        els.book.dataset.flipInit = "1";

        pageFlip = new window.St.PageFlip(els.book, {
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
            showPageCorners: true,
            useMouseEvents: true,
        });

        const pages = buildPages();
        els.book.innerHTML = "";

        pages.forEach((src, i) => {
            const page = document.createElement("div");
            page.className = "page";

            if (!src) {
                page.classList.add("page-ghost");
                els.book.appendChild(page);
                return;
            }

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

            els.book.appendChild(page);
        });

        pageFlip.loadFromHTML(els.book.querySelectorAll(".page"));
        window.__flipbook = { pageFlip };

        let isSnapBack = false;

        pageFlip.on("flip", (e) => {
            if (isSnapBack) return;

            playRandomTurn();

            const idx = e?.data ?? e;
            const human = idxToHuman(idx);

            // HARD RULE: never allow human < START_HUMAN_PAGE unless explicitly allowed once
            if (!allowBackUnder3Once && human < START_HUMAN_PAGE) {
                isSnapBack = true;
                setTimeout(() => {
                    pageFlip.flip(humanToIdx(START_HUMAN_PAGE));
                    localStorage.setItem("flip:page", String(START_HUMAN_PAGE));
                    syncPageIndicator(START_HUMAN_PAGE);
                    updateNavLocks(START_HUMAN_PAGE);
                    isSnapBack = false;
                }, 0);
                return;
            }

            // consume exception if it was used
            if (allowBackUnder3Once && human < START_HUMAN_PAGE) {
                allowBackUnder3Once = false;
            }

            localStorage.setItem("flip:page", String(human));
            syncPageIndicator(human);
            updateNavLocks(human);
        });

        return true;
    }

    function goToHuman(human) {
        let clamped = Math.max(1, Math.min(TOTAL_PAGES, human));

        if (!allowBackUnder3Once && clamped < START_HUMAN_PAGE) {
            clamped = START_HUMAN_PAGE;
        }
        if (allowBackUnder3Once && clamped < START_HUMAN_PAGE) {
            allowBackUnder3Once = false; // consume it
        }

        localStorage.setItem("flip:page", String(clamped));
        pageFlip?.flip(humanToIdx(clamped));

        preloadPages(clamped, 3);

        syncPageIndicator(clamped);
        updateNavLocks(clamped);
    }

    function preloadPages(pageNum, radius = 3) {
        const start = Math.max(1, pageNum - 1);
        const end = Math.min(TOTAL_PAGES, pageNum + radius);

        for (let p = start; p <= end; p++) {
            const img = new Image();
            img.decoding = "async";
            img.loading = "eager";
            img.src = `${BASE}lembo-${String(p).padStart(4, "0")}.webp`;
        }
    }

    SMB.goToHuman = goToHuman;

    // ----------------------------
    // Start / End state control
    // ----------------------------

    function syncCoverArt() {
        if (!els.startBtn) return;

        const isEnd = document.body.classList.contains("is-end-state");
        const target = isEnd ? pageUrl(TOTAL_PAGES) : pageUrl(1);

        els.startBtn.style.background = `url("${target}") center / contain no-repeat`;
    }

    function setFlipbarVisible(visible) {
        if (!els.flipbar) return;
        els.flipbar.style.display = visible ? "" : "none";
    }

    function enterReadingMode() {
        // start page and defaults
        localStorage.setItem("flip:page", String(START_HUMAN_PAGE));
        localStorage.setItem("flip:stage", DEFAULT_STAGE_KEY);
        location.hash = "";
        allowBackUnder3Once = false;

        // hide hint & start screen
        SMB.hideStartHint();
        if (els.startScreen) els.startScreen.style.display = "none";

        // mark reading
        document.body.classList.add("is-reading");
        document.body.classList.remove("is-cover-only");
        els.stage?.classList.remove("is-resting");
        document.body.classList.remove("is-end-state");

        // show flipbar (CSS handles animation)
        setFlipbarVisible(true);
        if (els.flipbar) {
            els.flipbar.classList.remove("is-entering");
            void els.flipbar.offsetWidth; // reflow
            els.flipbar.classList.add("is-entering");
        }

        // init + jump
        initFlipbookOnce();
        resetViewToComfort();
        goToHuman(START_HUMAN_PAGE);
    }

    function goToStartState() {
        // Ensure end state matches start
        document.body.classList.remove("is-reading");
        document.body.classList.add("is-cover-only");
        document.body.classList.remove("is-end-state");
        els.stage?.classList.add("is-resting");
        allowBackUnder3Once = false;

        // flipbar hidden
        setFlipbarVisible(false);

        // reset persisted defaults
        localStorage.setItem("flip:page", String(START_HUMAN_PAGE));
        localStorage.setItem("flip:stage", DEFAULT_STAGE_KEY);
        location.hash = "";

        // show start UI
        if (els.startScreen) els.startScreen.style.display = "";
        showStartHint();
        syncCoverArt();

        // front cover as the big "button"
        if (els.startBtn) {
            els.startBtn.style.backgroundImage = `url("${pageUrl(1)}")`;
        }

        // close menus
        els.tiles?.classList.remove("is-open");
        els.moreMenu?.classList.remove("is-open");
    }

    function goToEndState() {
        document.body.classList.remove("is-reading");
        document.body.classList.add("is-cover-only");
        document.body.classList.add("is-end-state");

        els.stage?.classList.add("is-resting");
        allowBackUnder3Once = false;

        setFlipbarVisible(false);

        // reset persisted defaults (keeps boot/read consistent)
        localStorage.setItem("flip:page", String(START_HUMAN_PAGE));
        localStorage.setItem("flip:stage", DEFAULT_STAGE_KEY);
        location.hash = "";

        // show cover UI
        if (els.startScreen) els.startScreen.style.display = "";

        // end-state never shows the hint
        SMB.hideStartHint?.();

        // close menus
        els.tiles?.classList.remove("is-open");
        els.moreMenu?.classList.remove("is-open");
    }


    // ----------------------------
    // Wire UI (once)
    // ----------------------------
    function wireUIOnce() {
        paintIcons();
        applyStage();
        setFlipbarVisible(false); // resting default

        function currentHuman() {
            return Number(localStorage.getItem("flip:page") || String(START_HUMAN_PAGE));
        }

        // Block ONLY interactions that begin on LEFT half while on page 3
        // (Preserves hover/magnet behavior for PageFlip)
        function blockBackPeelOnStartPage(e) {
            if (currentHuman() !== START_HUMAN_PAGE) return;
            if (!els.book) return;

            const r = els.book.getBoundingClientRect();
            const x = e.clientX - r.left;

            if (x < r.width / 2) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation?.();
                return false;
            }
        }

        ["pointerdown", "mousedown", "touchstart"].forEach((evt) => {
            els.book?.addEventListener(evt, blockBackPeelOnStartPage, true);
        });

        // Panning
        if (els.wrap) {
            els.wrap.addEventListener("pointerdown", (e) => {
                if (zoom <= 1) return;
                isPanning = true;
                els.wrap.classList.add("is-dragging");
                els.wrap.setPointerCapture(e.pointerId);
                panSX = e.clientX;
                panSY = e.clientY;
                panOX = panX;
                panOY = panY;
            });

            els.wrap.addEventListener("pointermove", (e) => {
                if (!isPanning) return;
                panX = panOX + (e.clientX - panSX);
                panY = panOY + (e.clientY - panSY);
                applyTransform();
            });

            const endPan = () => {
                isPanning = false;
                els.wrap.classList.remove("is-dragging");
            };
            els.wrap.addEventListener("pointerup", endPan);
            els.wrap.addEventListener("pointerleave", endPan);
            els.wrap.addEventListener("pointercancel", endPan);
        }

        // Start button (THE ONLY way to enter reading)
        els.startBtn?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            enterReadingMode();
        });

        // Home / End
        els.btnFirst?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            goToStartState();
        });

        els.btnLast?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            goToEndState();
        });


        // Prev / Next
        els.btnNext?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            pageFlip?.flipNext();
        });

        els.btnPrev?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            pageFlip?.flipPrev();
        });

        // Page jump
        if (els.pageJump) {
            els.pageJump.addEventListener("focus", () => {
                const n = extractPageNumber(els.pageJump.value);
                if (Number.isFinite(n)) els.pageJump.value = String(n);
            });

            els.pageJump.addEventListener("blur", () => {
                const n = extractPageNumber(els.pageJump.value);
                const clamped = Number.isFinite(n)
                    ? Math.max(1, Math.min(TOTAL_PAGES, n))
                    : Number(localStorage.getItem("flip:page") || 1);
                els.pageJump.value = formatPageValue(clamped);
            });

            els.pageJump.addEventListener("keydown", (e) => {
                if (e.key !== "Enter") return;
                const n = extractPageNumber(els.pageJump.value);
                if (!Number.isFinite(n)) return;
                goToHuman(n);
                els.pageJump.blur();
            });
        }

        // Zoom
        els.zoomIn && (els.zoomIn.onclick = () => setZoom(zoom + 0.1));
        els.zoomOut && (els.zoomOut.onclick = () => setZoom(zoom - 0.1));
        els.zoomReset && (els.zoomReset.onclick = () => resetViewToComfort());

        // Tiles
        if (els.btnTiles) {
            els.btnTiles.onclick = () => {
                els.tiles?.classList.toggle("is-open");
                buildTilesOnce();
            };
        }
        els.tilesClose && (els.tilesClose.onclick = () => els.tiles?.classList.remove("is-open"));

        // More menu
        els.btnMore && (els.btnMore.onclick = () => els.moreMenu?.classList.toggle("is-open"));
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#btnMore") && !e.target.closest("#moreMenu")) {
                els.moreMenu?.classList.remove("is-open");
            }
        });

        // Share/Print/Full/Search/Sound
        els.btnShare && (els.btnShare.onclick = doShare);
        els.btnPrint && (els.btnPrint.onclick = doPrintCurrent);

        els.btnFull &&
            (els.btnFull.onclick = () => {
                const stage = els.stage;
                if (!stage) return;
                if (!document.fullscreenElement) stage.requestFullscreen?.();
                else document.exitFullscreen?.();
            });

        els.btnSearch && (els.btnSearch.onclick = () => alert("Search UI next step 😈"));

        els.btnSound &&
            (els.btnSound.onclick = () => {
                soundOn = !soundOn;
                localStorage.setItem("flip:sound", soundOn ? "1" : "0");
                paintIcons();
                (soundOn ? SFX.soundOn : SFX.soundOff).play().catch(() => { });
            });

        // Stage menu
        function renderStageMenu() {
            if (!els.stageMenu) return;
            els.stageMenu.innerHTML = STAGES.map(
                ([k, label]) =>
                    `<button type="button" data-stage="${k}">${k === stageKey ? "■" : "□"} ${label}</button>`
            ).join("");
        }

        if (els.btnStage && els.stageMenu) {
            renderStageMenu();

            els.btnStage.onclick = () => {
                playSfx("click");
                els.stageMenu.classList.toggle("is-open");
            };

            els.stageMenu.addEventListener("click", (e) => {
                const btn = e.target.closest("button[data-stage]");
                if (!btn) return;
                stageKey = btn.dataset.stage;
                localStorage.setItem("flip:stage", stageKey);
                applyStage();
                renderStageMenu();
            });
        }

        // Button SFX (only for real buttons)
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

    // ----------------------------
    // Boot: ensure true resting state
    // ----------------------------
    function bootRestingState() {
        applyStage();
        paintIcons();
        applyTransform();
        updatePanCursor();

        document.body.classList.remove("is-reading");
        document.body.classList.add("is-cover-only");
        document.body.classList.remove("is-end-state");
        els.stage?.classList.add("is-resting");
        syncCoverArt();

        setFlipbarVisible(false);

        localStorage.setItem("flip:page", String(START_HUMAN_PAGE));
        localStorage.setItem("flip:stage", DEFAULT_STAGE_KEY);

        if (els.startScreen) els.startScreen.style.display = "";

        showStartHint();
        syncCoverArt();

        syncPageIndicator(START_HUMAN_PAGE);
        updateNavLocks(START_HUMAN_PAGE);
    }

    // Run
    wireUIOnce();
    bootRestingState();
})();