import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { EmojiPicker } from "../../../client/src/components/discussion/chat/EmojiPicker";

/**
 * Component tests for EmojiPicker — the floating emoji-grid menu used
 * by both TextBar (chat composer) and MessageBubble (reaction picker).
 *
 *   EP-001  No render when emojis is undefined / empty
 *   EP-002  Renders one button per emoji
 *   EP-003  Clicking a button calls onSelect with that emoji
 *   EP-004  role="menu" is set on the wrapper
 *   EP-005  Click events stopPropagation (clicking inside the picker
 *           shouldn't bubble out and trigger any parent close-on-click
 *           handlers)
 */

const makeCapture = () => {
  const selected = [];
  const onSelect = (emoji) => {
    selected.push(emoji);
  };
  return { selected, onSelect };
};

test.describe("EmojiPicker", () => {
  test("EP-001: no render when emojis is undefined", async ({ mount }) => {
    const component = await mount(<EmojiPicker onSelect={() => {}} />);
    // Component returns null — root is empty.
    await expect(component.locator('[role="menu"]')).toHaveCount(0);
  });

  test("EP-001b: no render when emojis is []", async ({ mount }) => {
    const component = await mount(
      <EmojiPicker onSelect={() => {}} emojis={[]} />,
    );
    await expect(component.locator('[role="menu"]')).toHaveCount(0);
  });

  test("EP-002: renders one button per emoji", async ({ mount }) => {
    const component = await mount(
      <EmojiPicker onSelect={() => {}} emojis={["👍", "❤️", "😂", "🎉"]} />,
    );
    // `component` is the menu root itself. Count its child buttons.
    await expect(component.locator("button")).toHaveCount(4);
    // Each button shows the emoji as its text content.
    const texts = await component.locator("button").allTextContents();
    expect(texts).toEqual(["👍", "❤️", "😂", "🎉"]);
  });

  test("EP-003: clicking a button calls onSelect with that emoji", async ({
    mount,
  }) => {
    const { selected, onSelect } = makeCapture();
    const component = await mount(
      <EmojiPicker onSelect={onSelect} emojis={["👍", "❤️", "😂"]} />,
    );

    // Click the second button (❤️). Use evaluate-click to bypass viewport
    // checks — EmojiPicker has no fixed mount-side positioning, but its
    // grid sizing means buttons can land just outside the CT viewport.
    await component
      .locator("button")
      .nth(1)
      .evaluate((el) => el.click());
    await expect.poll(() => selected).toEqual(["❤️"]);

    // Click the third (😂) — onSelect fires again with new emoji.
    await component
      .locator("button")
      .nth(2)
      .evaluate((el) => el.click());
    await expect.poll(() => selected).toEqual(["❤️", "😂"]);
  });

  test("EP-004: role=menu is set on the wrapper", async ({ mount }) => {
    const component = await mount(
      <EmojiPicker onSelect={() => {}} emojis={["👍"]} />,
    );
    // `component` IS the menu root.
    await expect(component).toHaveAttribute("role", "menu");
  });

  test("EP-005: clicks inside the picker stopPropagation", async ({
    mount,
  }) => {
    // Wrap the picker in a parent that records clicks. If EmojiPicker
    // properly stops propagation, the parent handler should not fire
    // when clicking a picker button.
    let parentClicks = 0;
    const onParentClick = () => {
      parentClicks += 1;
    };
    const component = await mount(
      <div data-testid="parent" onClick={onParentClick}>
        <EmojiPicker onSelect={() => {}} emojis={["👍"]} />
      </div>,
    );

    await component
      .locator('[role="menu"] button')
      .first()
      .evaluate((el) => el.click());

    // Give React a tick to flush, then confirm the parent's onClick
    // never fired.
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(parentClicks).toBe(0);
  });
});
