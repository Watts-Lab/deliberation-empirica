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
      console.log(allowContinue);
      if (allowContinue) {
        next();
      } else {
        setShowIntro(true);
        alert("Some of your answers were incorrect")
      }
      event.preventDefault();
    }
    

    return (
      <div className="ml-5 mt-1 sm:mt-5 p-5 basis-1/2">
        <form className="space-y-8 divide-y divide-gray-200" onSubmit={handleSubmit}>
            <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Answer the following questions to verify your understanding of the instructions.
                </h3>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                Which of the following tasks will you be asked to do?
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={task}
                  name="task"
                  value="correct"
                  label="Partcipate in and answer questions about a discussion with others"
                  onChange={handleTasks}
                />
                <Radio
                  selected={task}
                  name="task"
                  value="read"
                  label="Read academic research papers about a novel topic"
                  onChange={handleTasks}
                />
                <Radio
                  selected={task}
                  name="task"
                  value="dishwasher"
                  label="Eat a dishwasher"
                  onChange={handleTasks}
                />
              </div>
            </div>
            <div>
            <label className="block text-md font-medium text-gray-700 my-2">
                You may be asked to complete pre-discussion training and an exit survey.
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={taskTwo}
                  name="taskTwo"
                  value="correct"
                  label="True"
                  onChange={handleTasksTwo}
                />
                <Radio
                  selected={taskTwo}
                  name="taskTwo"
                  value="false"
                  label="False"
                  onChange={handleTasksTwo}
                />
              </div>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                How will we use your responses?
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={response}
                  name="response"
                  value="art"
                  label="To make large-scale art projects"
                  onChange={handleResponse}
                />
                <Radio
                  selected={response}
                  name="response"
                  value="correct"
                  label="To be anonmously published in academic venues"
                  onChange={handleResponse}
                />
                <Radio
                  selected={response}
                  name="response"
                  value="disclose"
                  label="To disclose to other participants during the session"
                  onChange={handleResponse}
                />
              </div>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                How will we use your video data?
              </label>
              <div className="ml-5 grid gap-2">
                <Radio
                  selected={video}
                  name="video"
                  value="friends"
                  label="To send to our friends and family"
                  onChange={handleVideo}
                />
                <Radio
                  selected={video}
                  name="video"
                  value="socialMedia"
                  label="To post publicly to social media"
                  onChange={handleVideo}
                />
                <Radio
                  selected={video}
                  name="video"
                  value="correct"
                  label="To share with select researchers under confidentiality agreements"
                  onChange={handleVideo}
                />
              </div>
            </div>
            <div>
              <label className="block text-md font-medium text-gray-700 my-2">
                How long is the commitment?
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
                <Button type="submit" base='inline-flex items-center px-4 py-2 mt-6 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500'>Next</Button>
            </div> 
        </form>
      </div>
    )
};