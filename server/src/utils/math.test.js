import { test, expect } from "vitest";
import { shuffle, leftovers } from "./math";

test("returns a shuffled array", () => {
  const arr = [1, 2, 3, 4, 5];
  const shuffledArr = shuffle(arr);
  expect(shuffledArr).not.toEqual(arr);
  expect(shuffledArr).toHaveLength(arr.length);
  expect(shuffledArr).toContain(1);
  expect(shuffledArr).toContain(2);
  expect(shuffledArr).toContain(3);
  expect(shuffledArr).toContain(4);
  expect(shuffledArr).toContain(5);
});

test("returns an empty array if input is empty", () => {
  const arr = [];
  const shuffledArr = shuffle(arr);
  expect(shuffledArr).toEqual([]);
});

test("should return 1 when target is odd and all factors are even", () => {
  const target = 11;
  const factors = [2, 4];
  const result = leftovers(target, factors);
  expect(result).toBe(1);
});

test("should return 2 when there are mod 2 left ", () => {
  const target = 11;
  const factors = [3];
  const result = leftovers(target, factors);
  expect(result).toBe(2);
});

test("should return 0 if there are no leftovers", () => {
  const target = 12;
  const factors = [2, 3, 4];
  const result = leftovers(target, factors);
  expect(result).toBe(0);
});

test("should return 0 if there are no leftovers", () => {
  const target = 12;
  const factors = [2, 3, 4, 5, 2, 2, 2, 2, 2, 2, 2];
  const result = leftovers(target, factors);
  expect(result).toBe(0);
});

test("should return 0 if target is 0", () => {
  const target = 0;
  const factors = [2, 3, 4];
  const result = leftovers(target, factors);
  expect(result).toBe(0);
});

test("should return target if factors array is empty", () => {
  const target = 10;
  const factors = [];
  const result = leftovers(target, factors);
  expect(result).toBe(10);
});

test("should return target if smallest factor is larger than target", () => {
  const target = 10;
  const factors = [11, 12];
  const result = leftovers(target, factors);
  expect(result).toBe(10);
});

test("doesn't run forever", () => {
  const startTime = Date.now();
  const target = 100;
  const factors = [
    2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 2,
    3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9,
  ];
  const result = leftovers(target, factors);
  const endTime = Date.now();
  const duration = endTime - startTime;
  expect(duration).toBeLessThan(1000);
  expect(result).toBe(0);
});
