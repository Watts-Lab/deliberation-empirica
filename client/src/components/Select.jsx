import React from "react";

export function Select({ options, onChange, testId = "unnamedSelect" }) {
  return (
    <select
      className="overflow-ellipsis truncate block w-full pl-3 pr-10 py-2.25 text-base shadow-sm border border-gray-500 sm:text-sm rounded-md focus:outline-none focus:ring-empirica-500 focus:border-empirica-500"
      onChange={onChange}
      data-test={testId}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value || option.label}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
