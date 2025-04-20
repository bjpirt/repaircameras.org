import fs from "fs";
import Path from "path";
import Image from "@11ty/eleventy-img";

const links = async () => {
  const allLinks = (await fs.promises.readdir("site/_data/links"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => `site/_data/links/${f}`);

  const output = {};

  for (const link of allLinks) {
    console.log(link);
    const imagePath = link.replace(".json", ".jpg");
    const id = Path.parse(link).name;
    const linkData = JSON.parse(await fs.promises.readFile(link));

    linkData["thumbnail"] = await Image(imagePath, {
      widths: [110],
      outputDir: "_site/img/links",
      urlPath: "/img/links/",
      filenameFormat: function (id, src, width, format) {
        // id: hash of the original image
        // src: original image path
        // width: current width in px
        // format: current file format
        return `${src.replace("site/_data/links", "")}-${id}-${width}.${format}`;
      },
    });

    output[id] = linkData;
  }

  return output;
};

export default links;
