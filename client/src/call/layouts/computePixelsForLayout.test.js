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
    const empty = computePixelsForLayout(
      { grid: { rows: 0, cols: 0 }, feeds: [] },
      800,
      600
    );
    expect(empty).toEqual({ grid: { rows: 0, cols: 0 }, feeds: [] });
  });

  it("converts display regions into pixel-perfect tiles", () => {
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
    const layout = computePixelsForLayout(baseLayout, 900, 700, 4 / 3);
    layout.feeds.forEach((feed) => {
      expect(feed.pixels.width / feed.pixels.height).toBeCloseTo(4 / 3, 2);
    });
  });

  it("keeps zOrder if provided and defaults to 1", () => {
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
