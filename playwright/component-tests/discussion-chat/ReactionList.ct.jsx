import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { ReactionList } from "../../../client/src/components/discussion/chat/ReactionList";
import { ReactionListAdapter } from "./_helpers/ReactionListAdapter";

/**
 * Component tests for ReactionList — the inline pill row beneath chat
 * messages showing emoji reactions, counts, and tooltips.
 *
 *   RL-001  No render when reactions is empty/undefined
 *   RL-002  Reactions grouped by emoji; one pill per unique emoji
 *   RL-003  Count number shown only when count > 1
 *   RL-004  Pill highlighted (blue border class) when current player reacted
 *   RL-005  Pill NOT highlighted when current player hasn't reacted
 *   RL-006  Clicking own reaction calls onRemove with that reaction's id
 *   RL-007  Clicking someone-else's reaction is a no-op (onRemove not called)
 *   RL-008  Tooltip text on hover lists names from `players` lookup; falls
 *           back to "Player {position}" when no match
 */

const makeRemoveCapture = () => {
  const removed = [];
  const onRemove = (id) => {
    removed.push(id);
  };
  return { removed, onRemove };
};

test.describe("ReactionList", () => {
  test("RL-001: no render when reactions is undefined", async ({ mount }) => {
    const component = await mount(<ReactionList />);
    // Component returns null — the mount root has no buttons.
    await expect(component.locator("button")).toHaveCount(0);
  });

  test("RL-001b: no render when reactions is []", async ({ mount }) => {
    const component = await mount(<ReactionList reactions={[]} />);
    await expect(component.locator("button")).toHaveCount(0);
  });

  test("RL-002: reactions grouped by emoji — one pill per unique emoji", async ({
    mount,
  }) => {
    const component = await mount(
      <ReactionListAdapter
        reactions={[
          { id: "r1", emoji: "👍", playerPosition: 0 },
          { id: "r2", emoji: "👍", playerPosition: 1 },
          { id: "r3", emoji: "❤️", playerPosition: 1 },
        ]}
        rawPlayers={[
          { position: 0, name: "alice" },
          { position: 1, name: "bob" },
        ]}
      />,
    );
    // 2 unique emojis → 2 pills.
    await expect(component.locator("button")).toHaveCount(2);
    // First pill is 👍 with count 2; second is ❤️ with no count number.
    const firstButton = component.locator("button").nth(0);
    const secondButton = component.locator("button").nth(1);
    await expect(firstButton).toContainText("👍");
    await expect(firstButton).toContainText("2");
    await expect(secondButton).toContainText("❤️");
  });

  test("RL-003: count is hidden when only one reaction of an emoji", async ({
    mount,
  }) => {
    const component = await mount(
      <ReactionListAdapter
        reactions={[{ id: "r1", emoji: "🎉", playerPosition: 0 }]}
        rawPlayers={[{ position: 0, name: "alice" }]}
      />,
    );
    const button = component.locator("button").first();
    await expect(button).toContainText("🎉");
    // Count span is suppressed for count === 1 — assert no digit chars.
    const text = (await button.textContent()) || "";
    expect(text.replace(/\s/g, "")).toBe("🎉");
  });

  test("RL-004: pill highlighted (blue) when current player reacted", async ({
    mount,
  }) => {
    const component = await mount(
      <ReactionListAdapter
        reactions={[{ id: "r1", emoji: "👍", playerPosition: 0 }]}
        rawPlayers={[{ position: 0, name: "alice" }]}
        currentPlayerPosition={0}
      />,
    );
    const button = component.locator("button").first();
    // Source uses `border-blue-400` for own reactions and
    // `border-gray-300` for others.
    await expect(button).toHaveClass(/border-blue-400/);
  });

  test("RL-005: pill NOT highlighted when current player hasn't reacted", async ({
    mount,
  }) => {
    const component = await mount(
      <ReactionListAdapter
        reactions={[{ id: "r1", emoji: "👍", playerPosition: 1 }]}
        rawPlayers={[{ position: 1, name: "bob" }]}
        currentPlayerPosition={0}
      />,
    );
    const button = component.locator("button").first();
    await expect(button).toHaveClass(/border-gray-300/);
    await expect(button).not.toHaveClass(/border-blue-400/);
  });

  test("RL-006: clicking own reaction calls onRemove with that reaction's id", async ({
    mount,
  }) => {
    const { removed, onRemove } = makeRemoveCapture();
    const component = await mount(
      <ReactionListAdapter
        reactions={[
          { id: "my-reaction-id", emoji: "👍", playerPosition: 0 },
          { id: "their-reaction-id", emoji: "👍", playerPosition: 1 },
        ]}
        rawPlayers={[
          { position: 0, name: "alice" },
          { position: 1, name: "bob" },
        ]}
        currentPlayerPosition={0}
        onRemove={onRemove}
      />,
    );
    await component.locator("button").first().click();
    await expect.poll(() => removed).toEqual(["my-reaction-id"]);
  });

  test("RL-007: clicking a reaction the current player didn't make is a no-op", async ({
    mount,
    page,
  }) => {
    const { removed, onRemove } = makeRemoveCapture();
    const component = await mount(
      <ReactionListAdapter
        reactions={[
          { id: "their-reaction-id", emoji: "👍", playerPosition: 1 },
        ]}
        rawPlayers={[{ position: 1, name: "bob" }]}
        currentPlayerPosition={0}
        onRemove={onRemove}
      />,
    );
    await component.locator("button").first().click();
    // Give the RPC bridge a tick — assert nothing arrived.
    await page.waitForTimeout(150);
    expect(removed).toEqual([]);
  });

  test("RL-008: tooltip / title text uses players lookup with position fallback", async ({
    mount,
  }) => {
    const component = await mount(
      <ReactionListAdapter
        reactions={[
          { id: "r1", emoji: "👍", playerPosition: 0 },
          { id: "r2", emoji: "👍", playerPosition: 99 }, // no matching player
        ]}
        rawPlayers={[{ position: 0, name: "alice" }]}
        currentPlayerPosition={1}
      />,
    );
    // For non-self reactions the title attribute lists names joined by
    // ", "; missing players fall back to "Player {position}".
    const button = component.locator("button").first();
    const title = await button.getAttribute("title");
    expect(title).toBe("alice, Player 99");
  });

  test("RL-008b: own-reaction title says 'Click to remove your reaction'", async ({
    mount,
  }) => {
    const component = await mount(
      <ReactionListAdapter
        reactions={[{ id: "r1", emoji: "👍", playerPosition: 0 }]}
        rawPlayers={[{ position: 0, name: "alice" }]}
        currentPlayerPosition={0}
      />,
    );
    const button = component.locator("button").first();
    await expect(button).toHaveAttribute(
      "title",
      "Click to remove your reaction",
    );
  });
});
