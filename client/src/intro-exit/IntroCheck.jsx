import React from "react";
import { Introduction } from "./Introduction";
import { CheckUnderstanding } from "./CheckUnderstanding";

export default function IntroCheck({ next }) {
    return (
        <div className="grid grid-cols-2">
        <Introduction />
        <CheckUnderstanding next={next} />
    </div>
    ); 
}