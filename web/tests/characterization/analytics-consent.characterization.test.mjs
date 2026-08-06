import assert from "node:assert/strict";
import test from "node:test";

import { JSDOM } from "jsdom";
import React, { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import ts from "typescript";

import { importWebTypeScript, readWeb } from "./test-helpers.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function importGoogleTagBootstrap(dependencies) {
  const source = readWeb("src/components/GoogleTagBootstrap.tsx")
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?;\s*$/gmu, "");
  const prelude = `
    const dependencies = globalThis.__analyticsConsentRuntime;
    const { React, ANALYTICS_CONSENT_CHANGED_EVENT, isAnalyticsConsentStorageEvent,
      isAnalyticsAllowed, readAnalyticsConsent, getGoogleTagMeasurementId } = dependencies;
    const { useEffect } = React;
  `;
  const transpiled = ts.transpileModule(`${prelude}\n${source}`, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "src/components/GoogleTagBootstrap.tsx",
    reportDiagnostics: true,
  });
  assert.deepEqual(
    (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error),
    [],
  );
  globalThis.__analyticsConsentRuntime = { React, ...dependencies };
  const encoded = Buffer.from(transpiled.outputText).toString("base64");
  return (await import(`data:text/javascript;base64,${encoded}`)).default;
}

async function withAnalyticsDom({ consent = null, globalPrivacyControl = false } = {}, callback) {
  const dom = new JSDOM("<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>", {
    url: "https://pjsk.moe/en-us/",
  });
  const previousGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    Event: globalThis.Event,
    StorageEvent: globalThis.StorageEvent,
  };
  const previousNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(dom.window.navigator, "globalPrivacyControl", {
    configurable: true,
    value: globalPrivacyControl,
  });
  if (consent) dom.window.localStorage.setItem("moesekai_analytics_consent", consent);
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Event: dom.window.Event,
    StorageEvent: dom.window.StorageEvent,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });

  let root;
  try {
    root = await callback(dom);
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of Object.entries(previousGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
    if (previousNavigatorDescriptor) Object.defineProperty(globalThis, "navigator", previousNavigatorDescriptor);
    else delete globalThis.navigator;
    delete globalThis.__analyticsConsentRuntime;
  }
}

test("analytics consent defaults off and honors GPC and Do Not Track", async () => {
  const consent = await importWebTypeScript("src/lib/analyticsConsent.ts");
  const storage = {
    getItem: () => null,
  };

  assert.equal(consent.readAnalyticsConsent(storage), null);
  assert.equal(consent.isAnalyticsAllowed(null, {}, {}), false);
  assert.equal(consent.isAnalyticsAllowed("granted", { globalPrivacyControl: true }, {}), false);
  assert.equal(consent.isAnalyticsAllowed("granted", { doNotTrack: "1" }, {}), false);
  assert.equal(consent.isAnalyticsAllowed("granted", { msDoNotTrack: "yes" }, {}), false);
  assert.equal(consent.isAnalyticsAllowed("granted", {}, { doNotTrack: "1" }), false);
  assert.equal(consent.isAnalyticsAllowed("granted", {}, {}), true);
  assert.equal(consent.isAnalyticsConsentStorageEvent({ key: consent.ANALYTICS_CONSENT_STORAGE_KEY }), true);
  assert.equal(consent.isAnalyticsConsentStorageEvent({ key: null }), true);
  assert.equal(consent.isAnalyticsConsentStorageEvent({ key: "unrelated" }), false);
});

test("GoogleTagBootstrap loads once after grant and disables/removes it on revoke", async () => {
  const consent = await importWebTypeScript("src/lib/analyticsConsent.ts");
  await withAnalyticsDom({}, async () => {
    const GoogleTagBootstrap = await importGoogleTagBootstrap({
      ...consent,
      getGoogleTagMeasurementId: () => "G-TEST",
    });
    const element = React.createElement(GoogleTagBootstrap);
    const container = document.getElementById("root");
    container.innerHTML = renderToString(element);
    let root;
    await act(async () => {
      root = hydrateRoot(container, element);
    });

    assert.equal(document.getElementById("moesekai-google-tag"), null, "default deny must not load Google");
    await act(async () => {
      assert.equal(consent.writeAnalyticsConsent("granted"), true);
    });
    const script = document.getElementById("moesekai-google-tag");
    assert.ok(script);
    assert.match(script.src, /googletagmanager\.com\/gtag\/js\?id=G-TEST/);
    assert.equal(window.__moesekaiGoogleTagInitialized, true);

    await act(async () => {
      consent.writeAnalyticsConsent("granted");
    });
    assert.equal(document.querySelectorAll("#moesekai-google-tag").length, 1, "repeated grant must not duplicate the loader");

    document.cookie = "_ga=test; Path=/";
    await act(async () => {
      consent.writeAnalyticsConsent("denied");
    });
    assert.equal(document.getElementById("moesekai-google-tag"), null);
    assert.equal(window.__moesekaiGoogleTagInitialized, false);
    assert.equal(window["ga-disable-G-TEST"], true);
    assert.doesNotMatch(document.cookie, /_ga=/);

    await act(async () => {
      consent.writeAnalyticsConsent("granted");
    });
    assert.ok(document.getElementById("moesekai-google-tag"));
    await act(async () => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    assert.equal(document.getElementById("moesekai-google-tag"), null, "cross-tab storage clear must revoke consent");
    assert.equal(window["ga-disable-G-TEST"], true);
    return root;
  });
});

test("saved grant cannot override Global Privacy Control", async () => {
  const consent = await importWebTypeScript("src/lib/analyticsConsent.ts");
  await withAnalyticsDom({ consent: "granted", globalPrivacyControl: true }, async () => {
    const GoogleTagBootstrap = await importGoogleTagBootstrap({
      ...consent,
      getGoogleTagMeasurementId: () => "G-TEST",
    });
    const element = React.createElement(GoogleTagBootstrap);
    const container = document.getElementById("root");
    let root;
    await act(async () => {
      root = hydrateRoot(container, element);
    });
    assert.equal(document.getElementById("moesekai-google-tag"), null);
    assert.equal(window["ga-disable-G-TEST"], true);
    return root;
  });
});

test("tabbed settings and onboarding expose one localized consent control while retaining overlay shortcuts", () => {
  const settings = readWeb("src/components/SettingsPanel.tsx");
  const setup = readWeb("src/components/home/SetupGuide.tsx");
  const control = readWeb("src/components/AnalyticsConsentControl.tsx");
  assert.equal((settings.match(/<AnalyticsConsentControl \/>/g) ?? []).length, 1);
  assert.match(settings, /type SettingsTab = "visual" \| "content" \| "data" \| "about"/);
  assert.match(settings, /activeTab === "content"/);
  assert.match(settings, /settings\.analytics\.sectionTitle/);
  assert.match(settings, /matchesShortcutCombo\(event, SETTINGS_TOGGLE_COMBO\)/);
  assert.match(settings, /CLOSE_OVERLAY_COMBOS\.some/);
  assert.match(settings, /document\.body\.style\.overflow = previousBodyOverflow/);
  assert.match(setup, /<AnalyticsConsentControl accentColor=\{themeColor\} \/>/);
  assert.match(control, /role="switch"/);
  assert.match(control, /aria-checked=\{isGranted\}/);
  assert.match(control, /settings\.analytics\.privacySignal/);
});
