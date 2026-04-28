import React, { useRef, useState } from "react";
import { MockEmpiricaProvider } from "../../../mocks/empirica/MockEmpiricaProvider";
import { Chat } from "../../../../client/src/components/discussion/chat/Chat";
import { MockStage } from "../../../mocks/empirica/MockStage";

/**
 * Test harness that mounts the Chat container with all the Empirica
 * dependencies it needs:
 *
 *   - usePlayer / usePlayers / useStageTimer / useProgressLabel come
 *     from MockEmpiricaProvider (already wired via vite alias)
 *   - `scope` (the chat-scoped append target) is a MockStage instance
 *     wired so that any `scope.append` triggers a re-render AND fires
 *     `onAppendCalled` back to the test runner. Tests use that callback
 *     to assert the exact action shape sent into Empirica.
 *
 * Lives in a separate file because Playwright CT only mounts components
 * that are statically importable.
 */
export function ChatHarness({
  // Player setup
  currentPlayerId = "p1",
  playerConfigs = [{ id: "p1", attrs: { position: 0, name: "alice" } }],
  // Initial chat history (array of action objects, same shape as
  // produced by Chat itself).
  initialChatActions = [],
  // Stage timer fields read by Chat: `elapsed` is what feeds into the
  // `time` field of each action.
  stageTimer = { elapsed: 12_000, ended: false },
  progressLabel = "game_0_TestStage",
  // Chat component props
  showNickname = true,
  showTitle = false,
  reactionEmojisAvailable = [],
  reactToSelf = true,
  numReactionsPerMessage = 1,
  // Callback to inspect every scope.append({key, value}) call
  onAppendCalled,
}) {
  const [, force] = useState(0);
  const scopeRef = useRef(null);
  if (!scopeRef.current) {
    // Real Empirica wraps each appended item as `{id, value, createdAt}`
    // — `chatUtils.reconstructChatState` reads `action.value.type`, etc.
    // MockStage stores raw appends, so we wrap on the way in here so
    // Chat sees the same shape it would in production.
    const wrapInitial = initialChatActions.map((a, i) => ({
      id: `attr-${i}`,
      value: a,
      createdAt: new Date(),
    }));
    const stage = new MockStage(
      { chat: wrapInitial },
      // re-render harness on every mutation so Chat sees fresh state
      () => force((n) => n + 1),
    );
    const originalAppend = stage.append.bind(stage);
    stage.append = (key, value) => {
      // Use the public getAttribute API rather than reaching into
      // `_attributes` directly — keeps the harness from binding to
      // MockStage internals.
      const existingAttribute = stage.getAttribute(key);
      const wrapped = {
        id: `attr-${existingAttribute?.items?.length ?? 0}`,
        value,
        createdAt: new Date(),
      };
      originalAppend(key, wrapped);
      if (onAppendCalled) {
        // Pass the *unwrapped* value to the test — that's what the
        // Chat handler produced, which is what the assertions are
        // checking. The wrapper is an Empirica-side detail.
        onAppendCalled({ key, value });
      }
    };
    scopeRef.current = stage;
  }

  return (
    <MockEmpiricaProvider
      currentPlayerId={currentPlayerId}
      playerConfigs={playerConfigs}
      stageTimer={stageTimer}
      progressLabel={progressLabel}
    >
      <Chat
        scope={scopeRef.current}
        showNickname={showNickname}
        showTitle={showTitle}
        reactionEmojisAvailable={reactionEmojisAvailable}
        reactToSelf={reactToSelf}
        numReactionsPerMessage={numReactionsPerMessage}
      />
    </MockEmpiricaProvider>
  );
}
