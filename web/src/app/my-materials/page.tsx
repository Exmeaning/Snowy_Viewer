import MyMaterialsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("my_materials");

export default function MyMaterialsPage() {
    return <MyMaterialsClient />;
}
