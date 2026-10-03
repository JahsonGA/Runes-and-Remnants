import { describe, it, expect } from "vitest";
import { pickExecutorId } from "../src/harvest/logic.js";

// The harvest menu is broadcast to every connected client, so exactly one of
// them must be responsible for executing. Every client resolves this
// independently, so the rule has to be deterministic — if two clients ever
// disagree about who executes, the loot is granted twice.

const gm      = (id, active = true) => ({ id, active, isGM: true });
const player  = (id, active = true) => ({ id, active, isGM: false });

describe("pickExecutorId — selection", () => {
  it("picks the only active GM", () => {
    expect(pickExecutorId([player("p1"), gm("g1"), player("p2")])).toBe("g1");
  });

  it("never picks a player", () => {
    expect(pickExecutorId([player("aaa"), player("bbb")])).toBeNull();
  });

  it("ignores inactive GMs", () => {
    expect(pickExecutorId([gm("aaa", false), gm("zzz", true)])).toBe("zzz");
  });

  it("returns null when no GM is connected", () => {
    expect(pickExecutorId([player("p1"), gm("g1", false)])).toBeNull();
  });
});

describe("pickExecutorId — determinism", () => {
  it("picks the lowest id when several GMs are active", () => {
    expect(pickExecutorId([gm("ccc"), gm("aaa"), gm("bbb")])).toBe("aaa");
  });

  it("is independent of user order — every client agrees", () => {
    const users = [gm("ccc"), player("zzz"), gm("aaa"), gm("bbb")];
    const shuffles = [
      users,
      [...users].reverse(),
      [users[2], users[0], users[3], users[1]]
    ];
    const picks = shuffles.map(pickExecutorId);
    expect(new Set(picks).size, `clients disagreed: ${picks}`).toBe(1);
    expect(picks[0]).toBe("aaa");
  });

  it("is stable across repeated calls", () => {
    const users = [gm("ccc"), gm("aaa"), gm("bbb")];
    expect(pickExecutorId(users)).toBe(pickExecutorId(users));
  });
});

describe("pickExecutorId — malformed input", () => {
  it("handles an empty list", () => {
    expect(pickExecutorId([])).toBeNull();
  });

  it("handles undefined and null", () => {
    expect(pickExecutorId()).toBeNull();
    expect(pickExecutorId(null)).toBeNull();
  });

  it("skips entries missing an id", () => {
    expect(pickExecutorId([{ active: true, isGM: true }, gm("g1")])).toBe("g1");
  });

  it("skips null entries", () => {
    expect(pickExecutorId([null, undefined, gm("g1")])).toBe("g1");
  });
});
