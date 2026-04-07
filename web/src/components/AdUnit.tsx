"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { ADSENSE_CLIENT } from "@/lib/ads";

interface AdUnitProps {
  adSlot: string;
  adLayoutKey: string;
  adClient?: string;
  className?: string;
}

export default function AdUnit({
  adSlot,
  adLayoutKey,
  adClient = ADSENSE_CLIENT,
  className = "",
}: AdUnitProps) {
  const { showAds } = useTheme();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !showAds) return;
    if (document.documentElement.dataset.showAds === "false") return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // silently ignore ad errors
    }
  }, [showAds]);

  if (!showAds) {
    return null;
  }

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle ${className}`}
      style={{ display: "block" }}
      data-ad-format="fluid"
      data-ad-layout-key={adLayoutKey}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
    />
  );
}
