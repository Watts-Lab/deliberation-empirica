import React, { useEffect, useState } from 'react';
import eyeson, { StreamHelpers } from 'eyeson';
import Video from './Video';
import './VideoCall.css';
import { usePlayer, useStage } from '@empirica/player';

export function VideoCall ({ roomName, record }) {
  const [prepared, setPrepared] = useState(false);
  const [started, setStarted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [audio, setAudio] = useState(true);
  const [video, setVideo] = useState(true);

  const player = usePlayer();
  const stage = useStage();

  const handleEvent = event => {
    const { type } = event;
    console.log(`received event: ${type}`);
    console.debug(type, event);
    if (type === 'room_setup') {
      if (record && !event.recording) {
        eyeson.send({ type: 'start_recording' })
      }
      return;
    }
    if (type === 'accept') {
      setLocalStream(event.localStream);
      setRemoteStream(event.remoteStream);
      player.set('audioEnabled', true);
      player.set('videoEnabled', true);
      // temporary solution to not receiving room_setup event for some reason
      if (record) {
        eyeson.send({type: 'start_recording'});
      }      
      return;
    }
    if (type === 'recording_update') {
      if (!stage.get('recording_url') && event.recording) {
        stage.set('recording_url', event.recording.links.self);
      }
      return;
    }
    if (type === 'warning') {
      console.log('Warning: ' + event.name);
      return;
    }
    if (type === 'error') {
      console.log('Error: ' + event.name);
      endSession();
      return;
    }
    if (type === 'exit') {
      console.log('Meeting has ended');
      endSession();
      return;
    }
    console.debug('[App]', 'Ignore received event:', event.type);
  };

  async function delay(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  const startSession = async () => {
    let access_key = player.get('accessKey');
    if (!access_key) {
      await delay(3000);
      setPrepared(true);
      return;
    }
    setPrepared(true);
    setStarted(true);
    console.log(access_key);
    eyeson.onEvent(handleEvent);
    eyeson.start(access_key);
  }

  const endSession = () => {
    player.set('accessKey', null);
    eyeson.offEvent(handleEvent);
    eyeson.destroy();
    eyeson.onEvent(handleEvent);
    setLocalStream(null);
    setRemoteStream(null);
  }

  useEffect(() => {
    if (roomName && !remoteStream) {
      startSession();
    }
    return () => { 
      endSession();
      eyeson.offEvent(handleEvent); 
    }
  }, [roomName]);

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

  if (!prepared) {
    return (
      // loading page
      <div>
        <h3>Preparing to the Meeting Room...</h3>
      </div>
    );
  }

  if (!started) {
    return (
      <div>
        <button className="join-button" onClick={()=> window.location.reload(false)}>Join Meeting</button>
      </div>
    );
  }

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