
import { Metadata } from "next";
import CostumesClient from "./client";

export const metadata: Metadata = {
    title: "Snowy SekaiViewer - 服装图鉴",
};

export default function CostumesPage() {
    return <CostumesClient />;
}
