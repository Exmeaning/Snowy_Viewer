export const GOOGLE_TAG_MEASUREMENT_IDS: Readonly<Record<string, string>> = {
  "snowyviewer.exmeaning.com": "G-CSM858MVSF",
  "pjsk.moe": "G-T1LMSB0DNL",
};

export function getGoogleTagMeasurementId(hostname: string): string | undefined {
  const normalized = hostname.replace(/^www\./i, "");
  return GOOGLE_TAG_MEASUREMENT_IDS[normalized] || GOOGLE_TAG_MEASUREMENT_IDS[hostname];
}

export function buildGoogleTagBootstrapScript(): string {
  return `
    (function() {
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = window.gtag || gtag;
      gtag('js', new Date());

      var rawHostname = window.location.hostname || '';
      var hostname = rawHostname.replace(/^www\\./i, '');
      var measurementIds = ${JSON.stringify(GOOGLE_TAG_MEASUREMENT_IDS)};
      var measurementId = measurementIds[hostname] || measurementIds[rawHostname];

      if (measurementId) {
        gtag('config', measurementId);

        if (!document.getElementById('moesekai-google-tag')) {
          var s = document.createElement('script');
          s.id = 'moesekai-google-tag';
          s.async = true;
          s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
          document.head.appendChild(s);
        }
      }
    })();
  `;
}
