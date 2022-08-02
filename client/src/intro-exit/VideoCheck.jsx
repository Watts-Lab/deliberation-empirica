import React, { useState, useEffect } from 'react';
import { usePlayer, isDevelopment } from '@empirica/player';
import { VideoCall } from '../components/VideoCall';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';

const questionsStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
};

const vidStyle = {
  padding: '15px',
  minWidth: '600px',
  width: '100%',
  maxWidth: '1000px',
};

const mainStyle = {
  display: 'flex',
  flexDirection: 'row',
};

const flexStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
};

const rightStyle = {
  width: '60%',
  minWidth: '400px',
};

export function VideoCheck({ next }) {
  const player = usePlayer();
  const accessKey = player.get('accessKey');
  // probably won't need this once refresh not needed to get accessKey
  console.log(`VideoCheck Access Key: ${accessKey}`);

  const urlParams = new URLSearchParams(window.location.search);
  const videoCallEnabledInDev = urlParams.get('videoCall') || false;

  const [canSee, setSee] = useState(false);
  const [noName, setNoName] = useState(false);
  const [backgroundInfo, setBackground] = useState(false);
  const [safePlace, setSafePlace] = useState(false);
  const [noInterrupt, setNoInterrupt] = useState(false);
  const [speakFree, setSpeakFree] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [incorrectResponse, setIncorrectResponse] = useState(false);

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    console.log('Intro: Video Check');
    if (!isDevelopment || videoCallEnabledInDev) {
      console.log('Setting room name to player ID');
      player.set('roomName', player.id);

      return () => {
        player.set('roomName', null); // done with this room, close it
        player.set('accessKey', null);
      };
    }
    if (isDevelopment) console.log(`Video Call Enabled: ${videoCallEnabledInDev}`);
  }, []);

  // eslint-disable-next-line consistent-return -- not a mistake
  useEffect(() => {
    // the following code works around https://github.com/empiricaly/empirica/issues/132
        // TODO: remove when empirica is updated
        // CC: @npaton
    if (!accessKey && (!isDevelopment || videoCallEnabledInDev)) {
      const timer = setTimeout(() => {
        console.log('Refreshing to load video');
        window.location.reload();
      }, 3000);
      return () => clearTimeout(timer);
    }
  });

  function handleSubmit(event) {
    // eslint-disable-next-line max-len
    const correctResponse = enabled && canSee && noName && backgroundInfo && safePlace && noInterrupt && speakFree;

    if (correctResponse) {
      console.log('Videocheck complete');
      next();
    } else {
      console.log('Videocheck submitted with errors');
      setIncorrectResponse(true);
    }

    if (incorrectResponse) {
      document.getElementById('alert').scrollIntoView(true);
    }

    event.preventDefault();
  }

  return (
    <div style={flexStyle} id="alert" className="ml-5 mt-1 sm:mt-5 p-5">
      <h3 className="text-lg leading-6 font-medium text-gray-900">Check your webcam</h3>
      <div className="mt-8 mb-8">
        {incorrectResponse && (
          <div className="my-5">
            <Alert title="Not all of the necessary items were confirmed!" kind="error">
              Please confirm all of the following to continue.
            </Alert>
          </div>
        )}

        <p className="my-8 text-md text-gray-700">
          Please wait for the meeting to connect and&nbsp;
          take a moment to familiarize yourself with the video call software.&nbsp;
          (You will be the only person in this meeting.)
        </p>
        <div style={mainStyle}>
          <center>
            { isDevelopment && <input type="submit" data-test="skip" id="stageSubmitButton" onClick={() => next()} /> }
            { !accessKey && <h2 data-test="loadingVideoCall"> Loading meeting room... </h2>}
            { isDevelopment && !videoCallEnabledInDev && (
              <h2>
                Videocall Disabled for testing.&nbsp;
                To enable, add URL parameter &quot;&amp;videoCall=true&quot;
              </h2>
            )}
            <div style={vidStyle}>
              { accessKey && (
                <VideoCall
                  roomKey={accessKey}
                  record={false}
                />
              )}
            </div>
          </center>

          <div style={rightStyle}>
            <p className="mt-2 text-md text-gray-700">
              <b>Please confirm the following to ensure you can participate in the discussion.</b>
            </p>
            <form style={questionsStyle} onSubmit={handleSubmit}>
              <div className="ml-5 space-y-1">
                <div className="mt-1">
                  <input type="checkbox" className="mr-2" id="enabled" onClick={() => setEnabled(document.getElementById('enabled').checked)} />
                  <label htmlFor="enabled" className="display-6 text-gray-700 my-2">
                    My camera and microphone are enabled.
                  </label>
                </div>
                <div className="mt-1">
                  <input className="mr-2" type="checkbox" id="see" onClick={() => setSee(document.getElementById('see').checked)} />
                  <label htmlFor="see" className="display-6 text-gray-700 my-2">
                    I can see my full face in the video window.
                  </label>
                </div>
                <div className="mt-1">
                  <input className="mr-2" type="checkbox" id="noName" onClick={() => setNoName(document.getElementById('noName').checked)} />
                  <label htmlFor="noName" className="display-6 text-gray-700 my-2">
                    Nothing in my background reveals my full name&nbsp;
                    (i.e. a diploma on the wall, the name of an employer).
                  </label>
                </div>
                <div className="mt-1">
                  <input className="mr-2" type="checkbox" id="background" onClick={() => setBackground(document.getElementById('background').checked)} />
                  <label htmlFor="background" className="display-6 text-gray-700 my-2">
                    My background doesn&apos;t reveal other personal&nbsp;
                    information I am not comfortable sharing.
                  </label>
                </div>
                <div className="mt-1">
                  <input className="mr-2" type="checkbox" id="safeplace" onClick={() => setSafePlace(document.getElementById('safeplace').checked)} />
                  <label htmlFor="safeplace" className="display-6 text-gray-700 my-2">
                    I am in a safe place to engage in a discussion.
                  </label>
                </div>
                <div className="mt-1">
                  <input className="mr-2" type="checkbox" id="speakFree" onClick={() => setSpeakFree(document.getElementById('speakFree').checked)} />
                  <label htmlFor="speakfree" className="display-6 text-gray-700 my-2">
                    I am in a space where I can speak freely without bothering other people.
                  </label>
                </div>
                <div className="mt-1">
                  <input className="mr-2" type="checkbox" id="noInterrupt" onClick={() => setNoInterrupt(document.getElementById('noInterrupt').checked)} />
                  <label htmlFor="noInterrupt" className="display-6 text-gray-700 my-2">
                    I will not be interrupted.
                  </label>
                </div>
              </div>

              <Button type="submit">
                <p>Next</p>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
