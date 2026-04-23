import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  relTime,
  reconstructChatState,
  getNextActionId,
} from "./chatUtils";

// ---------- Fixture helpers ----------

// Chat actions are stored as Empirica attribute entries: `{value, createdAt}`.
// `value` is the action object written by the UI; `createdAt` is Empirica's
// wall-clock timestamp.
const action = (value, createdAt = "2026-04-21T12:00:00.000Z") => ({
  value,
  createdAt,
});

const sendMessage = (overrides = {}) => ({
  type: "send_message",
  id: 1,
  content: "hello",
  playerPosition: "0",
  sender: { id: "p0", name: "Alice", title: "A" },
  stage: "game_1_Discussion",
  time: 0,
  ...overrides,
});

const addReaction = (overrides = {}) => ({
  type: "add_reaction_emoji",
  id: 100,
  content: "👍",
  targetId: 1,
  playerPosition: "0",
  ...overrides,
});

const removeReaction = (overrides = {}) => ({
  type: "remove_reaction_emoji",
  id: 200,
  targetId: 100,
  playerPosition: "0",
  ...overrides,
});

// ---------- relTime ----------

describe("relTime", () => {
  const NOW = new Date("2026-04-21T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns 'now' for timestamps within the last minute", () => {
    expect(relTime(new Date(NOW.getTime() - 30 * 1000))).toBe("now");
    expect(relTime(NOW)).toBe("now");
  });

  test("returns minutes for sub-hour differences", () => {
    expect(relTime(new Date(NOW.getTime() - 5 * 60 * 1000))).toBe("5m");
    expect(relTime(new Date(NOW.getTime() - 59 * 60 * 1000))).toBe("59m");
  });

  test("returns hours for sub-day differences", () => {
    expect(relTime(new Date(NOW.getTime() - 3 * 3600 * 1000))).toBe("3h");
    expect(relTime(new Date(NOW.getTime() - 23 * 3600 * 1000))).toBe("23h");
  });

  test("returns 'N days ago' for sub-month differences", () => {
    expect(relTime(new Date(NOW.getTime() - 2 * 86400 * 1000))).toBe(
      "2 days ago"
    );
  });

  test("returns 'N months ago' for sub-year differences", () => {
    expect(relTime(new Date(NOW.getTime() - 45 * 86400 * 1000))).toBe(
      "1 months ago"
    );
  });

  test("returns 'N years ago' for beyond-year differences", () => {
    expect(relTime(new Date(NOW.getTime() - 2 * 365 * 86400 * 1000))).toBe(
      "2 years ago"
    );
  });
});

// ---------- reconstructChatState ----------

describe("reconstructChatState (append-only log → message list)", () => {
  test("returns [] for null/empty input", () => {
    expect(reconstructChatState(null)).toEqual([]);
    expect(reconstructChatState(undefined)).toEqual([]);
    expect(reconstructChatState([])).toEqual([]);
  });

  test("builds one message per send_message action", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1, content: "hi" })),
      action(sendMessage({ id: 2, content: "there", playerPosition: "1" })),
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: 1,
      text: "hi",
      playerPosition: "0",
      reactions: [],
    });
    expect(messages[1]).toMatchObject({ id: 2, text: "there", playerPosition: "1" });
  });

  test("preserves message order from the action log", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 3, content: "third" })),
      action(sendMessage({ id: 1, content: "first-in-log-but-actually-second" })),
    ]);
    expect(messages.map((m) => m.id)).toEqual([3, 1]);
  });

  test("attaches reactions to the targeted message", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1 })),
      action(sendMessage({ id: 2 })),
      action(addReaction({ id: 101, content: "👍", targetId: 1 })),
      action(addReaction({ id: 102, content: "🎉", targetId: 2 })),
    ]);
    expect(messages[0].reactions).toEqual([
      expect.objectContaining({ id: 101, emoji: "👍", playerPosition: "0" }),
    ]);
    expect(messages[1].reactions).toEqual([
      expect.objectContaining({ id: 102, emoji: "🎉" }),
    ]);
  });

  test("supports multiple reactions on one message", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1 })),
      action(addReaction({ id: 101, content: "👍", targetId: 1 })),
      action(
        addReaction({
          id: 102,
          content: "🎉",
          targetId: 1,
          playerPosition: "1",
        })
      ),
    ]);
    expect(messages[0].reactions).toHaveLength(2);
    expect(messages[0].reactions.map((r) => r.emoji)).toEqual(["👍", "🎉"]);
  });

  test("remove_reaction_emoji drops the targeted reaction from the message", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1 })),
      action(addReaction({ id: 101, content: "👍", targetId: 1 })),
      action(addReaction({ id: 102, content: "🎉", targetId: 1 })),
      action(removeReaction({ id: 201, targetId: 101 })),
    ]);
    expect(messages[0].reactions).toHaveLength(1);
    expect(messages[0].reactions[0].emoji).toBe("🎉");
  });

  test("remove_reaction_emoji with an unknown targetId is a no-op", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1 })),
      action(addReaction({ id: 101, content: "👍", targetId: 1 })),
      action(removeReaction({ id: 201, targetId: 999 })),
    ]);
    expect(messages[0].reactions).toHaveLength(1);
  });

  test("reactions targeting an unknown message are silently dropped", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1 })),
      action(addReaction({ id: 101, content: "👍", targetId: 42 })),
    ]);
    expect(messages[0].reactions).toEqual([]);
  });

  test("copies createdAt from action onto the message", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1 }), "2026-04-21T08:00:00.000Z"),
    ]);
    expect(messages[0].createdAt).toBe("2026-04-21T08:00:00.000Z");
  });

  test("sender defaults to {} when missing", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1, sender: undefined })),
    ]);
    expect(messages[0].sender).toEqual({});
  });

  test("ignores unknown action types", () => {
    const messages = reconstructChatState([
      action(sendMessage({ id: 1 })),
      action({ type: "mystery_action", id: 777 }),
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(1);
  });
});

// ---------- getNextActionId ----------

describe("getNextActionId", () => {
  test("returns 0 for an empty or missing log", () => {
    expect(getNextActionId(null)).toBe(0);
    expect(getNextActionId(undefined)).toBe(0);
    expect(getNextActionId([])).toBe(0);
  });

  test("returns max(existing ids) + 1", () => {
    expect(
      getNextActionId([
        action(sendMessage({ id: 5 })),
        action(sendMessage({ id: 12 })),
        action(addReaction({ id: 7 })),
      ])
    ).toBe(13);
  });

  test("treats missing ids as 0 when computing the max", () => {
    expect(
      getNextActionId([
        action({ type: "send_message", content: "no id" }),
        action(sendMessage({ id: 3 })),
      ])
    ).toBe(4);
  });
});
