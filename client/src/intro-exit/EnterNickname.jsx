import React, {useState} from "react";
import { Button } from "../components/Button";
import { usePlayer } from "@empirica/player";
export function EnterNickname({ next }) {
  const player = usePlayer();
  const labelClassName = 
    "mb-5 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm";
  const [nickname, setNickname] = useState("");
  
  function handleNickname(e) {
    setNickname(e.target.value);
  }

  function handleSubmit() {
    player.set("name", nickname);
    next();
  }
  

    return (
    <div className="mt-3 sm:mt-5 p-20">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        In the box below, please enter your first name, or a nickname if you prefer.
      </h3>
      <p className="mt-1 mb-3 text-md text-gray-500">
          This is the name which will be displayed to other participants in your discussion.
      </p>
      <input className={labelClassName} type="textarea" id="inputNickname" onChange={handleNickname}></input>
      <Button handleClick={handleSubmit} autoFocus>
        <p>Next</p>
      </Button>
    </div>
    );
}