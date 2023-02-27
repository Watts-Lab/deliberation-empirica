import { usePlayer } from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import React, { useState, useEffect } from "react";
import { load as loadYaml } from "js-yaml";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { TextArea } from "../components/TextArea";
import {
  useProgressLabel,
  loadStringFromURL,
  useRemoteFileString,
} from "../components/utils";

export function Prompt({ file, saveKey }) {
  const player = usePlayer();
  // const globals = useGlobal();
  const progressLabel = useProgressLabel();
  const promptString = useRemoteFileString(file);

  const [value, setValue] = useState("");
  // const [promptString, setPromptString] = useState(undefined);

  // const resourceLookup = globals?.get("resourceLookup"); // get the permalink for this implementation of the file
  // const fileURL = resourceLookup ? resourceLookup[`topics/${file}`] : undefined;

  // useEffect(() => {
  //   async function loadData() {
  //     const stringContent = await loadStringFromURL(fileURL);
  //     setPromptString(stringContent);
  //   }
  //   if (fileURL) loadData();
  // }, [fileURL]);

  if (!promptString) return <p>Loading prompt...</p>;

  const [, metaDataString, prompt, responseString] = promptString.split("---");

  const metaData = loadYaml(metaDataString);
  const promptType = metaData?.type;
  const promptName = metaData?.name || "unnamedPromt";

  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

  const saveData = (newValue) => {
    const newRecord = {
      ...metaData,
      permalink: fileURL, // TODO: test permalink in cypress
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
