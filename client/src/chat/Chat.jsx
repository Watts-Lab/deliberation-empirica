import React, { useEffect, useRef, useState } from "react";
import { usePlayer, useStageTimer, usePlayers } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { MessageBubble } from "./MessageBubble";
import { TextBar } from "./TextBar";
import { ChatIcon } from "./Icons";
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
      scroller.current.scrollTo({
        top: scroller.current.scrollHeight,
        behavior: "smooth",
      });
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
        name: player?.get("name") || `Player ${currentPlayerPosition + 1}`,
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
              <ChatIcon />
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
        <div className="min-h-full flex flex-col justify-end">
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
      </div>
      <TextBar
        onSendMessage={handleSendMessage}
        reactionEmojisAvailable={reactionEmojisAvailable}
      />
    </div>
  );
}
