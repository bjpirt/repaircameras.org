#!/usr/bin/env node

import Path from "path";
import fs from "fs";
import { execSync } from "child_process";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { PDFDocument } from "pdf-lib";

async function getDirList(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = Path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getDirList(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

const allFiles = fs
  .readdirSync("site/files")
  .filter((f) => f.endsWith(".pdf"))
  .map((f) => f.replace(".pdf", ""));

const allPages = (await getDirList("site/cameras")).map((f) => {
  return fs.readFileSync(f);
});

for (const file of allFiles) {
  if (!allPages.some((p) => p.includes(file))) {
    console.log(file);
  }
}
