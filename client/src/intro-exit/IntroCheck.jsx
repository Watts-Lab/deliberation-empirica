import React, { useEffect, useState } from "react";
import { Markdown } from "../components/Markdown";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { RadioGroup } from "../components/RadioGroup";
import { H1, H3 } from "../components/TextStyles";

const introMd = `
### In this study, you may be asked to:
- discuss a given topic over **a live video interface with real people**.
- answer a question as a group. (Anyone can update your
  group's answer until the timer expires.)
- receive training in discussion skills.
- answer questions about your discussion.

### What you need to do:
You must have functional **audio** and **video** capabilities.

Please pay attention when the discussion begins and **participate actively.**

### Payment:

You will be paid $15 per hour based on your time actively participating.

This study takes approximately **15 - 35 minutes.**

### How we use your data:

Your responses will not be shared with other participants.

After the session, **anonymized data will be shared in academic 
publications and public data repositories.**

Your audio and video data will be annotated by trained coders.

Your audio or video data may be shared with **researchers who commit 
to confidentiality and data security.**

`;

export function IntroCheck({ next }) {
  useEffect(() => {
    console.log("Intro: Description and Understanding Check");
  }, []);

  const [time, setTime] = useState("");
  const [task, setTask] = useState("");
  const [webcam, setWebcam] = useState("");
  const [response, setResponse] = useState("");
  const [video, setVideo] = useState("");
  const [incorrectResponse, setIncorrectResponse] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    if (
      time === "fifteen" &&
      task === "discuss" &&
      webcam === "yes" &&
      response === "publish" &&
      video === "researchers"
    ) {
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

  const renderQuiz = () => (
    <div id="quiz">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <H3>Please verify that you understand the instructions.</H3>

          {incorrectResponse && (
            <div id="alert" className="my-5">
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
          <RadioGroup
            label="What will you do in this task?"
            options={{
              bagel: "Eat a bagel",
              transcribe: "Transcribe a Discussion",
              discuss: "Discuss a topic with others",
              proofread: "Proofread a paper about group discussions",
            }}
            selected={task}
            onChange={(e) => setTask(e.target.value)}
            testId="doGroup"
          />

          <RadioGroup
            label="Do you need a webcam for this task?"
            options={{
              yes: "Yes",
              no: "No",
            }}
            selected={webcam}
            onChange={(e) => setWebcam(e.target.value)}
            testId="webcamGroup"
          />

          <RadioGroup
            label="How will we use your survey responses?"
            options={{
              art: "In art projects, with attribution",
              publish: "In academic publications, anonymously",
              prompts: "As prompts for others to discuss",
            }}
            selected={response}
            onChange={(e) => setResponse(e.target.value)}
            testId="responseGroup"
          />

          <RadioGroup
            label="Who can access to your video recording?"
            options={{
              public: "Anyone who is interested",
              nobody: "Nobody at all",
              researchers:
                "Analysts and researchers under confidentiality agreement",
            }}
            selected={video}
            onChange={(e) => setVideo(e.target.value)}
            testId="recordingGroup"
          />

          <RadioGroup
            label="How long is the time commitment?"
            options={{
              five: "5-10 minutes",
              fifteen: "15-35 minutes",
              sixty: "1-2 hours",
            }}
            selected={time}
            onChange={(e) => setTime(e.target.value)}
            testId="timeGroup"
          />
        </div>
        <div className="mt-4">
          <Button type="submit" data-test="submitButton">
            Next
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <div>
      <H1>Introduction</H1>
      <div className="md:(flex space-x-4)">
        <div className="max-w-xl">
          <Markdown text={introMd} />
        </div>
        <div className="max-w-xl">{renderQuiz()}</div>
      </div>
    </div>
  );
}
