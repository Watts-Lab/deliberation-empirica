import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { ChatHarness } from "./_helpers/ChatHarness";

/**
 * Component tests for the Chat container.
 *
 * Sub-components (TextBar, MessageBubble, EmojiPicker, ReactionList)
 * are covered by their own CT files. This file pins the *container*
 * behaviors:
 *
 *   CH-001  Empty state: "No chat yet" copy renders + TextBar present
 *   CH-002  Sending a message dispatches one scope.append with the
 *           expected shape (sender info, stage, time, playerPosition,
 *           type=send_message)
 *   CH-003  Initial chat history renders one bubble per send_message
 *           action; non-message actions don't create bubbles
 *   CH-004  showNickname / showTitle props flow through to bubble titles
 *   CH-005  reactionEmojisAvailable=[] → handleAddReaction is a no-op
 *           (no add_reaction_emoji action dispatched)
 *   CH-006  numReactionsPerMessage limit: a player can't add a second
 *           emoji to the same message once they've hit the limit
 *   CH-007  Same player + same emoji on same message is a no-op
 *           (de-dupe protection)
 *
 * Notes on design:
 *   - The `e2e/multi/test.spec.mjs` chat scenario covers cross-client
 *     propagation, stage scoping, and the `time > 0` invariant against
 *     a real Empirica server. This file fills the gaps that are
 *     impractical to drive end-to-end (limit enforcement, action
 *     shape).
 */

const makeAppendCapture = () => {
  const calls = [];
  const onAppendCalled = ({ key, value }) => {
    calls.push({ key, value });
  };
  return { calls, onAppendCalled };
};

