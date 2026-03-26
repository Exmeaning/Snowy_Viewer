const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, '../web/public/sticker-maker/img');
const outputFile = path.join(__dirname, '../web/public/sticker-maker/characters.json');

// Character mapping based on folder names
const CHAR_MAP = {
    "airi": { name: "Airi", color: "#FB8AAC" },
    "akito": { name: "Akito", color: "#FF7722" },
    "an": { name: "An", color: "#00BADC" },
    "emu": { name: "Emu", color: "#FF66BB" },
    "ena": { name: "Ena", color: "#B18F6C" },
    "haruka": { name: "Haruka", color: "#99CCFF" },
    "honami": { name: "Honami", color: "#EE6666" },
    "ichika": { name: "Ichika", color: "#33AAEE" },
    "kaito": { name: "KAITO", color: "#3366CC" },
    "kanade": { name: "Kanade", color: "#BB6688" },
    "kohane": { name: "Kohane", color: "#FF6699" },
    "len": { name: "Len", color: "#FFEE11" },
    "luka": { name: "Luka", color: "#FFBBCC" },
    "mafuyu": { name: "Mafuyu", color: "#8888CC" },
    "meiko": { name: "MEIKO", color: "#DD4444" },
    "miku": { name: "Miku", color: "#33CCBB" },
    "minori": { name: "Minori", color: "#FFCCAA" },
    "mizuki": { name: "Mizuki", color: "#DDAACC" },
    "nene": { name: "Nene", color: "#33DD99" },
    "rin": { name: "Rin", color: "#FFCC11" },
    "rui": { name: "Rui", color: "#BB88EE" },
    "saki": { name: "Saki", color: "#FFDD44" },
    "shiho": { name: "Shiho", color: "#BBDD22" },
    "shizuku": { name: "Shizuku", color: "#99EEDD" },
    "touya": { name: "Toya", color: "#0077DD" }, // Folder is touya, char is toya
    "tsukasa": { name: "Tsukasa", color: "#FFBB00" }
};

// Character ID mapping (internal ID for sorting/filtering)
// Using strings to match existing json format, but we can assign based on order
const CHAR_ORDER = [
    "ichika", "saki", "honami", "shiho",
    "minori", "haruka", "airi", "shizuku",
    "kohane", "an", "akito", "touya",
    "tsukasa", "emu", "nene", "rui",
    "kanade", "mafuyu", "ena", "mizuki",
    "miku", "rin", "len", "luka", "meiko", "kaito"
];

function generateCharacters() {
    const characters = [];
    let idCounter = 1;

    // Iterate through defined order to keep consistent
    for (const folder of CHAR_ORDER) {
        const dirPath = path.join(imgDir, folder);
        if (!fs.existsSync(dirPath)) {
            console.warn(`Directory not found: ${dirPath}`);
            continue;
        }

        const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.png'));

        // Sort files numerically if possible (airi1.png, airi2.png...)
        files.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || "0");
            const numB = parseInt(b.match(/\d+/)?.[0] || "0");
            return numA - numB;
        });

        const charInfo = CHAR_MAP[folder];
        // Handle touya -> toya mapping
        const charKey = folder === "touya" ? "toya" : folder;

        for (const file of files) {
            characters.push({
                id: String(idCounter++),
                name: `${charInfo.name} ${file.replace('.png', '')}`,
                character: charKey,
                img: `${folder}/${file}`,
                color: charInfo.color,
                defaultText: {
                    text: "text",
                    x: 148,
                    y: 58,
                    r: -2,
                    s: 40
                }
            });
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(characters, null, 4));
    console.log(`Generated ${characters.length} characters in ${outputFile}`);
}

generateCharacters();
