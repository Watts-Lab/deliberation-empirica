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

  const renderCharacterCount = () => {
    if (!showCharacterCount) return null;

    let countText = "";
    
    if (minLength && maxLength) {
      countText = `(${currentLength} / ${minLength}-${maxLength} chars)`;
    } else if (minLength) {
      countText = `(${currentLength} / ${minLength}+ characters required)`;
    } else if (maxLength) {
      countText = `(${currentLength} / ${maxLength} chars max)`;
    } else {
      countText = `(${currentLength} characters)`;
    }

    return (
      <div className="text-right text-sm text-gray-500 mt-1">
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
        onChange={onChange}
      />
      {renderCharacterCount()}
    </div>
  );
}
