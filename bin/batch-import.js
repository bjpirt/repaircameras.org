#!/usr/bin/env node

import fs from "fs";
import path from "path";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { execSync } from "child_process";
import { PDFDocument } from "pdf-lib";

const rl = readline.createInterface({ input: stdin, output: stdout });

function ask(question, prefill = '') {
  return new Promise((resolve) => {
    if (prefill) {
      // Write the prefill text to the prompt
      rl.write(prefill);
    }
    rl.question(question, (input) => resolve(input));
  });
}

const capitalise = (s) => s && String(s[0]).toUpperCase() + String(s).slice(1);

const toSlug = (displayName) =>
  displayName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

/**
 * Read a frontmatter scalar field from a markdown file (e.g. `manufacturer: Pentax`)
 */
const readFrontmatterField = (filePath, field) => {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
};

// Get list of known manufacturers from site/cameras directory.
// Display name comes from index.md frontmatter; falls back to a slug-derived name.
const getKnownManufacturers = () => {
  const camerasDir = 'site/cameras';
  if (!fs.existsSync(camerasDir)) return [];

  return fs.readdirSync(camerasDir)
    .filter(f => {
      const stat = fs.statSync(path.join(camerasDir, f));
      return stat.isDirectory();
    })
    .map(slug => {
      const fromIndex = readFrontmatterField(path.join(camerasDir, slug, 'index.md'), 'manufacturer');
      const name = fromIndex || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        slug,
        name,
        lowerName: slug.replace(/-/g, '').toLowerCase()
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

const KNOWN_MANUFACTURERS = getKnownManufacturers();

/**
 * List existing camera models for a manufacturer, by reading frontmatter
 * `model:` fields from site/cameras/{slug}/*.md.
 */
const getExistingModels = (manufacturerName) => {
  const slug = toSlug(manufacturerName);
  const dir = path.join('site/cameras', slug);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .map(f => {
      const fromFrontmatter = readFrontmatterField(path.join(dir, f), 'model');
      return fromFrontmatter || path.parse(f).name;
    })
    .sort((a, b) => a.localeCompare(b));
};

/**
 * Try to find manufacturer name in the filename.
 *
 * Three passes, in order of confidence:
 *   1. Prefix match against the delimiter-stripped filename (e.g. `pentax-mx-...`).
 *   2. Token-level match anywhere in the filename (e.g. `Camera-Craftsman-Konica-...`).
 *   3. Fallback to the first delimiter-separated word.
 */
const findManufacturer = (filename) => {
  const lowerFilename = filename.toLowerCase().replace(/[-_\s]/g, '');

  // Special case: OM-* files are Olympus
  if (/^om[-_]/i.test(filename)) {
    return { name: 'Olympus', matchLength: 0 };
  }

  // 1. Prefix match
  for (const mfr of KNOWN_MANUFACTURERS) {
    if (lowerFilename.startsWith(mfr.lowerName)) {
      return { name: mfr.name, matchLength: mfr.lowerName.length };
    }
  }

  // 2. Token-level match anywhere in the filename
  const tokens = filename.toLowerCase().split(/[-_\s]+/).filter(Boolean);
  for (const token of tokens) {
    const cleaned = token.replace(/[^a-z0-9]/g, '');
    const mfr = KNOWN_MANUFACTURERS.find(m => m.lowerName === cleaned);
    if (mfr) {
      // matchLength = 0 signals "not at start"; findModel handles this.
      return { name: mfr.name, matchLength: 0 };
    }
  }

  // 3. Fallback: first part before delimiter
  const parts = filename.split(/[-_]/);
  if (parts.length > 0) {
    const firstPart = parts[0];
    return {
      name: firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase(),
      matchLength: firstPart.length
    };
  }

  return null;
};

/**
 * Extract model name from a filename by tokenising and filtering out
 * the manufacturer name, doc-type keywords, and publication-prefix words
 * (so e.g. `Camera-Craftsman-Konica-Autoreflex-T3` yields `Autoreflex T3`).
 */
const findModel = (filename, manufacturer /*, matchLength */) => {
  const noiseWords = new Set([
    // doc types
    'service', 'repair', 'manual', 'guide', 'parts', 'exploded',
    'diagram', 'article', 'wiring', 'list', 'sm', 'rm',
    // publication prefixes
    'camera', 'craftsman', 'ccm', 'spt', 'journal', 'issue',
  ]);

  const mfrTokens = manufacturer
    ? manufacturer.toLowerCase().split(/[\s-]+/).filter(Boolean)
    : [];

  const tokens = filename.split(/[-_\s]+/).filter(Boolean);

  const filtered = tokens.filter(t => {
    const lower = t.toLowerCase();
    if (!lower) return false;
    if (mfrTokens.includes(lower)) return false;
    if (noiseWords.has(lower)) return false;
    return true;
  });

  if (filtered.length === 0) return '';
  return filtered.join(' ').trim().replace(/\s+/g, ' ');
};

/**
 * Document type definitions.
 * - `slug`: filename suffix (overrides toSlug(display) when set)
 * - `keywords`: filename substrings that hint this type
 * - `requiresIssueDate`: prompt for "months and year" after type selection
 * - `singleCameraOnly`: this type cannot be linked to multiple cameras
 */
const DOC_TYPES = [
  { display: 'Service Manual',           keywords: ['service'] },
  { display: 'Repair Guide',             keywords: ['repair-guide', 'repair_guide'] },
  { display: 'Repair Manual',            keywords: ['repair'] },
  { display: 'Parts List',               keywords: ['parts'] },
  { display: 'Exploded Diagram',         keywords: ['exploded', 'explode'] },
  { display: 'Guide',                    keywords: ['guide'] },
  { display: 'Article',                  keywords: ['article'] },
  { display: 'Wiring Diagram',           keywords: ['wiring'] },
  { display: 'SPT Journal',              keywords: [],                  slug: 'spt-journal' },
  { display: 'SPT Journal Article',      keywords: ['spt'],             slug: 'spt-article' },
  { display: 'Camera Craftsman Article', keywords: ['ccm-article'],     slug: 'ccm-article' },
  { display: 'Camera Craftsman Issue',   keywords: ['ccm-issue'],       slug: 'ccm-issue', requiresIssueDate: true },
];

const findDocType = (display) => DOC_TYPES.find(t => t.display === display);

const docTypeSlug = (display) => {
  const t = findDocType(display);
  return t?.slug || toSlug(display);
};

/**
 * Find document type in filename. Order matters — more specific keywords
 * should be matched first. CCM Issue is checked before "article", and SPT
 * before everything else, so e.g. "spt-pentax-mx-service.pdf" detects SPT.
 */
const findDocumentType = (filename) => {
  const lowerName = filename.toLowerCase();

  // CCM Issue: filename contains "ccm" or "camera-craftsman" plus a year.
  if (/\b(ccm|camera-craftsman)\b/.test(lowerName) && /\b(19|20)\d{2}\b/.test(lowerName)) {
    return 'Camera Craftsman Issue';
  }
  if (/\b(ccm|camera-craftsman)\b/.test(lowerName)) {
    return 'Camera Craftsman Article';
  }
  // SPT Journal "issue" is full-volume — has a year. Otherwise treat as a single article.
  if (/\bspt\b/.test(lowerName) && /\b(19|20)\d{2}\b/.test(lowerName)) {
    return 'SPT Journal';
  }
  if (/\bspt\b/.test(lowerName)) {
    return 'SPT Journal Article';
  }

  for (const docType of DOC_TYPES) {
    for (const keyword of docType.keywords) {
      if (lowerName.includes(keyword)) {
        return docType.display;
      }
    }
  }

  return '';
};

/**
 * Get the next file from the incoming directory
 */
const getNextFile = (skipFiles = []) => {
  const incomingDir = 'import/incoming';

  if (!fs.existsSync(incomingDir)) {
    console.error(`Directory not found: ${incomingDir}`);
    return null;
  }

  const files = fs.readdirSync(incomingDir)
    .filter(f => f.endsWith('.pdf'))
    .filter(f => !skipFiles.includes(f))
    .sort();

  if (files.length === 0) {
    return null;
  }

  return files[0];
};

/**
 * Let user select a document type from a menu
 */
const selectDocumentType = async () => {
  const docTypes = DOC_TYPES.map(t => t.display);

  console.log('\nSelect document type:');
  docTypes.forEach((type, index) => {
    console.log(`${index + 1}. ${type}`);
  });
  console.log(`${docTypes.length + 1}. Type custom value`);
  console.log('');

  const choice = await ask('Select option: ');
  const trimmedChoice = choice.trim();

  const choiceNum = parseInt(trimmedChoice);
  if (choiceNum >= 1 && choiceNum <= docTypes.length) {
    return docTypes[choiceNum - 1];
  } else if (choiceNum === docTypes.length + 1) {
    const custom = await ask('Enter document type: ');
    return custom.trim();
  } else {
    console.log('Invalid selection.');
    return '';
  }
};

/**
 * Interactive selector: prefill detected value, accept Enter to confirm,
 * type to override, or 's' to choose from a numbered list of existing items.
 * If the typed value isn't in the list, asks before adding it as new.
 *
 * Returns the canonical name string, or '' if cancelled.
 */
const selectFromList = async (label, items, detected = '') => {
  // Only prefill if the detected value matches an existing item — otherwise
  // a bad detection forces the user to delete the prefill before typing.
  const detectedCanonical = (() => {
    if (!detected) return '';
    const detectedSlug = toSlug(detected);
    const match = items.find(item =>
      toSlug(item) === detectedSlug || item.toLowerCase() === detected.toLowerCase()
    );
    return match || '';
  })();

  while (true) {
    const answer = await ask(`${label} (Enter to accept, 's' for list): `, detectedCanonical);
    const trimmed = answer.trim();

    if (trimmed.toLowerCase() === 's') {
      if (items.length === 0) {
        console.log('  (no existing entries)');
      } else {
        console.log('');
        items.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
      }
      console.log(`  ${items.length + 1}. Add new`);
      console.log('');
      const choice = (await ask('Select: ')).trim();
      const num = parseInt(choice);
      if (num >= 1 && num <= items.length) {
        return items[num - 1];
      }
      if (num === items.length + 1) {
        const newName = (await ask('New name: ')).trim();
        if (newName) return newName;
      }
      console.log('Invalid selection.\n');
      continue;
    }

    if (!trimmed) return '';

    // Match against existing items (case-insensitive / slug equivalent)
    const match = items.find(item =>
      toSlug(item) === toSlug(trimmed) || item.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) return match;

    // New entry — confirm.
    const confirm = (await ask(`"${trimmed}" not found. Add new? [Y/n]: `)).trim().toLowerCase();
    if (confirm === '' || confirm === 'y') return trimmed;
    // else loop and re-prompt
  }
};

const selectManufacturer = async (detected = '') => {
  const names = KNOWN_MANUFACTURERS.map(m => m.name);
  return selectFromList('Manufacturer', names, detected);
};

const selectModel = async (manufacturerName, detected = '') => {
  const models = getExistingModels(manufacturerName);
  return selectFromList('Model', models, detected);
};

const MONTH_ABBR = {
  january: 'jan', february: 'feb', march: 'mar', april: 'apr', may: 'may', june: 'jun',
  july: 'jul', august: 'aug', september: 'sep', october: 'oct', november: 'nov', december: 'dec',
  jan: 'jan', feb: 'feb', mar: 'mar', apr: 'apr', jun: 'jun', jul: 'jul', aug: 'aug',
  sept: 'sep', sep: 'sep', oct: 'oct', nov: 'nov', dec: 'dec',
};

/**
 * Parse "Mar - Apr 1974" / "march-april 1974" / "mar 1974" etc into a normalised
 * slug like "mar-apr-1974" or "mar-1974". Returns '' if no year is found.
 */
const parseIssueDate = (input) => {
  if (!input) return '';
  const lower = input.toLowerCase();

  const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return '';
  const year = yearMatch[0];

  const sortedKeys = Object.keys(MONTH_ABBR).sort((a, b) => b.length - a.length);
  const monthRegex = new RegExp(`\\b(${sortedKeys.join('|')})\\b`, 'g');
  const months = [];
  for (const m of lower.matchAll(monthRegex)) {
    const abbr = MONTH_ABBR[m[1]];
    if (months[months.length - 1] !== abbr) months.push(abbr);
  }

  if (months.length === 0) return year;
  return [...months, year].join('-');
};

/**
 * Format a date slug back for display: "mar-apr-1974" -> "Mar-Apr 1974".
 */
const formatIssueDate = (slug) => {
  if (!slug) return '';
  const parts = slug.split('-');
  const year = parts[parts.length - 1];
  const months = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1));
  return months.length ? `${months.join('-')} ${year}` : year;
};

/**
 * Get default description based on file type
 */
const getDefaultDescription = (documentType, manufacturer, model) => {
  const lowerType = documentType.toLowerCase();
  if (lowerType.includes("national camera") && lowerType.includes("service")) {
    return `Service manual for the ${manufacturer} ${model} from National Camera`;
  }
  if (lowerType.includes("service")) {
    return `Service manual for the ${manufacturer} ${model}`;
  }
  if (lowerType.includes("repair") && lowerType.includes("guide")) {
    return `Repair guide for the ${manufacturer} ${model}`;
  }
  if (lowerType.includes("repair")) {
    return `Repair manual for the ${manufacturer} ${model}`;
  }
  if (lowerType.includes("explode") || lowerType.includes("exploded")) {
    return `Exploded diagrams for the ${manufacturer} ${model}`;
  }
  if (lowerType.includes("parts")) {
    return `Parts list for the ${manufacturer} ${model}`;
  }
  if (documentType === 'Camera Craftsman Article' || (lowerType.includes("ccm") && lowerType.includes("article"))) {
    return `Camera Craftsman Magazine article on the ${manufacturer} ${model}`;
  }
  if (documentType === 'SPT Journal' || documentType === 'SPT Journal Article') {
    return `SPT Journal article on the ${manufacturer} ${model}`;
  }
  if (lowerType.includes("article")) {
    return `Article on the ${manufacturer} ${model}`;
  }
  return `Document for the ${manufacturer} ${model}`;
};

/**
 * Default description when a single file covers multiple cameras.
 */
const getMultiCameraDescription = (documentType, issueDateSlug = '') => {
  if (documentType === 'Camera Craftsman Issue') {
    const formatted = formatIssueDate(issueDateSlug);
    return formatted
      ? `Camera Craftsman Magazine issue from ${formatted}`
      : `Camera Craftsman Magazine issue`;
  }
  if (documentType === 'SPT Journal' || documentType === 'SPT Journal Article') {
    return `SPT Journal article`;
  }
  return `Article`;
};

/**
 * Update PDF metadata
 */
const updateMetadata = async (filePath, fileId, description, titleOverride = null) => {
  const pdfData = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfData);

  const title = titleOverride || fileId.split("-").map(capitalise).join(" ");
  pdfDoc.setTitle(title, { showInWindowTitleBar: true });
  pdfDoc.setSubject(description);
  pdfDoc.setCreator("");
  pdfDoc.setProducer("https://repaircameras.org");

  const dataOut = await pdfDoc.save();
  fs.writeFileSync(filePath, dataOut);
};

