/**
 * Exercise Image Processor
 *
 * Downloads exercise photos from free-exercise-db, processes them into
 * minimal silhouette-style PNGs:
 * - Removes white background (transparent)
 * - Converts to grayscale
 * - High contrast for clean silhouette look
 * - Exports as compact PNGs
 *
 * Usage: node scripts/process-exercise-images.js
 * Output: assets/exercises/{exercise-id}/0.png, 1.png
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'exercises');
const IMAGE_SIZE = 400; // px, square

// Import the exercise map (read the TS file as text and parse)
const exerciseImagesPath = path.join(__dirname, '..', 'lib', 'exercise-images.ts');
const fileContent = fs.readFileSync(exerciseImagesPath, 'utf-8');

// Extract exercise IDs from the map
const idRegex = /:\s*'([^']+)'/g;
const exerciseIds = new Set();
let match;
while ((match = idRegex.exec(fileContent)) !== null) {
  if (match[1] && !match[1].includes('//')) {
    exerciseIds.add(match[1]);
  }
}

console.log(`Found ${exerciseIds.size} exercise IDs to process\n`);

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function processImage(inputBuffer) {
  // Step 1: Resize to square
  let img = sharp(inputBuffer)
    .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } });

  // Step 2: Convert to grayscale
  img = img.grayscale();

  // Step 3: Increase contrast via linear transform (multiply + offset)
  // This pushes darks darker and lights lighter
  img = img.linear(1.6, -60);

  // Step 4: Remove white-ish background by making near-white pixels transparent
  // Convert to raw, process pixels, output as PNG
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  const pixels = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const gray = data[i]; // grayscale = 1 channel
    // Threshold: if pixel is very light (background), make transparent
    const isBackground = gray > 210;
    pixels[i * 4] = gray;     // R
    pixels[i * 4 + 1] = gray; // G
    pixels[i * 4 + 2] = gray; // B
    pixels[i * 4 + 3] = isBackground ? 0 : 255; // A
  }

  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();
}

async function processExercise(exerciseId) {
  const outDir = path.join(OUTPUT_DIR, exerciseId);

  // Skip if already processed
  if (fs.existsSync(path.join(outDir, '0.png')) && fs.existsSync(path.join(outDir, '1.png'))) {
    return 'skipped';
  }

  fs.mkdirSync(outDir, { recursive: true });

  for (const frame of [0, 1]) {
    const url = `${BASE_URL}/${exerciseId}/${frame}.jpg`;
    try {
      const raw = await downloadImage(url);
      const processed = await processImage(raw);
      fs.writeFileSync(path.join(outDir, `${frame}.png`), processed);
    } catch (err) {
      console.error(`  Failed ${exerciseId}/${frame}: ${err.message}`);
      return 'failed';
    }
  }

  return 'done';
}

async function main() {
  const ids = Array.from(exerciseIds);
  let done = 0, skipped = 0, failed = 0;

  // Process in batches of 5 to avoid overwhelming network
  for (let i = 0; i < ids.length; i += 5) {
    const batch = ids.slice(i, i + 5);
    const results = await Promise.all(batch.map(processExercise));

    for (const r of results) {
      if (r === 'done') done++;
      else if (r === 'skipped') skipped++;
      else failed++;
    }

    process.stdout.write(`\rProcessed ${i + batch.length}/${ids.length} (${done} new, ${skipped} skipped, ${failed} failed)`);
  }

  console.log('\n\nDone!');
  console.log(`Output: ${OUTPUT_DIR}`);

  // Calculate total size
  let totalSize = 0;
  for (const id of ids) {
    for (const frame of ['0.png', '1.png']) {
      const p = path.join(OUTPUT_DIR, id, frame);
      if (fs.existsSync(p)) totalSize += fs.statSync(p).size;
    }
  }
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
