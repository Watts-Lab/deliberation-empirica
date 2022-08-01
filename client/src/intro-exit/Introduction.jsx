import React from "react";
import { Button } from "../components/Button";

export function Introduction({ next }) {
  return (
    <div className="ml-5 mt-1 sm:mt-5 p-5 basis-1/2">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        In this study, you may be asked to:
      </h3>
      <div className="mt-1 mb-6">
        <p className="text-sm text-gray-500">
          - discuss a given topic over <b>a live video interface with real people</b>.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          - answer a question as a group. (Anyone can update your group's answer until the timer expires.)
        </p>
        <p className="mt-1 text-sm text-gray-500">
          - receive training in discussion skills. 
        </p>
        <p className="mt-1 text-sm text-gray-500"> 
          - answer questions about your discussion.
        </p>
      <h3 className="mt-5 text-lg leading-6 font-medium text-gray-900">
        What you need to do:
      </h3>
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
          You will be paid $15 per hour based on your time actively participating.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          This study takes approximately <b>15 - 35 minutes.</b>
        </p>
      <h3 className="mt-5 text-lg leading-6 font-medium text-gray-900">
        How we use your data:
      </h3>
        <p className="mt-2 text-sm text-gray-500">
          Your responses will not be shared with other participants. 
        </p>
        <p className="mt-2 text-sm text-gray-500">
          After the session, <b>anonymized data will be shared in academic publications and public data repositories.</b>
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Your audio and video data may be shared with select <b>researchers who commit to confidentiality and
          data security.</b>
        </p>
      </div>
    </div>
  );
}
