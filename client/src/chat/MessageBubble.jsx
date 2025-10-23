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
  const [isHovered, setIsHovered] = useState(false);

  const { text, sender, createdAt, reactions } = message;

  let { avatar } = sender;
  if (!avatar) {
    avatar = `https://avatars.dicebear.com/api/identicon/${sender.id}.svg`;
  }

  const avatarImage = avatar.startsWith("http") ? (
    <img
      className="inline-block h-8 w-8 rounded-full flex-shrink-0"
      src={avatar}
      alt={sender.id}
    />
  ) : (
    <div className="inline-block h-8 w-8 rounded-full flex-shrink-0">
      {avatar}
    </div>
  );

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
      <div className="flex justify-end items-start my-2 px-2">
        <div
          className="relative max-w-[75%]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setShowEmojiPicker(false);
          }}
        >
          <div className="flex flex-col items-end gap-1">
            <div className="bg-blue-500 text-white rounded-2xl px-4 py-2 break-words">
              <p className="text-sm leading-relaxed">{text}</p>
            </div>
            <div className="text-xs text-gray-400 px-2">
              {createdAt && relTime(createdAt)}
            </div>
            {reactions && reactions.length > 0 && (
              <ReactionList
                reactions={reactions}
                players={players}
                currentPlayerPosition={currentPlayerPosition}
                onRemove={onRemoveReaction}
              />
            )}
          </div>

          {canReact && isHovered && !showEmojiPicker && (
            <button
              type="button"
              className="absolute -left-8 top-0 p-1 rounded-full hover:bg-gray-200 transition-opacity opacity-0 hover:opacity-100 animate-fadeIn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add reaction"
              aria-label="Add reaction"
            >
              <EmojiIcon className="h-5 w-5 text-gray-600" />
            </button>
          )}

          {showEmojiPicker && (
            <div className="absolute right-0 top-0">
              <EmojiPicker
                emojis={reactionEmojisAvailable}
                onSelect={handleEmojiSelect}
                position="above"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Left-aligned gray bubble for other messages
  return (
    <div className="flex items-start my-2 px-2">
      <div className="mr-2">{avatarImage}</div>
      <div
        className="relative max-w-[75%]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowEmojiPicker(false);
        }}
      >
        <div className="flex flex-col gap-1">
          {(showNickname || showTitle) && (
            <p className="text-xs px-2">
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
          <div className="bg-gray-200 text-gray-900 rounded-2xl px-4 py-2 break-words">
            <p className="text-sm leading-relaxed">{text}</p>
          </div>
          <div className="text-xs text-gray-400 px-2">
            {createdAt && relTime(createdAt)}
          </div>
          {reactions && reactions.length > 0 && (
            <ReactionList
              reactions={reactions}
              players={players}
              currentPlayerPosition={currentPlayerPosition}
              onRemove={onRemoveReaction}
            />
          )}
        </div>

        {canReact && isHovered && !showEmojiPicker && (
          <button
            type="button"
            className="absolute -right-8 top-0 p-1 rounded-full hover:bg-gray-200 transition-opacity opacity-0 hover:opacity-100 animate-fadeIn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add reaction"
            aria-label="Add reaction"
          >
            <EmojiIcon className="h-5 w-5 text-gray-600" />
          </button>
        )}

        {showEmojiPicker && (
          <div className="absolute left-0 top-0">
            <EmojiPicker
              emojis={reactionEmojisAvailable}
              onSelect={handleEmojiSelect}
              position="above"
            />
          </div>
        )}
      </div>
    </div>
  );
}
