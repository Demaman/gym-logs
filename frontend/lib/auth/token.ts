interface JwtPayload {
  exp?: number
  sub?: string
  [key: string]: unknown
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64)) as JwtPayload
  } catch {
    return null
  }
}

// True if the token is already expired or expires within 30 s (clock-skew buffer).
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token)
  if (!payload?.exp) return true
  return Date.now() / 1000 > payload.exp - 30
}
