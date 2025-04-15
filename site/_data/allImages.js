import fs from "fs";
import Path from "path";
import Image from "@11ty/eleventy-img";

const images = async () => {
  const fileImages = (await fs.promises.readdir("site/_data/files")).map(
    (i) => `site/_data/files/${i}`
  );

  const linkImages = (await fs.promises.readdir("site/_data/links")).map(
    (i) => `site/_data/links/${i}`
  );

  const allImages = [...fileImages, ...linkImages].filter(
    (f) => f.endsWith(".jpg") || f.endsWith(".png")
  );
  const output = {};

  for (const file of allImages) {
    const id = Path.parse(file).name;

    output[id] = await Image(file, {
      widths: [110],
      outputDir: "_site/img/",
      filenameFormat: function (id, src, width, format) {
        // id: hash of the original image
        // src: original image path
        // width: current width in px
        // format: current file format
        return `${src.replace("site/_data/", "")}-${id}-${width}.${format}`;
      },
    });
  }
  return output;
};

export default images;
