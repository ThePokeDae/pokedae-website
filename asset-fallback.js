(() => {
  const RAW_ROOT = "https://raw.githubusercontent.com/ThePokeDae/pokedae-website/main/";
  const VERSION = "20260830-image-repair-1";

  function fallbackImage(img) {
    if (!img || img.dataset.pokedaeFallbackTried === "1") return;
    const original = img.getAttribute("src");
    if (!original || original.startsWith("data:") || original.startsWith("blob:")) return;

    let url;
    try { url = new URL(original, window.location.href); } catch { return; }
    if (url.origin !== window.location.origin) return;

    const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!path) return;

    img.dataset.pokedaeFallbackTried = "1";
    img.src = RAW_ROOT + path + "?v=" + VERSION;
  }

  document.addEventListener("error", (event) => {
    const target = event.target;
    if (target && target.tagName === "IMG") fallbackImage(target);
  }, true);

  window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("img").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) fallbackImage(img);
    });
  });
})();