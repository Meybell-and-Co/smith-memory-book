console.log("✅ inline flipbook script loaded");
console.log("✅ main script started");

(function () {
    const BASE = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/pages/";
    const TOTAL_PAGES = 239;

    const ICON_BASE = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/flipbook-ui-icons/";
    const ROOT = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/";
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
    const OPTICAL_NUDGE_Y = +20;

    const $ = (id) => document.getElementById(id);

    function makeAudio(url, vol = 0.6) {
        const a = new Audio(url);
        a.preload = "auto";
        a.volume = vol;
        return a;
    }

    // --- state ---
    let soundOn = (localStorage.getItem("flip:sound") ?? "1") === "1";
    let zoom = Number(localStorage.getItem("flip:zoom") || "1");

    let stageKey = localStorage.getItem("flip:stage") || "table";
    const stageEl = $("flipbook-stage");

    let panX = 0,
        panY = 0;
    let isPanning = false,
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

    function buildPages() {
        const pages = [];

        pages.push(pageUrl(1));

        // 👻
        pages.push(null);

        for (let p = 2; p <= TOTAL_PAGES - 1; p++) {
            pages.push(pageUrl(p));
        }

        // 👻
        pages.push(null);

        pages.push(pageUrl(TOTAL_PAGES));

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
        const match = value.match(/\d+/);
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
        wrap.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    function syncPageIndicator(humanPage) {
        const pageJump = $("pageJump");
        if (!pageJump) return;

        if (document.activeElement !== pageJump) {
            pageJump.value = formatPageValue(humanPage);
        }
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
        if (navigator.share)
            navigator.share({ title: document.title, url: link }).catch(() => { });
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
        w.document.write(
            '<img id="printImg" src="' +
            imgSrc +
            '" alt="Page ' +
            page +
            '">'
        );
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

    let tilesBuilt = false;
    function buildTilesOnce() {
        if (tilesBuilt) return;
        const grid = $("tilesGrid");
        if (!grid) return;

        const frag = document.createDocumentFragment();
        for (let p = 1; p <= TOTAL_PAGES; p++) {
            const d = document.createElement("div");
            d.className = "tile";
            d.innerHTML = `<img loading="lazy" src="${pageUrl(
                p
            )}" alt="Page ${p}">
        <div class="n"><span>Page</span><strong>${p}</strong></div>`;

            d.addEventListener("click", () => {
                window.__flipbook?.pageFlip?.flip(p - 1);
                $("tiles")?.classList.remove("is-open");
            });

            frag.appendChild(d);
        }
        grid.appendChild(frag);
        tilesBuilt = true;
    }

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
                console.log("drag start", wrap.className);
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

            wrap.addEventListener("pointerup", () => {
                isPanning = false;
                wrap.classList.remove("is-dragging");
                console.log("drag end", wrap.className);
            });

            wrap.addEventListener("pointerleave", () => {
                isPanning = false;
                wrap.classList.remove("is-dragging");
            });
            wrap.addEventListener("pointercancel", () => {
                isPanning = false;
                wrap.classList.remove("is-dragging");
            });
        }

        $("btnFirst") && ($("btnFirst").onclick = () => window.__flipbook.pageFlip.flip(0));
        $("btnLast") && ($("btnLast").onclick = () => window.__flipbook.pageFlip.flip(TOTAL_PAGES - 1));
        $("btnPrev") && ($("btnPrev").onclick = () => window.__flipbook.pageFlip.flipPrev());
        $("btnNext") && ($("btnNext").onclick = () => window.__flipbook.pageFlip.flipNext());

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
            window.__flipbook.pageFlip.flip(clamped - 1);
            localStorage.setItem("flip:page", String(clamped));

            syncPageIndicator(clamped);
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
            zoom = DEFAULT_ZOOM;
            setZoom(zoom);

            panX = 0;
            centerBookVertically();

            panY += OPTICAL_NUDGE_Y;

            if (typeof applyPan === "function") applyPan();
        }

        $("zoomReset") && (
            $("zoomReset").onclick = () => {
                console.log("🔄 Reset view");
                resetViewToComfort();
            }
        );

        $("btnTiles") &&
            ($("btnTiles").onclick = () => {
                $("tiles")?.classList.toggle("is-open");
                buildTilesOnce();
            });

        $("tilesClose") &&
            ($("tilesClose").onclick = () => $("tiles")?.classList.remove("is-open"));

        $("btnMore") &&
            ($("btnMore").onclick = () => $("moreMenu")?.classList.toggle("is-open"));

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

        // Stage menu wiring (optional; safe if markup not present yet)
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

        console.log(
            "pages check:",
            pages.length,
            pages[0],
            pages[1],
            pages.at(-2),
            pages.at(-1)
        );

        const container = document.getElementById("flipbook");
        if (!container) { console.error("❌ #flipbook not found"); return false; }

        container.innerHTML = "";

        pages.forEach((src, i) => {
            const page = document.createElement("div");
            page.className = "page";

            // Covers: first + last only
            if (i === 0 || i === pages.length - 1) {
                page.setAttribute("data-density", "hard");
                page.classList.add("page-cover");
                if (i === 0) page.classList.add("page-cover-top");
                else page.classList.add("page-cover-bottom");
            }

            // ✅ Ghost spacer page (src is null)
            if (!src) {
                page.classList.add("page-ghost");
                container.appendChild(page);
                return;
            }

            // Normal page with image
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
        const desiredIndex = Math.max(0, Math.min(TOTAL_PAGES - 1, desiredHuman - 1));

        pageFlip.flip(desiredIndex);
        syncPageIndicator(desiredIndex + 1);

        pageFlip.on("flip", (e) => {
            playRandomTurn();
            const human = (e.data ?? e) + 1;
            localStorage.setItem("flip:page", String(human));
            syncPageIndicator(human);
        });

        setTimeout(wireUI, 50);
        return true;
    }

    let tries = 0;
    const t = setInterval(() => {
        tries++;
        const ok = init();
        if (ok || tries > 400) clearInterval(t);
    }, 50);
})();