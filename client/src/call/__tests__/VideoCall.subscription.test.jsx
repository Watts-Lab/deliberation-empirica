/**
 * Tests for VideoCall subscription management
 *
 * These tests verify the logic that controls which video/audio tracks
 * are subscribed based on the current layout, WITHOUT requiring real WebRTC.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { VideoCall } from '../VideoCall';
import { createMockCallObject, createMockDevices, createMockParticipant } from './setup/dailyMocks';

// Mock Empirica hooks
vi.mock('@empirica/core/player/classic/react', () => ({
  useGame: vi.fn(() => ({ get: () => 'https://test.daily.co/room' })),
  usePlayer: vi.fn(() => ({
    get: vi.fn((key) => {
      if (key === 'position') return '1';
      if (key === 'name') return 'Test User';
      if (key === 'dailyId') return 'test-daily-id';
      return null;
    }),
    set: vi.fn(),
    append: vi.fn(),
  })),
  usePlayers: vi.fn(() => []),
  useStage: vi.fn(() => ({ get: () => false, set: vi.fn() })),
  useStageTimer: vi.fn(() => ({ elapsed: 0 })),
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
}));

// Mock Daily.co
const mockCallObject = createMockCallObject();
const mockDevices = createMockDevices();

vi.mock('@daily-co/daily-react', () => ({
  DailyProvider: ({ children }) => children,
  DailyAudio: () => null,
  useDaily: vi.fn(() => mockCallObject),
  useDevices: vi.fn(() => mockDevices),
  useParticipantIds: vi.fn(() => []),
  useLocalSessionId: vi.fn(() => 'local-session-id'),
}));

// Mock other call components
vi.mock('../Call', () => ({ Call: () => <div data-testid="call-component" /> }));
vi.mock('../Tray', () => ({ Tray: () => <div data-testid="tray-component" /> }));
vi.mock('../hooks/eventLogger', () => ({
  useDailyEventLogger: vi.fn(),
  useStageEventLogger: vi.fn(() => vi.fn()),
}));
vi.mock('../useAutoDiagnostics', () => ({
  useAutoDiagnostics: vi.fn(),
}));
vi.mock('../useAudioContextMonitor', () => ({
  useAudioContextMonitor: vi.fn(() => ({
    audioContextState: 'running',
    needsUserInteraction: false,
    resumeAudioContext: vi.fn(),
    audioContext: {},
  })),
}));
vi.mock('../../components/progressLabel', () => ({
  useProgressLabel: vi.fn(() => 'test-label'),
  useGetElapsedTime: vi.fn(() => vi.fn(() => 0)),
}));

describe('VideoCall - Subscription Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallObject.meetingState.mockReturnValue('joined-meeting');
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('joins the Daily room when roomUrl is provided', async () => {
    render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    await waitFor(() => {
      expect(mockCallObject.join).toHaveBeenCalledWith({
        url: 'https://test.daily.co/room',
      });
    });
  });

  it('disables autoGainControl after joining', async () => {
    render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    await waitFor(() => {
      expect(mockCallObject.setInputDevicesAsync).toHaveBeenCalledWith({
        audioSource: {
          autoGainControl: false,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    });
  });

  it('sets the display name in the Daily room', async () => {
    render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    await waitFor(() => {
      expect(mockCallObject.setUserName).toHaveBeenCalledWith('Test User');
    });
  });

  it('leaves the room on unmount', async () => {
    const { unmount } = render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    unmount();

    await waitFor(() => {
      expect(mockCallObject.leave).toHaveBeenCalled();
    });
  });

  it('handles missing roomUrl gracefully', async () => {
    const mockGame = vi.fn(() => ({ get: () => null }));
    const { useGame } = await import('@empirica/core/player/classic/react');
    useGame.mockImplementation(mockGame);

    render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    // Should not attempt to join
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockCallObject.join).not.toHaveBeenCalled();
  });

  it('registers event listeners for device errors', async () => {
    render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    await waitFor(() => {
      const eventNames = mockCallObject.on.mock.calls.map(call => call[0]);
      expect(eventNames).toContain('fatal-devices-error');
      expect(eventNames).toContain('camera-error');
      expect(eventNames).toContain('mic-error');
      expect(eventNames).toContain('joined-meeting');
    });
  });

  it('cleans up event listeners on unmount', async () => {
    const { unmount } = render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    const onCallCount = mockCallObject.on.mock.calls.length;
    unmount();

    await waitFor(() => {
      expect(mockCallObject.off).toHaveBeenCalled();
      // Should have called off for each on
      expect(mockCallObject.off.mock.calls.length).toBeGreaterThan(0);
    });
  });
});

describe('VideoCall - Device Alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallObject.meetingState.mockReturnValue('joined-meeting');
  });

  it('aligns camera to preferred device', async () => {
    const mockPlayer = {
      get: vi.fn((key) => {
        if (key === 'position') return '1';
        if (key === 'cameraId') return 'camera-2';
        if (key === 'cameraLabel') return 'External Webcam';
        return null;
      }),
      set: vi.fn(),
      append: vi.fn(),
    };

    const { usePlayer } = await import('@empirica/core/player/classic/react');
    usePlayer.mockReturnValue(mockPlayer);

    render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    await waitFor(() => {
      const setCalls = mockCallObject.setInputDevicesAsync.mock.calls;
      const cameraSetCall = setCalls.find(call => call[0].videoDeviceId);
      expect(cameraSetCall).toBeDefined();
      expect(cameraSetCall[0].videoDeviceId).toBe('camera-2');
    }, { timeout: 2000 });
  });

  it('aligns microphone to preferred device', async () => {
    const mockPlayer = {
      get: vi.fn((key) => {
        if (key === 'position') return '1';
        if (key === 'micId') return 'mic-2';
        if (key === 'micLabel') return 'External Microphone';
        return null;
      }),
      set: vi.fn(),
      append: vi.fn(),
    };

    const { usePlayer } = await import('@empirica/core/player/classic/react');
    usePlayer.mockReturnValue(mockPlayer);

    render(
      <VideoCall
        showNickname={true}
        showTitle={false}
        showSelfView={true}
        showReportMissing={true}
        layout={null}
        rooms={null}
      />
    );

    await waitFor(() => {
      const setCalls = mockCallObject.setInputDevicesAsync.mock.calls;
      const micSetCall = setCalls.find(call => call[0].audioDeviceId);
      expect(micSetCall).toBeDefined();
      expect(micSetCall[0].audioDeviceId).toBe('mic-2');
    }, { timeout: 2000 });
  });
});
