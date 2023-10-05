import React from "react";

export function RadioGroup({
  options,
  selected,
  onChange,
  label = "",
  testId = "unnamedRadioGroup",
}) {
  /*
  `options` is a list of elements:
    [ 
      {key: "option1", value: "Option 1"},
      {key: "option2", value: "Option 2"}
    ]
  `selected` is the key of the value to display as checked
  */

  const renderOption = ({ key, value }) => (
    <label
      className="font-normal text-sm text-gray-500"
      key={`${testId}_${key}`}
      data-test="option"
    >
      <input
        className="mr-2 shadow-sm"
        type="radio"
        value={key}
        checked={selected === key}
        onChange={onChange}
      />
      {value}
    </label>
  );

  return (
    <div className="mt-4" data-test={testId}>
      <label
        htmlFor={testId}
        className="block text-md font-medium text-gray-800 my-2"
      >
        {label}
      </label>
      <div className="ml-5 grid gap-1.5">{options.map(renderOption)}</div>
    </div>
  );
}
