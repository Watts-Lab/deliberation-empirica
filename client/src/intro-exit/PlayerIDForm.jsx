/* eslint-disable jsx-a11y/no-autofocus -- ensure that can directly type into box */
import React, { useState, useEffect } from "react";
import { P, H1 } from "../components/TextStyles";

export function PlayerIDForm({ onPlayerID }) {
  useEffect(() => {
    console.log("Intro: Player ID");
  }, []);

  const [playerID, setPlayerID] = useState("");

  const handleSubmit = (evt) => {
    evt.preventDefault();
    if (!playerID || playerID.trim() === "") {
      return;
    }
    onPlayerID(playerID);
  };

  return (
    <div className="min-h-screen bg-empirica-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <H1>Please enter your assigned payment ID</H1>
        <P>
          This could be your MTurk ID, Prolific ID, or Research Platform ID.
        </P>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form
            className="space-y-6"
            action="#"
            method="POST"
            onSubmit={handleSubmit}
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                ID:
              </label>
              <div className="mt-1">
                <input
                  id="playerID"
                  name="playerID"
                  type="text"
                  autoComplete="off"
                  required
                  autoFocus
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm"
                  value={playerID}
                  onChange={(e) => setPlayerID(e.target.value)}
                />
                <p
                  className="mt-2 text-sm text-gray-500"
                  id="playerID-description"
                >
                  Thank you!
                </p>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-empirica-600 hover:bg-empirica-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500"
              >
                Enter
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
