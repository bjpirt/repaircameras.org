document.querySelectorAll("[data-gallery]").forEach((gallery) => {
  const photos = gallery.querySelectorAll("[data-gallery-photo]");
  const thumbs = gallery.querySelectorAll("[data-gallery-thumb]");

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const index = thumb.dataset.galleryThumb;
      photos.forEach((photo) => {
        photo.classList.toggle("is-active", photo.dataset.galleryPhoto === index);
      });
      thumbs.forEach((t) => {
        t.classList.toggle("is-active", t.dataset.galleryThumb === index);
        t.setAttribute("aria-pressed", String(t.dataset.galleryThumb === index));
      });
    });
  });
});
