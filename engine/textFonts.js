export async function preloadTextFonts() {
  const manifestUrl = new URL("../assets/fonts/fonts.json", import.meta.url);
  let list;
  try {
    list = await fetch(manifestUrl + "?t=" + Date.now()).then((r) => r.json());
  } catch {
    return;
  }
  if (!Array.isArray(list)) return;
  const loads = list
    .filter((e) => e && !e.system && e.src && e.family)
    .map(async (e) => {
      try {
        const fontUrl = new URL("../" + e.src, import.meta.url).href;
        const face = new FontFace(e.family, `url(${fontUrl})`);
        await face.load();
        document.fonts.add(face);
      } catch (_) {}
    });
  await Promise.all(loads);
}
