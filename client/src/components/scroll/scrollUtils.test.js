import { describe, it, expect } from "vitest";
import { isAtBottom } from "./scrollUtils";

describe("isAtBottom", () => {
    const defaultThreshold = 80;

    it("returns true when exactly at bottom", () => {
        // scrollHeight=1000, scrollTop=500, clientHeight=500 → distanceFromBottom=0
        expect(isAtBottom(1000, 500, 500, defaultThreshold)).toBe(true);
    });

    it("returns true when within threshold of bottom", () => {
        // scrollHeight=1000, scrollTop=450, clientHeight=500 → distanceFromBottom=50 < 80
        expect(isAtBottom(1000, 450, 500, defaultThreshold)).toBe(true);
    });

    it("returns true when exactly at threshold boundary", () => {
        // scrollHeight=1000, scrollTop=420, clientHeight=500 → distanceFromBottom=80
        // Should be false since we use < not <=
        expect(isAtBottom(1000, 420, 500, defaultThreshold)).toBe(false);
    });

    it("returns false when significantly above bottom", () => {
        // scrollHeight=1000, scrollTop=0, clientHeight=500 → distanceFromBottom=500
        expect(isAtBottom(1000, 0, 500, defaultThreshold)).toBe(false);
    });

    it("returns false when just outside threshold", () => {
        // scrollHeight=1000, scrollTop=419, clientHeight=500 → distanceFromBottom=81
        expect(isAtBottom(1000, 419, 500, defaultThreshold)).toBe(false);
    });

    it("returns true for zero-height containers (no scrollable content)", () => {
        expect(isAtBottom(0, 0, 0, defaultThreshold)).toBe(true);
    });

    it("returns true when content fits without scrolling", () => {
        // clientHeight >= scrollHeight means no scroll needed
        expect(isAtBottom(500, 0, 500, defaultThreshold)).toBe(true);
        expect(isAtBottom(400, 0, 500, defaultThreshold)).toBe(true);
    });

    it("respects custom threshold values", () => {
        // With threshold of 20: distanceFromBottom=50 >= 20, so false
        expect(isAtBottom(1000, 450, 500, 20)).toBe(false);
        // With threshold of 100: distanceFromBottom=50 < 100, so true
        expect(isAtBottom(1000, 450, 500, 100)).toBe(true);
    });
});
