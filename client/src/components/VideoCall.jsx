import React, { useEffect, useState } from 'react';
import eyeson, { StreamHelpers } from 'eyeson';
import Video from './Video';
import './VideoCall.css';
import { usePlayer, useStage } from '@empirica/player';

export function VideoCall ({ accessKey, record }) {
  // don't call this until accessKey Exists
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [audio, setAudio] = useState(true);
  const [video, setVideo] = useState(true);

  const player = usePlayer();
  const stage = useStage();

  const handleEvent = event => {
    const { type } = event;
    console.debug(type, event);
    if (type === 'room_setup') { // if we are setting up a room, but it isn't ready yet
      if (record && !event.recording) {
        eyeson.send({ type: 'start_recording' })
      }
    } else if (type === 'accept') {  // ready to connect to the meeting
      setLocalStream(event.localStream);
      setRemoteStream(event.remoteStream);
      player.set('audioEnabled', true);
      player.set('videoEnabled', true);
      if (record) {
        eyeson.send({type: 'start_recording'});
      }      
    } else if (type === 'recording_update') {  // when the recording starts, sends back info about the recording
      if (!stage.get('recording_url') && event.recording) {
        stage.set('recording_url', event.recording.links.self);
      }
    } else if (type === 'stream_update') {  // any time any participant mutes or unmutes (we believe)
      setLocalStream(event.localStream);
      setRemoteStream(event.stream);
    } else if (type === 'warning') {
      console.log('Warning: ' + event.name);
    } else if (type === 'error') {
      console.log('Error: ' + event.name);
    } else if (type === 'exit') {
      console.log('Meeting has ended');
    } else {
      console.debug('[App]', 'Ignore received event:', event.type);
    }
    
  };


  useEffect(() => {
    // when component starts, only once
    eyeson.onEvent(handleEvent); // connect our event handler to to the eyeson callback
    eyeson.start(accessKey);  // starts the meeting

    return () => {  // when component closes
      eyeson.offEvent(handleEvent);
      eyeson.destroy();
      setLocalStream(null);
      setRemoteStream(null);
    }
  }, []);

  const toggleAudio = () => {
    const audioEnabled = !audio;
    StreamHelpers.toggleAudio(localStream, audioEnabled);
    setAudio(audioEnabled);
    player.set('audioEnabled', audioEnabled);
  };

  const toggleVideo = () => {
    const videoEnabled = !video;
    eyeson.send({
      type: 'change_stream',
      stream: localStream,
      video: videoEnabled,
      audio: audio
    });
    setVideo(videoEnabled);
    player.set('videoEnabled', videoEnabled);
  };

  if (!remoteStream) {
    return (
      <div>
        <h3>Connecting to the Meeting Room...</h3>
      </div>
    );
  }

  return(
    <>
      <div>
        { remoteStream && <Video stream={remoteStream} /> }
      </div>
      <div>
        <button onClick={toggleVideo}><i className={video ? "video-icon" : "video-icon-muted"}/></button>
        <button onClick={toggleAudio}><i className={audio ? "audio-icon" : "audio-icon-muted"}/></button>
        { /* <button onClick={endSession}>Quit</button> */ }
      </div>
    </>    
  );
}