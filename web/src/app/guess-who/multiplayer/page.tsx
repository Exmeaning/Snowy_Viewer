import { Metadata } from "next";
import MultiplayerClient from "./client";

export const metadata: Metadata = {
    title: "Guess Who Multiplayer",
    description: "Project Sekai character guessing multiplayer battle",
};

export default function MultiplayerPage() {
    return <MultiplayerClient />;
}
