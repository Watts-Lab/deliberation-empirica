import { EmpiricaGlobal } from "@empirica/player";
import React from "react";
import ReactDOM from "react-dom";
import App, { getURL } from "./App";
import "./index.css";

ReactDOM.render(
  <React.StrictMode>
    <EmpiricaGlobal url={getURL()}>
      <App />
    </EmpiricaGlobal>
  </React.StrictMode>,
  document.getElementById("root")
);
