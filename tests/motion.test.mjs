import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseEpisodePack } from "@manse/schema";
import { EpisodeSession } from "@manse/runtime-web/testing";
import { synthesizePoseFrames } from "@manse/runtime-web/testing";

/**
 * Evaluator-level motion harness. Pointer simulation cannot squat, so this
 * drives the vendored engine exactly the way the engine's own
 * packages/runtime-web/test/motion.test.ts does: parse the real pack through
 * the shipped schema, build an EpisodeSession (the same loader path the game
 * uses: parseEpisodePack -> EpisodeSession -> createChallengeEvaluator), and
 * replay a synthesized child motion through it. Success must arrive as the
 * session's own "success" audio cue within the pack's timeBudgetMs.
 */

const PACK_URL = new URL("../public/packs/froggy-hops/manse.pack.json", import.meta.url);
/** Matches DEFAULT_RUNTIME_TUNING.passiveSceneDurationMs in the runtime. */
const SCENE_START_MS = 2_500;

const packJson = JSON.parse(readFileSync(PACK_URL, "utf8"));
const challengeScenes = packJson.scenes.filter((scene) => scene.challenge !== null);

/**
 * Full-depth squat shape reused from the engine's own replay fixture
 * (packages/runtime-web/fixtures/replay/squat.json): hips/shoulders/nose drop
 * 0.10 of frame height while the knees travel outward — the knee bend is what
 * satisfies kneeAngleMaxDeg, a pure body drop never counts.
 */
const SQUAT_BOTTOM_JOINTS = {
  left_hip: { dy: 0.1 },
  right_hip: { dy: 0.1 },
  left_knee: { dx: 0.06, dy: 0.02 },
  right_knee: { dx: -0.06, dy: 0.02 },
  left_shoulder: { dy: 0.1 },
  right_shoulder: { dy: 0.1 },
  nose: { dy: 0.1 },
};

/**
 * A child performing squats at a comfortable cadence: stand still while the
 * evaluator calibrates, then per rep 500ms down, 200ms hold at the bottom,
 * 500ms back up, and ~800ms standing rest (covers the pack's cooldownMs).
 * One rep every 2000ms.
 */
function childSquatScript(repetitions) {
  const keyframes = [{ atMs: 0 }];
  let t = 1_500;
  for (let rep = 0; rep < repetitions; rep += 1) {
    keyframes.push({ atMs: t });
    keyframes.push({ atMs: t + 500, joints: SQUAT_BOTTOM_JOINTS });
    keyframes.push({ atMs: t + 700, joints: SQUAT_BOTTOM_JOINTS });
    keyframes.push({ atMs: t + 1_200 });
    t += 2_000;
  }
  keyframes.push({ atMs: t });
  return { fps: 30, durationMs: t, keyframes };
}

function scriptForChallenge(challenge) {
  if (challenge.type === "squat") return childSquatScript(challenge.repetitions);
  throw new Error(`No child motion script for challenge type '${challenge.type}'.`);
}

/** Run a replay through a full session; returns every event with its time. */
function driveSession(pack, frames) {
  const events = [];
  let now = 0;
  const session = new EpisodeSession(pack, {
    locale: pack.meta.locales[0] ?? "en",
    tier: "S",
    onEvent: (event) => events.push({ at: now, event }),
  });
  session.start(0);
  now = SCENE_START_MS;
  session.tick(SCENE_START_MS);
  for (const frame of frames) {
    now = frame.timestampMs + SCENE_START_MS;
    session.tick(now);
    session.updatePose({ ...frame, timestampMs: now });
  }
  // Let celebration and terminal scenes resolve.
  for (const extra of [1_600, 3_200, 6_000]) session.tick(now + extra);
  return { events, session, endedAt: now };
}

/** Isolate one scene of the real pack: intro -> that scene -> terminal. */
function harnessPackFor(sceneId) {
  const scene = packJson.scenes.find((candidate) => candidate.id === sceneId);
  const narration = {
    items: [
      { locale: "ko", text: "준비!", audioAssetId: null },
      { locale: "en", text: "Ready!", audioAssetId: null },
    ],
    captionDefaultOn: true,
  };
  return parseEpisodePack({
    ...packJson,
    entrySceneId: "harness-intro",
    scenes: [
      {
        id: "harness-intro",
        kind: "story",
        narration,
        demo: null,
        challenge: null,
        learning: null,
        artAssetId: null,
        energy: "calm",
        terminal: false,
        transitions: [{ on: "always", to: sceneId, adapt: null }],
      },
      {
        ...scene,
        transitions: [
          { on: "success", to: "harness-finish", adapt: null },
          { on: "struggle", to: "harness-finish", adapt: null },
        ],
      },
      {
        id: "harness-finish",
        kind: "celebration",
        narration,
        demo: null,
        challenge: null,
        learning: null,
        artAssetId: null,
        energy: "calm",
        terminal: true,
        transitions: [],
      },
    ],
  });
}

