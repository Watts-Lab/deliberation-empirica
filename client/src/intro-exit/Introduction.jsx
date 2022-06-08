import React from "react";
import { Button } from "../components/Button";

export function Introduction({ next }) {
  return (
    <div className="ml-1 mt-1 sm:mt-5 p-5">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        About this study:
      </h3>
      <div className="mt-1 mb-6">
        <div className="text-sm text-gray-500">
          In this study you will be asked to <b>participate in a real discussion</b> on a given topic using a live video interface with real people.
          <p className="mt-1 text-sm text-gray-500">
            You may also be asked to <b>participate in pre-discussion training,</b> and <b>write about your group's answer.</b>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            You will also be asked to <b>complete an exit survey.</b>
          </p>
        </div>
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
      </div>  
      <p className="mb-10 text-md text-gray-600">
        <b>In the following screens you will be asked to check that your camera and microphone are working properly and 
        verify your understanding of the above instructions.</b>
      </p>
      <Button handleClick={next} autoFocus base='inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500'>
        <p>Next</p>
      </Button>
    </div>
  );
}
