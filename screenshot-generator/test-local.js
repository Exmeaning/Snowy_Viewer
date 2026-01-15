/**
 * Test script for generating sample screenshots locally
 * Run: node test-local.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
    webUrl: 'http://localhost:3000',
    outputDir: './test-output',
    viewport: { width: 1200, height: 800 },
};

// Test samples - one from each type
const SAMPLES = [
    { name: 'card_4star', url: '/cards/1317?mode=screenshot', file: 'card_1317_4star.png' },
    { name: 'card_3star', url: '/cards/1316?mode=screenshot', file: 'card_1316_3star.png' },
    { name: 'card_2star', url: '/cards/100?mode=screenshot', file: 'card_100_2star.png' },
    { name: 'event', url: '/events/192?mode=screenshot', file: 'event_192.png' },
    { name: 'gacha', url: '/gacha/300?mode=screenshot', file: 'gacha_300.png' },
    { name: 'music', url: '/music/1?mode=screenshot', file: 'music_1.png' },
];

async function run() {
    console.log('Creating output directory...');
    await fs.mkdir(CONFIG.outputDir, { recursive: true });

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);

    for (const sample of SAMPLES) {
        const url = `${CONFIG.webUrl}${sample.url}`;
        const outputPath = path.join(CONFIG.outputDir, sample.file);

        console.log(`\nCapturing ${sample.name}...`);
        console.log(`  URL: ${url}`);

        try {
            await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: 60000
            });

            // Wait for container
            await page.waitForSelector('.container', { timeout: 30000 });

            // Wait for all images to load
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    const images = document.querySelectorAll('img');
                    let loaded = 0;
                    const total = images.length;

                    console.log(`Found ${total} images`);

                    if (total === 0) {
                        resolve();
                        return;
                    }

                    const checkComplete = () => {
                        loaded++;
                        console.log(`Image ${loaded}/${total} loaded`);
                        if (loaded >= total) resolve();
                    };

                    images.forEach((img, i) => {
                        if (img.complete && img.naturalHeight !== 0) {
                            checkComplete();
                        } else {
                            img.onload = checkComplete;
                            img.onerror = () => {
                                console.log(`Image ${i} failed to load: ${img.src}`);
                                checkComplete();
                            };
                        }
                    });

                    // 15 second timeout
                    setTimeout(resolve, 15000);
                });
            });

            // Extra wait for rendering
            await new Promise(r => setTimeout(r, 3000));

            // Take screenshot
            await page.screenshot({
                path: outputPath,
                type: 'png',
                fullPage: true,
            });

            console.log(`  ✓ Saved to ${outputPath}`);
        } catch (err) {
            console.error(`  ✗ Failed: ${err.message}`);
        }
    }

    await browser.close();
    console.log('\n=== Done ===');
    console.log(`Screenshots saved to: ${path.resolve(CONFIG.outputDir)}`);
}

run().catch(console.error);
