import React, { useEffect, useState, useRef } from "react";

export function TextArea({
  defaultText,
  onChange,
  onDebugMessage,
  testId,
  value,
  rows,
  showCharacterCount,
  minLength,
  maxLength,
  debounceDelay = 500,
}) {
  const [localValue, setLocalValue] = useState(value || "");
  const debounceTimeout = useRef(null);
  const keystrokeTimestamps = useRef([]);
  const isDebouncing = useRef(false);

  // Sync with external value only when not actively debouncing
  useEffect(() => {
    // Don't update local value from props if we're in the middle of debouncing
    // This prevents the textarea from resetting while the user is typing
    if (!isDebouncing.current) {
      setLocalValue(value || "");
    }
  }, [value]);

  const submitChange = (val) => {
    if (onChange && typeof onChange === "function") {
      onChange(val); // just pass value instead of event
    }
  };

  const debouncedSubmit = (val) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    isDebouncing.current = true;
    
    debounceTimeout.current = setTimeout(() => {
      isDebouncing.current = false;
      submitChange(val);
    }, debounceDelay);
  };

  const handlePaste = (e) => {
    // Prevent the default paste action
    e.preventDefault();

    const pastedText = e.clipboardData.getData("text");
    const debugMessage = {
      type: "pasteAttempt",
      content: pastedText,
      timestamp: Date.now(),
    };
    console.warn("Paste attempt detected in TextArea:", debugMessage);
    if (onDebugMessage) {
      onDebugMessage(debugMessage);
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;

    // If maxLength is set and new value exceeds it, prevent the change
    if (maxLength && newValue.length > maxLength) return;

    setLocalValue(newValue);
    debouncedSubmit(newValue);
  };

  const computeTypingStats = () => {
    const timestamps = keystrokeTimestamps.current;
    if (timestamps.length < 2) return null;

    const intervals = keystrokeTimestamps.current
      .slice(1)
      .map((t, i) => t - keystrokeTimestamps.current[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.map((x) => (x - avgInterval) ** 2).reduce((a, b) => a + b, 0) /
        intervals.length
    );

    return {
      totalKeystrokes: timestamps.length,
      avgInterval,
      stdDev,
    };
  };

  const handleBlur = () => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      isDebouncing.current = false;
    }
    submitChange(localValue);
    const typingStats = computeTypingStats();
    if (typingStats && onDebugMessage) {
      onDebugMessage({ type: "typingStats", ...typingStats });
    }
  };

  const handleKeyDown = () => {
    keystrokeTimestamps.current.push(Date.now());
  };

  const renderCharacterCount = () => {
    if (!showCharacterCount) return null;

    let countText = "";
    let colorClass = "text-gray-500";
    const currentLength = localValue.length;

    if (minLength && maxLength) {
      countText = `(${currentLength} / ${minLength}-${maxLength} chars)`;
      if (currentLength >= minLength && currentLength < maxLength) {
        colorClass = "text-green-600";
      } else if (currentLength === maxLength) {
        colorClass = "text-red-600";
      }
    } else if (minLength) {
      countText = `(${currentLength} / ${minLength}+ characters required)`;
      if (currentLength >= minLength) {
        colorClass = "text-green-600";
      }
    } else if (maxLength) {
      countText = `(${currentLength} / ${maxLength} chars max)`;
      if (currentLength === maxLength) {
        colorClass = "text-red-600";
      }
    } else {
      countText = `(${currentLength} characters)`;
    }

    return (
      <div className={`text-right text-sm mt-1 ${colorClass}`}>{countText}</div>
    );
  };

  return (
    <div className="relative">
      <textarea
        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm"
        id="responseTextArea"
        autoComplete="off"
        data-test={testId}
        rows={rows || "5"}
        placeholder={defaultText}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
      />
      {renderCharacterCount()}
    </div>
  );
}
