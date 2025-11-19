// Utility functions for chat state reconstruction and management

export function relTime(date) {
  const difference = (new Date().getTime() - date.getTime()) / 1000;

  if (difference < 60) return `now`;
  if (difference < 3600) return `${Math.floor(difference / 60)}m`;
  if (difference < 86400) return `${Math.floor(difference / 3600)}h`;
  if (difference < 2620800) return `${Math.floor(difference / 86400)} days ago`;
  if (difference < 31449600)
    return `${Math.floor(difference / 2620800)} months ago`;
  return `${Math.floor(difference / 31449600)} years ago`;
}

/**
 * Reconstruct chat state from a list of actions
 * @param {Array} actions - Array of action objects
 * @returns {Array} - Array of message objects with their reactions
 */
export function reconstructChatState(actions) {
  if (!actions || actions.length === 0) return [];

  const messages = [];
  const reactionMap = {}; // Map of message id to reactions

  actions.forEach((action) => {
    const { value: actionValue } = action;
    
    if (actionValue.type === "send_message") {
      messages.push({
        id: actionValue.id,
        text: actionValue.content,
        playerPosition: actionValue.playerPosition,
        sender: actionValue.sender || {},
        time: actionValue.time,
        stage: actionValue.stage,
        createdAt: action.createdAt,
        reactions: [], // Will be populated with reactions
      });
    } else if (actionValue.type === "add_reaction_emoji") {
      const { targetId } = actionValue;
      if (!reactionMap[targetId]) {
        reactionMap[targetId] = [];
      }
      reactionMap[targetId].push({
        id: actionValue.id,
        emoji: actionValue.content,
        playerPosition: actionValue.playerPosition,
        addedAt: action.createdAt,
      });
    } else if (actionValue.type === "remove_reaction_emoji") {
      const { targetId } = actionValue;
      // Find and remove the reaction from any message
      Object.keys(reactionMap).forEach((messageId) => {
        reactionMap[messageId] = reactionMap[messageId].filter(
          (r) => r.id !== targetId
        );
      });
    }
  });

  // Add reactions to messages
  return messages.map((message) => {
    if (reactionMap[message.id]) {
      return { ...message, reactions: reactionMap[message.id] };
    }
    return message;
  });
}

/**
 * Get the next action ID
 * @param {Array} actions - Array of existing actions
 * @returns {number} - Next ID
 */
export function getNextActionId(actions) {
  if (!actions || actions.length === 0) return 0;
  const maxId = Math.max(...actions.map((a) => a.value.id || 0));
  return maxId + 1;
}
