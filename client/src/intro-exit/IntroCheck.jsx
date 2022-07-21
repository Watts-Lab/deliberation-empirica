import React, { useRef, useEffect } from "react";
import { Introduction } from "./Introduction";
import { CheckUnderstanding } from "./CheckUnderstanding";

export default function IntroCheck({ next }) {

  useEffect(() => {
      console.log("Intro: Description and Understanding Check")
  }, []);

  return (
      <div className="grid grid-cols-2">
      <Introduction />
      <CheckUnderstanding next={next} />
  </div>
  ); 
}