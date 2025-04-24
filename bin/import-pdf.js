#!/usr/bin/env node

import Path from "path";
import fs from "fs";
import { execSync } from "child_process";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { PDFDocument } from "pdf-lib";

const rl = readline.createInterface({ input: stdin, output: stdout });

function capitalise(s) {
  return s && String(s[0]).toUpperCase() + String(s).slice(1);
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (input) => resolve(input));
  });
}

const renameFile = (filePath) => {
  const originalName = Path.parse(filePath).name;
  const lowerName = originalName.toLowerCase();
  const newFilePath = filePath.replace(originalName, lowerName);
  fs.renameSync(filePath, newFilePath);
  return newFilePath;
};

const getDescription = (fileId, manufacturer, model) => {
  if (fileId.includes("service")) {
    return `Service manual for the ${manufacturer} ${model}`;
  }
  if (fileId.includes("repair")) {
    return `Repair manual for the ${manufacturer} ${model}`;
  }
  if (fileId.includes("explode")) {
    return `Exploded diagrams for the ${manufacturer} ${model}`;
  }
  if (fileId.includes("parts")) {
    return `Parts list for the ${manufacturer} ${model}`;
  }
  return `Document for the ${manufacturer} ${model}`;
};

const updateMetadata = async (fileId, manufacturer, model) => {
  const pdfFile = `site/files/${fileId}.pdf`;

  const pdfData = fs.readFileSync(pdfFile);
  const pdfDoc = await PDFDocument.load(pdfData);

  const title = fileId.split("-").map(capitalise).join(" ");
  pdfDoc.setTitle(title, { showInWindowTitleBar: true });
  pdfDoc.setSubject(
    getDescription(fileId, capitalise(manufacturer), capitalise(model))
  );
  pdfDoc.setCreator("");
  pdfDoc.setProducer("https://repaircameras.org");

  const dataOut = await pdfDoc.save();
  fs.writeFileSync(pdfFile, dataOut);
};

const createManufacturerIndex = (name) => {
  const pageSlug = name.toLowerCase().replace(/ /g, "-");

  if (fs.existsSync(`site/cameras/${pageSlug}/index.md`)) {
    return;
  }

  console.log(`Creating manufacturer index for ${name}`);
  const content = `---
tags: manufacturers
layout: manufacturerIndex.11ty.tsx
manufacturer: ${name}
---
`;

  if (!fs.existsSync(`site/cameras/${pageSlug}/`)) {
    fs.mkdirSync(`site/cameras/${pageSlug}`);
  }
  fs.writeFileSync(`site/cameras/${pageSlug}/index.md`, content);
};

const createCameraPage = (model, manufacturer, fileId) => {
  const manPageSlug = manufacturer.toLowerCase().replace(/ /g, "-");
  const modelPageSlug = model.toLowerCase().replace(/ /g, "-");
  const pageName = `site/cameras/${manPageSlug}/${modelPageSlug}.md`;
  if (fs.existsSync(pageName)) {
    return;
  }
  console.log(`Creating camera page for ${model}`);

  const content = `---
layout: item.11ty.tsx
tags:
  - cameras
manufacturer: ${manufacturer}
model: ${model}
relatedFiles:
  - ${fileId}
relatedLinks:
---
`;

  fs.writeFileSync(pageName, content);
};

// const createCameraPage = async (id, manufacturer, cameraName) => {
//   const splitId = id.split("-");
//   let cameraName = splitId[1];
//   const pageFile = `site/cameras/${manufacturer}/${cameraName}.md`;

//   if (fs.existsSync(pageFile)) {
//     return cameraName;
//   }
//   const a1 = await ask(`Create camera page file (${cameraName}) [y/n/o] ? `);
//   switch (a1.trim()) {
//     case "y":
//       break;
//     case "n":
//       return;
//     case "o":
//       const a2 = await ask("Enter camera name: ");
//       cameraName = a2.trim();
//       break;
//   }
//   _createCameraPage(cameraName, manufacturer, id);

//   return cameraName;
// };

const checkCompression = async (fileName) => {
  const cmd = `pdfimages -list ${fileName}`;
  const output = execSync(cmd).toString();
  var imageCount = (output.match(/image/g) || []).length;
  var jpegCount = (output.match(/jpeg/g) || []).length;
  var ccittCount = (output.match(/ccitt/g) || []).length;
  console.log(
    `images: ${imageCount} | ccitt: ${ccittCount} | jpeg: ${jpegCount}`
  );
};

const createFileId = (filePath) => Path.parse(filePath).name.toLowerCase();

const getPdfProducer = async (filePath) => {
  const pdfData = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfData);

  return pdfDoc.getProducer();
};

const getNames = async (fileId) => {
  let manufacturer = capitalise(fileId.split("-")[0]);
  const a1 = await ask(`Manufacturer name (${manufacturer}) [y/n] ? `);
  switch (a1.trim()) {
    case "y":
    case "":
      break;
    case "n":
      const a2 = await ask("Enter manufacturer name: ");
      manufacturer = a2.trim();
      break;
  }

  let model = capitalise(fileId.split("-")[1]);
  const a3 = await ask(`Camera model (${model}) [y/n] ? `);
  switch (a3.trim()) {
    case "y":
    case "":
      break;
    case "n":
      const a4 = await ask("Enter camera model name: ");
      model = a4.trim();
      break;
  }

  return { manufacturer, model };
};

const getUnprocessedFiles = async () => {
  const files = fs.readdirSync("site/files/");

  return files
    .map((f) => `site/files/${f}`)
    .filter((f) => f.endsWith(".pdf"))
    .filter(
      async (f) => (await getPdfProducer(f)) !== "https://repaircameras.org"
    );
};

const processFile = async (filePath) => {
  const fileId = createFileId(filePath);
  const newFile = renameFile(filePath);
  const { manufacturer, model } = await getNames(fileId);
  await createManufacturerIndex(manufacturer);
  await createCameraPage(model, manufacturer, fileId);
  updateMetadata(fileId, manufacturer, model);
  await checkCompression(newFile);
};

// for (const file of await getUnprocessedFiles()) {
//   console.log(file);
//   console.log(await getPdfProducer(file));
//   // await processFile(file);
// }

const newFile = process.argv[2];

await processFile(newFile);

rl.close();
