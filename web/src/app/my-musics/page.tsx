import MyMusicsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("my_musics");

export default function MyMusicsPage() {
    return <MyMusicsClient />;
}
