import React, {useEffect} from "react";
import { Button } from "../components/Button";
import { usePlayer} from "@empirica/player";


export default function BetaVideoConsent({ next }) {
  useEffect(() => {
    console.log("Intro: Video Use Consent")
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
          Thank you again for agreeing to participate in our "Friends and Family" beta test! <br/><br/>
          We would like to use the recording from your discussion today in presentations and promotional material.
        </h3>
        <p className="text-md font-medium text-gray-700">
        (e.g. giving talks to academics and funders, 
        and making an "about our research" video to show online.)
        </p>
        <br/>
        <h3 className="text-lg leading-6 text-gray-900">
          If you agree to us using your video in these ways, please click on the <b>"I Consent"</b> button below.
        </h3>
        <h3 className="text-lg leading-6 text-gray-900">
          Otherwise, please click on the <b>"No Thanks"</b> button, and we will not include your video in any published materials.
        </h3>
        <br/>
        <h3 className="text-lg leading-6 text-gray-900">
          If you change your mind at any time, please reach out to <a href="mailto:deliberation-study@wharton.upenn.edu"> deliberation-study@wharton.upenn.edu</a>.
        </h3>
        <div className="mt-3 flex flex-row">
          <Button handleClick={handleConsent} base='inline-flex items-center mr-2 px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500' id="enter-nickname">
            <p>I Consent</p>
          </Button>
          <Button handleClick={handleRefuse} base='inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500' id="enter-nickname">
            <p>No Thanks</p>
          </Button>
        </div>
      </div>
    );
}