import React from "react";
import { DebounceInput } from "react-debounce-input";

export function TextArea({ defaultText, onChange, testId, value, rows }) {
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
      onChange={onChange}
      debounceTimeout={2000}
    />
  );
}
