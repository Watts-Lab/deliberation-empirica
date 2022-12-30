import React from "react";

export function RadioGroup({
  options,
  selected,
  onChange,
  label = "",
  testId = "unnamedRadioGroup",
}) {
  /*
  `options` is an object where
   - keys are the identifier to be used in the page
   - values are the text string to display
   e.g { nextTime: "Next Time", thisTime: "This Time" }
   `selected` is the key of the value to display as checked
  */

  const keys = Object.keys(options);

  const rows = keys.map((key) => (
    <label className="font-normal text-sm text-gray-500" key={key}>
      <input
        className="mr-2 shadow-sm"
        type="radio"
        value={key}
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
