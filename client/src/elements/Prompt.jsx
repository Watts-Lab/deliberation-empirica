import { usePlayer, useRound } from "@empirica/core/player/classic/react";
import React from "react";
import { load as loadYaml } from "js-yaml";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { TextArea } from "../components/TextArea";
import { useProgressLabel, useText, usePermalink } from "../components/utils";

export function Prompt({ file, name, shared }) {
  const player = usePlayer();
  const round = useRound();
  const progressLabel = useProgressLabel();
  const promptString = useText({ file });
  const permalink = usePermalink(file);

  if (!promptString) return <p>Loading prompt...</p>;

  // Parse the prompt string into its sections
  const sectionRegex = /---\n/g;
  const [, metaDataString, prompt, responseString] =
    promptString.split(sectionRegex);

  const metaData = loadYaml(metaDataString);
  const promptType = metaData?.type;
  const promptName = name || `${progressLabel}_${metaData?.name || file}`;
  const rows = metaData?.rows || 5;

  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

  // Coordinate saving the data
  const saveData = (newValue) => {
    const newRecord = {
      ...metaData,
      permalink, // TODO: test permalink in cypress
      name: promptName,
      shared,
      step: progressLabel,
      value: newValue,
    };
    console.log(newRecord);
    if (shared) {
      round.set(`prompt_${promptName}`, newRecord);
    } else {
      player.set(`prompt_${promptName}`, newRecord);
    }
  };

  const value = shared
    ? round.get(`prompt_${promptName}`)?.value
    : player.get(`prompt_${promptName}`)?.value;

  return (
    <div key={promptName}>
      <Markdown text={prompt} />
      {promptType === "multipleChoice" && (
        <RadioGroup
          options={Object.fromEntries(
            responses.map((choice, i) => [i, choice])
          )}
          selected={value}
          onChange={(e) => saveData(e.target.value)}
          testId={metaData?.name}
        />
      )}

      {promptType === "openResponse" && (
        <TextArea
          defaultText={responses.join("\n")}
          onChange={(e) => saveData(e.target.value)}
          value={value}
          testId={metaData?.name}
          rows={rows}
        />
      )}
    </div>
  );
}
