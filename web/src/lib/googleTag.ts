export const GOOGLE_TAG_MEASUREMENT_IDS: Readonly<Record<string, string>> = {
  "snowyviewer.exmeaning.com": "G-CSM858MVSF",
  "pjsk.moe": "G-T1LMSB0DNL",
};

const GOOGLE_TAG_SCRIPT_BASE = "https://www.googletagmanager.com/gtag/js?id=";

export function getGoogleTagMeasurementId(hostname: string): string | undefined {
  return GOOGLE_TAG_MEASUREMENT_IDS[hostname];
}

export function buildGoogleTagBootstrapScript(): string {
  return `
    (function() {
      var hostname = window.location.hostname;
      var measurementIds = ${JSON.stringify(GOOGLE_TAG_MEASUREMENT_IDS)};
      var measurementId = measurementIds[hostname];

      if (!measurementId || window.__moesekaiGoogleTagInitialized) {
        return;
      }

      window.__moesekaiGoogleTagInitialized = true;

      var googleTagScript = document.createElement('script');
      googleTagScript.async = true;
      googleTagScript.src = '${GOOGLE_TAG_SCRIPT_BASE}' + encodeURIComponent(measurementId);
      document.head.appendChild(googleTagScript);

      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
      };

      window.gtag('js', new Date());
      window.gtag('config', measurementId);
    })();
  `;
}
