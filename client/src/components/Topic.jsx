import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Alert } from "./Alert";

export function Radio({ selected, name, value, label, onChange }) {
  return (
    <p>
      <label className="text-sm font-medium text-gray-700">
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
      <br />
    </p>
  );
}

export function Topic({ topic, responseOwner, submitButton = true }) {
  const player = usePlayer();
  const [incorrectResponse, setIncorrectResponse] = useState(false);

  const question = topic
    .split("Prompt")[1]
    .replace('"', "")
    .split("Responses")[0]
    .replace('"', "");
  const responses = topic.split("Responses")[1]; // get everything after responses (the answers)
  const answers = responses.split("\n- ").filter((item) => item.length > 0); // exclude empty rows
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
      responseOwner.get("name") === "Discuss" &&
      responseOwner.get("displayClickMessage")
    ) {
      // 👇️ removes element from DOM
      console.log(`hiding ${hiding}`);
      hiding.style.display = "none";
      responseOwner.set("displayClickMessage", false);

      // 👇️ hides element (still takes up space on page)
      hiding.style.visibility = "hidden";
    }
  }, 10000); // 👈️ time in milliseconds

  function renderAnswers() {
    const rows = [];
    for (let i = 0; i < answers.length; i++) {
      rows.push(
        <Radio
          key={i}
          name="answers"
          value={answers[i]}
          label={answers[i]}
          selected={responseOwner.get("topicResponse")}
          onChange={handleChange}
        />
      );
    }

    return <div>{rows}</div>;
  }

  return (
    <div>
      {incorrectResponse && (
        <Alert title="Unable to proceed" kind="error">
          Please select a response.
        </Alert>
      )}
      <ReactMarkdown className="block text-lg font-medium text-gray-1000 my-2">
        {question}
      </ReactMarkdown>
      <form onSubmit={handleSubmit}>
        {renderAnswers(answers)}
        <br />
        <br />
        {submitButton && (
          <input
            type="submit"
            className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500 border-transparent shadow-sm text-white bg-empirica-600 hover:bg-empirica-700"
          />
        )}
        {responseOwner.get("name") === "Discuss" &&
          responseOwner.get("displayClickMessage") && (
            <h3 id="hiding" className="text-sm text-gray-500">
              {`${responseOwner.get(
                "lastClicker"
              )} changed the selected answer`}
            </h3>
          )}
      </form>
    </div>
  );
}
