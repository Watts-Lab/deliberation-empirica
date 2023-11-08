import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { H1 } from "../components/TextStyles";

export function AttentionCheck({ next }) {

  const [correctUntil, setCorrectUntil] = useState(0)

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
      // Find the index where the sentences don't match
      let mismatchIndex = 0;
      while (mismatchIndex < originalString.length && 
        sentenceInput[mismatchIndex] === originalString[mismatchIndex]) {
        mismatchIndex += 1;
      }

      setCorrectUntil(mismatchIndex)

      // Create the marked HTML content
      // const markedSentence = originalString
      //   .slice(0, mismatchIndex) // Matched part
      //   .replace(/(.+)$/,'<mark style="background-color:#80f880">$1</mark>') // Mark the last matched character
      //   + originalString.slice(mismatchIndex) // Rest of the original string
      //   .replace(/(.+)$/,'<mark style="background-color:#f88080">$1</mark>'); // Mark the remaining characters


      // document.getElementById("originalString").innerHTML = markedSentence;
      // // highlight matched parts with green and unmatched part with red
      // let matched = "";
      // let i = 0;
      // while (i < sentenceInput.length && sentenceInput.split('')[i] === originalString.split('')[i]) {
      //   matched += sentenceInput.split('')[i];
      //   i+=1;
      // }
      // // console.log(matched);
      // // render up til the index change coloring
      // let newS = originalString.replace(matched, `<mark style="background-color:#80f880">${matched}</mark>`);
      // const rest = originalString.replace(matched, '');
      // newS = newS.replace(rest, `<mark style="background-color:#f88080">${rest}</mark>`)
      // document.getElementById("originalString").innerHTML = newS;
    } else {
      // continue to the next step if matched exactly
      next();
    }
  };

  const renderMarkedSentence = () => {
    const markedSentence = [];
    
    for (let i = 0; i < originalString.length; i++) {
      if (i < correctUntil) {
        markedSentence.push(
          <mark key={i} style={{ backgroundColor: "#80f880" }}>
            {originalString[i]}
          </mark>
        );
      } else {
        markedSentence.push(
          <mark key={i} style={{ backgroundColor: "#f88080" }}>
            {originalString[i]}
          </mark>
        );
      }
    }
  
    return (
      <p>{markedSentence}</p>
    );
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
          {renderMarkedSentence()}
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
