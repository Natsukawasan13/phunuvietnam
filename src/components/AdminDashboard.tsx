import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LogOut, RefreshCw, Trash2 } from 'lucide-react'

type VisitorEvent = {
  id: string
  session_id: string
  occurred_at: string
  page_step: number | null
  event_type: string
  target: string | null
  details: Record<string, unknown>
}

type ScreenRecording = {
  id: string
  session_id: string
  created_at: string
  filename: string
  mime_type: string
  size_bytes: string
}

type ApiError = { error?: string }

const formatTimestamp = (value: string) => new Date(value).toLocaleString('vi-VN')
const formatBytes = (value: string) => {
  const bytes = Number(value)
  if (!Number.isFinite(bytes)) return value
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = bytes
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  return `${amount.toFixed(unit ? 1 : 0)} ${units[unit]}`
}

function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [events, setEvents] = useState<VisitorEvent[]>([])
  const [recordings, setRecordings] = useState<ScreenRecording[]>([])
  const [hasMoreEvents, setHasMoreEvents] = useState(false)
  const [hasMoreRecordings, setHasMoreRecordings] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [eventResponse, recordingResponse] = await Promise.all([
        fetch('/api/admin/events?limit=100', { credentials: 'same-origin' }),
        fetch('/api/admin/recordings?limit=100', { credentials: 'same-origin' }),
      ])
      if (eventResponse.status === 401 || recordingResponse.status === 401) {
        setAuthenticated(false)
        return
      }
      if (!eventResponse.ok || !recordingResponse.ok) throw new Error('Không thể tải dữ liệu quản trị.')
      const eventData = await eventResponse.json() as { events: VisitorEvent[] }
      const recordingData = await recordingResponse.json() as { recordings: ScreenRecording[] }
      setEvents(eventData.events)
      setRecordings(recordingData.recordings)
      setHasMoreEvents(eventData.events.length === 100)
      setHasMoreRecordings(recordingData.recordings.length === 100)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu quản trị.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = async (kind: 'events' | 'recordings') => {
    const offset = kind === 'events' ? events.length : recordings.length
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/${kind}?limit=100&offset=${offset}`, { credentials: 'same-origin' })
      if (response.status === 401) {
        setAuthenticated(false)
        return
      }
      if (!response.ok) throw new Error('Không thể tải thêm dữ liệu quản trị.')
      if (kind === 'events') {
        const result = await response.json() as { events: VisitorEvent[] }
        setEvents((current) => [...current, ...result.events])
        setHasMoreEvents(result.events.length === 100)
      } else {
        const result = await response.json() as { recordings: ScreenRecording[] }
        setRecordings((current) => [...current, ...result.recordings])
        setHasMoreRecordings(result.recordings.length === 100)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải thêm dữ liệu quản trị.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetch('/api/admin/session', { credentials: 'same-origin' }).then((response) => {
      setAuthenticated(response.ok)
      if (response.ok) void loadData()
    }).catch(() => setError('Không thể kết nối máy chủ.'))
  }, [loadData])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json() as ApiError
      if (!response.ok) throw new Error(result.error ?? 'Đăng nhập thất bại.')
      setPassword('')
      setAuthenticated(true)
      await loadData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  const deleteRecord = async (kind: 'events' | 'recordings', id: string) => {
    if (!window.confirm(`Xóa bản ghi ${id}? Hành động này không thể hoàn tác.`)) return
    setError('')
    try {
      const response = await fetch(`/api/admin/${kind}/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const result = await response.json() as ApiError
      if (!response.ok) throw new Error(result.error ?? 'Không thể xóa bản ghi.')
      await loadData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xóa bản ghi.')
    }
  }

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
    setAuthenticated(false)
    setEvents([])
    setRecordings([])
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {!authenticated ? (
          <section className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-7 shadow-xl">
            <h1 className="mb-2 text-2xl font-bold">Quản trị dữ liệu</h1>
            <p className="mb-6 text-sm text-slate-600">Đăng nhập bằng mật khẩu ADMIN_PASSWORD của máy chủ.</p>
            <form className="space-y-4" onSubmit={(event) => void login(event)}>
              <label className="block text-sm font-medium" htmlFor="admin-password">Mật khẩu quản trị</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <button className="w-full rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
            {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
          </section>
        ) : (
          <>
            <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Bảng điều khiển dữ liệu</h1>
                <p className="mt-1 text-sm text-slate-600">Đã tải {events.length} sự kiện và {recordings.length} video mới nhất.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Làm mới
                </button>
                <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Đăng xuất
                </button>
              </div>
            </header>
            {error && <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
            <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-bold">Lịch sử thao tác ({events.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">ID / Thời gian</th><th className="px-4 py-3">Phiên</th>
                      <th className="px-4 py-3">Trang</th><th className="px-4 py-3">Hành động / Mục tiêu</th>
                      <th className="px-4 py-3">Chi tiết đã gửi</th><th className="px-4 py-3">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3"><strong>#{item.id}</strong><br />{formatTimestamp(item.occurred_at)}</td>
                        <td className="max-w-36 break-all px-4 py-3 font-mono text-xs">{item.session_id}</td>
                        <td className="px-4 py-3">{item.page_step ?? '—'}</td>
                        <td className="px-4 py-3">{item.event_type}<br /><span className="text-slate-500">{item.target ?? '—'}</span></td>
                        <td className="max-w-md whitespace-pre-wrap break-words px-4 py-3 text-xs">{JSON.stringify(item.details)}</td>
                        <td className="px-4 py-3"><button type="button" onClick={() => void deleteRecord('events', item.id)} aria-label={`Xóa sự kiện ${item.id}`} className="rounded p-2 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                    {!events.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Chưa có sự kiện.</td></tr>}
                  </tbody>
                </table>
              </div>
              {hasMoreEvents && (
                <div className="border-t border-slate-200 p-4 text-center">
                  <button type="button" disabled={loading} onClick={() => void loadMore('events')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-60">
                    {loading ? 'Đang tải...' : 'Tải thêm sự kiện'}
                  </button>
                </div>
              )}
            </section>
            <section className="overflow-hidden rounded-2xl bg-white shadow">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-bold">Video màn hình ({recordings.length})</h2>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                {recordings.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <video className="mb-3 max-h-80 w-full rounded-lg bg-black" controls preload="metadata" src={`/api/admin/recordings/${item.id}`} />
                    <p className="text-sm font-semibold">#{item.id} · {item.filename}</p>
                    <p className="text-xs text-slate-600">{formatTimestamp(item.created_at)} · {formatBytes(item.size_bytes)}</p>
                    <button type="button" onClick={() => void deleteRecord('recordings', item.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> Xóa video
                    </button>
                  </article>
                ))}
                {!recordings.length && <p className="text-sm text-slate-500">Chưa có video.</p>}
              </div>
              {hasMoreRecordings && (
                <div className="border-t border-slate-200 p-4 text-center">
                  <button type="button" disabled={loading} onClick={() => void loadMore('recordings')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-60">
                    {loading ? 'Đang tải...' : 'Tải thêm video'}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default AdminDashboard
