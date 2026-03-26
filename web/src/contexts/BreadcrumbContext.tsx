"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface BreadcrumbContextType {
    /** 详情页设置的当前项名称（纯文本） */
    detailName: string | null;
    /** 详情页设置的当前项名称（React 节点，支持翻译组件等） */
    detailNode: ReactNode | null;
    /** 设置详情页名称（纯文本） */
    setDetailName: (name: string | null) => void;
    /** 设置详情页名称（React 节点） */
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

    // 路由变化时清空详情名称
    useEffect(() => {
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
