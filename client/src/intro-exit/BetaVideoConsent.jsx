import React, {useState, useRef, useEffect} from "react";
import { Button } from "../components/Button";
import { usePlayer} from "@empirica/player";


export default function BetaVideoConsent({ next }) {
  useEffect(() => {
    console.log("Intro: Enter Nickname")
  }, []);

  const player = usePlayer();

  const labelClassName = 
    "mb-5 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm";

  function handleConsent() {
    player.set("videoConsent", true);
    next();
  }

  function handleRefuse() {
    player.set("videoConsent", false);
    next();
  }
  

    return (
      <div className="mt-3 sm:mt-5 p-20">
        <h3 className="text-lg leading-6 text-gray-900">
          Thank you again for agreeing to participate in our beta test today. <br/>
          For this particular experiment, we hereby request your consent for the following additional usage of data associated with you.
        </h3>
        <br/>
        <p className="mt-1 mb-3 text-lg font-medium text-gray-900">
            1. Video and audio from your discussion with other study participants will be recorded.
        </p>
        <p className="mt-1 mb-3 text-lg font-medium text-gray-900">
            2. Segments or the entirety of your textual responses and discussion recordings may be shared with the public for promotional or demostrational purposes.
        </p>
        <h3 className="text-lg leading-6 text-gray-900">
          If you agree with the above clauses please click on the <b>"I Consent"</b> button below. <br/>
          Otherwise, please click on the <b>"I Refuse"</b> button below and we will remove your video and responses from any publicized materials.
        </h3>
        <div className="mt-3 flex flex-row">
          <Button handleClick={handleConsent} base='inline-flex items-center mr-2 px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500' id="enter-nickname">
            <p>I Consent</p>
          </Button>
          <Button handleClick={handleRefuse} base='inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500' id="enter-nickname">
            <p>I Refuse</p>
          </Button>
        </div>
      </div>
    );
}