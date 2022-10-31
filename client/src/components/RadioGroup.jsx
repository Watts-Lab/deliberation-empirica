import React, { useState } from "react";
import { P } from "./TextStyles";

export function RadioGroup({
  options,
  selected,
  onChange,
  label = "",
  live = false,
  setBy = "Someone",
  testId = "unlabeledRadioGroup",
}) {
  /*
  `options` is an object where
   - keys are the identifier to be used in the page
   - values are the text string to display
   e.g { nextTime: "Next Time", thisTime: "This Time" }

   `live` is a flag to indicate whether changes to the answer should be highlighted
  */

  const [lastSelected, setLastSelected] = useState(selected);
  const [displayClickMessage, setDisplayClickMessage] = useState(false);
  if (live && lastSelected !== selected) {
    setDisplayClickMessage(true);
    setLastSelected(selected);
    setTimeout(() => {
      setDisplayClickMessage(false);
    }, 5000);
  }

  const rows = Object.keys(options).map((key) => (
    <label className="font-normal text-sm text-gray-500" key={key}>
      <input
        className="mr-2 shadow-sm"
        type="radio"
        name={key}
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
      {displayClickMessage && <P>{`${setBy} changed the selected answer.`}</P>}
    </div>
  );
}
