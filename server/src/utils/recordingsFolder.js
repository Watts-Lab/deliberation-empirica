/**
 * Generate the Daily.co room name / recordings-folder identifier for a
 * game. The same string is used in three places at game-start time
 * (see callbacks.js — game-start handler):
 *
 *   - passed as `roomName` to `createRoom(roomName, …)` (Daily.co room name)
 *   - stored on the game as `recordingsFolder` (read back by the
 *     scienceData export to associate recordings with games)
 *   - stored on the game as `dailyRoomName` (used to close the room
 *     and stop recordings on game-end)
 *
 * The 28-character cap exists because Daily.co room names are limited
 * to 41 characters total and our deploy prepends a "deliberation"
 * prefix (~13 chars including a separator).
 *
 *   https://docs.daily.co/reference/rest-api/rooms/create-room#name
 *
 * The function takes the first 20 chars of the batch label plus the
 * last 6 chars of the game id (uniqueness within a batch). 20 + 6 = 26
 * chars max; well under the 28-char budget.
 *
 * Caveat: this helper is unit-tested in isolation. The integration
 * glue — that the same string is used for `createRoom` *and* stored
 * as both `recordingsFolder` and `dailyRoomName` on the game — is
 * only exercised by full-stack runs (Playwright e2e or production),
 * not by any unit test. A future refactor that desynchronizes those
 * three uses would not be caught here.
 */
export function makeRecordingsFolder(batchLabel, gameId) {
  return batchLabel.slice(0, 20) + gameId.slice(-6);
}
