import { useStageTimer } from '@empirica/player';
import React from 'react';

function humanTimer(seconds) {
  if (seconds === null) {
    return '-';
  }
  // Since we will likely never run timer for longer than 24 hours, I think this works fine
  return new Date(1000 * seconds).toISOString().slice(seconds < 3600 ? 14 : 11, 19);

  // let out = '';
  // const s = seconds % 60;
  // out += s.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false });

  // const min = (seconds - s) / 60;
  // if (min === 0) {
  //   return `00:${out}`;
  // }

  // const m = min % 60;
  // out = `${m.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false }}:${out}`;

  // const h = (min - m) / 60;
  // if (h === 0) {
  //   return out;
  // }

  // return `${h}:${out}`;
}

export function Timer() {
  const remaining = useStageTimer();

  return (
    <div className="flex flex-col items-center">
      <h1 className="font-mono text-3xl text-gray-500 font-semibold">
        {humanTimer(remaining)}
      </h1>
    </div>
  );
}
