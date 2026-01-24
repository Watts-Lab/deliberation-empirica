import { describe, it, expect } from "vitest";
import { transformAudioLevel } from "./audioLevelUtils";

describe("transformAudioLevel", () => {
    it("returns 0 for input 0", () => {
        expect(transformAudioLevel(0)).toBe(0);
    });

    it("returns 1 for input 1", () => {
        expect(transformAudioLevel(1)).toBe(1);
    });

    it("applies square root transformation (0.25 → 0.5)", () => {
        expect(transformAudioLevel(0.25)).toBeCloseTo(0.5, 5);
    });

    it("applies square root transformation (0.5 → ~0.707)", () => {
        expect(transformAudioLevel(0.5)).toBeCloseTo(Math.SQRT1_2, 5);
    });

    it("clamps negative values to 0", () => {
        expect(transformAudioLevel(-0.5)).toBe(0);
        expect(transformAudioLevel(-1)).toBe(0);
    });

    it("clamps values greater than 1 to 1", () => {
        expect(transformAudioLevel(1.5)).toBe(1);
        expect(transformAudioLevel(2)).toBe(1);
    });
});
