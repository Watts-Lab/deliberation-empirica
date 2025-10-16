import React from "react";

export function Slider({
  min = 0,
  max = 100,
  interval = 1,
  labelPts = [],
  labels = [],
  value,
  onChange,
  testId = "unnamedSlider",
}) {
  /*
  `min` - minimum value of the slider
  `max` - maximum value of the slider
  `interval` - step size for the slider
  `labelPts` - array of positions where ticks and labels should appear
  `labels` - array of label text corresponding to labelPts
  `value` - current value of the slider (undefined if no value set yet)
  `onChange` - callback when slider value changes
  */

  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    if (onChange) {
      onChange({ target: { value: newValue } });
    }
  };

  const handleClick = (e) => {
    // If no value is set yet, clicking the track should set a value
    if (localValue === undefined || localValue === null) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const rawValue = min + percentage * (max - min);
      // Round to nearest interval
      const newValue = Math.round(rawValue / interval) * interval;
      const clampedValue = Math.max(min, Math.min(max, newValue));
      setLocalValue(clampedValue);
      if (onChange) {
        onChange({ target: { value: clampedValue } });
      }
    }
  };

  // Calculate positions for labels
  const getPosition = (pt) => ((pt - min) / (max - min)) * 100;

  const hasValue = localValue !== undefined && localValue !== null;

  return (
    <div className="mt-4 w-full" data-test={testId}>
      <div className="relative w-full pt-2 pb-8">
        {/* Slider track - clickable when no value */}
        <div
          className={`relative w-full h-2 bg-gray-200 rounded ${
            !hasValue ? "cursor-pointer hover:bg-gray-300" : ""
          }`}
          onClick={handleClick}
          role="presentation"
        >
          {/* Ticks */}
          {labelPts.map((pt, idx) => (
            <div
              key={`tick-${pt}`}
              className="absolute top-0 h-2 w-0.5 bg-gray-400"
              style={{ left: `${getPosition(pt)}%` }}
            />
          ))}
        </div>

        {/* Slider input - invisible but provides functionality */}
        <input
          type="range"
          min={min}
          max={max}
          step={interval}
          value={hasValue ? localValue : min}
          onChange={handleChange}
          className="absolute top-2 left-0 w-full h-2 appearance-none bg-transparent cursor-pointer slider-input"
          style={{
            opacity: hasValue ? 1 : 0,
            pointerEvents: hasValue ? "auto" : "none",
          }}
          data-test={`${testId}-input`}
          aria-label="Slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={hasValue ? localValue : undefined}
        />

        {/* Labels */}
        <div className="relative w-full mt-2">
          {labelPts.map((pt, idx) => (
            <div
              key={`label-${pt}`}
              className="absolute text-xs text-gray-600 text-center"
              style={{
                left: `${getPosition(pt)}%`,
                transform: "translateX(-50%)",
                maxWidth: "80px",
              }}
            >
              {labels[idx]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
