import { EmpiricaMenu, EmpiricaPlayer, GameFrame, isDevelopment } from '@empirica/player';
import React, { useEffect } from 'react';
import 'virtual:windi.css'; // what is this
import { isMobile } from 'react-device-detect';
import { Game } from './Game';
import { IntroCheck } from './intro-exit/IntroCheck';
// import BetaVideoConsent from './intro-exit/BetaVideoConsent';
import { EnterNickname } from './intro-exit/EnterNickname';
import { VideoCheck } from './intro-exit/VideoCheck';
import { teamViability } from './intro-exit/Surveys/team_viability';
import { qualityControl } from './intro-exit/Surveys/quality_control';
import { Alert } from './components/Alert';
import { PlayerIDForm } from './intro-exit/PlayerIDForm';
import { NoGamesWithSorry } from './pages/NoGamesWithSorry';
import { IRBConsent } from './intro-exit/IRBConsent';
import { Lobby } from './pages/Lobby';

export function getURL() {
  // helps resolve some issues with running from the localhost over ngrok
  // TODO: find out if we can remove this
  const host = window.location.hostname;

  if (host === 'localhost') {
    return 'http://localhost:3000/query';
  }

  return `https://${host}/query`;
}

// eslint-disable-next-line import/no-default-export
export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerKeys = urlParams.getAll('playerKey') || '';
  playerKeys.forEach((playerKey, index) => { console.log(`player_${index}`, playerKey); });

  useEffect(() => {
    console.log(`Start: ${process.env.NODE_ENV} environment`);
  }, []);

  const introSteps = [
    IntroCheck,
    // BetaVideoConsent,
    EnterNickname,
    VideoCheck,
  ];

  const exitSteps = [
    teamViability,
    qualityControl,
  ];

  if (isMobile) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Mobile Device Detected">
          Mobile devices are not supported. Please join again from a computer to participate.
        </Alert>
      </div>
    );
  }

  function renderPlayers(keys) {
    const players = [];
    keys.forEach(playerKey => {
      players.push(
        <div test-player-id={playerKey}>
          <EmpiricaPlayer url={getURL()} ns={playerKey}>
            <GameFrame
              consent={IRBConsent}
              playerIDForm={PlayerIDForm}
              introSteps={introSteps}
              exitSteps={exitSteps}
              noGames={NoGamesWithSorry}
              lobby={Lobby}
            >
              <Game />
            </GameFrame>
          </EmpiricaPlayer>
        </div>,
      );
    });

    return <div className="h-full overflow-auto">{players}</div>;
  }

  // the second player in this block lets us cypress test multiple players at the
  // same time.
  return (
    <div className="h-screen relative">
      {isDevelopment && <EmpiricaMenu />}
      {isDevelopment ? renderPlayers(playerKeys) : renderPlayers([playerKeys[0]])}
    </div>
  );
}
