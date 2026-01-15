/**
 * Snowy Screenshot Generator
 * 
 * Generates screenshots for all detail pages using Puppeteer.
 * Supports incremental updates - only generates missing screenshots.
 * 
 * Usage:
 *   node index.js
 *   node index.js --force  # Regenerate all screenshots
 * 
 * Environment Variables:
 *   WEB_URL - Base URL of the web app (default: http://localhost:3000)
 *   OUTPUT_DIR - Directory to save screenshots (default: /screenshots)
 *   CONCURRENCY - Number of parallel browser pages (default: 3)
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
    webUrl: process.env.WEB_URL || 'http://localhost:3000',
    outputDir: process.env.OUTPUT_DIR || '/screenshots',
    concurrency: parseInt(process.env.CONCURRENCY) || 3,
    masterDataUrl: 'https://sekaimaster.exmeaning.com/master',
    viewport: { width: 1200, height: 800 },
    timeout: 30000,
    waitForSelector: '.container', // Wait for main content
};

// Screenshot targets
const TARGETS = [
    {
        name: 'cards',
        dataFile: 'cards.json',
        urlTemplate: (id) => `/cards/${id}?mode=screenshot`,
        idField: 'id',
    },
    {
        name: 'events',
        dataFile: 'events.json',
        urlTemplate: (id) => `/events/${id}?mode=screenshot`,
        idField: 'id',
    },
    {
        name: 'gacha',
        dataFile: 'gachas.json',
        urlTemplate: (id) => `/gacha/${id}?mode=screenshot`,
        idField: 'id',
    },
    {
        name: 'music',
        dataFile: 'musics.json',
        urlTemplate: (id) => `/music/${id}`,
        idField: 'id',
    },
];

// Utility: Create directory if not exists
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Utility: Check if file exists
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Utility: Fetch JSON data
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return response.json();
}

// Utility: Log with timestamp
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// Generate screenshots for a single target type
async function generateScreenshots(browser, target, forceRegenerate = false) {
    const outputDir = path.join(CONFIG.outputDir, target.name);
    await ensureDir(outputDir);

    log(`Fetching ${target.name} data...`);
    const data = await fetchJson(`${CONFIG.masterDataUrl}/${target.dataFile}`);
    const ids = data.map(item => item[target.idField]);
    log(`Found ${ids.length} ${target.name} items`);

    // Get existing screenshots
    let existingIds = [];
    if (!forceRegenerate) {
        try {
            const files = await fs.readdir(outputDir);
            existingIds = files
                .filter(f => f.endsWith('.webp'))
                .map(f => parseInt(f.replace('.webp', '')));
        } catch {
            existingIds = [];
        }
    }

    // Filter to only new items
    const newIds = forceRegenerate
        ? ids
        : ids.filter(id => !existingIds.includes(id));

    if (newIds.length === 0) {
        log(`No new ${target.name} screenshots needed`);
        return { total: ids.length, generated: 0, skipped: ids.length };
    }

    log(`Generating ${newIds.length} new screenshots for ${target.name}...`);

    // Process in batches using concurrency
    let generated = 0;
    let failed = 0;

    // Create a pool of pages
    const pages = await Promise.all(
        Array(CONFIG.concurrency).fill(null).map(() => browser.newPage())
    );

    // Set viewport for all pages
    await Promise.all(pages.map(page => page.setViewport(CONFIG.viewport)));

    // Process IDs in chunks
    const processBatch = async (id, pageIndex) => {
        const page = pages[pageIndex];
        const url = `${CONFIG.webUrl}${target.urlTemplate(id)}`;
        const outputPath = path.join(outputDir, `${id}.webp`);

        try {
            await page.goto(url, {
                waitUntil: 'networkidle0',  // Wait until no network activity
                timeout: CONFIG.timeout
            });

            // Wait for content to load
            await page.waitForSelector(CONFIG.waitForSelector, { timeout: CONFIG.timeout });

            // Wait longer for all images to fully load
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    const images = document.querySelectorAll('img');
                    let loaded = 0;
                    const total = images.length;

                    if (total === 0) {
                        resolve();
                        return;
                    }

                    const checkComplete = () => {
                        loaded++;
                        if (loaded >= total) resolve();
                    };

                    images.forEach(img => {
                        if (img.complete && img.naturalHeight !== 0) {
                            checkComplete();
                        } else {
                            img.onload = checkComplete;
                            img.onerror = checkComplete;
                        }
                    });

                    // Extended timeout for large images (15 seconds)
                    setTimeout(resolve, 15000);
                });
            });

            // Additional wait to ensure rendering completes
            await new Promise(r => setTimeout(r, 2000));

            // Take screenshot
            await page.screenshot({
                path: outputPath,
                type: 'webp',
                quality: 85,
                fullPage: true,
            });

            generated++;
            if (generated % 50 === 0 || generated === newIds.length) {
                log(`${target.name}: ${generated}/${newIds.length} completed`);
            }
        } catch (err) {
            failed++;
            log(`Failed to capture ${target.name}/${id}: ${err.message}`, 'ERROR');
        }
    };

    // Process all IDs with concurrency limit
    for (let i = 0; i < newIds.length; i += CONFIG.concurrency) {
        const batch = newIds.slice(i, i + CONFIG.concurrency);
        await Promise.all(batch.map((id, index) => processBatch(id, index)));
    }

    // Close pages
    await Promise.all(pages.map(page => page.close()));

    log(`${target.name} complete: ${generated} generated, ${failed} failed`);
    return {
        total: ids.length,
        generated,
        failed,
        skipped: existingIds.length
    };
}

// Generate metadata file
async function generateMetadata(stats) {
    const metadata = {
        generatedAt: new Date().toISOString(),
        version: process.env.BUILD_VERSION || 'dev',
        stats,
    };

    await fs.writeFile(
        path.join(CONFIG.outputDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
    );

    log('Metadata file generated');
}

// Main function
async function main() {
    const startTime = Date.now();
    const forceRegenerate = process.argv.includes('--force');

    log('='.repeat(60));
    log('Snowy Screenshot Generator');
    log('='.repeat(60));
    log(`Web URL: ${CONFIG.webUrl}`);
    log(`Output: ${CONFIG.outputDir}`);
    log(`Concurrency: ${CONFIG.concurrency}`);
    log(`Force regenerate: ${forceRegenerate}`);
    log('='.repeat(60));

    // Ensure output directory exists
    await ensureDir(CONFIG.outputDir);

    // Launch browser
    log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });

    const stats = {};

    try {
        // Generate screenshots for each target
        for (const target of TARGETS) {
            log(`\nProcessing ${target.name}...`);
            stats[target.name] = await generateScreenshots(browser, target, forceRegenerate);
        }

        // Generate metadata
        await generateMetadata(stats);

    } finally {
        await browser.close();
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log('\n' + '='.repeat(60));
    log('Generation Complete!');
    log('='.repeat(60));

    for (const [name, stat] of Object.entries(stats)) {
        log(`${name.padEnd(10)}: ${stat.generated} generated, ${stat.skipped || 0} skipped, ${stat.failed || 0} failed`);
    }

    log(`Total time: ${duration}s`);
    log('='.repeat(60));
}

main().catch(err => {
    log(`Fatal error: ${err.message}`, 'ERROR');
    console.error(err);
    process.exit(1);
});
