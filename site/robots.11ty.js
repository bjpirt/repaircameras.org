export const data = {
  eleventyExcludeFromCollections: true,
  permalink: "/robots.txt",
};

export function render() {
  return `User-agent: *
Allow: /

Sitemap: https://repaircameras.org/sitemap.xml`;
}
