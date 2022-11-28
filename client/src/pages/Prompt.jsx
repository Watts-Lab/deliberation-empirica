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

export function multipleChoiceResponse({
  responses,
  promptName,
  responseOwner,
  responseKey,
  dispatch,
  index,
  player,
  state,
}) {
  const handleRadioChange = (e) => {
    dispatch({
      promptType: "multipleChoice",
      index,
      promptName,
      value: e.target.value,
    });

    // responseOwner.set(responseKey, {
    //   promptName,
    //   value: e.target.value,
    //   setByNickname: player.get("nickname"),
    //   playerId: player.id,
    // });
  };

  return (
    <RadioGroup
      options={Object.fromEntries(responses.map((choice, i) => [i, choice]))}
      // selected={responseOwner.get(responseKey)?.value}
      selected={state.prompts[index]?.value || ""}
      onChange={handleRadioChange}
      // live={responseOwner.get("name") !== player.get("name")}
      // setBy={responseOwner.get(responseKey)?.setByNickname}
      testId={promptName}
    />
  );
}

export function openResponse({
  responses,
  promptName,
  state,
  dispatch,
  index,
}) {
  return (
    <TextArea
      defaultText={responses.join("\n")}
      onChange={(e) =>
        dispatch({
          promptType: "openResponse",
          index,
          promptName,
          value: e.target.value,
        })
      }
      value={state.prompts[index]?.value || ""}
      testId={promptName}
    />
  );
}

export function Prompt({
  promptString,
  responseOwner,
  dispatch,
  index,
  player,
  stage,
  state,
}) {
  const [, metaData, prompt, responseString] = promptString.split("---");
  // TODO: strip leading and trailing whitespace from prompt
  const promptType = metaData.match(/^type:\s*(\S+)/m)[1];
  const promptName = metaData.match(/^name:\s*(\S+)/m)[1];
  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

  const responseKey = `prompt_${promptName}_stage_${stage.get("index")}`;

  return (
    <div key={`prompt ${index}`}>
      <Markdown text={prompt} />
      {promptType === "multipleChoice" &&
        multipleChoiceResponse({
          responses,
          promptName,
          responseOwner,
          state,
          responseKey,
          player,
          dispatch,
          index,
        })}

      {promptType === "openResponse" &&
        openResponse({
          responses,
          promptName,
          state,
          player,
          responseKey,
          dispatch,
          index,
        })}
    </div>
  );
}

export function PromptList({ promptList, responseOwner, submitButton = true }) {
  const player = usePlayer();
  const stage = useStage();

  const initialState = {
    playerId: player.id,
    stageNumber: stage.get("index"),
    prompts: [],
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
            responseOwner,
            stage,
            player,
            dispatch,
            state,
            index,
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
