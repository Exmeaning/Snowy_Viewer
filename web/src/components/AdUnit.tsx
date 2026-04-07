"use client";
import { useEffect, useRef } from "react";

interface AdUnitProps {
  adSlot: string;
  adLayoutKey: string;
  adClient?: string;
  className?: string;
}

export default function AdUnit({
  adSlot,
  adLayoutKey,
  adClient = "ca-pub-1417523602857305",
  className = "",
}: AdUnitProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // silently ignore ad errors
    }
  }, []);

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
