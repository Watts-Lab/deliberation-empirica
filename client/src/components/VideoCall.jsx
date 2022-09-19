import { usePlayer } from '@empirica/core/player/classic/react';
import DailyIframe from '@daily-co/daily-js';
import React, { useEffect, useState, useRef } from 'react';
import './VideoCall.css';

export function VideoCall({ roomKey }) {
  const player = usePlayer();

  // don't call this until roomKey Exists
  const dailyElement = useRef(null);
  const [callFrame, setCallFrame] = useState(null);

  const mountListeners = () => {
    callFrame.on('joined-meeting', event => {
      console.debug('Joined Meeting', event);
      // callFrame.startRecording({ fps: 30, layout: { preset: 'default' } });
    });

    callFrame.on('track-started', event => {
      if (event.participant.owner) {
        if (event.track.kind === 'video') {
          player.set('videoEnabled', true);
          console.debug('player video started');
        } else if (event.track.kind === 'audio') {
          player.set('audioEnabled', true);
          console.debug('player audio started');
        }
        console.debug('track-started', event);
      }
    });

    callFrame.on('track-stopped', event => {
      if (event.participant.owner) {
        if (event.track.kind === 'video') {
          player.set('videoEnabled', false);
          console.debug('player video stopped');
        } else if (event.track.kind === 'audio') {
          player.set('audioEnabled', false);
          console.debug('player audio stopped');
        }
        console.debug('track-started', event);
      }
    });
  };

  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (dailyElement.current && !callFrame) {
      // when component starts, only once
      setCallFrame(DailyIframe.wrap(dailyElement.current, { activeSpeakerMode: false, userName: player.get('nickname') }));
      console.log('mounted callFrame');
    }
    console.log('triggered');
  }, [dailyElement, callFrame]);

  useEffect(() => {
    if (callFrame) {
      mountListeners();
      callFrame.join({ url: roomKey });
    }

    return () => {
      console.log('left meeting');
      // when component closes
      if (callFrame) {
        callFrame.leave();
      }
    };
  }, [callFrame]);

  return (
    <div>
      <iframe id="dailyIframe" className="video-frame" title="Daily Iframe" ref={dailyElement} allow="microphone;camera;autoplay;display-capture" />
    </div>
  );
}
