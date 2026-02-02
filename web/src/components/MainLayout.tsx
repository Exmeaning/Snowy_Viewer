"use client";
import React from "react";
import MainNavbar from "./MainNavbar";
import MainFooter from "./MainFooter";
import ScrollToTop from "./ScrollToTop";
import SekaiLoader from "./SekaiLoader";
import BackgroundPattern from "./BackgroundPattern";

interface MainLayoutProps {
    children: React.ReactNode;
    activeNav?: string;
    showLoader?: boolean;
}

export default function MainLayout({
    children,
    activeNav = "首页",
    showLoader = false
}: MainLayoutProps) {
    return (
        <main className="min-h-screen relative overflow-x-hidden selection:bg-miku selection:text-white font-sans flex flex-col">
            {/* Loading Animation */}
            {showLoader && <SekaiLoader />}

            {/* Background Pattern */}
            <BackgroundPattern />

            {/* Navbar */}
            <MainNavbar activeItem={activeNav} />

            {/* Content */}
            <div className="flex-grow relative z-10 pt-[4.5rem]">
                {children}
            </div>

            {/* Footer */}
            <MainFooter />
            {/* Scroll To Top */}
            <ScrollToTop />

        </main>
    );
}
