import React, { useState } from "react";

export function ReactionList({
  reactions,
  players,
  currentPlayerPosition,
  onRemove,
}) {
  const [hoveredReaction, setHoveredReaction] = useState(null);

  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    if (!acc[emoji]) {
      acc[emoji] = [];
    }
    acc[emoji].push(reaction);
    return acc;
  }, {});

  const getPlayerName = (playerPosition) => {
    const player = players?.find((p) => p.get("position") === playerPosition);
    return player?.get("name") || `Player ${playerPosition + 1}`;
  };

  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => {
        const count = emojiReactions.length;
        const hasCurrentPlayer = emojiReactions.some(
          (r) => r.playerPosition === currentPlayerPosition
        );
        const currentPlayerReaction = emojiReactions.find(
          (r) => r.playerPosition === currentPlayerPosition
        );

        return (
          <div
            key={emoji}
            className="relative inline-block"
            onMouseEnter={() => setHoveredReaction(emoji)}
            onMouseLeave={() => setHoveredReaction(null)}
          >
            <button
              type="button"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm ${
                hasCurrentPlayer
                  ? "bg-blue-100 border-2 border-blue-400"
                  : "bg-gray-100 border border-gray-300"
              } hover:bg-gray-200 transition-colors`}
              onClick={() => {
                if (hasCurrentPlayer && onRemove && currentPlayerReaction) {
                  onRemove(currentPlayerReaction.id);
                }
              }}
              title={
                hasCurrentPlayer
                  ? "Click to remove your reaction"
                  : emojiReactions.map((r) => getPlayerName(r.playerPosition)).join(", ")
              }
            >
              <span>{emoji}</span>
              {count > 1 && <span className="text-xs font-medium">{count}</span>}
            </button>

            {hoveredReaction === emoji && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-20">
                {emojiReactions.map((r) => getPlayerName(r.playerPosition)).join(", ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
