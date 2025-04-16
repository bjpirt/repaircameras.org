#!/usr/bin/env node

import Path from "path";
import fs from "fs";
import { execSync } from "child_process";
import readline from "node:readline";
import { stdin, stdout } from "node:process";

const rl = readline.createInterface({ input: stdin, output: stdout });

const filePath = process.argv[2];

if (!filePath) {
  console.log("Usage: import-pdf.js <file>");
  process.exit(1);
}

const fileId = Path.parse(filePath).name;

function capitalise(s) {
  return s && String(s[0]).toUpperCase() + String(s).slice(1);
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (input) => resolve(input));
  });
}

const createThumbnail = (id) => {
  if (
    fs.existsSync(`site/_data/files/${id}.jpg`) ||
    fs.existsSync(`site/_data/files/${id}.jpg`)
  ) {
    return;
  }

  console.log("Creating thumbnail");

  const outputFile = `site/_data/files/${id}`;
  const cmd = `pdfimages -f 1 -l 1 -png -j ${filePath} ${outputFile}`;
  execSync(cmd);

  const files = fs.readdirSync("site/_data/files/");
  const thumbnailRegex = new RegExp(`${id}-\\d+\.(jpg|png)`);
  const newThumbnails = files.filter(
    (f) => (f.endsWith(".jpg") || f.endsWith(".png")) && thumbnailRegex.test(f)
  );
  if (newThumbnails.length !== 1) {
    console.log("Error: multiple thumbnails created");
  }
  const newFileEnding = newThumbnails[0].split(".").slice(-1)[0];
  fs.renameSync(
    `site/_data/files/${newThumbnails[0]}`,
    `site/_data/files/${id}.${newFileEnding}`
  );
};

const createDataFile = (id) => {
  const dataFile = `site/_data/files/${id}.json`;
  if (fs.existsSync(dataFile)) {
    return;
  }
  console.log("Creating data file");

  const splitId = id.split("-");
  const title = splitId.map(capitalise).join(" ");
  const fileType = capitalise(splitId.slice(2).join(" "));
  const description = `${fileType} for the ${capitalise(splitId[0])} ${capitalise(splitId[1])}`;
  fs.writeFileSync(dataFile, JSON.stringify({ title, description }));
};

const _createManufacturerIndex = (name) => {
  console.log(`Creating manufacturer index for ${name}`);
  const content = `---
tags: manufacturers
layout: manufacturerIndex.11ty.tsx
manufacturer: ${capitalise(name)}
---
`;
  if (!fs.existsSync(`site/cameras/${name}/`)) {
    fs.mkdirSync(`site/cameras/${name}`);
  }
  fs.writeFileSync(`site/cameras/${name}/index.md`, content);
};

const createManufacturerIndex = async (id) => {
  const splitId = id.split("-");
  let manufacturer = splitId[0];
  const indexFile = `site/cameras/${manufacturer}/index.md`;
  if (fs.existsSync(indexFile)) {
    return manufacturer;
  }
  const a1 = await ask(
    `Create manufacturer index file (${manufacturer}) [y/n/o] ? `
  );
  switch (a1.trim()) {
    case "y":
      break;
    case "n":
      return manufacturer;
    case "o":
      const a2 = ask("Enter manufacturer name: ");
      manufacturer = a2.trim();
      break;
  }
  _createManufacturerIndex(manufacturer);
  return manufacturer;
};
const _createCameraPage = (name, manufacturer, fileId) => {
  console.log(`Creating camera page for ${name}`);
  const content = `---
layout: item.11ty.tsx
tags:
  - cameras
manufacturer: ${capitalise(manufacturer)}
model: ${name}
relatedFiles:
  - ${fileId}
relatedLinks:
---
`;
  fs.writeFileSync(`site/cameras/${manufacturer}/${name}.md`, content);
};

const createCameraPage = async (id, manufacturer) => {
  const splitId = id.split("-");
  let cameraName = splitId[1];
  const pageFile = `site/cameras/${manufacturer}/${cameraName}.md`;

  if (fs.existsSync(pageFile)) {
    return;
  }
  const a1 = await ask(`Create camera page file (${cameraName}) [y/n/o] ? `);
  switch (a1.trim()) {
    case "y":
      break;
    case "n":
      return;
    case "o":
      const a2 = ask("Enter camera name: ");
      cameraName = a2.trim();
      break;
  }
  _createCameraPage(cameraName, manufacturer, id);
};

createThumbnail(fileId);
createDataFile(fileId);
const manufacturer = await createManufacturerIndex(fileId);
console.log(manufacturer);
await createCameraPage(fileId, manufacturer);

rl.close();
