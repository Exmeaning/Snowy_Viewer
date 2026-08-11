import assert from "node:assert/strict";
import test from "node:test";

import { JSDOM } from "jsdom";
import React, { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import ts from "typescript";

import { importWebTypeScript, readWeb } from "./test-helpers.mjs";

const HYDRATION_ERROR_PATTERN = /hydrat|server rendered html|didn't match/i;
const ACTIVE_CLASS = "island-pill-active";
const TEST_ACCOUNT_STORAGE_KEY = "navigation-hydration-account";
const LocaleContext = React.createContext("zh-CN");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let moduleSequence = 0;

function stripImports(source) {
  return source
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?;\s*$/gmu, "");
}

async function importTsxComponent(relativePath, prelude) {
  moduleSequence += 1;
  const transpiled = ts.transpileModule(
    `${prelude}\n${stripImports(readWeb(relativePath))}`,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: relativePath,
      reportDiagnostics: true,
    },
  );
  const diagnostics = transpiled.diagnostics ?? [];
  assert.deepEqual(
    diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error),
    [],
    `${relativePath} must transpile for the component hydration harness`,
  );

  const encoded = Buffer.from(
    `${transpiled.outputText}\n//# sourceURL=${relativePath}-${moduleSequence}.mjs`,
  ).toString("base64");
  return (await import(`data:text/javascript;base64,${encoded}`)).default;
}

async function importLocalizedPath(routing) {
  const dependencyKey = "__moesekaiNavigationHydrationRouting";
  globalThis[dependencyKey] = routing;
  return importWebTypeScript("src/lib/localized-path.ts", [[
    'import { DEFAULT_ROUTE_LOCALE, isRouteLocale, type RouteLocale } from "@/lib/locale-routing";',
    `const { DEFAULT_ROUTE_LOCALE, isRouteLocale } = globalThis.${dependencyKey};\ntype RouteLocale = string;`,
  ]]);
}

let componentHarnessPromise;

