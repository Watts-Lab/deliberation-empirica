import React, { useState, useRef } from "react";
import { EmojiPicker } from "./EmojiPicker";
import { EmojiIcon, SendIcon } from "./Icons";

export function TextBar({ onSendMessage, reactionEmojisAvailable }) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  const hasEmojiPicker =
    reactionEmojisAvailable && reactionEmojisAvailable.length > 0;

  const resize = (e) => {
    const { target } = e;
    target.style.height = "inherit";
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const txt = text.trim();
    if (txt === "") {
      return;
    }

    if (txt.length > 1024) {
      e.preventDefault();
      // eslint-disable-next-line no-alert
      alert("Max message length is 1024");
      return;
    }

    onSendMessage(txt);
    setText("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.shiftKey === false) {
      handleSubmit(e);
      resize(e);
    }
  };

  const handleKeyUp = (e) => {
    resize(e);
  };

  const handleEmojiSelect = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + emoji + text.substring(end);

    setText(newText);
    setShowEmojiPicker(false);

    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  return (
    <form
      className="p-2 flex items-stretch gap-2 border-t bg-white relative"
      onSubmit={handleSubmit}
    >
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          name="message"
          id="message"
          rows={1}
          className="peer resize-none bg-transparent block w-full rounded-md border-0 py-1.5 pl-4 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-300 focus:ring-2 focus:ring-inset focus:ring-empirica-500 sm:text-sm sm:leading-6"
          placeholder="Say something"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {hasEmojiPicker && (
          <>
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-empirica-500"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Insert emoji"
              aria-label="Insert emoji"
            >
              <EmojiIcon className="h-5 w-5" />
            </button>

            {showEmojiPicker && (
              <div className="absolute right-0 bottom-full mb-2 z-10">
                <EmojiPicker
                  emojis={reactionEmojisAvailable}
                  onSelect={handleEmojiSelect}
                  position="above"
                />
              </div>
            )}
          </>
        )}
      </div>

      <button
        type="submit"
        className="rounded-md bg-gray-100 w-9 h-9 p-2 text-sm font-semibold text-gray-500 shadow-sm hover:bg-gray-200 hover:text-empirica-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-empirica-500 flex-shrink-0"
        onClick={handleSubmit}
        aria-label="Send message"
      >
        <SendIcon className="h-full w-full" />
      </button>
    </form>
  );
}
