import React, { useState } from "react";
import { relTime } from "./chatUtils";
import { ReactionList } from "./ReactionList";
import { EmojiPicker } from "./EmojiPicker";
import { EmojiIcon } from "./Icons";

export function MessageBubble({
  message,
  isSelf,
  showNickname,
  showTitle,
  reactionEmojisAvailable,
  reactToSelf,
  onAddReaction,
  onRemoveReaction,
  players,
  currentPlayerPosition,
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = React.useRef(null);

  const { text, sender, createdAt, reactions } = message;

  // Close picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const canReact =
    reactionEmojisAvailable &&
    reactionEmojisAvailable.length > 0 &&
    (reactToSelf || !isSelf);

  const handleEmojiSelect = (emoji) => {
    if (onAddReaction) {
      onAddReaction(message.id, emoji);
    }
    setShowEmojiPicker(false);
  };

  if (isSelf) {
    // Right-aligned blue bubble for self messages
    return (
      <div className="flex justify-end items-start my-2 px-2 group">
        <div className="relative max-w-[75%]">
          <div className="flex flex-col items-end gap-1">
            <div className="relative bg-blue-500 text-white rounded-2xl px-4 py-3 break-words">
              <p className="text-base leading-relaxed text-white my-0">{text}</p>
              {/* Speech bubble tail pointing bottom-right */}
              <div className="absolute bottom-0 right-0 w-0 h-0 border-l-8 border-l-transparent border-t-8 border-t-blue-500 translate-x-1 translate-y-2" />
            </div>
            {reactions && reactions.length > 0 && (
              <ReactionList
                reactions={reactions}
                players={players}
                currentPlayerPosition={currentPlayerPosition}
                onRemove={onRemoveReaction}
                align="right"
              />
            )}
            <div className="text-xs text-gray-400 px-2">
              {createdAt && relTime(createdAt)}
            </div>
          </div>

          {canReact && (
            <button
              type="button"
              className="absolute -left-8 top-0 p-1 rounded-full hover:bg-gray-200 text-gray-300 group-hover:text-gray-600 transition-colors"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add reaction"
              aria-label="Add reaction"
            >
              <EmojiIcon className="h-5 w-5" />
            </button>
          )}

          {showEmojiPicker && (
            <div className="absolute left-0 top-8" ref={pickerRef}>
              <EmojiPicker
                emojis={reactionEmojisAvailable}
                onSelect={handleEmojiSelect}
                position="above"
                align="outside-left"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Left-aligned gray bubble for other messages
  return (
    <div className="flex items-start my-2 px-2 group">
      <div className="relative max-w-[75%]">
        {(showNickname || showTitle) && (
          <p className="text-xs px-2 mb-1">
            {showNickname && (
              <span className="font-semibold text-gray-900">
                {sender.name}
              </span>
            )}{" "}
            {showTitle && (
              <span
                className={`${
                  showNickname
                    ? "font-normal text-gray-500"
                    : "font-semibold text-gray-900"
                }`}
              >
                {showNickname ? `(${sender.title})` : sender.title}
              </span>
            )}
          </p>
        )}
        <div className="relative flex flex-col gap-1">
          <div className="relative bg-gray-200 text-gray-900 rounded-2xl px-4 py-3 break-words">
            <p className="text-base leading-relaxed my-0">{text}</p>
            {/* Speech bubble tail pointing bottom-left */}
            <div className="absolute bottom-0 left-0 w-0 h-0 border-r-8 border-r-transparent border-t-8 border-t-gray-200 -translate-x-1 translate-y-2" />
          </div>
          {reactions && reactions.length > 0 && (
            <ReactionList
              reactions={reactions}
              players={players}
              currentPlayerPosition={currentPlayerPosition}
              onRemove={onRemoveReaction}
              align="left"
            />
          )}
          <div className="text-xs text-gray-400 px-2">
            {createdAt && relTime(createdAt)}
          </div>

          {canReact && (
            <button
              type="button"
              className="absolute -right-8 top-0 p-1 rounded-full hover:bg-gray-200 text-gray-300 group-hover:text-gray-600 transition-colors"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add reaction"
              aria-label="Add reaction"
            >
              <EmojiIcon className="h-5 w-5" />
            </button>
          )}

          {showEmojiPicker && (
            <div className="absolute right-0 top-6" ref={pickerRef}>
              <EmojiPicker
                emojis={reactionEmojisAvailable}
                onSelect={handleEmojiSelect}
                position="above"
                align="outside-right"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
