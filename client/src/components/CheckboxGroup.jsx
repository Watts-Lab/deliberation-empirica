import React from "react";

export function CheckboxGroup({ options, selected, onChange, testId }) {
  // options is an object with keys=value, values=label
  // e.g { nextTime: "Next Time", thisTime: "This Time" }
  const rows = Object.keys(options).map((key) => (
    <label className="text-sm font-medium text-gray-700">
      <input
        className="mr-2 shadow-sm sm:text-sm"
        type="checkbox"
        name={key}
        value={key}
        id={`${testId}_${key}`}
        checked={selected.includes(key)}
        onChange={() => {
          const selectedNow = new Set(selected);
          if (document.getElementById(`${testId}_${key}`).checked) {
            selectedNow.add(key);
          } else {
            selectedNow.delete(key);
          }
          onChange(Array.from(selectedNow));
        }}
      />
      {options[key]}
    </label>
  ));

  return (
    <div className="ml-5 grid gap-1.5" data-test={testId}>
      {rows}
    </div>
  );
}