async function getComponentHarness() {
  if (componentHarnessPromise) return componentHarnessPromise;

  componentHarnessPromise = (async () => {
    const routing = await importWebTypeScript("src/lib/locale-routing.ts");
    const localizedPath = await importLocalizedPath(routing);
    const dependencies = {
      React,
      LocaleContext,
      currentPathname: "/",
      navigationCalls: [],
      routing,
      localizedPath,
      getActiveAccount() {
        if (typeof window === "undefined") return null;
        const nickname = window.localStorage.getItem(TEST_ACCOUNT_STORAGE_KEY);
        return nickname ? { id: "test", gameId: "1", nickname } : null;
      },
      router: {
        back() {},
        push(href) {
          dependencies.navigationCalls.push({ method: "push", href });
        },
        replace(href) {
          dependencies.navigationCalls.push({ method: "replace", href });
        },
      },
    };
    globalThis.__moesekaiNavigationHydration = dependencies;

    const localizedLinkPrelude = `
      const dependencies = globalThis.__moesekaiNavigationHydration;
      const React = dependencies.React;
      const { useI18n, localizePath, Link } = dependencies;
    `;
    dependencies.useI18n = function useI18n() {
      const locale = React.useContext(LocaleContext);
      return {
        locale,
        routeLocale: routing.uiLocaleToRouteLocale(locale),
        t: (key) => key,
      };
    };
    dependencies.localizePath = localizedPath.localizePath;
    dependencies.Link = function LinkStub({ href, onClick, children, prefetch: _prefetch, ...props }) {
      const resolvedHref = typeof href === "string" ? href : href.pathname ?? "";
      return React.createElement("a", {
        ...props,
        href: resolvedHref,
        onClick(event) {
          event.preventDefault();
          onClick?.(event);
        },
      }, children);
    };
    const LocalizedLink = await importTsxComponent(
      "src/components/LocalizedLink.tsx",
      localizedLinkPrelude,
    );

    const shortcutCombos = {
      "sidebar-focus-next": ["arrowdown"],
      "sidebar-focus-prev": ["arrowup"],
      "sidebar-open-focused": ["enter"],
      "close-overlay": ["escape"],
    };
    Object.assign(dependencies, {
      Image({ unoptimized: _unoptimized, ...props }) {
        return React.createElement("img", props);
      },
      LocalizedLink,
      usePathname: () => dependencies.currentPathname,
      useRouter: () => dependencies.router,
      localizePathForBrowser: localizedPath.localizePathForBrowser,
      stripRouteLocale: localizedPath.stripRouteLocale,
      ACCOUNTS_CHANGED_EVENT: "moesekai-accounts-changed",
      getCharacterIconUrl: () => "/avatar.webp",
      getTopCharacterId: () => 21,
      getCachedAvatarUrl: () => null,
      useCardThumbnail: () => null,
      useTheme: () => ({ assetSource: "main" }),
      NAV_ITEM_LABEL_KEYS: {},
      LYRICS_ENTRY_VISIBLE: false,
      getShortcutById: (id) => ({ combos: shortcutCombos[id] ?? [] }),
      isEditableEventTarget: () => false,
      isKeyboardEventComposing: () => false,
      matchesShortcutCombo: (event, combo) => event.key.toLowerCase() === combo[0],
      parseShortcutCombos: (combos) => combos.map((combo) => [combo]),
    });
    const sidebarPrelude = `
      const dependencies = globalThis.__moesekaiNavigationHydration;
      const React = dependencies.React;
      const { useState, useEffect, useRef, useMemo } = React;
      const Image = dependencies.Image;
      const Link = dependencies.LocalizedLink;
      const {
        usePathname, useRouter, localizePathForBrowser, stripRouteLocale,
        ACCOUNTS_CHANGED_EVENT, getActiveAccount, getCharacterIconUrl,
        getTopCharacterId, getCachedAvatarUrl, useCardThumbnail, useTheme,
        useI18n, NAV_ITEM_LABEL_KEYS, LYRICS_ENTRY_VISIBLE, getShortcutById, isEditableEventTarget,
        isKeyboardEventComposing, matchesShortcutCombo, parseShortcutCombos,
      } = dependencies;
    `;
    const Sidebar = await importTsxComponent("src/components/Sidebar.tsx", sidebarPrelude);

    Object.assign(dependencies, {
      Sidebar,
      useSearchParams: () => ({ get: () => null }),
      MainNavbar: () => null,
      MainFooter: () => null,
      ScrollToTop: () => null,
      QuickFilterButton: () => null,
      SekaiLoader: () => null,
      BackgroundPattern: () => null,
      KeyboardShortcutsHelp: () => null,
      useKeyboardShortcuts: () => {},
      usePageListShortcuts: () => {},
      useMainLayoutTheme: () => ({
        useTrainedThumbnail: false,
        setUseTrainedThumbnail: () => {},
        backgroundAnimationBudget: "off",
      }),
      DetailSeoSummary: () => null,
      useDetailSeoSummary: () => null,
    });
    const mainLayoutPrelude = `
      const dependencies = globalThis.__moesekaiNavigationHydration;
      const React = dependencies.React;
      const { useState, useEffect, useCallback, useMemo, useRef, Suspense } = React;
      const { useRouter, useSearchParams, MainNavbar, Sidebar, MainFooter,
        ScrollToTop, QuickFilterButton, SekaiLoader, BackgroundPattern,
        KeyboardShortcutsHelp, useKeyboardShortcuts, usePageListShortcuts,
        localizePathForBrowser, DetailSeoSummary, useDetailSeoSummary } = dependencies;
      const useTheme = dependencies.useMainLayoutTheme;
    `;
    const MainLayout = await importTsxComponent("src/components/MainLayout.tsx", mainLayoutPrelude);

    return { dependencies, LocalizedLink, MainLayout, Sidebar };
  })();

  return componentHarnessPromise;
}

function clearDomGlobals() {
  for (const key of [
    "window",
    "document",
    "navigator",
    "screen",
    "HTMLElement",
    "Node",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "StorageEvent",
    "localStorage",
    "sessionStorage",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ]) {
    delete globalThis[key];
  }
}

