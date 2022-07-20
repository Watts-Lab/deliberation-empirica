import React, {useState} from "react";
import { useEffect } from "react";
import { Button } from "../components/Button";
import { Radio } from "./ExitSurvey"

export function CheckUnderstanding({next}) {
    const [time, setTime] = useState("");
    const [task, setTask] = useState("");
    const [taskTwo, setTaskTwo] = useState("");
    const [response, setResponse] = useState("");
    const [video, setVideo] = useState("");
    const [allowContinue, setAllowContinue] = useState(false);
    const [showIntro, setShowIntro] = useState(false);

    useEffect(() => {
      if (time === "correct" && task === "correct" && taskTwo === "correct" && response === "correct" && video === "correct") {
        setAllowContinue(true);
      } else {
        setAllowContinue(false);
      }
    })

    function handleTime(e) {
      setTime(e.target.value);
    }

    function handleTasks(e) {
      setTask(e.target.value);
    }

    function handleTasksTwo(e) {
      setTaskTwo(e.target.value);
    }

    function handleResponse(e) {
      setResponse(e.target.value);
    }

    function handleVideo(e) {
        setVideo(e.target.value);
    }

    function handleSubmit(event) {
      if (allowContinue) {
        console.log("Understanding check submitted correctly")
        next();
      } else {
        setShowIntro(true);
        console.log("Understanding check submitted with errors")
        alert("Some of your answers were incorrect")
      }
      event.preventDefault();
    }
    

    return (
      <div className="ml-5 mt-1 sm:mt-5 p-5 basis-1/2">
        <form className="space-y-8 divide-y divide-gray-200" onSubmit={handleSubmit}>
            <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                   Please verify that you understand the instructions:
                </h3>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                What will you do in this task?
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={task}
                  name="task"
                  value="dishwasher"
                  label="Eat a bagel"
                  onChange={handleTasks}
                />
                <Radio
                  selected={task}
                  name="task"
                  value="transcribe"
                  label="Transcribe a discussion"
                  onChange={handleTasks}
                />
                <Radio
                  selected={task}
                  name="task"
                  value="correct"
                  label="Discuss a topic with others"
                  onChange={handleTasks}
                />
                <Radio
                  selected={task}
                  name="task"
                  value="read"
                  label="Proofread a paper about group discussions"
                  onChange={handleTasks}
                />
              </div>
            </div>
            <div>
            <label className="block text-md font-medium text-gray-700 my-2">
              Do you need a webcam for this task?
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={taskTwo}
                  name="taskTwo"
                  value="correct"
                  label="Yes"
                  onChange={handleTasksTwo}
                />
                <Radio
                  selected={taskTwo}
                  name="taskTwo"
                  value="false"
                  label="No"
                  onChange={handleTasksTwo}
                />
              </div>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                How will we use your survey responses?
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={response}
                  name="response"
                  value="art"
                  label="In art projects, with attribution"
                  onChange={handleResponse}
                />
                <Radio
                  selected={response}
                  name="response"
                  value="correct"
                  label="In academic publications, anonymously"
                  onChange={handleResponse}
                />
                <Radio
                  selected={response}
                  name="response"
                  value="disclose"
                  label="As prompts for others to discuss"
                  onChange={handleResponse}
                />
              </div>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                Who can access to your video recording?
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={video}
                  name="video"
                  value="public"
                  label="Anyone who is interested"
                  onChange={handleVideo}
                />
                <Radio
                  selected={video}
                  name="video"
                  value="nobody"
                  label="Nobody at all"
                  onChange={handleVideo}
                />
                <Radio
                  selected={video}
                  name="video"
                  value="correct"
                  label="Researchers under confidentiality agreement"
                  onChange={handleVideo}
                />
              </div>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                How long is the time commitment?
              </label>
              <div className="ml-5 grid gap-2">
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
              </div>
            </div>
            <div>
                <Button type="submit" base='inline-flex items-center px-4 py-2 mt-6 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500' id="check-understanding-next">Next</Button>
            </div> 
        </form>
      </div>
    )
};