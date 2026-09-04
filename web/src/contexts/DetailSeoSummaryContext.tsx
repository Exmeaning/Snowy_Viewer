"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface DetailSeoSemanticPayload {
    kind: string;
    data: unknown;
}

export interface DetailSeoSummaryValue {
    title: string;
    description: string;
    semantic?: DetailSeoSemanticPayload;
}

const DetailSeoSummaryContext = createContext<DetailSeoSummaryValue | null>(null);

export function DetailSeoSummaryProvider({
    summary,
    children,
}: {
    summary: DetailSeoSummaryValue | null;
    children?: ReactNode;
}) {
    return (
        <DetailSeoSummaryContext.Provider value={summary}>
            {children}
        </DetailSeoSummaryContext.Provider>
    );
}

export function useDetailSeoSummary() {
    return useContext(DetailSeoSummaryContext);
}
