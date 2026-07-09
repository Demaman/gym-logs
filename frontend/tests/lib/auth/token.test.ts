import { describe, it, expect } from 'vitest'
import { decodeToken, isTokenExpired } from '@/lib/auth/token'

// Build a minimal JWT-shaped string (base64url payload, no real signature)
function makeToken(payload: object): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${b64}.signature`
}

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

describe('decodeToken', () => {
  it('returns the parsed payload for a valid token', () => {
    const token = makeToken({ exp: 9999999999, sub: 'user-1' })
    const payload = decodeToken(token)
    expect(payload?.exp).toBe(9999999999)
    expect(payload?.sub).toBe('user-1')
  })

  it('returns null for a token with fewer than 3 segments', () => {
    expect(decodeToken('onlyone')).toBeNull()
    expect(decodeToken('two.parts')).toBeNull()
  })

  it('returns null when the payload segment is not valid base64', () => {
    expect(decodeToken('a.!!!.c')).toBeNull()
  })
})

describe('isTokenExpired', () => {
  it('returns false for a token expiring in the future (beyond buffer)', () => {
    const token = makeToken({ exp: nowSec() + 3600 })
    expect(isTokenExpired(token)).toBe(false)
  })

  it('returns true for a token whose exp is in the past', () => {
    const token = makeToken({ exp: nowSec() - 1 })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns true for a token expiring within the 30-second buffer', () => {
    const token = makeToken({ exp: nowSec() + 20 })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns true for a token without an exp claim', () => {
    const token = makeToken({ sub: 'no-exp' })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns true for a malformed token string', () => {
    expect(isTokenExpired('not-a-jwt')).toBe(true)
  })

  it('returns true for an empty string', () => {
    expect(isTokenExpired('')).toBe(true)
  })
})
