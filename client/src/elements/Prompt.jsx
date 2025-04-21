import {
  usePlayer,
  useGame,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import React from "react";
import { load as loadYaml } from "js-yaml";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { CheckboxGroup } from "../components/CheckboxGroup";
import { TextArea } from "../components/TextArea";
import { useText, usePermalink } from "../components/hooks";
import { SharedNotepad } from "../components/SharedNotepad";
import { ListSorter } from "../components/ListSorter";

export function Prompt({ file, name, shared }) {
  const player = usePlayer();
  const game = useGame();
  const stageTimer = useStageTimer();

  const progressLabel = player.get("progressLabel");
  const { text: promptString, error: fetchError } = useText({ file });
  const permalink = usePermalink(file);
  const [responses, setResponses] = React.useState([]);

  if (fetchError) {
    return <p>Error loading prompt, retrying...</p>;
  }
  if (!promptString) return <p>Loading prompt...</p>;

  // Parse the prompt string into its sections
  const sectionRegex = /---\n/g;
  const [, metaDataString, prompt, responseString] =
    promptString.split(sectionRegex);

  const metaData = loadYaml(metaDataString);
  const promptType = metaData?.type;
  const promptName = name || `${progressLabel}_${metaData?.name || file}`;
  const rows = metaData?.rows || 5;

  if (promptType !== "noResponse" && !responses.length) {
    const responseItems = responseString
      .split(/\r?\n|\r|\n/g)
      .filter((i) => i)
      .map((i) => i.substring(2));

    if (metaData?.shuffleOptions) {
      setResponses(responseItems.sort(() => 0.5 - Math.random())); // shuffle
    } else {
      setResponses(responseItems);
    }
  }

  const record = {
    ...metaData,
    permalink, // TODO: test permalink in cypress
    name: promptName,
    shared,
    step: progressLabel,
    prompt,
    responses,
  };

  // Coordinate saving the data
  const saveData = (newValue) => {
    record.value = newValue;
    const stageElapsed = (stageTimer?.elapsed || 0) / 1000;
    record.stageTimeElapsed = stageElapsed;

    if (shared) {
      game.set(`prompt_${promptName}`, record);
      console.log(
        `Save game.set(prompt_${promptName}`,
        game.get(`prompt_${promptName}`)
      );
    } else {
      player.set(`prompt_${promptName}`, record);
    }
  };

  const value = shared
    ? game.get(`prompt_${promptName}`)?.value
    : player.get(`prompt_${promptName}`)?.value;

  return (
    <>
      <Markdown text={prompt} />
      {promptType === "multipleChoice" &&
        (metaData.select === "single" || metaData.select === undefined) && (
          <RadioGroup
            options={responses.map((choice) => ({
              key: choice,
              value: choice,
            }))}
            selected={value}
            onChange={(e) => saveData(e.target.value)}
            testId={metaData?.name}
          />
        )}

      {promptType === "multipleChoice" && metaData.select === "multiple" && (
        <CheckboxGroup
          options={responses.map((choice) => ({
            key: choice,
            value: choice,
          }))}
          selected={value}
          onChange={(newSelection) => saveData(newSelection)}
          testId={metaData?.name}
        />
      )}

      {promptType === "openResponse" && !shared && (
        <TextArea
          defaultText={responses.join("\n")}
          onChange={(e) => saveData(e.target.value)}
          value={value}
          testId={metaData?.name}
          rows={rows}
        />
      )}

      {promptType === "openResponse" && shared && (
        <SharedNotepad
          padName={promptName}
          defaultText={responses.join("\n")}
          record={record}
          arg="test"
          rows={rows}
        />
      )}

      {promptType === "listSorter" && (
        <ListSorter
          list={value || responses}
          onChange={(newOrder) => saveData(newOrder)}
          testId={metaData?.name}
        />
      )}
    </>
  );
}
