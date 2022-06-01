import React, {useState} from "react";
import { useEffect } from "react";
import { Button } from "../components/Button";
import { Radio } from "./ExitSurvey"

export function CheckUnderstanding({ next }) {
    const [time, setTime] = useState("");
    const [timeCorrect, setTimeCorrect] = useState(false);
    const [task, setTask] = useState(false);
    const [response, setResponse] = useState(false);
    const [video, setVideo] = useState(false);
    const [allowContinue, setAllowContinue] = useState(false);
    const [showAlert, setShowAlert] = useState(false);

    useEffect(() => {
      if (time === "correct" && task && response && video) {
        setAllowContinue(true);
      } else {
        setAllowContinue(false);
      }
    })

    // function checkContinue() {
    //   if (timeCorrect && task && response && video) {
    //     setAllowContinue(true);
    //   }
    // }

    function handleTime(e) {
      setTime(e.target.value);
      // if (time === "correct" && task && response && video) {
      //   setAllowContinue(true);
      // }
      // console.log("task" + task);
      // console.log("response" + response);
      // console.log("time" + time);
      // console.log("video" + video);
      // console.log("allowContinue" + allowContinue);
    }

    function handleTasks() {
      if (
        !document.getElementById("game").checked && 
        document.getElementById("discussion").checked &&
        document.getElementById("write").checked &&
        !document.getElementById("research").checked
      ) {
        setTask(true);
      }
    }

    function handleResponse() {
      if (
        !document.getElementById("profit").checked && 
        document.getElementById("disclose").checked &&
        document.getElementById("publish").checked
      ) {
        setResponse(true);
      }
    }

    function handleVideo() {
      if (
        !document.getElementById("sell").checked && 
        document.getElementById("analyze").checked &&
        document.getElementById("share").checked
      ) {
        setVideo(true);
      }
    }

    function handleSubmit() {
      console.log(allowContinue);
      if (allowContinue) {
        next;
      } else {
        setShowAlert(true);
      }
      console.log(showAlert);
    }
    if (showAlert) {
      return (
        <form className="mt-5 space-y-8 divide-y divide-gray-200" onSubmit={handleSubmit}>
            <div className="ml-10 sm:mt-5">
                <h3 className="text-lg leading-2 font-medium text-gray-900">
                    Answer the following questions to confirm your understanding of the instructions.
                </h3>
                <h3 disabled={!showAlert} className="mt-5 text-lg leading-2 font-medium text-red-900">
                  Incorrect Response. Please try again.
                </h3>
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                Which of the following tasks will you be asked to do?
              </label>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="game"
                    value="game"
                    onClick={handleTasks}
                  />
                  <label htmlFor="game" className="text-sm font-medium text-gray-700 my-2"> Play a game with other participants
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="discussion"
                    value="discussion"
                    onClick={handleTasks}
                  />
                  <label htmlFor="discussion" className="text-sm font-medium text-gray-700 my-2"> Partcipate in a discussion with other participants
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="write"
                    value="write"
                    onClick={handleTasks}
                  />
                  <label htmlFor="write" className="text-sm font-medium text-gray-700 my-2"> Write about your group's discussion
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="research"
                    value="research"
                    onClick={handleTasks}
                  />
                  <label htmlFor="research" className="text-sm font-medium text-gray-700 my-2"> Read research about a novel topic
                  </label>
                </div>
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                How will we use your responses?
              </label>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="profit"
                    value="profit"
                    onClick={handleResponse}
                  />
                  <label htmlFor="profit" className="text-sm font-medium text-gray-700 my-2"> To make a profit by selling to third-parties.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="publish"
                    value="publish"
                    onClick={handleResponse}
                  />
                  <label htmlFor="publish" className="text-sm font-medium text-gray-700 my-2"> To be anonmously published in academic venues.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="disclose"
                    value="disclose"
                    onClick={handleResponse}
                  />
                  <label htmlFor="disclose" className="text-sm font-medium text-gray-700 my-2"> To disclose to other participants during the session
                  </label>
                </div>
                
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                How will we use your video data?
              </label>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="sell"
                    value="sell"
                    onClick={handleVideo}
                  />
                  <label htmlFor="sell" className="text-sm font-medium text-gray-700 my-2"> To make a profit by selling to third-parties.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="analyze"
                    value="analyze"
                    onClick={handleVideo}
                  />
                  <label htmlFor="analyze" className="text-sm font-medium text-gray-700 my-2">  To analyze for behavioral patterns to support our research.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="share"
                    value="share"
                    onClick={handleVideo}
                  />
                  <label htmlFor="share" className="text-sm font-medium text-gray-700 my-2"> To share with select researchers under confidentiality agreements.
                  </label>
                </div>
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                How long is the commitment?
              </label>
                <div className="grid gap-2">
                  <Radio
                    selected={time}
                    name="time"
                    value="5-10-minutes"
                    label="5-10 minutes"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="correct"
                    label="15-35 minutes"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="1-2-hour"
                    label="1-2 hours"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="3-4-hours"
                    label="3-4 hours"
                    onChange={handleTime}
                  />
                </div>
                
              </div>
            <div className="ml-5">
                <Button type="submit" disabled={!allowContinue}>Next</Button>
            </div> 
        </form>
      )
    }

    return (
        <form className="mt-5 space-y-8 divide-y divide-gray-200" onSubmit={handleSubmit}>
            <div className="ml-10 sm:mt-5">
                <h3 className="text-lg leading-2 font-medium text-gray-900">
                    Answer the following questions to confirm your understanding of the instructions.
                </h3>
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                Which of the following tasks will you be asked to do?
              </label>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="game"
                    value="game"
                    onClick={handleTasks}
                  />
                  <label htmlFor="game" className="text-sm font-medium text-gray-700 my-2"> Play a game with other participants
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="discussion"
                    value="discussion"
                    onClick={handleTasks}
                  />
                  <label htmlFor="discussion" className="text-sm font-medium text-gray-700 my-2"> Partcipate in a discussion with other participants
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="write"
                    value="write"
                    onClick={handleTasks}
                  />
                  <label htmlFor="write" className="text-sm font-medium text-gray-700 my-2"> Write about your group's discussion
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="research"
                    value="research"
                    onClick={handleTasks}
                  />
                  <label htmlFor="research" className="text-sm font-medium text-gray-700 my-2"> Read research about a novel topic
                  </label>
                </div>
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                How will we use your responses?
              </label>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="profit"
                    value="profit"
                    onClick={handleResponse}
                  />
                  <label htmlFor="profit" className="text-sm font-medium text-gray-700 my-2"> To make a profit by selling to third-parties.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="publish"
                    value="publish"
                    onClick={handleResponse}
                  />
                  <label htmlFor="publish" className="text-sm font-medium text-gray-700 my-2"> To be anonmously published in academic venues.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="disclose"
                    value="disclose"
                    onClick={handleResponse}
                  />
                  <label htmlFor="disclose" className="text-sm font-medium text-gray-700 my-2"> To disclose to other participants during the session
                  </label>
                </div>
                
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                How will we use your video data?
              </label>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="sell"
                    value="sell"
                    onClick={handleVideo}
                  />
                  <label htmlFor="sell" className="text-sm font-medium text-gray-700 my-2"> To make a profit by selling to third-parties.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="analyze"
                    value="analyze"
                    onClick={handleVideo}
                  />
                  <label htmlFor="analyze" className="text-sm font-medium text-gray-700 my-2">  To analyze for behavioral patterns to support our research.
                  </label>
                </div>
                <div className="mt-1">
                  <input
                    type="checkbox"
                    id="share"
                    value="share"
                    onClick={handleVideo}
                  />
                  <label htmlFor="share" className="text-sm font-medium text-gray-700 my-2"> To share with select researchers under confidentiality agreements.
                  </label>
                </div>
            </div>
            <div className="ml-5">
              <label className="block text-md font-medium text-gray-700 my-2">
                How long is the commitment?
              </label>
                <div className="grid gap-2">
                  <Radio
                    selected={time}
                    name="time"
                    value="5-10-minutes"
                    label="5-10 minutes"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="correct"
                    label="15-35 minutes"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="1-2-hour"
                    label="1-2 hours"
                    onChange={handleTime}
                  />
                  <Radio
                    selected={time}
                    name="time"
                    value="3-4-hours"
                    label="3-4 hours"
                    onChange={handleTime}
                  />
                </div>
                
              </div>
            <div className="ml-5">
                <Button type="submit" disabled={!allowContinue}>Next</Button>
            </div> 
        </form>
    )
};