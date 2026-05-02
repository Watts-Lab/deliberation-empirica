// Shared participant-walk helpers.
//
// Three layers, each building on the previous:
//   - registerParticipant(page, ...)   stops AT consent click
//                                       (player exists in tajriba but
//                                       hasn't completed AC + nickname)
//   - walkToLobby(page, ...)           stops AT nickname submit
//                                       (player is in the lobby/dispatch
//                                       window but not yet in a game)
//   - walkToGame(page, ...)            additionally waits for a named
//                                       prompt element to render in the
//                                       game stage (player is dispatched,
//                                       position has been assigned,
//                                       game stage 1 is mounted)
//
// All three navigate to the player URL with the given playerKey and
// drive the same intro flow. The level you pick depends on what your
// test is observing:
//   - Cancel-during-intro / closed-batch UX → registerParticipant
//   - Cross-player text-chat in lobby / dispatch invariants → walkToLobby
//   - Anything that needs game-scope state (prompts, durations,
//     scienceData rows) → walkToGame
//
// Used by every solo/multi/smoke e2e spec; centralizing means selector
// updates (e.g. data-testid drift) only need a single edit.

export const ATTENTION_SENTENCE =
  "I agree to participate in this study to the best of my ability.";

// Default selector timeouts. Most are generous to absorb CI runner
// jitter; the IdForm/consent gates default to 30s because they're the
// first paint after navigation, when JS bundle download dominates.
const DEFAULT_TIMEOUTS = {
  idForm: 30_000,
  consent: 30_000,
  attentionCheck: 15_000,
  nickname: 15_000,
  game: 60_000,
};

/**
 * Walk through ID form + consent. Stops AT consent click. The player
 * exists in tajriba and has the consent record, but has not done the
 * attention check or chosen a nickname.
 *
 * @param {import("@playwright/test").Page} page
 * @param {object} args
 * @param {string} args.url             Base player URL (typically `stack.urls.player`)
 * @param {string} args.playerKey       Recruitment identifier; goes into the URL and the IdForm input
 * @param {object} [args.extraParams]   Additional query-string params to append.
 *                                       Used by tests that exercise URL-param spread
 *                                       behavior (e.g. workerId/assignmentId/source
 *                                       attribution from MTurk-style entry URLs).
 * @param {object} [args.timeouts]      Override individual phase timeouts
 */
export async function registerParticipant(
  page,
  { url, playerKey, extraParams, timeouts = {} },
) {
  // `playerKey` is reserved — it both binds the URL to a tajriba
  // session and feeds the IdForm. If a caller tried to override it
  // via `extraParams.playerKey`, the URL would say one thing and the
  // IdForm another (and the exported `playerKey` field on the row
  // would be the IdForm value). Fail loud rather than silently
  // diverging — refresh/resume tests would mysteriously fail.
  if (extraParams && Object.hasOwn(extraParams, "playerKey")) {
    throw new Error(
      "extraParams.playerKey is reserved — pass playerKey at the top level so URL binding and IdForm input stay in sync",
    );
  }
  const t = { ...DEFAULT_TIMEOUTS, ...timeouts };
  const params = new URLSearchParams({ ...(extraParams || {}), playerKey });
  await page.goto(`${url}?${params.toString()}`, { waitUntil: "load" });

  const idInput = page.locator('input[data-testid="inputPaymentId"]');
  await idInput.waitFor({ state: "visible", timeout: t.idForm });
  await idInput.fill(playerKey);
  await page.locator('button[data-testid="joinButton"]').click();

  const consentBtn = page.locator('button[data-testid="consentButton"]');
  await consentBtn.waitFor({ state: "visible", timeout: t.consent });
  await consentBtn.click();
}

/**
 * Walk through ID form → consent → attention check → nickname. Stops
 * AT the nickname submit click. The player is in the lobby/dispatch
 * window but not yet placed in a game.
 *
 * @param {import("@playwright/test").Page} page
 * @param {object} args
 * @param {string} args.url
 * @param {string} args.playerKey
 * @param {string} [args.nickname]  Defaults to `nick_${playerKey}`
 * @param {object} [args.timeouts]
 */
export async function walkToLobby(
  page,
  { url, playerKey, nickname, extraParams, timeouts = {} },
) {
  const t = { ...DEFAULT_TIMEOUTS, ...timeouts };
  await registerParticipant(page, { url, playerKey, extraParams, timeouts: t });

  const attnInput = page.locator('input[data-testid="inputAttentionCheck"]');
  await attnInput.waitFor({ state: "visible", timeout: t.attentionCheck });
  // pressSequentially with delay:1 mimics typing — the AC validator
  // requires the input to match the sentence character-for-character.
  await attnInput.pressSequentially(ATTENTION_SENTENCE, { delay: 1 });
  await page.locator('button[data-testid="continueAttentionCheck"]').click();

  const nickInput = page.locator('input[data-testid="inputNickname"]');
  await nickInput.waitFor({ state: "visible", timeout: t.nickname });
  await nickInput.fill(nickname || `nick_${playerKey}`);
  await page.locator('button[data-testid="continueNickname"]').click();
}

/**
 * Walk through full intro AND wait for a named game-stage prompt
 * element to render. The wait is the signal that the player has been
 * dispatched (position assigned, game stage mounted) — most game-stage
 * specs need this anchor before driving stage interactions.
 *
 * @param {import("@playwright/test").Page} page
 * @param {object} args
 * @param {string} args.url
 * @param {string} args.playerKey
 * @param {string} args.gamePromptName   The `name:` field of a prompt
 *                                       element in the treatment's first
 *                                       game stage. Used in the waitFor
 *                                       selector `[data-testid="element-prompt-${name}"]`.
 * @param {string} [args.nickname]
 * @param {object} [args.timeouts]
 */
export async function walkToGame(
  page,
  { url, playerKey, gamePromptName, nickname, extraParams, timeouts = {} },
) {
  const t = { ...DEFAULT_TIMEOUTS, ...timeouts };
  await walkToLobby(page, { url, playerKey, nickname, extraParams, timeouts: t });
  await page
    .locator(`[data-testid="element-prompt-${gamePromptName}"]`)
    .waitFor({ state: "visible", timeout: t.game });
}
