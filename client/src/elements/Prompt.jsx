import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import { load as loadYaml } from "js-yaml";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { TextArea } from "../components/TextArea";
import { useProgressLabel, useText, usePermalink } from "../components/utils";

export function Prompt({ file, saveKey }) {
  const player = usePlayer();
  const progressLabel = useProgressLabel();

  const promptString = useText({ file });
  const permalink = usePermalink(file);

  const [value, setValue] = useState("");

  if (!promptString) return <p>Loading prompt...</p>;

  const sectionRegex = /---\n/g;
  const [, metaDataString, prompt, responseString] =
    promptString.split(sectionRegex);

  const metaData = loadYaml(metaDataString);
  const promptType = metaData?.type;
  const promptName = metaData?.name || "unnamedPromt";
  const rows = metaData?.rows || 5;

  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

  const saveData = (newValue) => {
    const newRecord = {
      ...metaData,
      permalink, // TODO: test permalink in cypress
      step: progressLabel,
      value: newValue,
    };
    player.set(`prompt_${saveKey || file}_${progressLabel}`, newRecord);
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
          rows={rows}
        />
      )}
    </div>
  );
}
