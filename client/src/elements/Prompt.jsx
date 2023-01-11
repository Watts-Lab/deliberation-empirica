import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { TextArea } from "../components/TextArea";

export function Prompt({ promptString, saveKey }) {
  const player = usePlayer();
  const [value, setValue] = useState("");

  const handleChange = (e) => {
    setValue(e.target.value);
    player.set(saveKey, e.target.value);
  };

  const [, metaData, prompt, responseString] = promptString.split("---");
  // TODO: strip leading and trailing whitespace from prompt
  const promptType = metaData.match(/^type:\s*(\S+)/m)[1];
  const promptName = metaData.match(/^name:\s*(\S+)/m)[1];
  const responses = responseString
    .split(/\r?\n|\r|\n/g)
    .filter((i) => i)
    .map((i) => i.substring(2));

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
