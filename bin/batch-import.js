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

// Get list of known manufacturers from site/cameras directory
const getKnownManufacturers = () => {
  const camerasDir = 'site/cameras';
  if (!fs.existsSync(camerasDir)) return [];

  return fs.readdirSync(camerasDir)
    .filter(f => {
      const stat = fs.statSync(path.join(camerasDir, f));
      return stat.isDirectory();
    })
    .map(name => ({
      slug: name,
      name: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      lowerName: name.replace(/-/g, '').toLowerCase()
    }));
};

const KNOWN_MANUFACTURERS = getKnownManufacturers();

/**
 * Try to find manufacturer name in the filename
 */
const findManufacturer = (filename) => {
  const lowerFilename = filename.toLowerCase().replace(/[-_\s]/g, '');

  // Special case: OM-* files are Olympus
  if (/^om[-_]/i.test(filename)) {
    return {
      name: 'Olympus',
      matchLength: 0
    };
  }

  // Try to match against known manufacturers
  for (const mfr of KNOWN_MANUFACTURERS) {
    if (lowerFilename.startsWith(mfr.lowerName)) {
      return {
        name: mfr.name,
        matchLength: mfr.lowerName.length
      };
    }
  }

  // Fallback: try first part before delimiter
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
 * Extract model name from filename after removing manufacturer and doc type
 */
const findModel = (filename, manufacturer, matchLength) => {
  let remaining = filename;

  // Remove manufacturer from beginning (if it was in the filename)
  if (manufacturer && matchLength > 0) {
    const mfrLower = manufacturer.toLowerCase().replace(/\s+/g, '');
    const fileStart = filename.toLowerCase().replace(/[-_\s]/g, '').substring(0, mfrLower.length);
    if (fileStart === mfrLower) {
      remaining = filename.substring(manufacturer.replace(/\s+/g, '').length);
    }
  }

  // Remove leading delimiters
  remaining = remaining.replace(/^[-_\s]+/, '');

  // Remove document type keywords from the end
  let modelParts = remaining.split(/[-_\s]/);

  // Filter out common document type words
  const typeWords = ['service', 'repair', 'manual', 'guide', 'parts', 'exploded',
                     'diagram', 'article', 'wiring', 'list', 'sm', 'rm'];

  modelParts = modelParts.filter(part => {
    const lower = part.toLowerCase();
    return lower && !typeWords.includes(lower);
  });

  if (modelParts.length === 0) return '';

  // Join the model parts and normalize spacing
  return modelParts.join(' ').trim().replace(/\s+/g, ' ');
};

/**
 * Find document type in filename
 */
const findDocumentType = (filename) => {
  const DOC_TYPES = [
    { keywords: ['service'], display: 'Service Manual' },
    { keywords: ['repair'], display: 'Repair Manual' },
    { keywords: ['parts'], display: 'Parts List' },
    { keywords: ['exploded', 'explode'], display: 'Exploded Diagram' },
    { keywords: ['guide'], display: 'Guide' },
    { keywords: ['article'], display: 'Article' },
    { keywords: ['wiring'], display: 'Wiring Diagram' },
  ];

  const lowerName = filename.toLowerCase();

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
  const docTypes = [
    'Service Manual',
    'Repair Manual',
    'Parts List',
    'Exploded Diagram',
    'Guide',
    'Article',
    'Wiring Diagram',
  ];

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
 * Helper function to capitalize strings
 */
const capitalise = (s) => {
  return s && String(s[0]).toUpperCase() + String(s).slice(1);
};

/**
 * Convert display name to slug (e.g., "Service Manual" -> "service-manual")
 */
const toSlug = (displayName) => displayName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

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
  if (lowerType.includes("ccm") && lowerType.includes("article")) {
    return `Camera Craftsman Magazine article on the ${manufacturer} ${model}`;
  }
  if (lowerType.includes("article")) {
    return `Article on the ${manufacturer} ${model}`;
  }
  return `Document for the ${manufacturer} ${model}`;
};

/**
 * Update PDF metadata
 */
const updateMetadata = async (filePath, fileId, manufacturer, model, description) => {
  const pdfData = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfData);

  const title = fileId.split("-").map(capitalise).join(" ");
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
 * Create a new camera page
 */
const createCameraPage = (model, manufacturer, fileId) => {
  const manPageSlug = toSlug(manufacturer);
  const modelPageSlug = toSlug(model);
  const pageName = `site/cameras/${manPageSlug}/${modelPageSlug}.md`;

  console.log(`Creating camera page for ${manufacturer} ${model}`);

  const content = `---
layout: item.11ty.tsx
tags:
  - cameras
manufacturer: ${manufacturer}
model: ${model}
relatedFiles:
  - ${manPageSlug}/${fileId}
relatedLinks:
---
`;

  fs.writeFileSync(pageName, content);
};

/**
 * Add file to existing camera page
 */
const addFileToCameraPage = (model, manufacturer, fileId) => {
  const manPageSlug = toSlug(manufacturer);
  const modelPageSlug = toSlug(model);
  const pageName = `site/cameras/${manPageSlug}/${modelPageSlug}.md`;
  const fullFileId = `${manPageSlug}/${fileId}`;

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
 * Import the file - move it to site/files and create/update camera page
 */
const importFile = async (filename, manufacturer, model, documentType, description) => {
  const sourcePath = path.join('import/incoming', filename);

  // Generate target filename and fileId
  let manSlug = toSlug(manufacturer);
  let modelSlug = toSlug(model);
  let documentTypeSlug = toSlug(documentType);
  let fileId = `${manSlug}-${modelSlug}-${documentTypeSlug}`;

  // Show and allow editing of the target filename
  console.log('\n' + '='.repeat(60));
  console.log('Import Preview');
  console.log('='.repeat(60));
  console.log(`Source file:  ${filename}`);
  console.log('');

  const newFileId = await ask(`Target filename (without .pdf): `, fileId);
  if (newFileId.trim()) {
    fileId = newFileId.trim();
  }

  const targetDir = path.join('site/files', manSlug);
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

  // Show final import details
  console.log('\n' + '-'.repeat(60));
  console.log('Final Import Details:');
  console.log('-'.repeat(60));
  console.log(`Filename:     ${fileId}.pdf`);
  console.log(`Title:        ${fileId.split("-").map(capitalise).join(" ")}`);
  console.log(`Description:  ${description}`);
  console.log('-'.repeat(60));

  const confirmAnswer = await ask('\nProceed with import? [Y/n]: ');
  const trimmedConfirm = confirmAnswer.trim().toLowerCase();
  if (trimmedConfirm && trimmedConfirm !== 'y') {
    console.log('\nImport cancelled.\n');
    return false;
  }

  console.log('\nImporting file...');

  // Move the file
  console.log(`Moving ${filename} -> ${fileId}.pdf`);
  fs.renameSync(sourcePath, targetPath);

  // Update PDF metadata
  console.log('Updating PDF metadata...');
  await updateMetadata(targetPath, fileId, manufacturer, model, description);

  // Create manufacturer index if needed
  createManufacturerIndex(manufacturer);

  // Create or update camera page
  const cameraPagePath = path.join('site/cameras', manSlug, `${modelSlug}.md`);
  if (fs.existsSync(cameraPagePath)) {
    addFileToCameraPage(model, manufacturer, fileId);
  } else {
    createCameraPage(model, manufacturer, fileId);
  }

  console.log(`\n✓ Import complete: ${fileId}.pdf\n`);

  // Copy commit message to clipboard
  const commitMessage = `Adding files for ${manufacturer} ${model}`;
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
 * Process a single file
 */
const processFile = async (filename) => {
  console.log('\n' + '='.repeat(60));
  console.log(`Processing: ${filename}`);
  console.log('='.repeat(60) + '\n');

  const filePath = path.join('import/incoming', filename);

  // Open the file in VS Code
  try {
    console.log('Opening file in VS Code...\n');
    execSync(`code "${filePath}"`, { stdio: 'ignore' });
  } catch (error) {
    console.log('Warning: Could not open file in VS Code\n');
  }

  const baseName = path.parse(filename).name;

  // Extract manufacturer
  const mfrMatch = findManufacturer(baseName);
  const detectedManufacturer = mfrMatch ? mfrMatch.name : '';

  // Ask for manufacturer confirmation
  const mfrAnswer = await ask('Manufacturer (or \'m\' for menu): ', detectedManufacturer);
  const trimmedMfr = mfrAnswer.trim();

  if (trimmedMfr.toLowerCase() === 'm') {
    return await showMenu(filename, '', '', '');
  }

  let manufacturer = trimmedMfr;

  if (!manufacturer) {
    console.log('Manufacturer is required. Skipping file.\n');
    const answer = await ask('Press [n] for next file, [m] for menu, [q] to quit: ');
    const action = answer.trim().toLowerCase();

    if (action === 'm') {
      return await showMenu(filename, '', '', '');
    }

    return action;
  }

  // Extract model
  const detectedModel = findModel(baseName, manufacturer, mfrMatch ? mfrMatch.matchLength : 0);

  // Ask for model confirmation
  const modelAnswer = await ask('Model: ', detectedModel);
  let model = modelAnswer.trim();

  if (!model) {
    console.log('Model is required. Skipping file.\n');
    const answer = await ask('Press [n] for next file, [q] to quit: ');
    return answer.trim().toLowerCase();
  }

  // Extract document type
  const detectedDocType = findDocumentType(baseName);

  // Ask for document type confirmation
  let documentType;
  if (detectedDocType) {
    const docAnswer = await ask('Document type (or \'s\' to select): ', detectedDocType);
    const trimmedDoc = docAnswer.trim();
    if (trimmedDoc.toLowerCase() === 's') {
      documentType = await selectDocumentType();
    } else {
      documentType = trimmedDoc;
    }
  } else {
    documentType = await selectDocumentType();
  }

  if (!documentType) {
    console.log('Document type is required. Skipping file.\n');
    const answer = await ask('Press [n] for next file, [q] to quit: ');
    return answer.trim().toLowerCase();
  }

  // Get and confirm description
  const defaultDescription = getDefaultDescription(documentType, manufacturer, model);
  const descAnswer = await ask('Description: ', defaultDescription);
  const description = descAnswer.trim() || defaultDescription;

  console.log(`\nConfirmed: ${manufacturer} ${model} - ${documentType}`)
  console.log(`Description: ${description}\n`);

  // Generate target filename
  const manSlug = toSlug(manufacturer);
  const modelSlug = toSlug(model);
  const targetFilename = `${manSlug}-${modelSlug}-${toSlug(documentType)}.pdf`;
  const targetPath = path.join('site/files', manSlug, targetFilename);

  // Check if file already exists
  if (fs.existsSync(targetPath)) {
    console.log(`⚠️  WARNING: File already exists: ${targetFilename}`);
    console.log('This appears to be a duplicate!\n');
  } else {
    console.log(`✓ New file: ${targetFilename}\n`);
  }

  // Check for existing files for this camera
  const cameraPagePath = path.join('site/cameras', manSlug, `${modelSlug}.md`);
  let existingFiles = [];

  if (fs.existsSync(cameraPagePath)) {
    console.log(`Camera page exists: site/cameras/${manSlug}/${modelSlug}.md`);

    // Read the camera page to find existing files
    const cameraContent = fs.readFileSync(cameraPagePath, 'utf8');
    const relatedFilesMatch = cameraContent.match(/relatedFiles:\s*\n((?:\s+-\s+.+\n)*)/);

    if (relatedFilesMatch && relatedFilesMatch[1]) {
      existingFiles = relatedFilesMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^\s*-\s*/, '').trim());

      if (existingFiles.length > 0) {
        console.log('Existing files for this camera:');
        existingFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file}.pdf`);
        });
      } else {
        console.log('No existing files for this camera.');
      }
    } else {
      console.log('No existing files for this camera.');
    }
  } else {
    console.log(`Camera page does NOT exist yet.`);
    console.log(`Will be created at: site/cameras/${manSlug}/${modelSlug}.md`);
  }
  console.log('');

  // Prompt with option to open existing files - loop until user chooses action
  let promptText = 'Press [i] to import, [n] for next file, [m] for menu';
  if (existingFiles.length > 0) {
    promptText += ', [1-' + existingFiles.length + '] to open file';
  }
  promptText += ', [q] to quit: ';

  while (true) {
    const answer = await ask(promptText);
    const action = answer.trim().toLowerCase();

    // Check if user wants to open an existing file
    const fileNum = parseInt(action);
    if (fileNum >= 1 && fileNum <= existingFiles.length) {
      const fileToOpen = existingFiles[fileNum - 1];
      const filePathToOpen = path.join('site/files', `${fileToOpen}.pdf`);
      try {
        console.log(`\nOpening: ${fileToOpen}.pdf\n`);
        execSync(`code "${filePathToOpen}"`, { stdio: 'ignore' });

        // Show the file list again and re-prompt
        console.log('Existing files for this camera:');
        existingFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file}.pdf`);
        });
        console.log('');

        // Continue the loop to prompt again
        continue;
      } catch (error) {
        console.log('Warning: Could not open file\n');
        continue;
      }
    }

    // Check if user wants to import
    if (action === 'i' || action === 'import') {
      const imported = await importFile(filename, manufacturer, model, documentType, description);
      // If import was successful or cancelled, move to next file
      // If import failed (e.g., duplicate file), show prompt again
      if (imported) {
        return 'n';
      } else {
        // Show prompt again for another action
        continue;
      }
    }

    // Check if user wants the menu
    if (action === 'm' || action === 'menu') {
      let menuAction = await showMenu(filename, manufacturer, model, documentType);

      // Handle menu actions - if 'm' is returned, show menu again
      while (menuAction === 'm') {
        menuAction = await showMenu(filename, manufacturer, model, documentType);
      }

      return menuAction;
    }

    // Any other action (n, q, etc.) - return it
    return action;
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
