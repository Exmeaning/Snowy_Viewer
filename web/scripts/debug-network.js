
const urls = [
    "https://sekaimaster.exmeaning.com/master/events.json",
    "https://raw.githubusercontent.com/Exmeaning/haruki-sekai-master/main/master/events.json"
];

async function test() {
    for (const url of urls) {
        console.log(`Testing ${url}...`);
        try {
            const start = Date.now();
            const res = await fetch(url);
            const time = Date.now() - start;
            if (res.ok) {
                console.log(`[OK] Status: ${res.status}, Time: ${time}ms`);
            } else {
                console.error(`[FAIL] Status: ${res.status}`);
            }
        } catch (e) {
            console.error(`[ERROR] ${e.message}`);
        }
        console.log("-".repeat(20));
    }
}

test();
