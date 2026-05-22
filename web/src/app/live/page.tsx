import VirtualLiveContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("live");

export default function LivePage() {
    return <VirtualLiveContent />;
}
