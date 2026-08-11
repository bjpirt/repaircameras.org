// Swap the cover facade for the Internet Archive reader on click, so IA's
// viewer scripts only load for readers who ask for them.
document.querySelectorAll("[data-ia-embed]").forEach((facade) => {
  facade.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    iframe.src = facade.dataset.iaEmbed;
    iframe.title = facade.dataset.iaTitle;
    iframe.className = "iaReader-embed";
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("loading", "lazy");
    facade.replaceWith(iframe);
  });
});
