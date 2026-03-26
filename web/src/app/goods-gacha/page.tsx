import { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import GachaClient from './client';

export const metadata: Metadata = {
    title: "谷子盲抽模拟",
    description: "Project Sekai 谷子盲抽模拟器",
};

// Define the type for our pools data
export type GachaPools = Record<string, string[]>;

async function getGachaPools(): Promise<GachaPools> {
    const gachaDir = path.join(process.cwd(), 'public', 'goods_gacha');
    const pools: GachaPools = {};

    try {
        if (!fs.existsSync(gachaDir)) {
            console.error('Gacha directory not found:', gachaDir);
            return {};
        }

        const entries = fs.readdirSync(gachaDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const poolName = entry.name;
                const poolPath = path.join(gachaDir, poolName);

                try {
                    const files = fs.readdirSync(poolPath);
                    // Filter for image files
                    const images = files.filter(file =>
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
                    ).map(file => `/goods_gacha/${poolName}/${file}`); // Create public URL path

                    if (images.length > 0) {
                        pools[poolName] = images;
                    }
                } catch (err) {
                    console.error(`Error reading pool directory ${poolName}:`, err);
                }
            }
        }
    } catch (err) {
        console.error('Error reading gacha directory:', err);
    }

    return pools;
}

export default async function GachaPage() {
    const pools = await getGachaPools();
    return <GachaClient pools={pools} />;
}
