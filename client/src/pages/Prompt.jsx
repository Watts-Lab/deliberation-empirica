import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import { Alert } from "../components/Alert";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { Button } from "../components/Button";
import { TextArea } from "../components/TextArea";

export function Prompt({ promptString, responseOwner, submitButton = true }) {
  const player = usePlayer();
  const [, , prompt, response] = promptString.split("---");

  const [incorrectResponse, setIncorrectResponse] = useState(false);

  const hiding = document.getElementById("hiding");

  const handleChange = (e) => {
    responseOwner.set("topicResponse", e.target.value);
    responseOwner.set("displayClickMessage", true);
    responseOwner.set("lastClicker", player.get("nickname"));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (responseOwner.get("topicResponse")) {
      console.log("Topic response submitted");
      player.stage.set("submit", true);
    } else {
      setIncorrectResponse(true);
      console.log("Tried to advance without selecting answer");
    }
  };

  setTimeout(() => {
    if (
      hiding != null &&
      responseOwner.get("name") !== player.get("name") &&
      responseOwner.get("displayClickMessage")
    ) {
      // 👇️ removes element from DOM
      // console.log(`hiding ${hiding}`);
      hiding.style.display = "none";
      responseOwner.set("displayClickMessage", false);

      // 👇️ hides element (still takes up space on page)
      hiding.style.visibility = "hidden";
    }
  }, 10000); // 👈️ time in milliseconds

  const renderMultipleChoice = (choices) => (
    <div>
      <RadioGroup
        options={Object.fromEntries(choices.map((choice, i) => [i, choice]))}
        selected={responseOwner.get("topicResponse")}
        onChange={handleChange}
        testId="multipleChoice"
      />
    </div>
  );

  const renderResponse = (responseString) => {
    const responseLines = responseString.split(/\r?\n|\r|\n/g).filter((i) => i);
    if (responseLines.length) {
      if (responseLines[0][0] === "-") {
        return renderMultipleChoice(responseLines.map((i) => i.substring(2)));
      }
      if (responseLines[0][0] === ">") {
        return (
          <TextArea defaultText={responseLines.map((i) => i.substring(2))} />
        );
      }
      console.log("unreadable response type");
    }
    return <br />;
  };

  return (
    <div>
      {incorrectResponse && (
        <Alert title="Unable to proceed" kind="error">
          Please select a response.
        </Alert>
      )}
      <Markdown text={prompt} />

      <form onSubmit={handleSubmit}>
        {renderResponse(response)}

        <div className="my-5">
          {responseOwner.get("name") !== player.get("name") &&
            responseOwner.get("displayClickMessage") && (
              <h3 id="hiding" className="text-sm text-gray-500">
                {`${responseOwner.get(
                  "lastClicker"
                )} changed the selected answer`}
              </h3>
            )}
        </div>

        {submitButton && (
          <div className="mt-4">
            <Button type="submit" data-test="submitButton">
              Next
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
