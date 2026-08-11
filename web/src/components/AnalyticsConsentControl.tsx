"use client";

import { useEffect, useId, useState } from "react";

import { useI18n } from "@/contexts/I18nContext";
import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  hasAnalyticsPrivacySignal,
  isAnalyticsConsentStorageEvent,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsentChoice,
} from "@/lib/analyticsConsent";

interface AnalyticsConsentControlProps {
  accentColor?: string;
}

export default function AnalyticsConsentControl({ accentColor }: AnalyticsConsentControlProps) {
  const { t } = useI18n();
  const controlId = useId();
  const statusId = `${controlId}-status`;
  const descriptionId = `${controlId}-description`;
  const [consent, setConsent] = useState<AnalyticsConsentChoice | null>(null);
  const [privacySignal, setPrivacySignal] = useState(false);

  useEffect(() => {
    const syncConsent = () => {
      setConsent(readAnalyticsConsent());
      setPrivacySignal(hasAnalyticsPrivacySignal());
    };
    const handleStorage = (event: StorageEvent) => {
      if (isAnalyticsConsentStorageEvent(event)) syncConsent();
    };

    syncConsent();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const isGranted = consent === "granted";
  const grantBlocked = privacySignal && !isGranted;
  const statusKey = privacySignal
    ? "settings.analytics.privacySignal"
    : isGranted
      ? "settings.analytics.statusGranted"
      : "settings.analytics.statusDenied";

  const toggleConsent = () => {
    if (grantBlocked) return;
    const nextConsent = isGranted ? "denied" : "granted";
    if (writeAnalyticsConsent(nextConsent)) setConsent(nextConsent);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("settings.analytics.label")}
          </p>
          <p id={statusId} className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
            {t(statusKey)}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isGranted}
          aria-describedby={`${statusId} ${descriptionId}`}
          aria-label={t("settings.analytics.label")}
          disabled={grantBlocked}
          onClick={toggleConsent}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isGranted ? "bg-miku" : "bg-slate-200 dark:bg-slate-700"}`}
          style={isGranted && accentColor ? { backgroundColor: accentColor } : undefined}
        >
          <span
            aria-hidden="true"
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isGranted ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
      <p id={descriptionId} className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
        {t("settings.analytics.description")}
      </p>
    </div>
  );
}
