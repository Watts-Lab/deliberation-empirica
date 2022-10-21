import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Alert } from "../components/Alert";

function H1({ children }) {
  return (
    <h2 className="text-2xl leading-7 font-medium text-gray-1000">
      {children}
    </h2>
  );
}

function H2({ children }) {
  return (
    <h2 className="text-xl leading-7 font-medium text-gray-1000">{children}</h2>
  );
}

function H3({ children }) {
  return (
    <h3 className="text-lg leading-7 font-medium text-gray-1000">{children}</h3>
  );
}

function UL({ children }) {
  return <ul className="list-circle list-inside">{children}</ul>;
}

function LI({ children }) {
  return <li className="text-sm font-medium text-gray-700">{children}</li>;
}

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

  function renderMultipleChoice(choices) {
    const rows = [];
    for (let i = 0; i < choices.length; i++) {
      rows.push(
        <Radio
          key={i}
          name="answers"
          value={choices[i]}
          label={choices[i]}
          selected={responseOwner.get("topicResponse")}
          onChange={handleChange}
        />
      );
    }

    return <div>{rows}</div>;
  }

  function renderOpenResponse(defaultText) {
    return (
      <div>
        <textarea
          id="responseTextArea"
          rows="5"
          cols="50"
          defaultValue={defaultText}
        />
      </div>
    );
  }

  const renderResponse = (responseString) => {
    const responseLines = responseString.split(/\r?\n|\r|\n/g).filter((i) => i);
    if (responseLines.length) {
      if (responseLines[0][0] === "-") {
        return renderMultipleChoice(responseLines.map((i) => i.substring(2)));
      }
      if (responseLines[0][0] === ">") {
        return renderOpenResponse(responseLines.map((i) => i.substring(2)));
      }
      console.log("unreadable response type");
    }
    return <br />;
  };

  return (
    <div style={{flex: 1, padding: "20px"}}>
      {incorrectResponse && (
        <Alert title="Unable to proceed" kind="error">
          Please select a response.
        </Alert>
      )}
      <ReactMarkdown
        className="block text-lg font-medium text-gray-1000 my-2"
        components={{ h1: H1, h2: H2, h3: H3, ul: UL, li: LI }}
      >
        {prompt}
      </ReactMarkdown>

      <form onSubmit={handleSubmit}>
        {renderResponse(response)}
        <br />
        <br />
        {responseOwner.get("name") !== player.get("name") &&
          responseOwner.get("displayClickMessage") && (
            <h3 id="hiding" className="text-sm text-gray-500">
              {`${responseOwner.get(
                "lastClicker"
              )} changed the selected answer`}
            </h3>
          )}

        {submitButton && (
          <input
            type="submit"
            className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500 border-transparent shadow-sm text-white bg-empirica-600 hover:bg-empirica-700"
          />
        )}
      </form>
    </div>
  );
}
