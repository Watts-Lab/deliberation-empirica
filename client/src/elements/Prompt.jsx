import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import { Markdown } from "../components/Markdown";
import { RadioGroup } from "../components/RadioGroup";
import { TextArea } from "../components/TextArea";

// function reducer(state, action) {
//   const newValue = {
//     promptType: action.promptType,
//     promptName: action.promptName,
//     value: action.value,
//   };
//   const newPrompts = state.prompts;
//   newPrompts[action.index] = newValue;
//   return { ...state, prompts: newPrompts };
// }

// Add an alert for when the prompts are going to move on
// Add an alert for when there is a new prompt
// log every prompt change to the player object (figure out a schedule for textareas)

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

// export function PromptList({ promptList, submitButton = true }) {
//   const player = usePlayer();
//   const stage = useStage();

//   const initialState = {
//     playerId: player.id,
//     stageNumber: stage.get("index"),
//     prompts: new Array(promptList.length),
//   };
//   const [state, dispatch] = useReducer(reducer, initialState);

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     player.set("prompt", state);
//     player.stage.set("submit", true);
//   };

//   return (
//     <div>
//       <form onSubmit={handleSubmit}>
//         {promptList.map((promptDict, index) =>
//           Prompt({
//             promptDict,
//             index,
//             state,
//             dispatch,
//           })
//         )}
//         {submitButton && (
//           <div className="mt-4">
//             <Button type="submit" data-test="submitButton">
//               Next
//             </Button>
//           </div>
//         )}
//       </form>
//     </div>
//   );
// }
