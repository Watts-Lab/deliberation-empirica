import { describe, it, expect, vi } from "vitest";
import { defaultResponsiveLayout } from "./defaultResponsiveLayout";

describe("defaultResponsiveLayout", () => {
  it("returns empty layout when no positions provided", () => {
    // Sanity check: no players => no grid/feeds, prevents divide-by-zero later.
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
    // Verifies basic happy path: grid sizing and self tile media flagging.
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
    // Ensures the helper treats the incoming positions list as authoritative.
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
    // Guards against regressions where feed order shifts and self tile moves.
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
    // Smoke test for responsiveGrid heuristics (should scale beyond 2×2).
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

  it("chooses single column when width is constrained", () => {
    // Extreme portrait container should treat all tiles as a vertical stack.
    const layout = defaultResponsiveLayout({
      positions: ["0", "1"],
      selfPosition: "0",
      width: 400,
      height: 1200,
    });
    expect(layout.grid.cols).toBe(1);
    expect(layout.grid.rows).toBeGreaterThan(1);
  });

  it("uses multiple columns when width allows side-by-side tiles", () => {
    // Wider container should produce a multi-column grid for two tiles.
    const layout = defaultResponsiveLayout({
      positions: ["0", "1"],
      selfPosition: "0",
      width: 1600,
      height: 800,
    });
    expect(layout.grid.cols).toBeGreaterThan(1);
  });
});
