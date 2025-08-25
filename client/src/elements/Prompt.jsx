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
import { useText, usePermalink, useDebounce } from "../components/hooks";
import { SharedNotepad } from "../components/SharedNotepad";
import { ListSorter } from "../components/ListSorter";

// Checking equality for two sets - used for setting new responses
function setEquality(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}

export function Prompt({ file, name, shared }) {
  const player = usePlayer();
  const game = useGame();
  const stageTimer = useStageTimer();

  const progressLabel = player.get("progressLabel");
  const { text: promptString, error: fetchError } = useText({ file });
  const permalink = usePermalink(file);

  const [responses, setResponses] = React.useState([]);

  // Create saveData function at the top level to avoid hooks issues
  const saveData = React.useCallback((newValue, recordData) => {
    const updatedRecord = {
      ...recordData,
      value: newValue,
      stageTimeElapsed: (stageTimer?.elapsed || 0) / 1000,
    };

    if (shared) {
      game.set(`prompt_${recordData.name}`, updatedRecord);
      console.log(
        `Save game.set(prompt_${recordData.name}`,
        game.get(`prompt_${recordData.name}`)
      );
    } else {
      player.set(`prompt_${recordData.name}`, updatedRecord);
    }
  }, [shared, game, player, stageTimer]);

  // Debounce the saveData function for openResponse prompts
  const debouncedSaveData = useDebounce(saveData, 2000);

  if (fetchError) {
    return <p>Error loading prompt, retrying...</p>;
  }

  if (!promptString) return <p>Loading...</p>;

  // Parse the prompt string into its sections
  const [, metaDataString, prompt, responseString] =
    promptString.split(/^-{3,}$/gm);

  const metaData = loadYaml(metaDataString);

  const promptType = metaData?.type;
  const promptName = name || `${progressLabel}_${metaData?.name || file}`;
  const rows = metaData?.rows || 5;
  const minLength = metaData?.minLength;
  const maxLength = metaData?.maxLength;

  if (promptType !== "noResponse" && responseString.trim() !== '') {
    const responseItems = responseString
      .split(/\r?\n|\r|\n/g)
      .filter((i) => i)
      .map((i) => i.substring(2));

    // If responses is not initialized or new response items are different from current responses, reset
    if (!responses.length || !(setEquality(new Set(responseItems), new Set(responses)))) {
      if (metaData?.shuffleOptions) {
        setResponses(responseItems.sort(() => 0.5 - Math.random())); // shuffle
      } else {
        setResponses(responseItems);
      }
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
            onChange={(e) => saveData(e.target.value, record)}
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
          onChange={(newSelection) => saveData(newSelection, record)}
          testId={metaData?.name}
        />
      )}

      {promptType === "openResponse" && !shared && (
        <TextArea
          defaultText={responses.join("\n")}
          onChange={(e) => debouncedSaveData(e.target.value, record)}
          value={value}
          testId={metaData?.name}
          rows={rows}
          showCharacterCount={!!(minLength || maxLength)}
          minLength={minLength}
          maxLength={maxLength}
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
          onChange={(newOrder) => saveData(newOrder, record)}
          testId={metaData?.name}
        />
      )}
    </>
  );
}
