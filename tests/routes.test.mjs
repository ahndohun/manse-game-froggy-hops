import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the anonymous game start experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Play with pointer/);
  assert.match(html, /Camera stays on this device/);
  assert.match(html, /aria-pressed="false"[^>]*>KO</);
  assert.match(html, /aria-pressed="true"[^>]*>EN</);
  assert.match(html, /\/packs\/froggy-hops\/assets\/images\/pond-hero\.png/);
  assert.match(html, /https:\/\/github\.com\/ahndohun\/manse-game-froggy-hops/);
  assert.doesNotMatch(html, /replace-me/);
  assert.doesNotMatch(html, /signin-with-chatgpt|<iframe\b|<form\b/i);
});

test("interactive controls do not leak pointer presses into the game stage", async () => {
  const clientSource = await readFile("app/GameClient.tsx", "utf8");
  const escape = clientSource.indexOf('closest("button, a")');
  const capture = clientSource.indexOf("setPointerCapture", escape);
  assert.notEqual(escape, -1, "the stage must ignore pointer events originating from buttons and links");
  assert.equal(capture > escape, true, "the control escape must run before pointer capture");
});

test("generated hero provenance matches the shipped bytes", async () => {
  const assetPath = "public/packs/froggy-hops/assets/images/pond-hero.png";
  const asset = await readFile(assetPath);
  const digest = createHash("sha256").update(asset).digest("hex");
  const siteProvenance = JSON.parse(await readFile("public/asset-provenance.json", "utf8"));
  const record = siteProvenance.assets.find(({ path }) => path.endsWith("/pond-hero.png"));
  assert.equal(record?.origin, "generated");
  assert.equal(record?.license, "MIT");
  assert.equal(record?.sha256, digest);
  assert.equal(record?.model, "Not reported by the built-in image_gen response");
});

test("build bundles the public contract and pose runtime", async () => {
  const manifest = JSON.parse(await readFile("public/.well-known/manse-game.json", "utf8"));
  assert.equal(typeof manifest.slug, "string");
  assert.equal(manifest.slug.length > 0, true);
  await access(`public/packs/${manifest.slug}/manse.pack.json`);
  await access(`dist/client/packs/${manifest.slug}/assets/images/pond-hero.png`);
  await access("dist/client/sw.js");
  await access("dist/client/models/pose_landmarker_lite.task");
  await access("dist/client/vendor/mediapipe/wasm/vision_wasm_internal.wasm");
  const clientEntries = await readdir("dist/client", { recursive: true });
  const scripts = await Promise.all(
    clientEntries.filter((entry) => entry.endsWith(".js")).map((entry) => readFile(`dist/client/${entry}`, "utf8")),
  );
  assert.equal(
    scripts.some((script) => script.includes("serviceWorker") && script.includes("/sw.js")),
    true,
    "the production client must register the bundled service worker",
  );
});