/**
 * Create manufacturer index page
 */
const createManufacturerIndex = (name) => {
  const pageSlug = toSlug(name);

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

/**
 * Create a new camera page.
 * `fileFolder` is the storage folder under site/files (defaults to the manufacturer slug).
 */
const createCameraPage = (model, manufacturer, fileId, fileFolder = null) => {
  const manPageSlug = toSlug(manufacturer);
  const modelPageSlug = toSlug(model);
  const pageName = `site/cameras/${manPageSlug}/${modelPageSlug}.md`;
  const folder = fileFolder || manPageSlug;

  console.log(`Creating camera page for ${manufacturer} ${model}`);

  const content = `---
layout: item.11ty.tsx
tags:
  - cameras
manufacturer: ${manufacturer}
model: ${model}
relatedFiles:
  - ${folder}/${fileId}
relatedLinks:
---
`;

  fs.writeFileSync(pageName, content);
};

/**
 * Add file to existing camera page.
 * `fileFolder` is the storage folder under site/files (defaults to the manufacturer slug).
 */
const addFileToCameraPage = (model, manufacturer, fileId, fileFolder = null) => {
  const manPageSlug = toSlug(manufacturer);
  const modelPageSlug = toSlug(model);
  const pageName = `site/cameras/${manPageSlug}/${modelPageSlug}.md`;
  const folder = fileFolder || manPageSlug;
  const fullFileId = `${folder}/${fileId}`;

  console.log(`Adding file to existing camera page: ${manufacturer} ${model}`);

  // Read the camera page
  const content = fs.readFileSync(pageName, 'utf8');

  // Check if file is already listed
  if (content.includes(`- ${fullFileId}`)) {
    console.log(`⚠️  File already listed in camera page`);
    return;
  }

  // Find the relatedFiles section and add the new file
  const relatedFilesMatch = content.match(/relatedFiles:\s*\n((?:\s+-\s+.+\n)*)/);

  if (relatedFilesMatch) {
    // Add to existing relatedFiles list
    const existingList = relatedFilesMatch[0];
    const newList = existingList.trimEnd() + `\n  - ${fullFileId}\n`;
    const newContent = content.replace(existingList, newList);
    fs.writeFileSync(pageName, newContent);
  } else {
    // No relatedFiles section exists, add one before relatedLinks or at end of frontmatter
    const newRelatedFiles = `relatedFiles:\n  - ${fullFileId}\n`;

    if (content.includes('relatedLinks:')) {
      const newContent = content.replace('relatedLinks:', `${newRelatedFiles}relatedLinks:`);
      fs.writeFileSync(pageName, newContent);
    } else {
      const newContent = content.replace(/---\n$/, `${newRelatedFiles}---\n`);
      fs.writeFileSync(pageName, newContent);
    }
  }
};

/**
 * Import the file - move it to site/files and create/update camera pages.
 *
 * @param {string} filename     Source filename in import/incoming
 * @param {Array<{manufacturer: string, model: string}>} cameras   One or more camera pages to link to
 * @param {string} documentType Display name of the document type
 * @param {string} description  PDF description (subject)
 * @param {string} fileFolder   Storage folder under site/files
 * @param {string} suggestedFileId Default filename (without .pdf)
 * @param {string|null} titleOverride Optional PDF title; defaults to slug-derived
 */
const importFile = async (filename, cameras, documentType, description, fileFolder, suggestedFileId, titleOverride = null) => {
  const sourcePath = path.join('import/incoming', filename);

  let fileId = suggestedFileId;

  // Show and allow editing of the target filename
  console.log('\n' + '='.repeat(60));
  console.log('Import Preview');
  console.log('='.repeat(60));
  console.log(`Source file:  ${filename}`);
  console.log(`Folder:       site/files/${fileFolder}/`);
  console.log(`Cameras:      ${cameras.map(c => `${c.manufacturer} ${c.model}`).join(', ')}`);
  console.log('');

  const newFileId = await ask(`Target filename (without .pdf): `, fileId);
  if (newFileId.trim()) {
    fileId = newFileId.trim();
  }

  const targetDir = path.join('site/files', fileFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const targetPath = path.join(targetDir, `${fileId}.pdf`);

  // Check if file already exists
  if (fs.existsSync(targetPath)) {
    console.log(`\n⚠️  ERROR: File already exists: ${fileId}.pdf`);
    console.log('Cannot import duplicate file.\n');
    return false;
  }

  const finalTitle = titleOverride || fileId.split("-").map(capitalise).join(" ");

  // Show final import details
  console.log('\n' + '-'.repeat(60));
  console.log('Final Import Details:');
  console.log('-'.repeat(60));
  console.log(`Filename:     ${fileFolder}/${fileId}.pdf`);
  console.log(`Title:        ${finalTitle}`);
  console.log(`Description:  ${description}`);
  console.log(`Linking to:`);
  cameras.forEach(c => console.log(`  - ${c.manufacturer} ${c.model}`));
  console.log('-'.repeat(60));

  console.log('\nImporting file...');

  // Move the file
  console.log(`Moving ${filename} -> ${fileFolder}/${fileId}.pdf`);
  fs.renameSync(sourcePath, targetPath);

  // Update PDF metadata
  console.log('Updating PDF metadata...');
  await updateMetadata(targetPath, fileId, description, finalTitle);

  // For each camera: ensure manufacturer index exists, then create or update camera page.
  for (const { manufacturer, model } of cameras) {
    createManufacturerIndex(manufacturer);
    const cameraPagePath = path.join('site/cameras', toSlug(manufacturer), `${toSlug(model)}.md`);
    if (fs.existsSync(cameraPagePath)) {
      addFileToCameraPage(model, manufacturer, fileId, fileFolder);
    } else {
      createCameraPage(model, manufacturer, fileId, fileFolder);
    }
  }

  console.log(`\n✓ Import complete: ${fileFolder}/${fileId}.pdf\n`);

  // Copy commit message to clipboard
  const commitMessage = cameras.length === 1
    ? `Adding files for ${cameras[0].manufacturer} ${cameras[0].model}`
    : `Adding ${documentType}: ${fileId}`;
  try {
    execSync(`echo "${commitMessage}" | pbcopy`);
    console.log(`📋 Commit message copied to clipboard: "${commitMessage}"\n`);
  } catch (error) {
    console.log(`⚠️  Could not copy to clipboard: ${commitMessage}\n`);
  }

  // Pause before continuing
  await ask('Press Enter to continue to next file...');

  return true;
};

/**
 * Show menu for handling files
 */
const showMenu = async (filename, manufacturer, model, documentType) => {
  console.log('\n' + '='.repeat(60));
  console.log('File Actions Menu');
  console.log('='.repeat(60));
  console.log('1. Move to issues directory');
  console.log('2. Move to already-imported directory');
  console.log('3. Move to to-process directory (needs more work)');
  console.log('4. Cancel (continue with next file)');
  console.log('q. Quit');
  console.log('='.repeat(60) + '\n');

  const choice = await ask('Select option: ');
  const trimmedChoice = choice.trim().toLowerCase();

  const sourcePath = path.join('import/incoming', filename);

  switch (trimmedChoice) {
    case '1':
      // Move to issues
      const issuesPath = path.join('import/issues', filename);
      fs.renameSync(sourcePath, issuesPath);
      console.log(`\nMoved to issues: ${filename}\n`);
      return 'n'; // Continue to next file

    case '2':
      // Move to already-imported
      const importedPath = path.join('import/already-imported', filename);
      fs.renameSync(sourcePath, importedPath);
      console.log(`\nMoved to already-imported: ${filename}\n`);
      return 'n'; // Continue to next file

    case '3':
      // Move to to-process
      const toProcessDir = 'import/to-process';
      if (!fs.existsSync(toProcessDir)) {
        fs.mkdirSync(toProcessDir, { recursive: true });
      }
      const toProcessPath = path.join(toProcessDir, filename);
      fs.renameSync(sourcePath, toProcessPath);
      console.log(`\nMoved to to-process: ${filename}\n`);
      return 'n'; // Continue to next file

    case '4':
      // Cancel - just continue to next
      console.log('\nCancelled. Moving to next file.\n');
      return 'n';

    case 'q':
    case 'quit':
      return 'q';

    default:
      console.log('\nInvalid option. Please try again.\n');
      return 'm'; // Show menu again
  }
};

/**
 * Read existing relatedFiles entries from a camera page (for the "open existing file"
 * helper prompt). Returns [] if the page doesn't exist.
 */
const readRelatedFiles = (manufacturer, model) => {
  const pagePath = path.join('site/cameras', toSlug(manufacturer), `${toSlug(model)}.md`);
  if (!fs.existsSync(pagePath)) return [];
  const content = fs.readFileSync(pagePath, 'utf8');
  const match = content.match(/relatedFiles:\s*\n((?:\s+-\s+.+\n)*)/);
  if (!match || !match[1]) return [];
  return match[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^\s*-\s*/, '').trim());
};

/**
 * Decide where the file should live, what its default fileId should be, and
 * what title/description make sense, based on the (camera count, type, ccmDate).
 */
const buildImportPlan = ({ documentType, cameras, ccmDateSlug, sourceBasename }) => {
  const isMulti = cameras.length > 1;
  const typeSlug = docTypeSlug(documentType);

  if (documentType === 'Camera Craftsman Issue') {
    const dateSlug = ccmDateSlug || 'undated';
    const dateDisplay = formatIssueDate(ccmDateSlug);
    return {
      folder: 'camera-craftsman',
      fileId: `camera-craftsman-${dateSlug}`,
      title: dateDisplay
        ? `Camera Craftsman Magazine: ${dateDisplay}`
        : `Camera Craftsman Magazine`,
      description: getMultiCameraDescription(documentType, ccmDateSlug),
    };
  }

  if (isMulti) {
    // Multi-camera: pick a publication folder based on type, fall back to articles/.
    let folder = 'articles';
    let fileIdPrefix = '';
    if (documentType === 'SPT Journal' || documentType === 'SPT Journal Article') {
      folder = 'spt-journal';
      fileIdPrefix = 'spt-journal-';
    } else if (documentType === 'Camera Craftsman Article') {
      folder = 'camera-craftsman';
      fileIdPrefix = 'camera-craftsman-';
    }
    // Default fileId from source filename, slugified.
    const baseSlug = toSlug(sourceBasename).replace(/^[-_]+|[-_]+$/g, '') || 'untitled';
    const fileId = !fileIdPrefix || baseSlug.startsWith(fileIdPrefix)
      ? baseSlug
      : `${fileIdPrefix}${baseSlug}`;
    return {
      folder,
      fileId,
      title: null,
      description: getMultiCameraDescription(documentType),
    };
  }

  // Single camera: existing convention {mfr}-{model}-{type}.
  const { manufacturer, model } = cameras[0];
  return {
    folder: toSlug(manufacturer),
    fileId: `${toSlug(manufacturer)}-${toSlug(model)}-${typeSlug}`,
    title: null,
    description: getDefaultDescription(documentType, manufacturer, model),
  };
};

/**
 * Process a single file
 */
const processFile = async (filename) => {
  console.log('\n' + '='.repeat(60));
  console.log(`Processing: ${filename}`);
  console.log('='.repeat(60) + '\n');

  const filePath = path.join('import/incoming', filename);
  const baseName = path.parse(filename).name;

  // Open the file in VS Code
  try {
    console.log('Opening file in VS Code...\n');
    execSync(`code "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    console.log('Warning: Could not open file in VS Code\n');
  }

  // ---- Step 1: collect one or more (manufacturer, model) pairs ----
  const mfrMatch = findManufacturer(baseName);
  const detectedManufacturer = mfrMatch ? mfrMatch.name : '';
  const detectedModel = findModel(baseName, detectedManufacturer, mfrMatch ? mfrMatch.matchLength : 0);

  console.log('Cameras (leave manufacturer blank to open the file-actions menu)\n');

  const cameras = [];
  let isFirst = true;

  while (true) {
    const detMfr = isFirst ? detectedManufacturer : '';
    const detModel = isFirst ? detectedModel : '';

    const manufacturer = await selectManufacturer(detMfr);
    if (!manufacturer) {
      if (cameras.length === 0) {
        const answer = await ask('Press [n] for next file, [m] for menu, [q] to quit: ');
        const a = answer.trim().toLowerCase();
        if (a === 'm') return await showMenu(filename, '', '', '');
        return a;
      }
      break;
    }

    const model = await selectModel(manufacturer, detModel);
    if (!model) {
      console.log('Model required — skipping this camera.\n');
      if (cameras.length === 0) continue;
      break;
    }

    cameras.push({ manufacturer, model });

    // Show existing files for this camera (helpful context).
    const existing = readRelatedFiles(manufacturer, model);
    if (existing.length > 0) {
      console.log(`\nExisting files for ${manufacturer} ${model}:`);
      existing.forEach((f, i) => console.log(`  ${i + 1}. ${f}.pdf`));
      console.log('');
    } else {
      const pageExists = fs.existsSync(path.join('site/cameras', toSlug(manufacturer), `${toSlug(model)}.md`));
      if (!pageExists) {
        console.log(`(camera page will be created at site/cameras/${toSlug(manufacturer)}/${toSlug(model)}.md)\n`);
      }
    }

    const more = (await ask('Add another camera? [y/N]: ')).trim().toLowerCase();
    if (more !== 'y' && more !== 'yes') break;
    isFirst = false;
  }

  if (cameras.length === 0) {
    const answer = await ask('Press [n] for next file, [m] for menu, [q] to quit: ');
    const a = answer.trim().toLowerCase();
    if (a === 'm') return await showMenu(filename, '', '', '');
    return a;
  }

  // ---- Step 2: select file type ----
  const detectedDocType = findDocumentType(baseName);

  let documentType;
  if (detectedDocType) {
    const docAnswer = await ask("Document type (or 's' to select): ", detectedDocType);
    const trimmedDoc = docAnswer.trim();
    documentType = trimmedDoc.toLowerCase() === 's'
      ? await selectDocumentType()
      : trimmedDoc;
  } else {
    documentType = await selectDocumentType();
  }

  if (!documentType) {
    console.log('Document type is required. Skipping file.\n');
    const answer = await ask('Press [n] for next file, [q] to quit: ');
    return answer.trim().toLowerCase();
  }

  // ---- Step 3: extra prompt for CCM Issue (months and year) ----
  let ccmDateSlug = '';
  if (findDocType(documentType)?.requiresIssueDate) {
    const detected = parseIssueDate(baseName);
    while (!ccmDateSlug) {
      const answer = await ask('Months and year (e.g. Mar - Apr 1974): ', formatIssueDate(detected));
      ccmDateSlug = parseIssueDate(answer.trim());
      if (!ccmDateSlug) {
        console.log("Couldn't parse a year — please include a 4-digit year.\n");
      }
    }
  }

  // ---- Step 4: build defaults and confirm description ----
  const plan = buildImportPlan({
    documentType,
    cameras,
    ccmDateSlug,
    sourceBasename: baseName,
  });

  const descAnswer = await ask('Description: ', plan.description);
  const description = descAnswer.trim() || plan.description;

  console.log('');
  console.log(`Confirmed: ${cameras.map(c => `${c.manufacturer} ${c.model}`).join(', ')} — ${documentType}`);
  console.log(`Description: ${description}\n`);

  // ---- Step 5: import ----
  while (true) {
    const answer = (await ask('Proceed with import? [Y/n]: ')).trim().toLowerCase();
    const proceed = answer === '' || answer === 'y' || answer === 'yes';

    if (proceed) {
      const imported = await importFile(
        filename,
        cameras,
        documentType,
        description,
        plan.folder,
        plan.fileId,
        plan.title,
      );
      if (imported) return 'n';
      continue;
    }

    let menuAction = await showMenu(filename, cameras[0]?.manufacturer || '', cameras[0]?.model || '', documentType);
    while (menuAction === 'm') {
      menuAction = await showMenu(filename, cameras[0]?.manufacturer || '', cameras[0]?.model || '', documentType);
    }
    return menuAction;
  }
};

/**
 * Main loop
 */
const main = async () => {
  console.log('Batch Import Tool');
  console.log('=================\n');

  const incomingCount = fs.readdirSync('import/incoming').filter(f => f.endsWith('.pdf')).length;
  console.log(`Files in incoming: ${incomingCount}\n`);

  const processedFiles = [];

  while (true) {
    const nextFile = getNextFile(processedFiles);

    if (!nextFile) {
      console.log('No more files to process!');
      break;
    }

    const action = await processFile(nextFile);

    if (action === 'q' || action === 'quit') {
      console.log('\nExiting...');
      break;
    }

    // Mark this file as processed so we move to the next one
    processedFiles.push(nextFile);
  }

  rl.close();
};

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
