const container = document.getElementById("viz1778342582099");
const vizElement = container?.getElementsByTagName("object")[0];

function sizeTableauViz() {
  if (!container || !vizElement) return;

  const width = container.offsetWidth;
  vizElement.style.width = "100%";

  if (width > 800) {
    vizElement.style.height = `${Math.round(width * 0.75)}px`;
  } else if (width > 500) {
    vizElement.style.height = `${Math.round(width * 0.78)}px`;
  } else {
    vizElement.style.height = "1727px";
  }
}

if (container && vizElement) {
  sizeTableauViz();

  const scriptElement = document.createElement("script");
  scriptElement.src = "https://public.tableau.com/javascripts/api/viz_v1.js";
  vizElement.parentNode.insertBefore(scriptElement, vizElement);

  window.addEventListener("resize", sizeTableauViz);
}
