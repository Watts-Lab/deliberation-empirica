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
          className="relative w-full h-2 bg-gray-200 rounded cursor-pointer hover:bg-gray-300"
          onClick={handleClick}
          role="presentation"
        >
          {/* Ticks */}
          {labelPts.map((pt) => (
            <div
              key={`tick-${pt}`}
              className="absolute top-0 w-0.5 bg-gray-400"
              style={{ 
                left: `${getPosition(pt)}%`,
                height: "12px",
              }}
            />
          ))}
        </div>

        {/* Instruction message when no value is set */}
        {!hasValue && (
          <div 
            className="absolute text-xs text-gray-500 text-center whitespace-nowrap"
            style={{
              left: "50%",
              transform: "translateX(-50%) translateY(-100%)",
              top: "-10px",
            }}
          >
            Click the bar to select a value, then drag to adjust.
          </div>
        )}

        {/* Slider input - hidden when no value, visible when value is set */}
        {hasValue && (
          <input
            type="range"
            min={min}
            max={max}
            step={interval}
            value={localValue}
            onChange={handleChange}
            className="absolute top-2 left-0 w-full h-2 appearance-none bg-transparent cursor-pointer"
            style={{
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
            data-test={`${testId}-input`}
            aria-label="Slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={localValue}
          />
        )}

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

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 24px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          margin-top: -11px;
        }

        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 24px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        input[type="range"]::-webkit-slider-runnable-track {
          width: 100%;
          height: 0;
          background: transparent;
        }

        input[type="range"]::-moz-range-track {
          width: 100%;
          height: 0;
          background: transparent;
        }

        input[type="range"]:focus {
          outline: none;
        }

        input[type="range"]:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }

        input[type="range"]:focus::-moz-range-thumb {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }
      `}</style>
    </div>
  );
}
