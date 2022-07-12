import React, { useRef, useEffect } from "react";
import { Introduction } from "./Introduction";
import { CheckUnderstanding } from "./CheckUnderstanding";

export default function IntroCheck({ next }) {
    const firstRender = useRef(true);

    useEffect(() => {
      if (firstRender.current) {
        firstRender.current = false;
        console.log("Intro Check")
        return;
      }
    });
    return (
        <div className="grid grid-cols-2">
        <Introduction />
        <CheckUnderstanding next={next} />
    </div>
    ); 
}