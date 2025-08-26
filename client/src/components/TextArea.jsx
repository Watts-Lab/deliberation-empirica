import React from "react";

export function TextArea({ 
  defaultText, 
  onChange, 
  testId, 
  value, 
  rows, 
  showCharacterCount,
  minLength,
  maxLength 
}) {
  const currentLength = value ? value.length : 0;

  // Handle input change with max length validation
  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // If maxLength is set and new value exceeds it, prevent the change
    if (maxLength && newValue.length > maxLength) {
      return; // Don't call onChange, effectively preventing the input
    }
    
    onChange(e);
  };

  const renderCharacterCount = () => {
    if (!showCharacterCount) return null;

    let countText = "";
    let colorClass = "text-gray-500"; // default color
    
    if (minLength && maxLength) {
      countText = `(${currentLength} / ${minLength}-${maxLength} chars)`;
      if (currentLength >= minLength && currentLength <= maxLength) {
        colorClass = "text-green-600"; // green when in valid range
      } else if (currentLength > maxLength) {
        colorClass = "text-red-600"; // red when over max
      }
    } else if (minLength) {
      countText = `(${currentLength} / ${minLength}+ characters required)`;
      if (currentLength >= minLength) {
        colorClass = "text-green-600"; // green when minimum met
      }
    } else if (maxLength) {
      countText = `(${currentLength} / ${maxLength} chars max)`;
      if (currentLength > maxLength) {
        colorClass = "text-red-600"; // red when over max
      } else if (currentLength === maxLength) {
        colorClass = "text-yellow-600"; // yellow when at max
      }
    } else {
      countText = `(${currentLength} characters)`;
    }

    return (
      <div className={`text-right text-sm mt-1 ${colorClass}`}>
        {countText}
      </div>
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
        value={value || ""}
        onChange={handleChange}
      />
      {renderCharacterCount()}
    </div>
  );
}
