const SITE_URL = "https://repaircameras.org";

export const data = {
  eleventyExcludeFromCollections: true,
  permalink: "/sitemap.xml",
};

function urlEntry(url, lastmod) {
  return `  <url>\n    <loc>${url}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`;
}

export function render({ collections, files }) {
  // All HTML pages (cameras, manufacturer indexes, content pages, tutorials)
  const pages = collections.all
    .filter((item) => !item.data.eleventyExcludeFromCollections)
    .filter((item) => item.url)
    .map((item) => {
      const url = `${SITE_URL}${item.url}`;
      const lastmod = item.date ? item.date.toISOString().split("T")[0] : "";
      return urlEntry(url, lastmod);
    });

  // PDF files (e.g. files["canon/canon-a-1-repair-guide"] -> /files/canon/canon-a-1-repair-guide.pdf)
  const fileEntries = Object.keys(files).map((id) =>
    urlEntry(`${SITE_URL}/files/${id}.pdf`)
  );

  const allEntries = [...pages, ...fileEntries].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries}
</urlset>`;
}
