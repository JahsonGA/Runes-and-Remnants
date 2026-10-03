import { describe, it, expect } from "vitest";
import { actorOwners, isRecipient } from "../src/ui/reward-broadcast.js";

// Harvest broadcasts its reward to the whole party, because a kill is a
// party moment everyone watched happen. A crafted dagger or a brewed potion
// is not — it belongs to whoever made it. These two functions are what
// decide who that is.

const users = [
  { id: "gm1", isGM: true },
  { id: "playerA", isGM: false },
  { id: "playerB", isGM: false }
];

describe("actorOwners", () => {
  it("names the player who owns the actor", () => {
    const actor = { testUserPermission: u => u.id === "playerA" };
    expect(actorOwners(actor, users)).toEqual(["playerA"]);
  });

  it("excludes the GM even when the GM holds OWNER on everything", () => {
    // A GM who runs crafting on a player's behalf must not be mistaken for
    // the recipient — the dagger belongs to the player, not whoever executed
    // the request.
    const actor = { testUserPermission: () => true };
    expect(actorOwners(actor, users)).toEqual(["playerA", "playerB"]);
  });

  it("names every player who shares ownership", () => {
    const actor = { testUserPermission: u => u.id !== "gm1" };
    expect(actorOwners(actor, users)).toEqual(["playerA", "playerB"]);
  });

  it("returns nothing for an actor nobody owns", () => {
    const actor = { testUserPermission: () => false };
    expect(actorOwners(actor, users)).toEqual([]);
  });

  it("survives nothing", () => {
    expect(actorOwners(null, users)).toEqual([]);
    expect(actorOwners({ testUserPermission: () => true }, null)).toEqual([]);
  });
});

describe("isRecipient", () => {
  it("is true for a named recipient", () => {
    expect(isRecipient(["playerA"], "playerA", false)).toBe(true);
  });

  it("is false for anyone else, including the GM", () => {
    // The bug this guards against: crafting is GM-authoritative, so the
    // client that executes a request is often the GM, not the owner. If the
    // GM always counted, every reward would pop up twice as often as it
    // should — once for the real owner, once for the GM running the request.
    expect(isRecipient(["playerA"], "playerB", false)).toBe(false);
    expect(isRecipient(["playerA"], "gm1", true)).toBe(false);
  });

  it("falls back to the GM when the list is empty", () => {
    // An NPC, or a world with no ownership set up, must still show the
    // result to someone rather than to no one at all.
    expect(isRecipient([], "gm1", true)).toBe(true);
  });

  it("does not fall back for a non-GM when the list is empty", () => {
    expect(isRecipient([], "playerB", false)).toBe(false);
  });

  it("treats a missing list the same as an empty one", () => {
    expect(isRecipient(undefined, "gm1", true)).toBe(true);
    expect(isRecipient(null, "playerB", false)).toBe(false);
  });
});
