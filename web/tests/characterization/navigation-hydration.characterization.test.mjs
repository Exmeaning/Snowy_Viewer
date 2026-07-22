import assert from "node:assert/strict";
import test from "node:test";

import { importWebTypeScript, readWeb } from "./test-helpers.mjs";

async function importLocalizedPath(routing) {
  const dependencyKey = "__moesekaiNavigationHydrationRouting";
  globalThis[dependencyKey] = routing;
  return importWebTypeScript("src/lib/localized-path.ts", [[
    'import { DEFAULT_ROUTE_LOCALE, isRouteLocale, type RouteLocale } from "@/lib/locale-routing";',
    `const { DEFAULT_ROUTE_LOCALE, isRouteLocale } = globalThis.${dependencyKey};\ntype RouteLocale = string;`,
  ]]);
}

test("localized navigation is byte-consistent across rewritten SSR and public hydration paths", async () => {
  const routing = await importWebTypeScript("src/lib/locale-routing.ts");
  const localizedPath = await importLocalizedPath(routing);

  for (const routeLocale of routing.SUPPORTED_ROUTE_LOCALES) {
    const publicPathname = `/${routeLocale}/`;
    const contextRouteLocale = routing.uiLocaleToRouteLocale(
      routing.routeLocaleToUiLocale(routeLocale),
    );

    const serverHref = localizedPath.localizePath("/", contextRouteLocale);
    const hydratedHref = localizedPath.localizePath(
      "/",
      localizedPath.getRouteLocaleFromPathname(publicPathname),
    );
    assert.equal(serverHref, hydratedHref, `${routeLocale} home href must match`);
    assert.equal(serverHref, publicPathname);

    const serverHomeActive = localizedPath.stripRouteLocale("/") === "/";
    const hydratedHomeActive = localizedPath.stripRouteLocale(publicPathname) === "/";
    assert.equal(serverHomeActive, hydratedHomeActive, `${routeLocale} home class must match`);
  }

  const localizedLink = readWeb("src/components/LocalizedLink.tsx");
  assert.doesNotMatch(localizedLink, /usePathname/);
  assert.match(localizedLink, /const \{ locale \} = useI18n\(\)/);
  assert.match(localizedLink, /const routeLocale = uiLocaleToRouteLocale\(locale\)/);

  const sidebar = readWeb("src/components/Sidebar.tsx");
  assert.doesNotMatch(sidebar, /pathname === ["']\/["']/);
  assert.match(sidebar, /: isHome\s*\? "island-pill-active"/);
});

test("sidebar preferences, keyboard navigation, mobile close, and onboarding stay hydration-safe", () => {
  const layout = readWeb("src/components/MainLayout.tsx");
  assert.match(layout, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\)/);
  assert.match(layout, /const \[hasMounted, setHasMounted\] = useState\(false\)/);
  assert.match(layout, /useEffect\(\(\) => \{[\s\S]*sessionStorage\.getItem\("sidebar_open"\)/);

  const sidebar = readWeb("src/components/Sidebar.tsx");
  assert.match(sidebar, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(sidebar, /setFocusedIndex\(prev =>/);
  assert.match(sidebar, /window\.innerWidth < 768 \|\| screen\.width < 768/);
  assert.match(sidebar, /onClose\(\)/);

  const setupGuide = readWeb("src/components/home/SetupGuide.tsx");
  assert.match(setupGuide, /const \[mounted, setMounted\] = useState\(false\)/);
  assert.match(setupGuide, /useEffect\(\(\) => \{[\s\S]*localStorage\.getItem\(SETUP_STORAGE_KEYS\.completed\)/);
  assert.match(setupGuide, /if \(!mounted \|\| isExiting\) return null/);
});
