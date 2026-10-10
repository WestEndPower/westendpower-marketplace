'use strict';
const fs = require('node:fs');
const path = require('node:path');

function actualPath(root, relative) {
  let current = root;
  const parts = [];
  for (const part of relative.split('/')) {
    const matches = fs.existsSync(current)
      ? fs.readdirSync(current).filter(name => name.toLowerCase() === part.toLowerCase())
      : [];
    if (matches.length > 1) throw new Error('Ambiguous image capitalization: ' + relative);
    const name = matches[0] || part;
    parts.push(name);
    current = path.join(current, name);
  }
  return parts.join('/');
}

function syncStihlImages(rows, sourceFile, root, backupDirectory) {
  const sourceRoot = path.dirname(path.dirname(sourceFile));
  const jobs = new Map();
  const missing = new Set();
  for (const row of rows) {
    let image = String(row.ImageURL || '').trim().replace(/\\/g, '/');
    row.ImageURL = image;
    if (!image || /^(?:https?:)?\/\//i.test(image)) continue;
    image = image.replace(/^\.\//, '').replace(/^brands\/stihl\//i, '');
    if (image.split('/').some(part => part === '.' || part === '..') ||
        !/^images\/(?:[A-Za-z0-9_. -]+\/)*[A-Za-z0-9_. -]+\.(?:jpe?g|png|webp|gif|svg)$/i.test(image)) {
      throw new Error('Unsupported STIHL image path: ' + image);
    }
    const actualSource = actualPath(sourceRoot, image);
    const relativeTarget = actualPath(root, 'brands/stihl/' + actualSource);
    const source = path.join(sourceRoot, actualSource);
    const target = path.join(root, relativeTarget);
    row.ImageURL = relativeTarget;
    // Missing catalog images were intentionally left for later cleanup.
    // Report them without silently changing workbook data or aborting publishing.
    if (!fs.existsSync(source)) {
      if (!fs.existsSync(target)) missing.add(relativeTarget);
      continue;
    }
    if (!fs.statSync(source).isFile()) throw new Error('Image is not a file: ' + source);
    const bytes = fs.readFileSync(source);
    if (!bytes.length) throw new Error('STIHL image is empty: ' + source);
    if (fs.existsSync(target) && fs.readFileSync(target).equals(bytes)) continue;
    const key = relativeTarget.toLowerCase();
    const existing = jobs.get(key);
    if (existing && !existing.bytes.equals(bytes)) throw new Error('Conflicting STIHL image files: ' + image);
    jobs.set(key, { target, relativeTarget, bytes });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
  const journal = [];
  try {
    for (const job of jobs.values()) {
      fs.mkdirSync(path.dirname(job.target), { recursive: true });
      const saved = path.join(backupDirectory, 'stihl-images-' + stamp, job.relativeTarget);
      const existed = fs.existsSync(job.target);
      if (existed) {
        fs.mkdirSync(path.dirname(saved), { recursive: true });
        fs.copyFileSync(job.target, saved);
      }
      journal.push({ target: job.target, saved, existed });
      fs.writeFileSync(job.target, job.bytes);
    }
  } catch (error) {
    for (const job of journal.reverse()) {
      if (job.existed) fs.copyFileSync(job.saved, job.target);
      else fs.rmSync(job.target, { force: true });
    }
    throw error;
  }
  if (missing.size) console.warn('STIHL image files still missing (not restored):\n' + [...missing].join('\n'));
  console.log('STIHL Marketplace images: ' + jobs.size + ' copied/updated; workbook links use brands/stihl/images/.');
  return jobs.size;
}

module.exports = { syncStihlImages };
