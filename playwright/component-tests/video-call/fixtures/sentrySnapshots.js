/**
 * Real diagnostic data captured from Sentry issues.
 * Use these as test fixtures to ensure we catch real-world bugs.
 *
 * Each fixture represents an actual production bug that was reported.
 */

// From Issue #1159 - Safari AudioContext suspended
export const safariAudioContextBug = {
  meetingState: 'joining-meeting',
  audioContextState: 'suspended',
  localMediaState: {
    audioTrack: { state: 'interrupted', enabled: true, readyState: 'live' },
    videoTrack: { state: 'interrupted', enabled: true, readyState: 'live' }
  },
  browserPermissions: { camera: 'granted', microphone: 'granted' }
};

// From Issue #1131 - Subscription drift
export const subscriptionDriftBug = {
  desired: { audio: true, video: true },
  actual: {
    tracks: {
      audio: { subscribed: false, state: 'off' },
      video: { subscribed: true, state: 'playable' }
    }
  }
};

// From Issue #1169 - Safari device ID rotation
export const safariDeviceRotationBug = {
  preferredMicId: 'old-safari-id-abc123',
  preferredMicLabel: 'MacBook Pro Microphone',
  availableDevices: [
    { deviceId: 'new-safari-id-xyz789', label: 'MacBook Pro Microphone' },
    { deviceId: 'another-device', label: 'External USB Mic' }
  ]
};

// From PR #1171 - A/V diagnosis scenarios
export const diagnosisScenarios = {
  cantHearAudioContextSuspended: {
    reported: ['cant-hear'],
    audioContextState: 'suspended',
    remoteParticipants: [{ audio: { state: 'playable' } }]
  },
  cantHearRemoteMuted: {
    reported: ['cant-hear'],
    audioContextState: 'running',
    participants: [
      { local: true, audio: { off: null } },
      { local: false, audio: { off: { byUser: true } } }
    ]
  },
  othersCantHearMeMicEnded: {
    reported: ['others-cant-hear-me'],
    localMediaState: { audioTrack: { readyState: 'ended', enabled: true } }
  },
  othersCantHearMeMicMuted: {
    reported: ['others-cant-hear-me'],
    localMediaState: { audioTrack: { enabled: false, readyState: 'live' } }
  },
  othersCantSeeMeCameraEnded: {
    reported: ['others-cant-see-me'],
    localMediaState: { videoTrack: { readyState: 'ended', enabled: true } }
  },
  othersCantSeeMeCameraMuted: {
    reported: ['others-cant-see-me'],
    localMediaState: { videoTrack: { enabled: false, readyState: 'live' } }
  },
  speakerNotSet: {
    reported: ['cant-hear'],
    audioContextState: 'running',
    deviceAlignment: {
      speaker: { currentId: null }
    }
  },
  micPermissionDenied: {
    reported: ['others-cant-hear-me'],
    browserPermissions: {
      microphone: 'denied'
    }
  },
  cameraPermissionDenied: {
    reported: ['others-cant-see-me'],
    browserPermissions: {
      camera: 'denied'
    }
  }
};

// Network quality scenarios
export const networkScenarios = {
  goodNetwork: {
    networkStats: {
      stats: {
        latest: {
          videoRecvPacketLoss: 0.01, // 1% packet loss
          audioRecvPacketLoss: 0.005, // 0.5% packet loss
          rtt: 50 // 50ms round-trip time
        }
      }
    }
  },
  highPacketLoss: {
    networkStats: {
      stats: {
        latest: {
          videoRecvPacketLoss: 0.15, // 15% packet loss
          audioRecvPacketLoss: 0.12,
          rtt: 100
        }
      }
    }
  },
  highLatency: {
    networkStats: {
      stats: {
        latest: {
          videoRecvPacketLoss: 0.02,
          audioRecvPacketLoss: 0.01,
          rtt: 650 // 650ms round-trip time
        }
      }
    }
  }
};

// Participant states for subscription testing
export const participantStates = {
  localWithAudioVideo: {
    local: true,
    user_name: 'Local User',
    tracks: {
      audio: { state: 'playable', subscribed: 'staged' },
      video: { state: 'playable', subscribed: 'staged' }
    }
  },
  remoteAudioOnly: {
    local: false,
    user_name: 'Remote User 1',
    tracks: {
      audio: { state: 'playable', subscribed: true },
      video: { state: 'off', subscribed: false, off: { byUser: true } }
    }
  },
  remoteVideoOnly: {
    local: false,
    user_name: 'Remote User 2',
    tracks: {
      audio: { state: 'off', subscribed: false, off: { byUser: true } },
      video: { state: 'playable', subscribed: true }
    }
  },
  remoteFullyMuted: {
    local: false,
    user_name: 'Remote User 3',
    tracks: {
      audio: { state: 'off', subscribed: false, off: { byUser: true } },
      video: { state: 'off', subscribed: false, off: { byUser: true } }
    }
  },
  remoteNotSubscribed: {
    local: false,
    user_name: 'Remote User 4',
    tracks: {
      audio: { state: 'loading', subscribed: false },
      video: { state: 'loading', subscribed: false }
    }
  }
};
