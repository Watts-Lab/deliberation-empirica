import React, { useEffect, useRef, useState } from "react";
import { usePlayer, useStageTimer, usePlayers } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { MessageBubble } from "./MessageBubble";
import { TextBar } from "./TextBar";
import { reconstructChatState, getNextActionId } from "./chatUtils";

export function Chat({
  scope,
  attribute = "chat",
  showNickname = true,
  showTitle = false,
  reactionEmojisAvailable = [],
  reactToSelf = true,
  numReactionsPerMessage = 1,
}) {
  const player = usePlayer();
  const players = usePlayers();
  const progressLabel = player.get("progressLabel");
  const stageTimer = useStageTimer();
  const [messages, setMessages] = useState([]);
  const scroller = useRef();

  const currentPlayerPosition = player?.get("position");

  // Reconstruct chat state from actions whenever they change
  useEffect(() => {
    const actions = scope?.getAttribute(attribute)?.items || [];
    const reconstructed = reconstructChatState(actions);
    setMessages(reconstructed);
  }, [scope?.getAttribute(attribute)?.items?.length, scope, attribute]); // Depend on items length

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [messages]);

  if (!stageTimer) return null;
  const elapsed = (stageTimer?.elapsed || 0) / 1000;

  if (!scope || !player) {
    return <Loading />;
  }

  const handleSendMessage = (text) => {
    const actions = scope.getAttribute(attribute)?.items || [];
    const actionId = getNextActionId(actions);

    scope.append(attribute, {
      id: actionId,
      type: "send_message",
      content: text,
      targetId: undefined,
      playerPosition: currentPlayerPosition,
      sender: {
        id: player?.id,
        name: player?.get("name") || player?.id,
        title: player?.get("title"),
        avatar: player?.get("avatar"),
      },
      stage: progressLabel,
      time: elapsed,
    });
  };

  const handleAddReaction = (messageId, emoji) => {
    // Check if reactions are enabled
    if (!reactionEmojisAvailable || reactionEmojisAvailable.length === 0) {
      return;
    }

    // Check numReactionsPerMessage limit
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const currentPlayerReactions = message.reactions.filter(
      (r) => r.playerPosition === currentPlayerPosition
    );

    if (currentPlayerReactions.length >= numReactionsPerMessage) {
      // User has reached their limit, don't add more
      return;
    }

    // Check if user already reacted with this specific emoji
    const hasThisEmoji = currentPlayerReactions.some(
      (r) => r.emoji === emoji
    );
    if (hasThisEmoji) {
      // User already used this emoji, don't add duplicate
      return;
    }

    const actions = scope.getAttribute(attribute)?.items || [];
    const actionId = getNextActionId(actions);

    scope.append(attribute, {
      id: actionId,
      type: "add_reaction_emoji",
      content: emoji,
      targetId: messageId,
      playerPosition: currentPlayerPosition,
      stage: progressLabel,
      time: elapsed,
    });
  };

  const handleRemoveReaction = (reactionId) => {
    const actions = scope.getAttribute(attribute)?.items || [];
    const actionId = getNextActionId(actions);

    scope.append(attribute, {
      id: actionId,
      type: "remove_reaction_emoji",
      content: undefined,
      targetId: reactionId,
      playerPosition: currentPlayerPosition,
      stage: progressLabel,
      time: elapsed,
    });
  };

  if (messages.length === 0) {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="h-full w-full flex justify-center items-center">
          <div className="flex flex-col justify-center items-center w-2/3 space-y-2">
            <div className="w-24 h-24 text-gray-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-full w-full fill-current"
                viewBox="0 0 512 512"
              >
                <path d="M123.6 391.3c12.9-9.4 29.6-11.8 44.6-6.4c26.5 9.6 56.2 15.1 87.8 15.1c124.7 0 208-80.5 208-160s-83.3-160-208-160S48 160.5 48 240c0 32 12.4 62.8 35.7 89.2c8.6 9.7 12.8 22.5 11.8 35.5c-1.4 18.1-5.7 34.7-11.3 49.4c17-7.9 31.1-16.7 39.4-22.7zM21.2 431.9c1.8-2.7 3.5-5.4 5.1-8.1c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208s-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6c-15.1 6.6-32.3 12.6-50.1 16.1c-.8 .2-1.6 .3-2.4 .5c-4.4 .8-8.7 1.5-13.2 1.9c-.2 0-.5 .1-.7 .1c-5.1 .5-10.2 .8-15.3 .8c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4c4.1-4.2 7.8-8.7 11.3-13.5c1.7-2.3 3.3-4.6 4.8-6.9c.1-.2 .2-.3 .3-.5z" />
              </svg>
            </div>

            <h4 className="text-gray-700 font-semibold">No chat yet</h4>

            <p className="text-gray-500 text-center">
              Send a message to start the conversation.
            </p>
          </div>
        </div>
        <TextBar
          onSendMessage={handleSendMessage}
          reactionEmojisAvailable={reactionEmojisAvailable}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="h-full overflow-auto" ref={scroller}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isSelf={message.playerPosition === currentPlayerPosition}
            showNickname={showNickname}
            showTitle={showTitle}
            reactionEmojisAvailable={reactionEmojisAvailable}
            reactToSelf={reactToSelf}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
            players={players}
            currentPlayerPosition={currentPlayerPosition}
          />
        ))}
      </div>
      <TextBar
        onSendMessage={handleSendMessage}
        reactionEmojisAvailable={reactionEmojisAvailable}
      />
    </div>
  );
}
