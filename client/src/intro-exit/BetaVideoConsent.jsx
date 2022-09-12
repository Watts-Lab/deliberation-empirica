import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { Button } from "../components/Button";

// const labelClassName = 'mb-5 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm';

export function BetaVideoConsent({ next }) {
  useEffect(() => {
    console.log("Intro: Video Use Consent");
  }, []);

  const player = usePlayer();

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
        {`Thank you again for agreeing to participate in our "Friends and Family" beta test! \n
        We would like to use the recording from your discussion today in presentations and promotional material.`}
      </h3>
      <p className="text-md font-medium text-gray-700">
        (e.g. giving talks to academics and funders,&nbsp; and making an
        &quot;about our research&quot; video to show online.)
      </p>
      <br />
      <h3 className="text-lg leading-6 text-gray-900">
        If you agree to us using your video in these ways, please click on
        the&nbsp;
        <b>&quot;I Consent&quot;</b>
        &nbsp;button below.
      </h3>
      <h3 className="text-lg leading-6 text-gray-900">
        Otherwise, please click on the&nbsp;
        <b>&quot;No Thanks&quot;</b>
        &nbsp;button, and we will not include your video in any published
        materials.
      </h3>
      <br />
      <h3 className="text-lg leading-6 text-gray-900">
        If you change your mind at any time, please reach out to&nbsp;
        <a href="mailto:deliberation-study@wharton.upenn.edu">
          {" "}
          deliberation-study@wharton.upenn.edu
        </a>
        .
      </h3>
      <div className="mt-3 flex flex-row">
        <Button handleClick={() => handleConsent()} id="enter-nickname">
          <p>I Consent</p>
        </Button>
        <Button handleClick={() => handleRefuse()} id="enter-nickname">
          <p>No Thanks</p>
        </Button>
      </div>
    </div>
  );
}
