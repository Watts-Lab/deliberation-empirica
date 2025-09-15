import React, { useRef, useCallback } from "react";
import { DebounceInput } from "react-debounce-input";

export function TextArea({ defaultText, onChange, testId, value, rows, onInteraction }) {
  const interactionsRef = useRef([]);

  const logInteraction = useCallback((type, data) => {
    const interaction = {
      timestamp: Date.now(),
      type,
      ...data
    };
    interactionsRef.current.push(interaction);
    
    // Log to console for debugging
    console.log(`[TextArea] Interaction logged:`, interaction);
    
    // Call the onInteraction callback if provided to pass interactions to parent
    if (onInteraction) {
      onInteraction([...interactionsRef.current]);
    }
  }, [onInteraction]);

  const handleKeyDown = useCallback((e) => {
    logInteraction('keydown', {
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    });
  }, [logInteraction]);

  const handleKeyUp = useCallback((e) => {
    logInteraction('keyup', {
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    });
  }, [logInteraction]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    logInteraction('paste_blocked', {
      clipboardLength: e.clipboardData?.getData('text')?.length || 0
    });
    return false;
  }, [logInteraction]);

  const handleFocus = useCallback(() => {
    logInteraction('focus', {});
  }, [logInteraction]);

  const handleBlur = useCallback(() => {
    logInteraction('blur', {});
  }, [logInteraction]);

  const handleChange = useCallback((e) => {
    logInteraction('change', {
      textLength: e.target.value.length
    });
    onChange(e);
  }, [onChange, logInteraction]);

  return (
    <DebounceInput
      element="textarea"
      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm"
      id="responseTextArea"
      autoComplete="off"
      data-test={testId}
      rows={rows || "5"}
      placeholder={defaultText}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
      debounceTimeout={2000}
    />
  );
}
