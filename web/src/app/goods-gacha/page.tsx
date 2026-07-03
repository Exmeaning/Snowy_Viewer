import fs from 'fs';
import path from 'path';
import GachaClient from './client';
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("goods_gacha");

// Define the type for our pools data
export type GachaPools = Record<string, string[]>;

async function getGachaPools(): Promise<GachaPools> {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'goods_gacha_list.json');
    const baseDomain = "https://moe.exmeaning.com";

    try {
        if (!fs.existsSync(jsonPath)) {
            console.error('Goods gacha JSON list not found:', jsonPath);
            return {};
        }

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const relativePools = JSON.parse(rawData) as GachaPools;

        // Map relative paths to absolute URLs on CDN
        const absolutePools: GachaPools = {};
        for (const [poolName, files] of Object.entries(relativePools)) {
            absolutePools[poolName] = files.map(file => `${baseDomain}${file}`);
        }
        return absolutePools;
    } catch (err) {
        console.error('Error reading gacha JSON list:', err);
    }

    return {};
}

export default async function GachaPage() {
    const pools = await getGachaPools();
    return <GachaClient pools={pools} />;
}
