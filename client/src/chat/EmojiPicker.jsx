import React from "react";

export function EmojiPicker({
  emojis,
  onSelect,
  position = "above",
  align = "left",
  className = "",
}) {
  if (!emojis || emojis.length === 0) return null;

  const positionClasses = {
    above: "bottom-full mb-2",
    below: "top-full mt-2",
  };
  const alignClasses = {
    left: "left-0",
    right: "right-0",
    center: "left-1/2 -translate-x-1/2",
    "outside-left": "right-full mr-2",
    "outside-right": "left-full ml-2",
  };
  const horizontalClass = alignClasses[align] || alignClasses.left;

  return (
    <div
      className={`absolute ${positionClasses[position]} ${horizontalClass} z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-2 grid grid-cols-[repeat(5,_minmax(0,_2.5rem))] justify-items-center gap-0.5 w-max ${className}`}
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
          className="hover:bg-gray-100 rounded text-xl transition-colors w-10 h-10 flex items-center justify-center"
          onClick={() => onSelect(emoji)}
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
