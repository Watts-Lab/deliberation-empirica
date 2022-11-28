import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import React, { useReducer } from "react";
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

export function Prompt({ promptString, index, state, dispatch }) {
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
        {promptList.map((promptString, index) =>
          Prompt({
            promptString,
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
