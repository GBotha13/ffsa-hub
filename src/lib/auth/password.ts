/**
 * Shared password rules for every place a user sets or changes a password:
 * onboarding, public signup, password reset, and the change-password screen.
 * Keeping the minimum in one constant avoids the drift we had before
 * (onboarding allowed 6 characters while signup required 8).
 */
export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
