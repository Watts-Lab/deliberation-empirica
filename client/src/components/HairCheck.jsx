import { usePlayer } from '@empirica/core/player/classic/react';
import DailyIframe from '@daily-co/daily-js';
import React, { useEffect, useState } from 'react';
import { Video } from './Video';
import './HairCheck.css';

export function HairCheck({ roomUrl }) {
  const player = usePlayer();

  const dailyObject = DailyIframe.createCallObject();
  const [localStream, setLocalStream] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);

  const refreshDeviceList = async () => {
    console.log('Requested equipment update')
    const { devices } = await dailyObject.enumerateDevices();
    setCameras(devices.filter(d => d.kind === 'videoinput' && d.deviceId !== ''));
    setMicrophones(devices.filter(d => d.kind === 'audioinput' && d.deviceId !== ''));
    setSpeakers(devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== ''));
  }

  const mountListeners = () => {
    dailyObject.on('available-devices-updated', refreshDeviceList);

    // not receiving this callback after invoking setInputDeviceAsync why?
    dailyObject.on('selected-devices-updated', event => {
      console.log('New device selection');
      const { camera, mic, speaker } = event.devices;
      if (camera && camera.deviceId !== player.get('camera')) {
        player.set('camera', camera.deviceId);
      } else if (mic && mic.deviceId !== player.get('mic')) {
        player.set('mic', mic.deviceId);
      } else if (speaker && speaker.deviceId !== player.get('speaker')) {
        player.set('speaker', speaker.deviceId);
      }
    });

    // These events are never triggered
    dailyObject.on('track-started', event => {
      if (event.participant.local) {
        localStream.addTrack(event.track);
      }
    });

    dailyObject.on('track-stopped', event => {
      if (event.participant.local) {
        localStream.removeTrack(event.track);
      }
    })
  };

  useEffect(() => {
    const connect = async () => {
      const { camera, mic, speaker} = await dailyObject.startCamera({url: roomUrl});
      const localParticipant = dailyObject.participants().local;
      const videoTrack = localParticipant.tracks.video.persistentTrack;
      const audioTrack = localParticipant.tracks.audio.persistentTrack;
      console.log(audioTrack);
      setLocalStream(new MediaStream([videoTrack, audioTrack]));
      player.set('camera', camera.deviceId);
      player.set('mic', mic.deviceId);
      player.set('speaker', speaker.deviceId);
      await refreshDeviceList();
      mountListeners();
      console.log(localStream)
    };

    connect();

    return () => {
      // const tracks = localStream.getTracks();
      // tracks.forEach(track => track.stop());
      dailyObject.destroy();
    }
  }, []);

  const updateCamera = async e => {
    const { camera, mic } = await dailyObject.setInputDevicesAsync({
      videoDeviceId: e.target.value
    });
    console.log(camera.deviceId);
    player.set('camera', e.target.value);
    // why dailyObject.participants() === {} ?
    console.log(localStream);
    console.log(localStream.getVideoTracks());
    localStream.getVideoTracks()[0].stop();
    // localStream.removeTrack(localStream.getVideoTracks()[0]);
    // localStream.addTrack(videoTrack);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        deviceId: mic.deviceId,
      },
      video: {
        deviceId: camera.deviceId,
      }
    });
    setLocalStream(stream);
  }

  const updateMicrophone = async e => {
    const { camera, mic } = await dailyObject.setInputDevicesAsync({
      audioDeviceId: e.target.value
    });
    player.set('mic', e.target.value);
    console.log(localStream)
    console.log(localStream.getAudioTracks())
    localStream.getAudioTracks()[0].stop();
    // localStream.removeTrack(localStream.getAudioTracks()[0]);
    // localStream.addTrack(audioTrack);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        deviceId: mic.deviceId,
      },
      video: {
        deviceId: camera.deviceId,
      }
    });
    setLocalStream(stream);
  }

  const updateSpeaker = e => {
    dailyObject.setInputDevicesAsync({ audioDeviceId: e.target.value });
    player.set('speaker', e.target.value);
  }

  return (
    <form className="hair-check">
      <h1>Choose your hardware</h1>
      {/* Video preview */}
      {localStream && <Video className="videoPreview" stream={localStream} />}

      {/* Camera select */}
      <div>
        <label htmlFor="cameraOptions">Camera:</label>
        <select name="cameraOptions" id="cameraSelect" onChange={updateCamera}>
          {cameras?.map((camera) => (
            <option key={`cam-${camera.deviceId}`} value={camera.deviceId}>
              {camera.label}
            </option>
          ))}
        </select>
      </div>

      {/* Microphone select */}
      <div>
        <label htmlFor="micOptions">Microphone:</label>
        <select name="micOptions" id="micSelect" onChange={updateMicrophone}>
        {microphones?.map((mic) => (
          <option key={`mic-${mic.deviceId}`} value={mic.deviceId}>
            {mic.label}
          </option>
        ))}
        </select>
      </div>

      {/* Speakers select */}
      <div>
        <label htmlFor="speakersOptions">Speakers:</label>
        <select name="speakersOptions" id="speakersSelect" onChange={updateSpeaker}>
        {speakers?.map((speaker) => (
          <option key={`speaker-${speaker.deviceId}`} value={speaker.deviceId}>
            {speaker.label}
          </option>
        ))}
        </select>
      </div>
    </form>
  );
}
