import fs from "fs";
import Path from "path";
import Image from "@11ty/eleventy-img";

const IA_DIR = "site/_data/ia";
const ARCHIVE_BASE = "https://archive.org";

const ia = async () => {
  const descriptors = (await fs.promises.readdir(IA_DIR))
    .filter((f) => f.endsWith(".json"))
    .map((f) => `${IA_DIR}/${f}`);

  const output = {};

  for (const descriptor of descriptors) {
    const id = Path.parse(descriptor).name;
    const imagePath = descriptor.replace(".json", ".jpg");
    const data = JSON.parse(await fs.promises.readFile(descriptor));

    const thumbnail = await Image(imagePath, {
      widths: [110],
      outputDir: "_site/img/ia",
      urlPath: "/img/ia/",
      filenameFormat: function (hash, src, width, format) {
        return `${Path.parse(src).name}-${hash}-${width}.${format}`;
      },
    });

    output[id] = {
      ...data,
      id,
      // The reader stays on the site: /files/{id}/ embeds the IA copy
      url: `/files/${id}/`,
      detailsUrl: `${ARCHIVE_BASE}/details/${data.identifier}`,
      downloadUrl: `${ARCHIVE_BASE}/download/${data.identifier}/${data.file}`,
      embedUrl: `${ARCHIVE_BASE}/embed/${data.identifier}`,
      thumbnail,
    };
  }

  return output;
};

export default ia;
