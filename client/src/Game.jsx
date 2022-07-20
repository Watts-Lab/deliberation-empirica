import React from "react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";

const gameStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
}

const stageStyle = {
  //height:'90%',
  display:'flex',
  width:'100%'
}

export function Game() {
  return (
    <div style={gameStyle}>
      <Profile />
      <div style={stageStyle}>
        <Stage />
      </div>
    </div>
  );
}
