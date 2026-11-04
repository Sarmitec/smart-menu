(() => {
    let saved = null;
    try { saved = localStorage.getItem("cafe-theme"); } catch {}
    const dark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = "ar";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0f172a" : "#2563eb");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", (event) => {
        let manual = null;
        try { manual = localStorage.getItem("cafe-theme"); } catch {}
        if (manual) return;
        document.documentElement.classList.toggle("dark", event.matches);
        document.documentElement.dataset.theme = event.matches ? "dark" : "light";
        if (meta) meta.setAttribute("content", event.matches ? "#0f172a" : "#2563eb");
    });
})();