function successAt(events) {
  const cue = events.find(({ event }) => event.type === "audio-cue" && event.purpose === "success");
  return cue === undefined ? null : cue.at;
}

function struggled(events) {
  return events.some(({ event }) => event.type === "audio-cue" && event.purpose === "encourage");
}

function progressEvents(events) {
  return events.filter(({ event }) => event.type === "challenge-progress");
}

test("pack parses through the shipped @manse/schema validator", () => {
  const pack = parseEpisodePack(packJson);
  assert.equal(pack.scenes.length, packJson.scenes.length);
  assert.equal(challengeScenes.length > 0, true, "expected at least one challenge scene");
});

test("pack validator rejects an intentionally incomplete locale fixture", () => {
  const invalidPack = structuredClone(packJson);
  invalidPack.meta.summary = invalidPack.meta.summary.filter(({ locale }) => locale !== "en");
  assert.throws(
    () => parseEpisodePack(invalidPack),
    /Missing declared locale 'en'/,
    "declared locales must be complete across localized pack fields",
  );
});

for (const scene of challengeScenes) {
  const challenge = scene.challenge;
  test(`scene '${scene.id}': a child's ${challenge.type} clears within timeBudgetMs`, () => {
    const script = scriptForChallenge(challenge);
    const { events } = driveSession(harnessPackFor(scene.id), synthesizePoseFrames(script));

    const at = successAt(events);
    assert.notEqual(at, null, `expected a success cue; events: ${JSON.stringify(events)}`);
    const measuredMs = at - SCENE_START_MS;
    const progress = progressEvents(events);
    assert.equal(progress.length, challenge.repetitions, "every repetition must be counted once");
    assert.deepEqual([...new Set(progress.map(({ event }) => event.label))], [challenge.type]);
    assert.equal(struggled(events), false, "a comfortable child cadence must never trigger struggle");
    assert.equal(
      measuredMs <= challenge.timeBudgetMs,
      true,
      `cleared in ${measuredMs}ms but budget is ${challenge.timeBudgetMs}ms`,
    );
    assert.equal(events.at(-1)?.event.type, "complete");
    console.log(
      `    [motion] ${scene.id}: ${challenge.repetitions}x ${challenge.type} cleared in `
      + `${measuredMs}ms of ${challenge.timeBudgetMs}ms budget `
      + `(${Math.round((measuredMs / challenge.timeBudgetMs) * 100)}% used, `
      + `${challenge.timeBudgetMs - measuredMs}ms headroom; script ${script.durationMs}ms @ ${script.fps}fps)`,
    );
  });
}

test("full pack: child motion completes the real scene flow end-to-end", () => {
  const first = challengeScenes[0];
  // Scene transitions consume a neutral frame before the next evaluator is active,
  // so include one extra complete movement cycle per authored hand-off.
  const totalRepetitions = challengeScenes.reduce((total, scene) => total + scene.challenge.repetitions, 0) + challengeScenes.length;
  const script = childSquatScript(totalRepetitions);
  const { events } = driveSession(parseEpisodePack(packJson), synthesizePoseFrames(script));

  const visited = events
    .filter(({ event }) => event.type === "scene-changed")
    .map(({ event }) => event.sceneId);
  assert.deepEqual(visited, [packJson.entrySceneId, ...challengeScenes.map((scene) => scene.id), "complete"]);
  const at = successAt(events);
  assert.notEqual(at, null);
  const totalBudgetMs = challengeScenes.reduce((total, scene) => total + scene.challenge.timeBudgetMs, 0);
  assert.equal(at - SCENE_START_MS <= totalBudgetMs, true);
  assert.equal(events.at(-1)?.event.type, "complete");
  console.log(
    `    [motion] full pack: success in scene '${first.id}' at ${at - SCENE_START_MS}ms, `
    + `session complete; scenes visited: ${visited.join(" -> ")}`,
  );
});
