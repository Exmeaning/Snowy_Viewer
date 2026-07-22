export const GOOGLE_TAG_MEASUREMENT_IDS: Readonly<Record<string, string>> = {
  "snowyviewer.exmeaning.com": "G-CSM858MVSF",
  "pjsk.moe": "G-T1LMSB0DNL",
};

export function getGoogleTagMeasurementId(hostname: string): string | undefined {
  return GOOGLE_TAG_MEASUREMENT_IDS[hostname];
}
