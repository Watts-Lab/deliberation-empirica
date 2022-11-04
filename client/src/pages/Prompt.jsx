import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import React from "react";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { Button } from "../components/Button";
import { TextArea } from "../components/TextArea";

export function Prompt({ promptString, responseOwner }) {
  const player = usePlayer();
  const stage = useStage();

  const [, metaData, prompt, responseString] = promptString.split("---");
  // TODO: strip leading and trailing whitespace from prompt
  const promptType = metaData.match(/^type:\s*(\S+)/m)[1];
  const promptName = metaData.match(/^name:\s*(\S+)/m)[1];
  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

  const responseKey = `prompt_${promptName}_stage_${stage.get("index")}`;
  const handleChange = (e) => {
    responseOwner.set(responseKey, {
      promptName,
      promptType,
      stageIndex: stage.get("index"),
      value: e.target.value,
      setByNickname: player.get("nickname"),
      playerId: player.id,
    });
  };

  return (
    <div>
      <Markdown text={prompt} />
      {promptType === "multipleChoice" && (
        <RadioGroup
          options={Object.fromEntries(
            responses.map((choice, i) => [i, choice])
          )}
          selected={responseOwner.get(responseKey)?.value}
          onChange={handleChange}
          live={responseOwner.get("name") !== player.get("name")}
          setBy={responseOwner.get(responseKey)?.setByNickname}
          testId={promptName}
        />
      )}

      {promptType === "openResponse" && (
        <TextArea defaultText={responses.join("\n")} />
      )}
    </div>
  );
}

export function PromptList({ promptList, responseOwner, submitButton = true }) {
  const player = usePlayer();

  const handleSubmit = (e) => {
    e.preventDefault();
    player.stage.set("submit", true);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {promptList.map((promptString) =>
          Prompt({ promptString, responseOwner })
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
