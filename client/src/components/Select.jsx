import React from "react";

export function Select({
  options,
  onChange,
  value,
  defaultValue,
  testId = "unnamedSelect",
}) {
  return (
    <select
      className="overflow-ellipsis truncate block w-full pl-3 pr-10 py-2.25 text-base shadow-sm border border-gray-500 sm:text-sm rounded-md focus:outline-none focus:ring-empirica-500 focus:border-empirica-500"
      onChange={onChange}
      data-test={testId}
      value={value}
      defaultValue={defaultValue}
    >
      {options.map((option) => {
        const optionValue =
          option.value !== undefined ? option.value : option.label;
        return (
          <option
            key={optionValue}
            value={optionValue}
            disabled={option.disabled}
            hidden={option.hidden}
          >
            {option.label}
          </option>
        );
      })}
    </select>
  );
}
