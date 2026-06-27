import { describe, expect, it } from "vitest";
import {
  isTerminal,
  isValidTransition,
  SESSION_STATUS,
  transition,
} from "@/lib/checkout/state-machine";

describe("checkout state machine", () => {
  it("supports the complete guarded payment lifecycle", () => {
    expect(
      isValidTransition(SESSION_STATUS.OPEN, SESSION_STATUS.PREPARING)
    ).toBe(true);
    expect(
      isValidTransition(
        SESSION_STATUS.PREPARING,
        SESSION_STATUS.AWAITING_APPROVAL
      )
    ).toBe(true);
    expect(
      isValidTransition(
        SESSION_STATUS.AWAITING_APPROVAL,
        SESSION_STATUS.PROCESSING
      )
    ).toBe(true);
    expect(
      isValidTransition(SESSION_STATUS.PROCESSING, SESSION_STATUS.COMPLETED)
    ).toBe(true);
  });

  it("allows safe preparation retry without duplicate completion", () => {
    expect(
      transition(SESSION_STATUS.PREPARING, SESSION_STATUS.OPEN)
    ).toBe(SESSION_STATUS.OPEN);
    expect(() =>
      transition(SESSION_STATUS.COMPLETED, SESSION_STATUS.PROCESSING)
    ).toThrow("Invalid state transition");
    expect(isTerminal(SESSION_STATUS.COMPLETED)).toBe(true);
  });
});
