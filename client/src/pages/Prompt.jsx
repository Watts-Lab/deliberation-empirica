import {
  usePlayer,
  useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import React, { useReducer, useEffect, useState } from "react";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { Button } from "../components/Button";
import { TextArea } from "../components/TextArea";

function reducer(state, action) {
  const newValue = {
    promptType: action.promptType,
    promptName: action.promptName,
    value: action.value,
  };
  const newPrompts = state.prompts;
  newPrompts[action.index] = newValue;
  return { ...state, prompts: newPrompts };
}

// Add an alert for when the prompts are going to move on
// Add an alert for when there is a new prompt
// log every prompt change to the player object (figure out a schedule for textareas)

export function Prompt({ promptDict, index, state, dispatch }) {
  const timer = useStageTimer();
  const [displaying, setDisplaying] = useState(false);
  const elapsed = timer?.ellapsed / 1000 || 0;
  const { promptString, displayTime, hideTime, startDing } = promptDict;

  const shouldDisplay = !(
    (hideTime && elapsed > hideTime) ||
    (displayTime && elapsed < displayTime)
  );

  // console.log("-----------------------")
  // console.log("elapsed", elapsed);
  // console.log("displayTime", displayTime);
  // console.log("endtime", hideTime);
  // console.log("promptstring", promptString);
  // console.log("shouldDisplay", shouldDisplay);
  // console.log("displaying", displaying);

  if (shouldDisplay && shouldDisplay !== displaying) {
    const ding = new Audio("airplane_chime.mp3");
    ding.play();
    setDisplaying(true);
    //console.log("revealing: play ding now");
  } else if (displaying && shouldDisplay !== displaying) {
    setDisplaying(false);
    //console.log("hiding");
  }

  if (!displaying) return <></>;

  const [, metaData, prompt, responseString] = promptString.split("---");
  // TODO: strip leading and trailing whitespace from prompt
  const promptType = metaData.match(/^type:\s*(\S+)/m)[1];
  const promptName = metaData.match(/^name:\s*(\S+)/m)[1];
  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

  const handleChange = (e) => {
    dispatch({
      promptType,
      index,
      promptName,
      value: e.target.value,
    });
  };

  return (
    <div key={`prompt ${index}`}>
      <Markdown text={prompt} />
      {promptType === "multipleChoice" && (
        <RadioGroup
          options={Object.fromEntries(
            responses.map((choice, i) => [i, choice])
          )}
          selected={state.prompts[index]?.value || ""}
          onChange={handleChange}
          testId={promptName}
        />
      )}

      {promptType === "openResponse" && (
        <TextArea
          defaultText={responses.join("\n")}
          onChange={handleChange}
          value={state.prompts[index]?.value || ""}
          testId={promptName}
        />
      )}
    </div>
  );
}

export function PromptList({ promptList, submitButton = true }) {
  const player = usePlayer();
  const stage = useStage();

  const initialState = {
    playerId: player.id,
    stageNumber: stage.get("index"),
    prompts: new Array(promptList.length),
  };
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleSubmit = (e) => {
    e.preventDefault();
    player.set("prompt", state);
    player.stage.set("submit", true);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {promptList.map((promptDict, index) =>
          Prompt({
            promptDict,
            index,
            state,
            dispatch,
          })
        )}
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
