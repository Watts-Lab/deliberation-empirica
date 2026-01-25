import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Tile } from "./Tile";

// --- Mocks ---

const mockUseVideoTrack = vi.fn();
const mockUseAudioTrack = vi.fn();
const mockUseParticipantProperty = vi.fn();
const mockUsePlayer = vi.fn();
const mockUsePlayers = vi.fn();

vi.mock("@daily-co/daily-react", () => ({
    DailyVideo: ({ sessionId }) => <div data-testid="daily-video">{sessionId}</div>,
    useVideoTrack: (id) => mockUseVideoTrack(id),
    useAudioTrack: (id) => mockUseAudioTrack(id),
    useParticipantProperty: (id, prop) => mockUseParticipantProperty(id, prop),
}));

vi.mock("@empirica/core/player/classic/react", () => ({
    usePlayer: () => mockUsePlayer(),
    usePlayers: () => mockUsePlayers(),
}));

// Mock Icons
vi.mock("./Icons", () => ({
    MicrophoneOff: () => <div data-testid="icon-mic-off" />,
    CameraOff: () => <div data-testid="icon-camera-off" />,
    ParticipantLeft: () => <div data-testid="icon-participant-left" />,
}));

describe("Tile Component", () => {
    const mockPlayer = {
        get: vi.fn((key) => {
            if (key === "dailyId") return "test-daily-id";
            if (key === "position") return "1";
            return null;
        }),
        stage: { get: vi.fn() }, // playerSubmitted check
    };

    const mockRemotePlayer = {
        get: vi.fn((key) => {
            if (key === "dailyId") return "remote-daily-id";
            if (key === "position") return "2";
            return null;
        }),
        stage: { get: vi.fn() },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUsePlayer.mockReturnValue(mockPlayer);
        mockUsePlayers.mockReturnValue([mockPlayer, mockRemotePlayer]);
        mockUseParticipantProperty.mockReturnValue("Test User");
    });

    // Base props
    const props = {
        source: { type: "participant", position: 2 },
        media: { video: true, audio: true },
        pixels: { width: 100, height: 100 },
    };

    it("renders Waiting tile when track is missing (not connected)", () => {
        // Setup: No video state, no audio state
        mockUseVideoTrack.mockReturnValue(null);
        mockUseAudioTrack.mockReturnValue(null);

        const { container } = render(<Tile {...props} />);

        expect(container.querySelector('[data-test="waitingParticipantTile"]')).not.toBeNull();
        expect(container.querySelector('[data-test="videoMutedTile"]')).toBeNull();
    });

    it("renders Waiting tile when track is present but NOT subscribed", () => {
        // Setup: Video state exists but subscribed=false
        mockUseVideoTrack.mockReturnValue({
            state: "loading",
            subscribed: false, // Critical check!
            isOff: true, // This is often true when unsubscribed/loading
        });
        // Also simulate audio unplugged/unsubscribed to verify full waiting state
        mockUseAudioTrack.mockReturnValue({ state: "loading", subscribed: false });

        const { container } = render(<Tile {...props} />);

        // Should still show waiting because video is not subscribed
        expect(container.querySelector('[data-test="waitingParticipantTile"]')).not.toBeNull();
        expect(container.querySelector('[data-test="videoMutedTile"]')).toBeNull();
    });

    it("renders Video Muted tile when subscribed but muted (isOff)", () => {
        // Setup: Video state exists, subscribed=true, isOff=true
        mockUseVideoTrack.mockReturnValue({
            state: "off",
            subscribed: true,
            isOff: true,
        });
        mockUseAudioTrack.mockReturnValue({ state: "playable", subscribed: true });

        const { container } = render(<Tile {...props} />);

        expect(container.querySelector('[data-test="videoMutedTile"]')).not.toBeNull();
        expect(container.querySelector('[data-test="waitingParticipantTile"]')).toBeNull();
    });

    it("renders DailyVideo when subscribed and active", () => {
        // Setup: Video state exists, subscribed=true, isOff=false
        mockUseVideoTrack.mockReturnValue({
            state: "playable",
            subscribed: true,
            isOff: false,
        });
        mockUseAudioTrack.mockReturnValue({ state: "playable", subscribed: true });

        const { container } = render(<Tile {...props} />);

        expect(screen.getByTestId("daily-video")).toBeDefined(); // This mock uses data-testid
        expect(container.querySelector('[data-test="waitingParticipantTile"]')).toBeNull();
        expect(container.querySelector('[data-test="videoMutedTile"]')).toBeNull();
    });
});
