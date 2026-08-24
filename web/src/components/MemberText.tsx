"use client";

import React from "react";
import ExternalLink from "@/components/ExternalLink";
import { MEMBER_LINKS } from "@/lib/team-links";

interface MemberTextProps {
    text: string | null | undefined;
    className?: string;
    linkClassName?: string;
}

export function renderMemberText(
    text: string | null | undefined,
    linkClassName: string = "text-miku hover:underline font-medium transition-colors",
): React.ReactNode {
    if (!text) return null;
    const keys = Object.keys(MEMBER_LINKS)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .sort((a, b) => b.length - a.length);
    const pattern = `(@[^\\s@、,，/|]+|${keys.join("|")})`;
    const tokens = text.split(new RegExp(pattern, "g"));
    return tokens.map((token, index) => {
        const link = MEMBER_LINKS[token] || MEMBER_LINKS[`@${token}`];
        if (link) {
            return (
                <ExternalLink
                    key={index}
                    href={link}
                    target="_blank"
                    className={linkClassName}
                >
                    {token}
                </ExternalLink>
            );
        }
        return token;
    });
}

export default function MemberText({ text, className, linkClassName }: MemberTextProps) {
    if (!text) return null;
    const content = renderMemberText(text, linkClassName);
    if (className) {
        return <span className={className}>{content}</span>;
    }
    return <>{content}</>;
}
