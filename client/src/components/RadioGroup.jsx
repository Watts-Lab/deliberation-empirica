import React from "react";

export function RadioGroup({
  options,
  selected,
  label = "",
  onChange,
  testId = "unlabeledRadioGroup",
}) {
  // options is an object where
  // - keys are the identifier to be used in the page
  // - values are the text string to display
  // e.g { nextTime: "Next Time", thisTime: "This Time" }

  const rows = Object.keys(options).map((key) => (
    <label className="font-normal text-sm text-gray-500">
      <input
        className="mr-2 shadow-sm"
        type="radio"
        name={key}
        value={key}
        key={key}
        checked={selected === key}
        onChange={onChange}
      />
      {options[key]}
    </label>
  ));

  return (
    <div className="mt-4" data-test={testId}>
      <label
        htmlFor={testId}
        className="block text-md font-medium text-gray-800 my-2"
      >
        {label}
      </label>
      <div className="ml-5 grid gap-1.5">{rows}</div>
    </div>
  );
}
