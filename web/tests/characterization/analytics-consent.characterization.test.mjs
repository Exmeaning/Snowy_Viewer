import assert from "node:assert/strict";
import test from "node:test";

import { JSDOM } from "jsdom";
import React, { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import ts from "typescript";

import { readWeb } from "./test-helpers.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function importGoogleTagBootstrap(dependencies) {
  const source = readWeb("src/components/GoogleTagBootstrap.tsx")
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?;\s*$/gmu, "");
  const prelude = `
    const React = globalThis.__googleTagRuntime.React;
    const getGoogleTagMeasurementId = (...args) => globalThis.__googleTagRuntime.getGoogleTagMeasurementId(...args);
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
  globalThis.__googleTagRuntime = { React, ...dependencies };
  const encoded = Buffer.from(transpiled.outputText).toString("base64");
  return (await import(`data:text/javascript;base64,${encoded}`)).default;
}

async function withAnalyticsDom(callback) {
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
    delete globalThis.__googleTagRuntime;
  }
}

test("GoogleTagBootstrap always loads Google Analytics when a measurement ID exists", async () => {
  await withAnalyticsDom(async () => {
    const GoogleTagBootstrap = await importGoogleTagBootstrap({
      getGoogleTagMeasurementId: () => "G-TEST",
    });
    const element = React.createElement(GoogleTagBootstrap);
    const container = document.getElementById("root");
    container.innerHTML = renderToString(element);
    let root;
    await act(async () => {
      root = hydrateRoot(container, element);
    });

    const script = document.getElementById("moesekai-google-tag");
    assert.ok(script, "production hosts must load Google Analytics");
    assert.match(script.src, /googletagmanager\.com\/gtag\/js\?id=G-TEST/);
    assert.equal(window.__moesekaiGoogleTagInitialized, true);
    return root;
  });
});

test("GoogleTagBootstrap stays idle without a measurement ID", async () => {
  await withAnalyticsDom(async () => {
    const GoogleTagBootstrap = await importGoogleTagBootstrap({
      getGoogleTagMeasurementId: () => undefined,
    });
    const element = React.createElement(GoogleTagBootstrap);
    const container = document.getElementById("root");
    let root;
    await act(async () => {
      root = hydrateRoot(container, element);
    });
    assert.equal(document.getElementById("moesekai-google-tag"), null);
    assert.equal(window.__moesekaiGoogleTagInitialized, undefined);
    return root;
  });
});

test("settings, onboarding, and privacy no longer expose an analytics consent toggle", () => {
  const settings = readWeb("src/components/SettingsPanel.tsx");
  const setup = readWeb("src/components/home/SetupGuide.tsx");
  const privacy = readWeb("src/app/privacy/client.tsx");
  const googleTag = readWeb("src/components/GoogleTagBootstrap.tsx");

  assert.doesNotMatch(settings, /AnalyticsConsentControl|settings\.analytics/);
  assert.match(settings, /type SettingsTab = "visual" \| "content" \| "data" \| "about"/);
  assert.match(settings, /activeTab === "content"/);
  assert.match(settings, /matchesShortcutCombo\(event, SETTINGS_TOGGLE_COMBO\)/);
  assert.match(settings, /CLOSE_OVERLAY_COMBOS\.some/);
  assert.match(settings, /document\.body\.style\.overflow = previousBodyOverflow/);
  assert.doesNotMatch(setup, /AnalyticsConsentControl/);
  assert.doesNotMatch(privacy, /AnalyticsConsentControl|controls\.consent/);
  assert.doesNotMatch(googleTag, /analyticsConsent|isAnalyticsAllowed|readAnalyticsConsent/);
  assert.match(googleTag, /getGoogleTagMeasurementId\(window\.location\.hostname\)/);
  assert.match(googleTag, /document\.createElement\("script"\)/);
});
