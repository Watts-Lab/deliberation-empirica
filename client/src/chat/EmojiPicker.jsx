import React from "react";

export function EmojiPicker({ emojis, onSelect, position = "above" }) {
  if (!emojis || emojis.length === 0) return null;

  const positionClasses = {
    above: "bottom-full mb-2",
    below: "top-full mt-2",
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} left-0 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-1`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
        }
      }}
      role="menu"
      tabIndex={-1}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="hover:bg-gray-100 rounded p-2 text-xl transition-colors"
          onClick={() => onSelect(emoji)}
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
