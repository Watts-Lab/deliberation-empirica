import React from "react";
import { Button } from "../components/Button";

export function Introduction({ next }) {
  return (
    <div className="mt-3 sm:mt-5 p-20">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        About this study:
      </h3>
      <div className="mt-2 mb-6">
        <p className="text-sm text-gray-500">
          In this study you will be asked to participate in a real discussion on a given topic using a live video interface with real people.
          <p>You may also be asked to participate in pre-discussion training, and write about your group's answer.</p>
          <p>You will also be asked to complete an exit survey.</p>
        </p>
        <p className="text-sm text-gray-500">
          This task will take approximately TIME
        </p>
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        What you need to do:
      </h3>
        <p className = "text-sm text-gray-500">
          Please use a computer, not a mobile device.
          You must have functional audio and video capabilities
          Please pay attention when the discussion begins and participate actively
        </p>
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        Payment:
      </h3>
        <p className="text-sm text-gray-500">
          You will be paid $15 per hour based on your time spent from when you logged in until you complete the exit survey.
        </p>
       <h3 className="text-lg leading-6 font-medium text-gray-900">
        How we use your data:
      </h3>
        <p className="text-sm text-gray-500">
          Your responses will not be disclosed during the session. After the session, your responses will be
          anonymized and may be made public in order to enable broad collaboration in data analysis.  Anonymous 
          data will be made public with publication in academic venues in accordance with venue requirements.
        </p>
        <p className="text-sm text-gray-500">
          Your audio and video data may be shared with select researchers under agreements of confidentiality 
          and data security, in order to extract features from the recordings such as the use of body language, 
          tone, or interruption behavior.
        </p>
      </div>  
      <p className="text-sm text-gray-500">
        In the following screen you will be asked to verify your understanding of the
        above instructions.
      </p>
      <Button handleClick={next} autoFocus>
        <p>Next</p>
      </Button>
    </div>
  );
}
