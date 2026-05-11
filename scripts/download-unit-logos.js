/**
 * Download unit outline logos from sekai.best
 * Saves them to web/public/images/unit-logos/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Unit codes for all 6 units
const UNIT_CODES = [
    'light_sound',
    'idol',
    'street',
    'theme_park',
    'school_refusal',
    'piapro'
];

// Servers to download from
const SERVERS = ['jp', 'cn'];

const OUTPUT_DIR = path.join(__dirname, '../web/public/images/unit-logos');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Download a file from URL
 */
function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => { }); // Delete partial file
            reject(err);
        });
    });
}

/**
 * Main download function
 */
async function downloadLogos() {
    console.log('Starting unit logo download...\n');

    let successCount = 0;
    let failCount = 0;

    for (const server of SERVERS) {
        console.log(`\n=== Downloading ${server.toUpperCase()} logos ===`);
        
        for (const unitCode of UNIT_CODES) {
            const url = `https://sekai.best/images/${server}/logol_outline/logo_${unitCode}.png`;
            const filename = `logo_${unitCode}_${server}.png`;
            const outputPath = path.join(OUTPUT_DIR, filename);

            try {
                console.log(`Downloading: ${filename}...`);
                await downloadFile(url, outputPath);
                console.log(`✓ Success: ${filename}`);
                successCount++;
            } catch (error) {
                console.error(`✗ Failed: ${filename} - ${error.message}`);
                failCount++;
            }
        }
    }

    console.log('\n=== Download Summary ===');
    console.log(`Total: ${successCount + failCount}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`\nLogos saved to: ${OUTPUT_DIR}`);
}

// Run the download
downloadLogos().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
