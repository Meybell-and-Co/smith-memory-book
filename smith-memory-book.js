    console.log("✅ inline flipbook script loaded");
    console.log("✅ main script started");
    (function () {
      const BASE = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/pages/";
      const TOTAL_PAGES = 239;
      const START_PAGE = 0;

      const ICON_BASE = "https://pub-be03f9c6fce44f8cbc3ec20dcaa3b337.r2.dev/flipbook-ui-icons/";
      let flipbarTone = "gold";

      const ICONS = {
        cream: {
          zoomIn: ICON_BASE + "add-cream.png",
          zoomOut: ICON_BASE + "subtract-cream.png",
          tiles: ICON_BASE + "tiles-cream.png",
          search: ICON_BASE + "search-cream.png",
          share: ICON_BASE + "share-cream.png",
          print: ICON_BASE + "print-cream.png",
          fullscreen: ICON_BASE + "maximize-cream.png",
          more: ICON_BASE + "ellipsis-cream.png",
          start: ICON_BASE + "start-cream.png",
          end: ICON_BASE + "end-cream.png",
          soundOn: ICON_BASE + "sound-cream.png",
          soundOff: ICON_BASE + "sound-off-cream.png",
        },
        gold: {
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
        }
      };

      let soundOn = (localStorage.getItem("flip:sound") ?? "1") === "1";
      let zoom = Number(localStorage.getItem("flip:zoom") || "1");

      const $ = (id) => document.getElementById(id);

      function pageUrl(humanPageNum) {
        const n = String(humanPageNum).padStart(4, "0");
        return `${BASE}lembo_${n}.webp`;
      }

      function buildPages() {
        return Array.from({ length: TOTAL_PAGES }, (_, idx) => pageUrl(idx + 1));
      }

      function paintIcons() {
        const tone = ICONS[flipbarTone];
        document.querySelectorAll("#flipbar img[data-ikey]").forEach(img => {
          const key = img.dataset.ikey;
          if (key === "sound") img.src = soundOn ? tone.soundOn : tone.soundOff;
          else img.src = tone[key] || "";
        });
      }

      function setZoom(z) {
        zoom = Math.max(0.6, Math.min(2.2, z));
        $("flipbook-wrap").style.transform = `scale(${zoom})`;
        localStorage.setItem("flip:zoom", String(zoom));
      }

      function shareLink() {
        const url = new URL(location.href);
        url.hash = `p=${Number(localStorage.getItem("flip:page") || "1")}`;
        return url.toString();
      }

      function doShare() {
        const link = shareLink();
        if (navigator.share) navigator.share({ title: document.title, url: link }).catch(() => { });
        else navigator.clipboard?.writeText(link)
          .then(() => alert("Link copied!"))
          .catch(() => prompt("Copy this link:", link));
      }

      function doPrintCurrent() {
  const page = Number(localStorage.getItem("flip:page") || "1");
  const imgSrc = pageUrl(page);

  const w = window.open("", "_blank");
  if (!w) return;

  // Build popup HTML without any <script> tags inside strings
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

  // Now wire printing logic safely (no HTML parser edge cases)
  w.onload = () => {
    const img = w.document.getElementById("printImg");
    if (!img) return;

    img.onload = () => {
      w.focus();
      w.print();
      setTimeout(() => w.close(), 250);
    };

    // If cached and already complete, trigger manually
    if (img.complete) img.onload();
  };
}


      let tilesBuilt = false;
      function buildTilesOnce() {
        if (tilesBuilt) return;
        const grid = $("tilesGrid");
        const frag = document.createDocumentFragment();
        for (let p = 1; p <= TOTAL_PAGES; p++) {
          const d = document.createElement("div"); d.className = "tile"; d.innerHTML = `<img
  loading="lazy" src="${pageUrl(p)}" alt="Page ${p}">
  <div class="n"><span>Page</span><strong>${p}</strong></div>`;
          d.addEventListener("click", () => {
            window.__flipbook.pageFlip.flip(p - 1);
            $("tiles").classList.remove("is-open");
          });
          frag.appendChild(d);
        }
        grid.appendChild(frag);
        tilesBuilt = true;
      }

      function wireUI() {
        paintIcons();
        setZoom(zoom);

        $("btnFirst").onclick = () => window.__flipbook.pageFlip.flip(0);
        $("btnLast").onclick = () => window.__flipbook.pageFlip.flip(TOTAL_PAGES - 1);
        $("btnPrev").onclick = () => window.__flipbook.pageFlip.flipPrev();
        $("btnNext").onclick = () => window.__flipbook.pageFlip.flipNext();

        $("pageJump").addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          const n = parseInt(e.currentTarget.value, 10);
          if (Number.isFinite(n)) window.__flipbook.pageFlip.flip(Math.max(1, Math.min(TOTAL_PAGES, n)) - 1);
          e.currentTarget.blur();
        });

        $("zoomIn").onclick = () => setZoom(zoom + 0.1);
        $("zoomOut").onclick = () => setZoom(zoom - 0.1);

        $("btnTiles").onclick = () => { $("tiles").classList.toggle("is-open"); buildTilesOnce(); };
        $("tilesClose").onclick = () => $("tiles").classList.remove("is-open");

        $("btnMore").onclick = () => $("moreMenu").classList.toggle("is-open");
        document.addEventListener("click", (e) => {
          if (!e.target.closest("#btnMore") && !e.target.closest("#moreMenu")) $("moreMenu").classList.remove("is-open");
        });

        $("btnShare").onclick = doShare;
        $("btnPrint").onclick = doPrintCurrent;

        $("btnFull").onclick = () => {
          const stage = $("flipbook-stage");
          if (!document.fullscreenElement) stage.requestFullscreen?.();
          else document.exitFullscreen?.();
        };

        $("btnSearch").onclick = () => alert("Search UI next step 😈");

        $("btnSound").onclick = () => {
          soundOn = !soundOn;
          localStorage.setItem("flip:sound", soundOn ? "1" : "0");
          paintIcons();
        };
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
          showCover: false,
          mobileScrollSupport: true
        });

        pageFlip.loadFromImages(buildPages());
        window.__flipbook = { pageFlip };

        pageFlip.on("flip", (e) => {
          const human = (e.data ?? e) + 1;
          localStorage.setItem("flip:page", String(human));
        });

        pageFlip.flip(START_PAGE);
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