function installDom(url, width = 1280) {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url });
  const { window } = dom;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window.screen, "width", { configurable: true, value: width });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);

  Object.assign(globalThis, {
    window,
    document: window.document,
    navigator: window.navigator,
    screen: window.screen,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    StorageEvent: window.StorageEvent,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
  });
  return dom;
}

function localeProvider(locale, child) {
  return React.createElement(LocaleContext.Provider, { value: locale }, child);
}

function captureHydrationErrors() {
  const consoleErrors = [];
  const recoverableErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args);
  };
  return {
    consoleErrors,
    recoverableErrors,
    restore() {
      console.error = originalConsoleError;
    },
    assertNone(label) {
      const hydrationConsoleErrors = consoleErrors.filter((args) =>
        HYDRATION_ERROR_PATTERN.test(args.map(String).join(" ")),
      );
      assert.deepEqual(hydrationConsoleErrors, [], `${label} logged hydration errors`);
      assert.deepEqual(recoverableErrors, [], `${label} reported recoverable hydration errors`);
    },
  };
}

function sidebarSnapshot(container) {
  const home = container.querySelector('aside a[data-nav-index="0"]');
  const cards = container.querySelector('aside a[data-nav-index="1"]');
  assert.ok(home);
  assert.ok(cards);
  return {
    homeHref: home.getAttribute("href"),
    homeClass: home.getAttribute("class"),
    cardsHref: cards.getAttribute("href"),
    cardsContainerClass: cards.parentElement.getAttribute("class"),
  };
}

