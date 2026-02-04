/**
 * Progress Label Module
 *
 * This module provides a unified system for tracking participant progress through
 * a Deliberation study and computing elapsed time within each step.
 *
 * See ProgressLabelContext.jsx for detailed documentation.
 *
 * @module progressLabel
 */

export {
  StageProgressLabelProvider,
  IntroExitProgressLabelProvider,
  useProgressLabel,
  useGetElapsedTime,
  computeProgressLabel,
} from "./ProgressLabelContext";
