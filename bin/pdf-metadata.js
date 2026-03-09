#!/usr/bin/env node

import fs from "fs";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { PDFDocument } from "pdf-lib";

const rl = readline.createInterface({ input: stdin, output: stdout });

function ask(question, prefill = '') {
  return new Promise((resolve) => {
    if (prefill) {
      rl.write(prefill);
    }
    rl.question(question, (input) => resolve(input));
  });
}

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node bin/pdf-metadata.js <file.pdf>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const pdfData = fs.readFileSync(filePath);
const pdfDoc = await PDFDocument.load(pdfData);

const currentTitle = pdfDoc.getTitle() || '';
const currentSubject = pdfDoc.getSubject() || '';
const currentAuthor = pdfDoc.getAuthor() || '';
const currentCreator = pdfDoc.getCreator() || '';
const currentProducer = pdfDoc.getProducer() || '';

console.log(`\nPDF Metadata: ${filePath}`);
console.log('='.repeat(60));
console.log(`Title:    ${currentTitle || '(empty)'}`);
console.log(`Subject:  ${currentSubject || '(empty)'}`);
console.log(`Author:   ${currentAuthor || '(empty)'}`);
console.log(`Creator:  ${currentCreator || '(empty)'}`);
console.log(`Producer: ${currentProducer || '(empty)'}`);
console.log('='.repeat(60));
console.log('\nEdit fields below (press Enter to keep current value, type "-" to clear):\n');

const title = await ask('Title: ', currentTitle);
const subject = await ask('Subject: ', currentSubject);
const author = await ask('Author: ', currentAuthor);

const resolve = (input, current) => {
  const trimmed = input.trim();
  if (trimmed === '-') return '';
  if (trimmed === '') return current;
  return trimmed;
};

const newTitle = resolve(title, currentTitle);
const newSubject = resolve(subject, currentSubject);
const newAuthor = resolve(author, currentAuthor);

pdfDoc.setTitle(newTitle, { showInWindowTitleBar: true });
pdfDoc.setSubject(newSubject);
pdfDoc.setAuthor(newAuthor);
pdfDoc.setCreator('');
pdfDoc.setProducer('https://repaircameras.org');

console.log('\nUpdated metadata:');
console.log('-'.repeat(60));
console.log(`Title:    ${newTitle || '(empty)'}`);
console.log(`Subject:  ${newSubject || '(empty)'}`);
console.log(`Author:   ${newAuthor || '(empty)'}`);
console.log(`Creator:  (cleared)`);
console.log(`Producer: https://repaircameras.org`);
console.log('-'.repeat(60));

const confirm = await ask('\nSave changes? [Y/n]: ');
if (confirm.trim().toLowerCase() === 'n') {
  console.log('Cancelled.');
} else {
  const dataOut = await pdfDoc.save();
  fs.writeFileSync(filePath, dataOut);
  console.log('Saved.');
}

rl.close();
