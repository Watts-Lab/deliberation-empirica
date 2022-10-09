// import { isDevelopment } from '@empirica/core/player';
import { usePlayer, useGame } from '@empirica/core/player/classic/react';
import React, { useEffect } from 'react';
import { VideoCall } from '../components/VideoCall';

const containerStyle = {
  display: 'flex',
  padding: '20px',
  height: '700px',
};
const lowStyle = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'flex-start',
  width: '100%',
  height: '100%',
};

const vidStyle = {
  padding: '15px',
  minWidth: '500px',
  position: 'relative',
  width: '100%',
  minHeight: '700px',
  height: '100%',
};

const rStyle = {
  display: 'flex',
  flexDirection: 'column',
  padding: '35px',
  minWidth: '300px',
  width: '30%',
};

export function Discussion({ prompt }) {
  const player = usePlayer();
  const game = useGame();
  const dailyUrl = game.get('dailyUrl');
  const isDevelopment = ['dev', 'test'].includes(player.get("deployEnvironment"))
  console.log(`Discussion Room URL: ${dailyUrl}`);

  const urlParams = new URLSearchParams(window.location.search);
  console.log(urlParams);
  const videoCallEnabledInDev = urlParams.get('videoCall') || false;

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    if (isDevelopment) {
      console.log(`Video Call Enabled: ${videoCallEnabledInDev}`);
    }
  }, []);

  // // eslint-disable-next-line consistent-return -- not a mistake
  // useEffect(() => {
  //   // the following code works around https://github.com/empiricaly/empirica/issues/132
  //   // TODO: remove when empirica is updated @npaton
  //   if (!accessKey && (!isDevelopment || videoCallEnabledInDev)) {
  //     const timer = setTimeout(() => {
  //       console.log("Refreshing to load video");
  //       window.location.reload();
  //     }, 2000);
  //     return () => clearTimeout(timer);
  //   }
  // });

  return (
    <div style={containerStyle}>
      <div style={lowStyle}>
        {!dailyUrl && (
          <h2 data-test="loadingVideoCall"> Loading meeting room... </h2>
        )}
        {isDevelopment && !videoCallEnabledInDev && (
          <h2>
            Videocall Disabled for testing.&nbsp; To enable, add URL parameter
            &quot;&amp;videoCall=true&quot;
          </h2>
        )}

        <div style={vidStyle}>
          {dailyUrl && <VideoCall roomUrl={dailyUrl} record />}
        </div>

        <div style={rStyle}>
          {prompt}
          {isDevelopment && (
            <input
              type="submit"
              data-test="skip"
              id="stageSubmitButton"
              onClick={() => player.stage.set('submit', true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
