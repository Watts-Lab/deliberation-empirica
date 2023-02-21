import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import { load as loadYaml } from "js-yaml";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { TextArea } from "../components/TextArea";
import { getProgressLabel } from "../components/utils";

export function Prompt({ promptString, saveKey }) {
  const player = usePlayer();
  const progressLabel = getProgressLabel();

  const [value, setValue] = useState("");
  const [, metaDataString, prompt, responseString] = promptString.split("---");

  const metaData = loadYaml(metaDataString);
  const promptType = metaData?.type;
  const promptName = metaData?.name || "unnamedPromt";

  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

  const saveData = (newValue) => {
    // console.log(`saving data for prompt ${promptName}, value: ${newValue}`);
    const newRecord = {
      ...metaData,
      step: progressLabel,
      value: newValue,
    };
    player.set(`prompt_${saveKey}_${progressLabel}`, newRecord);
  };

  const handleChange = (e) => {
    setValue(e.target.value);
    saveData(e.target.value);
  };

  return (
    <div key={saveKey}>
      <Markdown text={prompt} />
      {promptType === "multipleChoice" && (
        <RadioGroup
          options={Object.fromEntries(
            responses.map((choice, i) => [i, choice])
          )}
          selected={value}
          onChange={handleChange}
          testId={promptName}
        />
      )}

      {promptType === "openResponse" && (
        <TextArea
          defaultText={responses.join("\n")}
          onChange={handleChange}
          value={value}
          testId={promptName}
        />
      )}
    </div>
  );
}