test.describe("Chat container", () => {
  test("CH-001: empty state renders 'No chat yet' message and TextBar", async ({
    mount,
  }) => {
    const component = await mount(<ChatHarness />);

    await expect(component.getByText("No chat yet")).toBeVisible();
    await expect(
      component.getByText("Send a message to start the conversation."),
    ).toBeVisible();
    // TextBar is always rendered (input visible).
    await expect(component.locator('textarea[name="message"]')).toBeVisible();
  });

  test("CH-002: sending a message dispatches a send_message action with the expected shape", async ({
    mount,
  }) => {
    const { calls, onAppendCalled } = makeAppendCapture();
    const component = await mount(
      <ChatHarness
        playerConfigs={[
          {
            id: "p1",
            attrs: { position: 0, name: "alice", title: "Title-A" },
          },
        ]}
        currentPlayerId="p1"
        stageTimer={{ elapsed: 5500, ended: false }}
        progressLabel="game_0_TestStage"
        onAppendCalled={onAppendCalled}
      />,
    );

    await component.locator('textarea[name="message"]').fill("hello world");
    await component.locator('textarea[name="message"]').press("Enter");

    await expect.poll(() => calls.length).toBe(1);
    const [call] = calls;
    expect(call.key).toBe("chat");
    expect(call.value).toMatchObject({
      type: "send_message",
      content: "hello world",
      playerPosition: 0,
      // stageTimer.elapsed is 5500ms → time field is 5.5 seconds.
      time: 5.5,
      stage: "game_0_TestStage",
      sender: {
        id: "p1",
        name: "alice",
        title: "Title-A",
      },
    });
    // getNextActionId returns a number; confirm it's set.
    expect(typeof call.value.id).toBe("number");
  });

  test("CH-003: initial chat history renders one bubble per send_message action", async ({
    mount,
  }) => {
    const component = await mount(
      <ChatHarness
        initialChatActions={[
          {
            id: 1,
            type: "send_message",
            content: "first message",
            playerPosition: 0,
            sender: { id: "p1", name: "alice", title: "T-0" },
            stage: "game_0_TestStage",
            time: 1.2,
          },
          {
            id: 2,
            type: "send_message",
            content: "second message",
            playerPosition: 1,
            sender: { id: "p2", name: "bob", title: "T-1" },
            stage: "game_0_TestStage",
            time: 2.4,
          },
          // Reaction action — should NOT produce its own bubble; just
          // attaches a reaction to the targeted message.
          {
            id: 3,
            type: "add_reaction_emoji",
            content: "👍",
            targetId: 1,
            playerPosition: 1,
            stage: "game_0_TestStage",
            time: 3.0,
          },
        ]}
      />,
    );

    await expect(component.getByText("first message")).toBeVisible();
    await expect(component.getByText("second message")).toBeVisible();
    // Empty-state copy must NOT show now that we have history.
    await expect(component.getByText("No chat yet")).toHaveCount(0);
  });

  test("CH-004: showTitle propagates — bubble titles render with current player's title in parens", async ({
    mount,
  }) => {
    const component = await mount(
      <ChatHarness
        showNickname
        showTitle
        playerConfigs={[
          { id: "p1", attrs: { position: 0, name: "alice", title: "T-0" } },
        ]}
        currentPlayerId="p1"
        initialChatActions={[
          {
            id: 1,
            type: "send_message",
            content: "from-bob",
            playerPosition: 1,
            // bob's stored title in the action — MessageBubble shows
            // sender info from the action, not from the live players list.
            sender: { id: "p2", name: "bob", title: "T-1" },
            stage: "game_0_TestStage",
            time: 1.0,
          },
        ]}
      />,
    );

    // "bob" can match both the rendered nickname text and the avatar
    // initial-letter span — count is enough for this assertion. The
    // critical pin is the parenthesized title, the cypress 03 regression.
    await expect(component.getByText("bob").first()).toBeVisible();
    // showNickname && showTitle → title is parenthesized next to nickname.
    await expect(component.getByText("(T-1)")).toBeVisible();
  });

  test("CH-005: reactionEmojisAvailable=[] → no Add reaction UI is rendered", async ({
    mount,
  }) => {
    const component = await mount(
      <ChatHarness
        reactionEmojisAvailable={[]} // disabled
        initialChatActions={[
          {
            id: 1,
            type: "send_message",
            content: "no reactions allowed here",
            playerPosition: 1,
            sender: { id: "p2", name: "bob", title: "T-1" },
            stage: "game_0_TestStage",
            time: 1.0,
          },
        ]}
      />,
    );

    // Sanity: the message rendered.
    await expect(
      component.getByText("no reactions allowed here"),
    ).toBeVisible();
    // The MessageBubble's `canReact` branch hides the "Add reaction"
    // toggle when `reactionEmojisAvailable` is empty — the only UI
    // path to handleAddReaction. Asserting absence of that button is
    // the load-bearing gate check; the container's handler is also
    // defensively guarded but unreachable when the UI is hidden.
    await expect(component.getByLabel("Add reaction")).toHaveCount(0);
  });

  test("CH-006: numReactionsPerMessage limit blocks a second emoji from same player on same message", async ({
    mount,
    page,
  }) => {
    const { calls, onAppendCalled } = makeAppendCapture();
    // Pre-existing: alice (p1, position 0) already added 👍 to message 1.
    // numReactionsPerMessage=1 → a follow-up reaction from alice on the
    // same message must be blocked (no append fires).
    const component = await mount(
      <ChatHarness
        numReactionsPerMessage={1}
        reactionEmojisAvailable={["👍", "❤️", "😂"]}
        currentPlayerId="p1"
        playerConfigs={[
          { id: "p1", attrs: { position: 0, name: "alice", title: "T-0" } },
        ]}
        initialChatActions={[
          {
            id: 1,
            type: "send_message",
            content: "hi",
            playerPosition: 1,
            sender: { id: "p2", name: "bob", title: "T-1" },
            stage: "game_0_TestStage",
            time: 1.0,
          },
          {
            id: 2,
            type: "add_reaction_emoji",
            content: "👍",
            targetId: 1,
            playerPosition: 0,
            stage: "game_0_TestStage",
            time: 2.0,
          },
        ]}
        onAppendCalled={onAppendCalled}
      />,
    );

    // Drive the actual reaction UI: open the picker on bob's message
    // and try to add ❤️. The container should reject because alice has
    // already used her one allowed reaction (👍) on this message.
    await component.getByLabel("Add reaction").click();
    await component
      .locator('[role="menu"] button')
      .filter({ hasText: "❤️" })
      .first()
      .evaluate((el) => el.click());

    // Give the RPC bridge a tick — assert no append landed.
    await page.waitForTimeout(200);
    expect(calls).toEqual([]);
  });

  test("CH-007: same player + same emoji on same message is a no-op (de-dupe)", async ({
    mount,
    page,
  }) => {
    const { calls, onAppendCalled } = makeAppendCapture();
    // Alice has already 👍'd message 1. numReactionsPerMessage is generous
    // (3); the dedupe gate is what blocks her from 👍-ing it again.
    const component = await mount(
      <ChatHarness
        numReactionsPerMessage={3}
        reactionEmojisAvailable={["👍", "❤️", "😂"]}
        currentPlayerId="p1"
        playerConfigs={[
          { id: "p1", attrs: { position: 0, name: "alice", title: "T-0" } },
        ]}
        initialChatActions={[
          {
            id: 1,
            type: "send_message",
            content: "hi",
            playerPosition: 1,
            sender: { id: "p2", name: "bob", title: "T-1" },
            stage: "game_0_TestStage",
            time: 1.0,
          },
          {
            id: 2,
            type: "add_reaction_emoji",
            content: "👍",
            targetId: 1,
            playerPosition: 0,
            stage: "game_0_TestStage",
            time: 2.0,
          },
        ]}
        onAppendCalled={onAppendCalled}
      />,
    );

    await component.getByLabel("Add reaction").click();
    // Re-pick 👍 — same emoji alice already used. Container should
    // dedupe (`hasThisEmoji` branch).
    await component
      .locator('[role="menu"] button')
      .filter({ hasText: "👍" })
      .first()
      .evaluate((el) => el.click());

    await page.waitForTimeout(200);
    expect(calls).toEqual([]);

    // Picking ❤️ instead — within the per-message limit of 3 and not a
    // duplicate emoji — should land. This proves the dedupe gate is
    // emoji-specific, not a blanket block.
    await component.getByLabel("Add reaction").click();
    await component
      .locator('[role="menu"] button')
      .filter({ hasText: "❤️" })
      .first()
      .evaluate((el) => el.click());

    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].value).toMatchObject({
      type: "add_reaction_emoji",
      content: "❤️",
      targetId: 1,
      playerPosition: 0,
    });
  });
});
