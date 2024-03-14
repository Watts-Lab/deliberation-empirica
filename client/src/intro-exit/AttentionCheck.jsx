import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";

export function AttentionCheck({ next }) {
  const [correctUntil, setCorrectUntil] = useState(undefined);
  const [sentenceInput, setSentenceInput] = useState("");
  const originalString =
    "I agree to participate in this study to the best of my ability.";

  useEffect(() => {
    console.log("Intro: Attention Check");
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (originalString !== sentenceInput) {
      console.log("sentences don't match");
      // Find the index where the sentences don't match
      let mismatchIndex = 0;
      while (
        mismatchIndex < originalString.length &&
        sentenceInput[mismatchIndex] === originalString[mismatchIndex]
      ) {
        mismatchIndex += 1;
      }
      setCorrectUntil(mismatchIndex);
    } else {
      // continue to the next step if matched exactly
      next();
    }
  };

  const renderSentence = () => {
    if (correctUntil === undefined) {
      return originalString;
    }
    return (
      <>
        <mark data-test="correctPortion" style={{ backgroundColor: "#80f880" }}>
          {originalString.substring(0, correctUntil)}
        </mark>
        <mark
          data-test="incorrectPortion"
          style={{ backgroundColor: "#f88080" }}
        >
          {originalString.substring(correctUntil)}
        </mark>
      </>
    );
  };

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        <h1>Please type the following sentence exactly:</h1>
        <span
          id="originalString"
          onCopy={(e) => {
            e.preventDefault();
            return false;
          }}
          onDrag={(e) => {
            e.preventDefault();
            return false;
          }}
        >
          <p className="my-4 pl-3 bg-gray-100">{renderSentence()}</p>
        </span>

        <form onSubmit={handleSubmit}>
          <input
            className="mb-5 mt-3 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 w-full"
            type="textarea"
            autoComplete="off"
            id="inputAttentionCheck"
            data-test="inputAttentionCheck"
            onChange={(e) => setSentenceInput(e.target.value)}
            onPaste={(e) => {
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
          {correctUntil !== undefined && (
            <p className="text-red-600 text-sm italic mb-5">
              Please correct any errors
            </p>
          )}
          <Button testId="continueAttentionCheck" handleClick={handleSubmit}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
