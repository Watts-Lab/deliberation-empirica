// Converts a layout object into pixel values based on the container size.

function expandRegionShorthand(region, maxRows, maxCols) {
  /*
    Expands shorthand region definitions into full { first, last } objects.
    e.g., rows: 0  => rows: { first: 0, last: 0 } (1-based to 0-based)
          cols: { first: 1, last: 2 } => unchanged
          cols: 1 => cols: { first: 1, last: 1 }
  */
  const expanded = {};

  if (typeof region.rows === "number") {
    expanded.rows = { first: region.rows, last: region.rows };
  } else if (
    typeof region.rows === "object" &&
    region.rows.first !== undefined &&
    region.rows.last !== undefined
  ) {
    expanded.rows = {
      first: region.rows.first,
      last: region.rows.last,
    };
  } else {
    // default to full range
    expanded.rows = { first: 0, last: maxRows - 1 };
  }

  if (typeof region.cols === "number") {
    expanded.cols = { first: region.cols, last: region.cols };
  } else if (
    typeof region.cols === "object" &&
    region.cols.first !== undefined &&
    region.cols.last !== undefined
  ) {
    expanded.cols = {
      first: region.cols.first,
      last: region.cols.last,
    };
  } else {
    // default to full range
    expanded.cols = { first: 0, last: maxCols - 1 };
  }

  return expanded;
}

export function computePixelsForLayout(
  playerLayout,
  containerWidth,
  containerHeight,
  aspectRatio = 16 / 9
) {
  /* 
    **playerLayout** is an object mapping positions to layout regions 
    to display to the current player.

    **containerWidth** and **containerHeight** are the pixel dimensions 
    of the container component.

    The grid describes positions on the screen in rows and columns.
    Each tile may cover multiple rows/columns, 
    e.g., rows: { first: 0, last: 2 } would cover rows 0, 1, and 2.

    The covered grid cells may not have the same aspect ratio as the desired tile aspect ratio,
    in which case, we center the tile within the allocated region, returning 
    pixel values that maintain the desired aspect ratio - e.g. just the portion of 
    the region that will contain the video feed.
    
    e.g.,
        {
        grid: { rows: 1, cols: 2},
        feeds: [
            {
            source: { type: "participant", position: "positionName" },
            media: { audio: true, video: true, screen: false },
            displayRegion: { rows: { first: 0, last: 0 }, cols: { first: 0, last: 0 } }
            },
            {
            source: { type: "self" },
            media: { audio: false, video: true, screen: false },
            displayRegion: { rows: { first: 0, last: 0 }, cols: { first: 1, last: 1 } }
            },
            ...
        ]
        }

        Returns a copy of the layout object with additional fields for each feed:
        pixels: { left, top, width, height }

        Also expands any shorthand region definitions.
      
    */

  if (!playerLayout || !playerLayout.grid || !playerLayout.feeds) {
    console.warn("Invalid playerLayout provided:", playerLayout);
    return null;
  }

  const { grid, feeds } = playerLayout;
  const newLayout = { grid: { rows: grid.rows, cols: grid.cols }, feeds: [] };
  const numRows = grid.rows;
  const numCols = grid.cols;

  const cellWidth = containerWidth / numCols;
  const cellHeight = containerHeight / numRows;

  // create a new feeds array without mutating the function parameter objects
  const newFeeds = feeds.map((feed) => {
    const region = expandRegionShorthand(feed.displayRegion);
    const x = region.cols.first * cellWidth; // zero-based index means this is the left edge
    const y = region.rows.first * cellHeight; // zero-based index means this is the top edge

    // calculate the width and height of the allocated region
    const regionWidth = (region.cols.last - region.cols.first + 1) * cellWidth; // +1 because both first and last are inclusive
    const regionHeight =
      (region.rows.last - region.rows.first + 1) * cellHeight;

    // determine the optimal width and height of the content, preserving aspect ratio
    let optimalWidth = regionWidth; // start by assuming we can use full width
    let optimalHeight = regionWidth / aspectRatio;

    if (optimalHeight > regionHeight) {
      // fall back to height constraint
      optimalHeight = regionHeight;
      optimalWidth = regionHeight * aspectRatio;
    }

    // center the tile within the allocated region
    const centeredX = x + (regionWidth - optimalWidth) / 2;
    const centeredY = y + (regionHeight - optimalHeight) / 2;

    // compute left, top, width, height
    const left = Math.round(centeredX);
    const top = Math.round(centeredY);
    const width = Math.round(optimalWidth);
    const height = Math.round(optimalHeight);

    // return a new feed object with pixels (do not mutate the original feed param)
    return {
      source: feed.source,
      media: feed.media,
      displayRegion: region, // use expanded region
      pixels: { left, top, width, height },
      zOrder: feed.zOrder || 1, // default zOrder to 1 if not provided
    };
  });

  newLayout.feeds = newFeeds;

  return newLayout;
}
