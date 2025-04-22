import fs from "fs";
import Path from "path";
import { PDFDocument } from "pdf-lib";
import thumbnail from "pdf-thumbnail";
import Image from "@11ty/eleventy-img";

const exists = async (file) =>
  fs.promises
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);

const images = async () => {
  const allFiles = (await fs.promises.readdir("site/files"))
    .filter((f) => f.endsWith(".pdf"))
    .map((i) => `site/files/${i}`);

  const thumbnailDirExists = await exists("_site/img/thumbnails/");

  if (!thumbnailDirExists) {
    console.log("Creating thumbnails dir");
    await fs.promises.mkdir("_site/img/thumbnails/", { recursive: true });
  }
  const output = {};

  for (const file of allFiles) {
    const id = Path.parse(file).name;
    console.log(id);

    const screenshotPath = `_site/img/thumbnails/${id}-full.jpg`;

    const screenshotExists = await exists(screenshotPath);
    const pdfData = await fs.promises.readFile(file);
    const pdfDoc = await PDFDocument.load(pdfData);

    if (!screenshotExists) {
      await thumbnail(fs.createReadStream(file), {
        resize: {
          width: 800,
          height: 8000,
        },
      })
        .then((data) => {
          const stream = fs.createWriteStream(screenshotPath);
          data.pipe(stream);
          return new Promise((resolve) => stream.on("finish", resolve));
        })
        .then(() => {})
        .catch((err) => console.error(err));
    }

    const thumbnailImage = await Image(screenshotPath, {
      widths: [110],
      outputDir: "_site/img/thumbnails/",
      urlPath: "/img/thumbnails/",
      filenameFormat: function (id, src, width, format) {
        // id: hash of the original image
        // src: original image path
        // width: current width in px
        // format: current file format
        return `${src.replace("_site/img/thumbnails", "").replace("-full.jpg", "")}-${id}-${width}.${format}`;
      },
    });

    output[id] = {
      title: pdfDoc.getTitle(),
      description: pdfDoc.getSubject(),
      thumbnail: thumbnailImage,
    };
  }
  return output;
};

export default images;
