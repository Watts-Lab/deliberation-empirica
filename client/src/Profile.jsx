import React from "react";
import { Timer } from "./components/Timer";

export function Profile() {
  return (
    <div
      data-test="profile"
      className="absolute top-0 left-0 right-0 md:min-w-2xl  p-y-2 text-gray-500 bg-gray-100 rounded-b-md grid grid-cols-3 items-center shadow-sm"
    >
      Time Remaining
      <Timer />
    </div>
  );
}
