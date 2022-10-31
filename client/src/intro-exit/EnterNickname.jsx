import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";

export function EnterNickname({ next }) {
  useEffect(() => {
    console.log("Intro: Enter Nickname");
  }, []);

  const player = usePlayer();

  const labelClassName =
    "mb-5 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm";

  const [nickname, setNickname] = useState("");

  function handleNickname(e) {
    setNickname(e.target.value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    player.set("nickname", nickname);
    next();
  }

  return (
    <div className="pt-10 sm:mt-10 ml-20">
      <h3 className="text-lg leading-5 font-medium text-gray-900">
        Please enter your first name, or a nickname if you prefer.
      </h3>
      <p className="mt-1 mb-3 text-md text-gray-600">
        This is the name that other participants will see.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          className={labelClassName}
          type="textarea"
          id="inputNickname"
          onChange={handleNickname}
          // autoFocus
        />
        <Button type="submit" id="enter-nickname">
          <p>Next</p>
        </Button>
      </form>
    </div>
  );
}
