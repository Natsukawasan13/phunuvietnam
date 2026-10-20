const consentStorageKey = 'phunuvietnam-data-consent'
const sessionStorageKey = 'phunuvietnam-visitor-session'

export type VisitorEvent = {
  eventType: string
  pageStep: number | null
  target?: string
  details?: Record<string, unknown>
}

export function hasTelemetryConsent() {
  const storedConsent = window.localStorage.getItem(consentStorageKey)
  if (!storedConsent?.startsWith('granted:')) return false
  const expiresAt = Number(storedConsent.slice('granted:'.length))
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000
}

export function getVisitorSessionId() {
  const current = window.sessionStorage.getItem(sessionStorageKey)
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current
  const sessionId = crypto.randomUUID()
  window.sessionStorage.setItem(sessionStorageKey, sessionId)
  return sessionId
}

export async function trackVisitorEvent(event: VisitorEvent) {
  if (!hasTelemetryConsent()) return true
  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getVisitorSessionId(),
      },
      body: JSON.stringify(event),
      keepalive: true,
    })
    if (!response.ok) console.error(`Could not save visitor event: HTTP ${response.status}`)
    return response.ok
  } catch (error) {
    console.error('Could not save visitor event:', error)
    return false
  }
}

export function getConsentStorageKey() {
  return consentStorageKey
}
