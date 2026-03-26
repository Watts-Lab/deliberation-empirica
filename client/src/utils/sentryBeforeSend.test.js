import { describe, it, expect } from "vitest";
import { stripIpAddress } from "./sentryBeforeSend";

describe("stripIpAddress", () => {
  it("removes ip_address from event.user", () => {
    const event = {
      message: "test",
      user: { id: "abc", ip_address: "1.2.3.4" },
    };
    const result = stripIpAddress(event);
    expect(result.user).not.toHaveProperty("ip_address");
    expect(result.user.id).toBe("abc");
  });

  it("returns the event unchanged when there is no user", () => {
    const event = { message: "test" };
    const result = stripIpAddress(event);
    expect(result).toBe(event);
  });

  it("handles user object with no ip_address", () => {
    const event = { message: "test", user: { id: "abc" } };
    const result = stripIpAddress(event);
    expect(result.user.ip_address).toBeUndefined();
    expect(result.user.id).toBe("abc");
  });

  it("does not mutate the original event", () => {
    const event = {
      message: "test",
      user: { id: "abc", ip_address: "1.2.3.4" },
    };
    stripIpAddress(event);
    expect(event.user.ip_address).toBe("1.2.3.4");
  });

  it("preserves other event properties", () => {
    const event = {
      message: "test",
      tags: { batchName: "batch1" },
      user: { id: "abc", ip_address: "1.2.3.4", username: "player1" },
    };
    const result = stripIpAddress(event);
    expect(result.message).toBe("test");
    expect(result.tags).toEqual({ batchName: "batch1" });
    expect(result.user.username).toBe("player1");
  });

  it("handles null user gracefully", () => {
    const event = { message: "test", user: null };
    const result = stripIpAddress(event);
    expect(result).toBe(event);
  });
});
