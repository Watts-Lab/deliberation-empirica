import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { H1 } from "../components/TextStyles";

export function AttentionCheck({ next }) {
  useEffect(() => {
    console.log("Intro: Attention Check");
  }, []);

  const labelClassName =
    "mb-5 mt-3 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 w-full";

  const [sentenceInput, setSentenceInput] = useState("");
  const originalString = "Last Friday I saw a spotted striped blue worm shake hands with a legless lizard."

  const handleAttentionCheck = (e) => {
    setSentenceInput(e.target.value)
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (originalString !== sentenceInput) {
      console.log("sentences don't match")
      // highlight matched parts with green and unmatched part with red
      let matched = "";
      let i = 0;
      while (i < sentenceInput.length && sentenceInput.split('')[i] === originalString.split('')[i]) {
        matched += sentenceInput.split('')[i];
        i+=1;
      }
      // console.log(matched);
      let newS = originalString.replace(matched, `<mark style="background-color:#80f880">${matched}</mark>`);
      const rest = originalString.replace(matched, '');
      newS = newS.replace(rest, `<mark style="background-color:#f88080">${rest}</mark>`)
      document.getElementById("originalString").innerHTML = newS;
    } else {
      // continue to the next step if matched exactly
      next();
    }
  };

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        <H1>
          In the box below, please copy the following sentence exactly:
        </H1>
        <span id="originalString"
            onCopy={(e) => {
              e.preventDefault();
              return false;
            }}
            onDrag={(e) => {
              e.preventDefault();
              return false;
            }}>
          {originalString}
        </span>
        
        <form onSubmit={handleSubmit}>
          <input
            className={labelClassName}
            type="textarea"
            autoComplete="off"
            id="inputAttentionCheck"
            data-test="inputAttentionCheck"
            onChange={handleAttentionCheck}
            onPaste= {(e) => {
              e.preventDefault();
              return false;
            }}
            onCopy={(e) => {
              e.preventDefault();
              return false;
            }}
            onDrop={(e) => {
              e.preventDefault();
              return false;
            }}
            // autoFocus
          />
          <Button testId="continueAttentionCheck" handleClick={handleSubmit}>
            <p>Continue</p>
          </Button>
        </form>
      </div>
    </div>
  );
}
