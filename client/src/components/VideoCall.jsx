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
  const [stats, setStats] = useState(null);

  const player = usePlayer();
  const stage = useStage();

  const showStatistics = stats => {
    setStats(stats);
  }

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
    } else if (type === 'statistics_ready') {
      event.statistics.onUpdate(showStatistics);
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
      <div className="control-bar">
        <button onClick={toggleVideo}>
          <img className={video ? "video-icon" : "video-icon-muted"} alt={video ? "Mute Video" : "Unmute Video"} />
        </button>
        <button onClick={toggleAudio}>
          <img className={audio ? "audio-icon" : "audio-icon-muted"} alt={audio ? "Mute Audio" : "Unmute Audio"} />
        </button>
        { /* <button onClick={endSession}>Quit</button> */ }
      </div>
      {stats && <div>
        <p>Bitrate: {stats.bitrateSend}&uarr; {stats.bitrateRecv}&darr;<br/></p>
        <p>Jitter: {stats.jitter}<br/></p>
        <p>Packet Loss: {stats.packetLoss}<br/></p>
        <p>Round Trip Time: {stats.roundTripTime}<br/></p>
        <p>NackL {stats.nack}<br/></p>
      </div>}
    </>    
  );
}