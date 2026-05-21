import { Metadata } from "next";
import MultiplayerClient from "./client";

export const metadata: Metadata = {
    title: "Guess Jacket Multiplayer",
    description: "Project Sekai music jacket guessing multiplayer battle",
};

export default function MultiplayerPage() {
    return <MultiplayerClient />;
}
