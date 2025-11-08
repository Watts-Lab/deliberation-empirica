import { describe, it, expect, vi } from "vitest";
import { defaultResponsiveLayout } from "./defaultResponsiveLayout";

describe("defaultResponsiveLayout", () => {
  it("returns empty layout when no positions provided", () => {
    const layout = defaultResponsiveLayout({
      positions: [],
      selfPosition: "0",
      width: 800,
      height: 600,
    });

    expect(layout).toEqual({
      grid: { rows: 0, cols: 0 },
      feeds: [],
    });
  });

  it("creates a symmetric grid and marks self feed correctly", () => {
    const positions = ["0", "1", "2", "3"];
    const layout = defaultResponsiveLayout({
      positions,
      selfPosition: "1",
      width: 1200,
      height: 800,
    });

    expect(layout.grid).toMatchObject({ rows: 2, cols: 2 });
    expect(layout.feeds).toHaveLength(positions.length);

    const selfFeed = layout.feeds.find((feed) => feed.source.type === "self");
    expect(selfFeed).toBeDefined();
    expect(selfFeed.media).toEqual({ audio: false, video: true });

    const participantFeeds = layout.feeds.filter(
      (feed) => feed.source.type === "participant"
    );
    expect(participantFeeds).toHaveLength(positions.length - 1);
    participantFeeds.forEach((feed) => {
      expect(feed.media).toEqual({ audio: true, video: true });
      expect(positions).toContain(feed.source.position);
    });
  });

  it("relies on upstream filtering (only provided positions are rendered)", () => {
    const layout = defaultResponsiveLayout({
      positions: ["1", "3"],
      selfPosition: "0",
      width: 1000,
      height: 800,
    });

    expect(layout.feeds).toHaveLength(2);
    layout.feeds.forEach((feed) => {
      expect(feed.source.type).toBe("participant");
      expect(["1", "3"]).toContain(String(feed.source.position));
    });
  });

  it("maintains feed order and self placement", () => {
    const layout = defaultResponsiveLayout({
      positions: ["self", "2", "3"],
      selfPosition: "self",
      width: 900,
      height: 600,
    });
    expect(layout.feeds[0].source.type).toBe("self");
    expect(layout.feeds[1].source.position).toBe("2");
  });

  it("prefers more square grids as player count grows", () => {
    const positions = Array.from({ length: 7 }).map((_, idx) => String(idx));
    const layout = defaultResponsiveLayout({
      positions,
      selfPosition: "0",
      width: 1400,
      height: 900,
    });

    expect(layout.grid.rows).toBeGreaterThan(1);
    expect(layout.grid.cols).toBeGreaterThan(1);
    expect(layout.feeds).toHaveLength(positions.length);
  });
});
