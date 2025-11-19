import { describe, it, expect } from "vitest";
import { computePixelsForLayout } from "./computePixelsForLayout";

const baseLayout = {
  grid: { rows: 2, cols: 2 },
  feeds: [
    {
      source: { type: "participant", position: "0" },
      media: { audio: true, video: true },
      displayRegion: {
        rows: { first: 0, last: 0 },
        cols: { first: 0, last: 0 },
      },
    },
    {
      source: { type: "participant", position: "1" },
      media: { audio: true, video: true },
      displayRegion: {
        rows: { first: 0, last: 0 },
        cols: { first: 1, last: 1 },
      },
    },
  ],
};

describe("computePixelsForLayout", () => {
  it("returns null when playerLayout is invalid", () => {
    // Defensive path: invalid layout objects should short-circuit gracefully.
    expect(computePixelsForLayout(null, 800, 600)).toBeNull();
    expect(
      computePixelsForLayout(
        { grid: { rows: 0, cols: 0 } },
        800,
        600
      )
    ).toBeNull();
  });

  it("returns empty layout when there are no grid cells to render", () => {
    // Even if grid metadata exists, zero rows/cols should yield no feeds.
    const empty = computePixelsForLayout(
      { grid: { rows: 0, cols: 0 }, feeds: [] },
      800,
      600
    );
    expect(empty).toEqual({ grid: { rows: 0, cols: 0 }, feeds: [] });
  });

  it("converts display regions into pixel-perfect tiles", () => {
    // Main contract: map logical grid coordinates into pixel dimensions.
    const layout = computePixelsForLayout(baseLayout, 1000, 800, 16 / 9);
    expect(layout).not.toBeNull();
    expect(layout.grid).toEqual(baseLayout.grid);
    expect(layout.feeds).toHaveLength(2);

    layout.feeds.forEach((feed) => {
      const { width, height } = feed.pixels;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(width / height).toBeCloseTo(16 / 9, 2);
      expect(feed.displayRegion.rows.first).toBeDefined();
      expect(feed.displayRegion.cols.first).toBeDefined();
    });
  });

  it("respects non-square regions and centers video within them", () => {
    // Covers the math that letterboxes inside multi-row/multi-col spans.
    const complexLayout = {
      grid: { rows: 2, cols: 2 },
      feeds: [
        {
          source: { type: "participant", position: "0" },
          media: { audio: true, video: true },
          displayRegion: {
            rows: { first: 0, last: 1 },
            cols: { first: 0, last: 1 },
          },
        },
      ],
    };

    const layout = computePixelsForLayout(complexLayout, 800, 600, 16 / 9);
    const feed = layout.feeds[0];
    expect(feed.pixels.width).toBeLessThanOrEqual(800);
    expect(feed.pixels.height).toBeLessThanOrEqual(600);
    expect(feed.pixels.left).toBeGreaterThanOrEqual(0);
    expect(feed.pixels.top).toBeGreaterThanOrEqual(0);
  });

  it("expands shorthand definitions for rows/cols", () => {
    // Ensures numeric shorthand gets normalized into { first, last }.
    const shorthandLayout = {
      grid: { rows: 1, cols: 2 },
      feeds: [
        {
          source: { type: "participant", position: "0" },
          media: { audio: true, video: true },
          displayRegion: { rows: 0, cols: 0 },
        },
      ],
    };
    const layout = computePixelsForLayout(shorthandLayout, 640, 360, 4 / 3);
    expect(layout.feeds[0].displayRegion.rows).toEqual({
      first: 0,
      last: 0,
    });
    expect(layout.feeds[0].displayRegion.cols).toEqual({
      first: 0,
      last: 0,
    });
  });

  it("honors custom aspect ratios", () => {
    // Allow callers to request non-16:9 tiles without distortion.
    const layout = computePixelsForLayout(baseLayout, 900, 700, 4 / 3);
    layout.feeds.forEach((feed) => {
      expect(feed.pixels.width / feed.pixels.height).toBeCloseTo(4 / 3, 2);
    });
  });

  it("keeps zOrder if provided and defaults to 1", () => {
    // Guarantees render hints stay attached when we hydrate the layout.
    const feeds = [
      {
        source: { type: "participant", position: "0" },
        media: { audio: true, video: true },
        displayRegion: { rows: { first: 0, last: 0 }, cols: 0 },
        zOrder: 3,
      },
      {
        source: { type: "participant", position: "1" },
        media: { audio: true, video: true },
        displayRegion: { rows: 0, cols: { first: 1, last: 1 } },
      },
    ];
    const layout = computePixelsForLayout(
      { grid: { rows: 1, cols: 2 }, feeds },
      800,
      400,
      16 / 9
    );
    expect(layout.feeds[0].zOrder).toBe(3);
    expect(layout.feeds[1].zOrder).toBe(1);
  });
});
  it("keeps tiles within container bounds", () => {
    // Valid layout should never place tiles outside the container dimensions.
    const layout = computePixelsForLayout(baseLayout, 800, 600, 16 / 9);
    layout.feeds.forEach((feed) => {
      const { pixels } = feed;
      expect(pixels.left).toBeGreaterThanOrEqual(0);
      expect(pixels.top).toBeGreaterThanOrEqual(0);
      expect(pixels.left + pixels.width).toBeLessThanOrEqual(800);
      expect(pixels.top + pixels.height).toBeLessThanOrEqual(600);
    });
  });
