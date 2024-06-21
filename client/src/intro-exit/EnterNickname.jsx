import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";

export function EnterNickname({ next }) {
  useEffect(() => {
    console.log("Intro: Enter Nickname");
  }, []);

  const player = usePlayer();

  const labelClassName =
    "mb-5 mt-3 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 w-full";

  const [nickname, setNickname] = useState("");

  const handleNickname = (e) => {
    setNickname(e.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    player.set("name", nickname);
    next();
  };

  return (
    <div className="grid justify-center">
      <div className="max-w-xl">
        <h1>
          In the box below, please enter your first name, or a nickname if you
          prefer.
        </h1>
        <p>
          This is the name which will be displayed to other participants in your
          discussion.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            className={labelClassName}
            type="textarea"
            autoComplete="off"
            id="inputNickname"
            data-test="inputNickname"
            onChange={handleNickname}
            // autoFocus
          />
          <Button testId="continueNickname" handleClick={handleSubmit}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
