import React from "react";

export function CheckboxGroup({
  options,
  selected,
  onChange,
  label = "",
  testId = "unnamedCheckboxGroup",
}) {
  /*
  `options` is a list of elements:
    [ 
      {key: "option1", value: "Option 1"},
      {key: "option2", value: "Option 2"}
    ]
  `selected` is a list of selected keys
  */

  const onChangeWrapper = (key) => {
    const selectedNow = new Set(selected);
    if (document.getElementById(`${testId}_${key}`).checked) {
      selectedNow.add(key);
    } else {
      selectedNow.delete(key);
    }
    onChange(Array.from(selectedNow));
  };

  const renderOption = ({ key, value }) => (
    <label
      className="font-normal text-sm text-gray-500"
      key={`${testId}_${key}`}
      data-test="option"
    >
      <input
        className="mr-2 shadow-sm"
        type="checkbox"
        name={key}
        value={key}
        id={`${testId}_${key}`}
        checked={!!selected?.includes(key)}
        onChange={() => onChangeWrapper(key)}
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