async function hydrate(element, container, capture) {
  let root;
  await act(async () => {
    root = hydrateRoot(container, element, {
      onRecoverableError(error) {
        capture.recoverableErrors.push(error);
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
  });
  return root;
}

async function unmount(root, dom, capture) {
  await act(async () => root.unmount());
  capture.restore();
  dom.window.close();
  clearDomGlobals();
}

test("LocalizedLink and Sidebar hydrate rewritten root and nested routes without byte drift", async (t) => {
  const { dependencies, Sidebar } = await getComponentHarness();
  const scenarios = [
    { routeLocale: "zh-cn", uiLocale: "zh-CN", internalPath: "/", publicPath: "/zh-cn/", active: "home" },
    { routeLocale: "en-us", uiLocale: "en-US", internalPath: "/", publicPath: "/en-us/", active: "home" },
    { routeLocale: "zh-cn", uiLocale: "zh-CN", internalPath: "/cards/", publicPath: "/zh-cn/cards/", active: "cards" },
    { routeLocale: "en-us", uiLocale: "en-US", internalPath: "/cards/", publicPath: "/en-us/cards/", active: "cards" },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.publicPath, async () => {
      clearDomGlobals();
      dependencies.currentPathname = scenario.internalPath;
      const element = localeProvider(
        scenario.uiLocale,
        React.createElement(Sidebar, { isOpen: true, onClose: () => {}, hasMounted: true }),
      );
      const serverHtml = renderToString(element);

      const dom = installDom(`https://pjsk.moe${scenario.publicPath}`);
      const container = document.getElementById("root");
      container.innerHTML = serverHtml;
      const beforeHydration = sidebarSnapshot(container);
      assert.equal(beforeHydration.homeHref, `/${scenario.routeLocale}/`);
      assert.equal(beforeHydration.cardsHref, `/${scenario.routeLocale}/cards`);
      assert.equal(beforeHydration.homeClass.includes(ACTIVE_CLASS), scenario.active === "home");
      assert.equal(beforeHydration.cardsContainerClass.includes(ACTIVE_CLASS), scenario.active === "cards");

      dependencies.currentPathname = scenario.publicPath;
      const capture = captureHydrationErrors();
      const root = await hydrate(element, container, capture);
      assert.deepEqual(sidebarSnapshot(container), beforeHydration);
      capture.assertNone(scenario.publicPath);
      await unmount(root, dom, capture);
    });
  }
});

test("Sidebar links opt out of automatic RSC prefetch without changing localized navigation", () => {
  const sidebar = readWeb("src/components/Sidebar.tsx");
  assert.equal((sidebar.match(/prefetch=\{false\}/g) ?? []).length, 3);
  assert.doesNotMatch(readWeb("src/components/LocalizedLink.tsx"), /prefetch=\{false\}/);
});

test("post-hydration storage, keyboard navigation, and mobile close remain interactive", async () => {
  const { dependencies, Sidebar } = await getComponentHarness();
  clearDomGlobals();
  dependencies.currentPathname = "/";
  dependencies.navigationCalls.length = 0;
  const element = localeProvider(
    "zh-CN",
    React.createElement(Sidebar, { isOpen: true, onClose: () => {}, hasMounted: true }),
  );
  const serverHtml = renderToString(element);
  const dom = installDom("https://pjsk.moe/zh-cn/");
  const container = document.getElementById("root");
  container.innerHTML = serverHtml;
  dependencies.currentPathname = "/zh-cn/";
  const capture = captureHydrationErrors();
  const root = await hydrate(element, container, capture);

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  assert.match(container.querySelector('a[data-nav-index="0"]').className, /ring-2/);
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  assert.match(container.querySelector('a[data-nav-index="1"]').parentElement.className, /ring-2/);
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  assert.deepEqual(dependencies.navigationCalls.at(-1), { method: "push", href: "/zh-cn/cards" });

  await act(async () => {
    localStorage.setItem(TEST_ACCOUNT_STORAGE_KEY, "Hydrated User");
    window.dispatchEvent(new StorageEvent("storage", { key: TEST_ACCOUNT_STORAGE_KEY }));
  });
  assert.match(container.textContent, /Hydrated User/);
  capture.assertNone("desktop interactions");
  await unmount(root, dom, capture);

  let mobileCloseCount = 0;
  dependencies.currentPathname = "/cards/";
  const mobileElement = localeProvider(
    "en-US",
    React.createElement(Sidebar, {
      isOpen: true,
      onClose: () => { mobileCloseCount += 1; },
      hasMounted: true,
    }),
  );
  const mobileServerHtml = renderToString(mobileElement);
  const mobileDom = installDom("https://pjsk.moe/en-us/cards/", 390);
  const mobileContainer = document.getElementById("root");
  mobileContainer.innerHTML = mobileServerHtml;
  dependencies.currentPathname = "/en-us/cards/";
  const mobileCapture = captureHydrationErrors();
  const mobileRoot = await hydrate(mobileElement, mobileContainer, mobileCapture);
  await act(async () => {
    mobileContainer.querySelector('a[data-nav-index="1"]').dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  assert.equal(mobileCloseCount, 1);
  mobileCapture.assertNone("mobile navigation");
  await unmount(mobileRoot, mobileDom, mobileCapture);
});

test("MainLayout restores the saved sidebar preference only after hydration", async () => {
  const { dependencies, MainLayout } = await getComponentHarness();
  clearDomGlobals();
  dependencies.currentPathname = "/";
  const element = localeProvider(
    "zh-CN",
    React.createElement(MainLayout, null, React.createElement("div", null, "content")),
  );
  const serverHtml = renderToString(element);
  const dom = installDom("https://pjsk.moe/zh-cn/");
  sessionStorage.setItem("sidebar_open", "true");
  const container = document.getElementById("root");
  container.innerHTML = serverHtml;
  assert.match(container.querySelector("aside").className, /-translate-x-\[18rem\]/);
  assert.doesNotMatch(container.querySelector("aside").className, /transition-transform/);

  dependencies.currentPathname = "/zh-cn/";
  const capture = captureHydrationErrors();
  const root = await hydrate(element, container, capture);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  assert.match(container.querySelector("aside").className, /translate-x-0/);
  assert.match(container.querySelector("aside").className, /transition-transform/);
  capture.assertNone("saved sidebar preference");
  await unmount(root, dom, capture);
});
