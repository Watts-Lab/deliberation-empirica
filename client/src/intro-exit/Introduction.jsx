import React, { useEffect } from "react";
import { Button } from "../components/Button";
import { usePlayer } from "@empirica/player";

export function Introduction({ next }) {
  const player = usePlayer(); 

  // async function calculateStart() {
  //   const date = new Date(); 
  //   const time = date.getTime(); 
  //   console.log("intro start: " + time)

  //   player.set("startT", time);
  // }

  // calculateStart();

  useEffect(() => {
    // localStorage.clear();
    const date = new Date(); 
    const time = date.getTime(); 
    player.set("tStart", time);
    console.log("intro start: " + player.get("tStart"))
  }, []);
  

  return (
    <div className="ml-5 mt-1 sm:mt-5 p-5">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        About this study:
      </h3>
      <div className="mt-1 mb-6">
        <p className="text-sm text-gray-500">
          In this study you will be asked to <b>participate in a real discussion</b> on a given topic using a live video interface with real people.
          <p className="mt-1 text-sm text-gray-500">
            You may also be asked to <b>participate in pre-discussion training,</b> and <b>write about your group's answer.</b>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            You will also be asked to <b>complete an exit survey.</b>
          </p>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          This task will take approximately <b>15 - 35 minutes.</b>
        </p>
      <h3 className="mt-5 text-lg leading-6 font-medium text-gray-900">
        What you need to do:
      </h3>
        <p className = "mt-1 text-sm text-gray-500">
          Please use a <b>computer,</b> not a mobile device.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          You must have functional <b>audio</b> and <b>video</b> capabilities.
        </p>
        <p className="mt-1 text-sm text-gray-500">
        Please pay attention when the discussion begins and <b>participate actively.</b>
        </p>
      <h3 className="mt-5 text-lg leading-6 font-medium text-gray-900">
        Payment:
      </h3>
        <p className="mt-1 text-sm text-gray-500">
          You will be paid <b>$15</b> per hour based on your time spent from when you logged in until you complete the exit survey.
        </p>
      <h3 className="mt-5 text-lg leading-6 font-medium text-gray-900">
        How we use your data:
      </h3>
        <p className="mt-2 text-sm text-gray-500">
          <b>Your responses will not be disclosed during the session.</b> After the session, your responses will be
          anonymized and may be made public in order to enable broad collaboration in data analysis.  Anonymous 
          data will be made public with <b>publication in academic venues</b> in accordance with venue requirements.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          <b>Your audio and video data</b> may be <b>shared with select researchers under agreements of confidentiality 
          and data security</b>, in order to extract features from the recordings such as the use of body language, 
          tone, or interruption behavior.
        </p>
      <h3 className="mt-5 text-lg leading-6 font-medium text-gray-900">
        Informed Consent:
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        This activity is part of a scientific experiment to understand the process of group deliberation. Your participation 
        in this study is entirely voluntary, and you may withdraw at any point by closing this browser window. During this 
        activity, you may engage in video, audio, or text chat with other study participants. You may be shown instructional 
        material, asked to discuss particular topics, and complete surveys about your experience. We may record your discussion 
        for quality control and analysis. These recordings will be kept secure and confidential. We may share recordings under a 
        confidentiality agreement with researchers who specialize in video or audio analysis. Apart from these recordings, the only
        information we will have is your platform-assigned payment ID (e.g. MTurk worker ID) and the timestamps of your interactions
        with our site. We will record this ID to allow us to observe participation across sessions. There is no way for us to identify
        you or contact you outside of the crowd-sourcing platform through which you joined. Anonymous data (not including discussion
        recordings) may be shared publicly. Our aggregate results may be presented at scientific meetings or published in scientific
        journals. You can contact the research team by emailing deliberation-study@wharton.upenn.edu. You can call the University of
        Pennsylvania Institutional Review Board at 215-898-2614. Clicking on the "Next" button indicates that you are at least 18
        years of age, understand this agreement, and consent to participate voluntarily.
      </p>
      </div>  
      <p className="mb-10 text-md text-gray-600">
        <b>In the following screens you will be asked to check that your camera and microphone are working properly and 
        verify your understanding of the above instructions.</b>
      </p>
      <Button handleClick={next} base='inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500'>
        <p>Next</p>
      </Button>
    </div>
  );
}
