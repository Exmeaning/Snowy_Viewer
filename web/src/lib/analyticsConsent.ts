export const ANALYTICS_CONSENT_STORAGE_KEY = "moesekai_analytics_consent";
export const ANALYTICS_CONSENT_CHANGED_EVENT = "moesekai-analytics-consent-changed";

export type AnalyticsConsentChoice = "granted" | "denied";

interface PrivacyNavigator {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  msDoNotTrack?: string | null;
}

interface PrivacyWindow {
  doNotTrack?: string | null;
}

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

export function hasAnalyticsPrivacySignal(
  navigatorLike: PrivacyNavigator | undefined = typeof navigator === "undefined" ? undefined : navigator,
  windowLike: PrivacyWindow | undefined = typeof window === "undefined" ? undefined : window as unknown as PrivacyWindow,
): boolean {
  if (navigatorLike?.globalPrivacyControl === true) return true;
  return [navigatorLike?.doNotTrack, navigatorLike?.msDoNotTrack, windowLike?.doNotTrack]
    .some((value) => value === "1" || value?.toLowerCase() === "yes");
}

export function isAnalyticsAllowed(
  consent: AnalyticsConsentChoice | null,
  navigatorLike?: PrivacyNavigator,
  windowLike?: PrivacyWindow,
): boolean {
  return consent === "granted" && !hasAnalyticsPrivacySignal(navigatorLike, windowLike);
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
