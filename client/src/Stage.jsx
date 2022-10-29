import {
  usePlayer,
  usePlayers,
  useStage,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import React, { useEffect, useState } from "react";
import { Discussion } from "./pages/Discussion";
import { TrainingVideo } from "./pages/TrainingVideo";
import { PromptList } from "./pages/Prompt";

export function Stage() {
  const player = usePlayer();
  const players = usePlayers();
  const stage = useStage();

  const isDevelopment = ["dev", "test"].includes(
    player.get("deployEnvironment")
  );
  const [callEnabled, setCallEnabled] = useState(!isDevelopment);

  useEffect(() => {
    console.log(`Stage ${stage.get("index")}: ${stage.get("name")}`);
  }, []);

  if (player.stage.get("submit")) {
    if (players.length === 1) {
      return <Loading />;
    }
    return (
      <div className="text-center text-gray-400 pointer-events-none">
        Please wait for other player(s).
      </div>
    );
  }

  const devTools = () => (
    <div data-test="devTools">
      <input
        type="checkbox"
        id="enableVideoCall"
        name="enableVideoCall"
        data-test="enableVideoCall"
        onClick={setCallEnabled}
      />
      <label htmlFor="enableVideoCall">Enable VideoCall</label>
      <br />
      <input
        type="submit"
        data-test="skip"
        onClick={() => player.stage.set("submit", true)}
      />
    </div>
  );

  const displayComponent = (type) => {
    const promptList = stage.get("prompt");
    switch (type) {
      case "discussion":
        return (
          <div className="mt-5 md:(flex space-x-4)">
            <div className="min-w-sm h-[45vh] md:(flex-grow h-[90vh])">
              {callEnabled ? <Discussion /> : <h2>VideoCall disabled</h2>}
            </div>
            {promptList && (
              <div className="max-w-lg">
                <PromptList
                  promptList={promptList}
                  responseOwner={stage}
                  submitButton={false}
                />
              </div>
            )}
          </div>
        );
      case "prompt":
        return <PromptList promptList={promptList} responseOwner={player} />;

      case "video":
        return <TrainingVideo url={stage.get("url")} />;

      default:
        return <br />;
    }
  };

  return (
    <div>
      {displayComponent(stage.get("type"))}
      {isDevelopment && devTools()}
    </div>
  );
}
