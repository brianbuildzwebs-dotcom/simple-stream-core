export function authCallbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

export function postAuthRedirectUrl() {
  return `${window.location.origin}/dashboard`;
}