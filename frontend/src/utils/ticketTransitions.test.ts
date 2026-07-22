import { describe, it, expect } from "vitest";
import { getAllowedTransitions } from "@/utils/ticketTransitions";

describe("getAllowedTransitions", () => {
  it("OPEN transitions to IN_PROGRESS and CLOSED", () => {
    expect(getAllowedTransitions("OPEN")).toEqual(["IN_PROGRESS", "CLOSED"]);
  });

  it("IN_PROGRESS transitions to RESOLVED and CLOSED", () => {
    expect(getAllowedTransitions("IN_PROGRESS")).toEqual(["RESOLVED", "CLOSED"]);
  });

  it("RESOLVED transitions to IN_PROGRESS and CLOSED", () => {
    expect(getAllowedTransitions("RESOLVED")).toEqual(["IN_PROGRESS", "CLOSED"]);
  });

  it("CLOSED has no transitions", () => {
    expect(getAllowedTransitions("CLOSED")).toEqual([]);
  });
});