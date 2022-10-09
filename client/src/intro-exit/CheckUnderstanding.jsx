import React, { useState, useEffect } from "react";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

export function Radio({ selected, name, value, label, onChange }) {
  return (
    <label className="text-sm font-medium text-gray-600">
      <input
        className="mr-2 shadow-sm sm:text-sm"
        type="radio"
        name={name}
        value={value}
        checked={selected === value}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

export function CheckUnderstanding({ next }) {
  const [time, setTime] = useState("");
  const [task, setTask] = useState("");
  const [taskTwo, setTaskTwo] = useState("");
  const [response, setResponse] = useState("");
  const [video, setVideo] = useState("");
  const [allowContinue, setAllowContinue] = useState(false);
  const [incorrectResponse, setIncorrectResponse] = useState(false);

  const labelStyle = {};

  useEffect(() => {
    if (
      time === "correct" &&
      task === "correct" &&
      taskTwo === "correct" &&
      response === "correct" &&
      video === "correct"
    ) {
      setAllowContinue(true);
    } else {
      setAllowContinue(false);
    }
  });

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
    event.preventDefault();

    if (allowContinue) {
      console.log("Intro Quiz submitted correctly");
      next();
    } else {
      console.log("Intro Quiz submitted with errors");
      setIncorrectResponse(true);
    }

    if (incorrectResponse) {
      document.getElementById("alert").scrollIntoView(true);
    }
  }

  return (
    <div id="alert" className="ml-5 mt-1 sm:mt-1 p-5 basis-1/2">
      <form
        className="space-y-3 divide-y divide-gray-200"
        onSubmit={handleSubmit}
      >
        <div style={labelStyle}>
          <h3 className="text-lg leading-4 font-medium text-gray-800">
            <b>Please verify that you understand the instructions.</b>
          </h3>
          {incorrectResponse && (
            <div className="my-5">
              <Alert
                title="Some of your responses were incorrect!"
                kind="error"
              >
                &quot;Please review the information again&nbsp; and resubmit to
                confirm your understanding.&quot;
              </Alert>
            </div>
          )}
        </div>
        <div>
          <label
            htmlFor="doGroup"
            className="block text-md font-medium text-gray-800 my-2"
          >
            What will you do in this task?
          </label>
          <div className="ml-5 grid gap-1.5" data-test="doGroup">
            <Radio
              selected={task}
              name="task"
              value="dishwasher"
              label="Eat a bagel"
              onChange={(e) => handleTasks(e)}
            />
            <Radio
              selected={task}
              name="task"
              value="transcribe"
              label="Transcribe a discussion"
              onChange={(e) => handleTasks(e)}
            />
            <Radio
              selected={task}
              name="task"
              value="correct"
              label="Discuss a topic with others"
              onChange={(e) => handleTasks(e)}
            />
            <Radio
              selected={task}
              name="task"
              value="read"
              label="Proofread a paper about group discussions"
              onChange={(e) => handleTasks(e)}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="webcamGroup"
            className="block text-md font-medium text-gray-800 my-2"
          >
            Do you need a webcam for this task?
          </label>
          <div className="ml-4 grid gap-1.5" data-test="webcamGroup">
            <Radio
              selected={taskTwo}
              name="taskTwo"
              value="correct"
              label="Yes"
              onChange={(e) => handleTasksTwo(e)}
            />
            <Radio
              selected={taskTwo}
              name="taskTwo"
              value="no"
              label="No"
              onChange={(e) => handleTasksTwo(e)}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="surveyGroup"
            className="block text-md font-medium text-gray-800 my-2"
          >
            How will we use your survey responses?
          </label>
          <div className="ml-5 grid gap-1.5" data-test="surveyGroup">
            <Radio
              selected={response}
              name="response"
              value="art"
              label="In art projects, with attribution"
              onChange={(e) => handleResponse(e)}
            />
            <Radio
              selected={response}
              name="response"
              value="correct"
              label="In academic publications, anonymously"
              onChange={(e) => handleResponse(e)}
            />
            <Radio
              selected={response}
              name="response"
              value="disclose"
              label="As prompts for others to discuss"
              onChange={(e) => handleResponse(e)}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="recordingGroup"
            className="block text-md font-medium text-gray-800 my-2"
          >
            Who can access to your video recording?
          </label>
          <div className="ml-5 grid gap-1.5" data-test="recordingGroup">
            <Radio
              selected={video}
              name="video"
              value="public"
              label="Anyone who is interested"
              onChange={(e) => handleVideo(e)}
            />
            <Radio
              selected={video}
              name="video"
              value="nobody"
              label="Nobody at all"
              onChange={(e) => handleVideo(e)}
            />
            <Radio
              selected={video}
              name="video"
              value="correct"
              label="Researchers under confidentiality agreement"
              onChange={(e) => handleVideo(e)}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="timeGroup"
            className="block text-md font-medium text-gray-800 my-2"
          >
            How long is the time commitment?
          </label>
          <div className="ml-5 grid gap-1.5" data-test="timeGroup">
            <Radio
              selected={time}
              name="time"
              value="5-10-minutes"
              label="5-10 minutes"
              onChange={(e) => handleTime(e)}
            />
            <Radio
              selected={time}
              name="time"
              value="correct"
              label="15-35 minutes"
              onChange={(e) => handleTime(e)}
            />
            <Radio
              selected={time}
              name="time"
              value="1-2-hour"
              label="1-2 hours"
              onChange={(e) => handleTime(e)}
            />
          </div>
        </div>
        <div>
          <Button type="submit" data-test="check-understanding-next">
            Next
          </Button>
        </div>
      </form>
    </div>
  );
}
