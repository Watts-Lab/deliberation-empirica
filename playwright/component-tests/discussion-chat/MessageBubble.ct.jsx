import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { MessageBubble } from "../../../client/src/components/discussion/chat/MessageBubble";

/**
 * Component tests for MessageBubble title rendering.
 *
 * Replaces the title-rendering assertions retired from cypress 03:
 *
 *   cy.get("...").contains("Title-A-Position-0");
 *   cy.get("...").contains("(Title-A-Position-0)").should("not.exist");
 *
 * The exact regression cypress 03 was guarding against — title shown
 * with parentheses when it shouldn't be — lives in MessageBubble.jsx
 * line ~124:
 *
 *   {showNickname ? `(${sender.title})` : sender.title}
 *
 * That branching is the only place a title can pick up parentheses,
 * and there was no L2 coverage of it before this file. The cypress
 * spec running against a full Empirica stack was overkill; pin the
 * branch directly.
 *
 * Tests:
 *   MB-001  showTitle + showNickname → title in parens, alongside nickname
 *   MB-002  showTitle alone → title without parens (cypress 03 regression)
 *   MB-003  showNickname alone → no title rendered
 *   MB-004  neither flag → header strip not rendered at all
 */

const baseMessage = {
  id: "msg-1",
  text: "hello world",
  sender: {
    name: "nickname_alice",
    title: "Title-A-Position-0",
  },
  // chatUtils.relTime calls `.getTime()` on this — must be a Date instance,
  // not a number. Pass a fixed past time so the rendered "Xm ago" is stable.
  createdAt: new Date(Date.now() - 60_000),
  reactions: [],
};

test.describe("MessageBubble title rendering", () => {
  test("MB-001: showTitle + showNickname renders title in parentheses next to nickname", async ({
    mount,
  }) => {
    const component = await mount(
      <MessageBubble
        message={baseMessage}
        isSelf={false}
        showNickname
        showTitle
      />,
    );

    await expect(component.getByText("nickname_alice")).toBeVisible();
    // Title appears with parens — that's the documented "both flags" shape.
    await expect(component.getByText("(Title-A-Position-0)")).toBeVisible();
  });

  test("MB-002: showTitle alone renders title without parentheses (cypress 03 regression guard)", async ({
    mount,
  }) => {
    const component = await mount(
      <MessageBubble
        message={baseMessage}
        isSelf={false}
        showNickname={false}
        showTitle
      />,
    );

    // Title should appear bare — this is what cypress 03 was pinning.
    await expect(component.getByText("Title-A-Position-0")).toBeVisible();
    // The parenthesized form must NOT appear when nickname is hidden.
    // toHaveCount(0) is strict DOM-absence (cypress's `should("not.exist")`
    // semantics). `.not.toBeVisible()` would pass for hidden-but-present.
    await expect(component.getByText("(Title-A-Position-0)")).toHaveCount(0);
    // And no nickname.
    await expect(component.getByText("nickname_alice")).toHaveCount(0);
  });

  test("MB-003: showNickname alone renders nickname without title", async ({
    mount,
  }) => {
    const component = await mount(
      <MessageBubble
        message={baseMessage}
        isSelf={false}
        showNickname
        showTitle={false}
      />,
    );

    await expect(component.getByText("nickname_alice")).toBeVisible();
    await expect(component.getByText("Title-A-Position-0")).toHaveCount(0);
    await expect(component.getByText("(Title-A-Position-0)")).toHaveCount(0);
  });

  test("MB-004: neither flag → no nickname or title rendered", async ({
    mount,
  }) => {
    const component = await mount(
      <MessageBubble
        message={baseMessage}
        isSelf={false}
        showNickname={false}
        showTitle={false}
      />,
    );

    await expect(component.getByText("nickname_alice")).toHaveCount(0);
    await expect(component.getByText("Title-A-Position-0")).toHaveCount(0);
    // Message body itself still renders.
    await expect(component.getByText("hello world")).toBeVisible();
  });
});
