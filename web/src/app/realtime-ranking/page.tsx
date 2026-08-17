import { redirect } from "next/navigation";

interface PageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RealtimeRankingPage({ searchParams }: PageProps) {
    const sp = searchParams ? await searchParams : {};
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(sp)) {
        if (Array.isArray(val)) {
            val.forEach((v) => params.append(key, v));
        } else if (val !== undefined) {
            params.set(key, val);
        }
    }
    const query = params.toString();
    redirect(query ? `/realtime-ranking-next?${query}` : "/realtime-ranking-next");
}
