import React, { useState, useEffect } from 'react';
import { usePlayer } from "@empirica/core/player/classic/react";
// import { getEtherpadText } from '../../../server/src/getEtherpadText';

export function SharedNotepad({ padID }) {
  
  const player = usePlayer();
  const [focusIntervalID, setFocusIntervalID] = useState(''); // to-do: clearInvertal()

  useEffect(() => {
    function checkFocus() {
      if (
        document.activeElement === document.getElementById(padID) &&
        player.stage.get('clicked') !== padID
      ) {
        player.stage.set('clicked', padID);
      } else if (
        document.activeElement !== document.getElementById(padID) &&
        player.stage.get('clicked') === padID
      ) {
        player.stage.set('clicked', null);
      }
    } 
    setFocusIntervalID(setInterval(checkFocus, 100));
    return () => {
      clearInterval(focusIntervalID);
    }
  }, [])


  
  function buildUserParams() {
    return `?userName=${player.id}&userColor="blue"`.replace(/#/g, '%23'); // to-do: get the color of the player
  }
  
  function buildOptionsParams(options) {
    return options
      ? Object.entries(options).reduce((acc, [query, value]) => `${acc}&${query}=${value}`, '')
      : '';
  }
  const baseUrl = 'https://collab.csslabdev.com';
  const defaultOptions = {
    showLineNumbers: false,
    showControls: false,
    showChat: false,
    useMonospaceFont: false,
    noColors: false,
    alwaysShowChat: false,
    lang: 'en',
    rtl: false,
    focusOnLine: 0,
  };
  const userParams = buildUserParams(player);
  const optionsParams = buildOptionsParams(defaultOptions);
  const [padURL, setPadURL] = useState(`${baseUrl}/p/${padID + userParams + optionsParams}`);

  return (
    <iframe
      id={padID}
      title='etherpad editor'
      width='100%'
      height='100%'
      style={{border: '2px solid'}}
      sandbox='allow-scripts allow-same-origin'
      src={padURL}
    />
  ); 
} 

/*
export function buildPadId(gameId, displayName, uid) {
  return `${gameId}-${displayName}-${uid}`.replace(/ /g, '_');
}


export async function saveEtherpadStage(stage) {
  const etherpadData = stage.get('etherpadData');

  for (const padId in etherpadData) {
    etherpadData[padId] = await getEtherpadText(padId);
  }

  stage.set('etherpadData', etherpadData);
}
*/

