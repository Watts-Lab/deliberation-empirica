import { useGame } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { VideoCall } from "../components/VideoCall";

const containerStyle = {
  flex: 1,
  display: "flex",
  padding: "20px",
  height: "700px",
};
const lowStyle = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "flex-start",
  width: "100%",
  height: "100%",
};

const vidStyle = {
  padding: "15px",
  minWidth: "500px",
  position: "relative",
  width: "100%",
  minHeight: "700px",
  height: "100%",
};

export function Discussion() {
  const game = useGame();
  const dailyUrl = game.get("dailyUrl");

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    console.log(`Discussion Room URL: ${dailyUrl}`);
  }, []);

  return (
    <div style={containerStyle}>
      <div style={lowStyle}>
        {!dailyUrl && (
          <h2 data-test="loadingVideoCall"> Loading meeting room... </h2>
        )}

        <div style={vidStyle}>
          {dailyUrl && <VideoCall roomUrl={dailyUrl} record />}
        </div>
      </div>
    </div>
  );
}
