export const ANALYTICS_CONSENT_STORAGE_KEY = "moesekai_analytics_consent";
export const ANALYTICS_CONSENT_CHANGED_EVENT = "moesekai-analytics-consent-changed";

export type AnalyticsConsentChoice = "granted" | "denied";

export function readAnalyticsConsent(
  storage: Pick<Storage, "getItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage,
): AnalyticsConsentChoice | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function isAnalyticsAllowed(consent: AnalyticsConsentChoice | null): boolean {
  // Default on for this non-profit fan site. Only an explicit opt-out disables the tag.
  return consent !== "denied";
}

export function isAnalyticsConsentStorageEvent(event: Pick<StorageEvent, "key">): boolean {
  return event.key === null || event.key === ANALYTICS_CONSENT_STORAGE_KEY;
}

export function writeAnalyticsConsent(consent: AnalyticsConsentChoice): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
  return true;
}
