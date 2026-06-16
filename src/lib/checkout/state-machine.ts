/**
 * Checkout session state machine.
 *
 * Valid transitions:
 *   open       → completed  (payment successful)
 *   open       → expired    (time-based expiry)
 *   open       → canceled   (merchant or customer cancels)
 *
 * Terminal states: completed, expired, canceled
 * From terminal states: no transitions allowed.
 */

export const SESSION_STATUS = {
  OPEN: "open" as const,
  COMPLETED: "completed" as const,
  EXPIRED: "expired" as const,
  CANCELED: "canceled" as const,
};

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  [SESSION_STATUS.OPEN]: [
    SESSION_STATUS.COMPLETED,
    SESSION_STATUS.EXPIRED,
    SESSION_STATUS.CANCELED,
  ],
  [SESSION_STATUS.COMPLETED]: [],
  [SESSION_STATUS.EXPIRED]: [],
  [SESSION_STATUS.CANCELED]: [],
};

/**
 * Check if a state transition is valid.
 */
export function isValidTransition(
  from: SessionStatus,
  to: SessionStatus
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Apply a state transition. Throws if the transition is invalid.
 */
export function transition(
  currentStatus: SessionStatus,
  newStatus: SessionStatus
): SessionStatus {
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid state transition: ${currentStatus} → ${newStatus}`
    );
  }
  return newStatus;
}

/**
 * Check if a status is terminal (no further transitions allowed).
 */
export function isTerminal(status: SessionStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}
