"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface BreadcrumbContextType {
    /** Current detail item name set by detail pages (plain text) */
    detailName: string | null;
    /** Current detail item name set by detail pages (React node, supports translated components) */
    detailNode: ReactNode | null;
    /** Set detail page name (plain text) */
    setDetailName: (name: string | null) => void;
    /** Set detail page name (React node) */
    setDetailNode: (node: ReactNode | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
    detailName: null,
    detailNode: null,
    setDetailName: () => {},
    setDetailNode: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [detailName, setDetailName] = useState<string | null>(null);
    const [detailNode, setDetailNode] = useState<ReactNode | null>(null);

    // Clear detail names when the route changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDetailName(null);
        setDetailNode(null);
    }, [pathname]);

    const handleSetDetailName = useCallback((name: string | null) => {
        setDetailName(name);
    }, []);

    const handleSetDetailNode = useCallback((node: ReactNode | null) => {
        setDetailNode(node);
    }, []);

    return (
        <BreadcrumbContext.Provider
            value={{
                detailName,
                detailNode,
                setDetailName: handleSetDetailName,
                setDetailNode: handleSetDetailNode,
            }}
        >
            {children}
        </BreadcrumbContext.Provider>
    );
}

export function useBreadcrumb() {
    return useContext(BreadcrumbContext);
}
