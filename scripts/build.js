/**
 * Vercel build script — assembles the public/ output directory.
 *
 * Steps:
 *  1. Build the admin React dashboard (outputs to <root>/admin/)
 *  2. Create public/ and copy all static storefront assets into it
 *  3. Copy the built admin dashboard into public/admin/
 *
 * Vercel serverless functions (api/) stay at the project root and are
 * discovered automatically — they must NOT live inside public/.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      copyFile(s, d);
    }
  }
}

// ── 1. Build admin dashboard ──────────────────────────────────────────────────
console.log('\n===  Building admin dashboard  ===');
run('npm --prefix admin-dashboard install');
run('npm --prefix admin-dashboard run build');
// Vite outputs to <root>/admin/ (configured in vite.config.js outDir: '../admin')

// ── 2. Create clean public/ directory ────────────────────────────────────────
console.log('\n===  Assembling public/  ===');
if (fs.existsSync(PUBLIC)) {
  fs.rmSync(PUBLIC, { recursive: true, force: true });
}
ensureDir(PUBLIC);

// File extensions to copy from the root level
const STATIC_EXTS = new Set([
  '.html', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico',
  '.mp4', '.webm', '.mov',
  '.woff', '.woff2', '.ttf', '.eot',
  '.txt', '.xml',
]);

// Root-level directories to copy into public/ verbatim
const COPY_DIRS = ['images', 'fonts', 'icons', 'assets'];

// Root-level files/dirs to never copy
const SKIP = new Set([
  'node_modules', '.git', '.github', 'backend', 'admin-dashboard',
  'admin',          // copied separately below (after the Vite build)
  'api',            // Vercel serverless functions — must stay at project root
  'scripts',        // build tooling only
  'public',         // output dir itself
  '.env', '.env.example', '.env.local',
  'package.json', 'package-lock.json',
  'vercel.json',
  'apply_clone.py', 'fetch_images.js',
  '.gitignore', '.vercelignore',
]);

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (SKIP.has(entry.name)) continue;

  const src  = path.join(ROOT, entry.name);
  const dest = path.join(PUBLIC, entry.name);

  if (entry.isDirectory()) {
    if (COPY_DIRS.includes(entry.name)) {
      console.log(`  copy dir  ${entry.name}/`);
      copyDir(src, dest);
    }
    // Other unlisted directories are skipped
  } else {
    const ext = path.extname(entry.name).toLowerCase();
    if (STATIC_EXTS.has(ext)) {
      console.log(`  copy file ${entry.name}`);
      copyFile(src, dest);
    }
  }
}

// ── 3. Copy built admin dashboard → public/admin/ ────────────────────────────
const adminSrc  = path.join(ROOT, 'admin');
const adminDest = path.join(PUBLIC, 'admin');
if (fs.existsSync(adminSrc)) {
  console.log('\n  copy dir  admin/');
  copyDir(adminSrc, adminDest);
} else {
  console.warn('\n  WARNING: admin/ directory not found — skipping');
}

// ── Done ─────────────────────────────────────────────────────────────────────
const fileCount = countFiles(PUBLIC);
console.log(`\n===  Build complete: ${fileCount} files → public/  ===\n`);

function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
}
