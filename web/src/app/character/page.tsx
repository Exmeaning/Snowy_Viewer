
import { Metadata } from "next";
import CharacterListContent from "./client";

export const metadata: Metadata = {
    title: "角色图鉴",
    description: "浏览 Project Sekai 全部角色资料与详细信息",
};

export default function CharacterPage() {
    return <CharacterListContent />;
}
