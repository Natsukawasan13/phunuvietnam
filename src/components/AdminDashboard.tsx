import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Download, FileSpreadsheet, LogOut, RefreshCw, Search, Trash2 } from 'lucide-react'

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
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [sessionSearchInput, setSessionSearchInput] = useState('')
  const [activeSessionSearch, setActiveSessionSearch] = useState('')
  const [hasMoreEvents, setHasMoreEvents] = useState(false)
  const [hasMoreRecordings, setHasMoreRecordings] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(async (search = '', sessionId = '') => {
    setLoading(true)
    setError('')
    try {
      const eventQuery = new URLSearchParams({ limit: '100', search, sessionId })
      const [eventResponse, recordingResponse] = await Promise.all([
        fetch(`/api/admin/events?${eventQuery}`, { credentials: 'same-origin' }),
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

  const loadMore = async (kind: 'events' | 'recordings', search = '', sessionId = '') => {
    const offset = kind === 'events' ? events.length : recordings.length
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ limit: '100', offset: String(offset) })
      if (kind === 'events') {
        query.set('search', search)
        query.set('sessionId', sessionId)
      }
      const response = await fetch(`/api/admin/${kind}?${query}`, { credentials: 'same-origin' })
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
      await loadData(activeSearch, activeSessionSearch)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xóa bản ghi.')
    }
  }

  const deleteAll = async (kind: 'events' | 'recordings') => {
    const label = kind === 'events' ? 'toàn bộ lịch sử thao tác' : 'toàn bộ video'
    if (!window.confirm(`Bạn chắc chắn muốn xóa ${label}? Thao tác này không thể hoàn tác.`)) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/${kind}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const result = await response.json() as ApiError & { deleted?: number }
      if (!response.ok) throw new Error(result.error ?? `Không thể xóa ${label}.`)
      await loadData(activeSearch, activeSessionSearch)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Không thể xóa ${label}.`)
    } finally {
      setLoading(false)
    }
  }

  const exportEvents = async () => {
    setExporting(true)
    setError('')
    try {
      const query = new URLSearchParams()
      if (activeSearch) query.set('search', activeSearch)
      if (activeSessionSearch) query.set('sessionId', activeSessionSearch)
      const response = await fetch(`/api/admin/events/export?${query}`, { credentials: 'same-origin' })
      if (!response.ok) {
        const result = await response.json() as ApiError
        throw new Error(result.error ?? 'Không thể xuất file Excel.')
      }
      const fileUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = 'visitor-events.xlsx'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xuất file Excel.')
    } finally {
      setExporting(false)
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
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={exporting} onClick={() => void exportEvents()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800 disabled:opacity-60">
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> {exporting ? 'Đang xuất...' : 'Tải log Excel'}
                </button>
                <button type="button" onClick={() => void loadData(activeSearch, activeSessionSearch)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Làm mới
                </button>
                <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Đăng xuất
                </button>
              </div>
            </header>
            {error && <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
            <section className="mb-8 overflow-hidden rounded-2xl bg-white shadow">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold">Lịch sử thao tác ({events.length})</h2>
                  {activeSearch && <p className="mt-1 text-xs text-slate-500">Đang lọc theo: “{activeSearch}”</p>}
                  {activeSessionSearch && <p className="mt-1 text-xs text-slate-500">Phiên: “{activeSessionSearch}”</p>}
                </div>
                <button type="button" disabled={loading} onClick={() => void deleteAll('events')} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Xóa tất cả log
                </button>
              </div>
              <form
                className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:flex-wrap"
                onSubmit={(event) => {
                  event.preventDefault()
                  const search = searchInput.trim()
                  const sessionId = sessionSearchInput.trim()
                  setActiveSearch(search)
                  setActiveSessionSearch(sessionId)
                  void loadData(search, sessionId)
                }}
              >
                <label htmlFor="event-search" className="sr-only">Tìm log theo tên người dùng</label>
                <input
                  id="event-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Tìm log theo tên người dùng đã nhập..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
                <label htmlFor="session-search" className="sr-only">Tìm log theo phiên</label>
                <input
                  id="session-search"
                  type="search"
                  value={sessionSearchInput}
                  onChange={(event) => setSessionSearchInput(event.target.value)}
                  placeholder="Lọc theo Session ID..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
                <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  <Search className="h-4 w-4" aria-hidden="true" /> Tìm kiếm
                </button>
                {(activeSearch || activeSessionSearch) && (
                  <button type="button" disabled={loading} onClick={() => {
                    setSearchInput('')
                    setSessionSearchInput('')
                    setActiveSearch('')
                    setActiveSessionSearch('')
                    void loadData('', '')
                  }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-60">
                    Xóa lọc
                  </button>
                )}
              </form>
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
                  <button type="button" disabled={loading} onClick={() => void loadMore('events', activeSearch, activeSessionSearch)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-60">
                    {loading ? 'Đang tải...' : 'Tải thêm sự kiện'}
                  </button>
                </div>
              )}
            </section>
            <section className="overflow-hidden rounded-2xl bg-white shadow">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-bold">Video màn hình ({recordings.length})</h2>
                <button type="button" disabled={loading} onClick={() => void deleteAll('recordings')} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Xóa tất cả video
                </button>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                {recordings.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <video className="mb-3 max-h-80 w-full rounded-lg bg-black" controls preload="metadata" src={`/api/admin/recordings/${item.id}`} />
                    <p className="text-sm font-semibold">#{item.id} · {item.filename}</p>
                    <p className="text-xs text-slate-600">{formatTimestamp(item.created_at)} · {formatBytes(item.size_bytes)}</p>
                    <a href={`/api/admin/recordings/${item.id}?download=1`} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                      <Download className="h-4 w-4" aria-hidden="true" /> Tải video về máy
                    </a>
                    <button type="button" onClick={() => void deleteRecord('recordings', item.id)} className="ml-2 mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> Xóa video
                    </button>
                  </article>
                ))}
                {!recordings.length && <p className="text-sm text-slate-500">Chưa có video.</p>}
              </div>
              {hasMoreRecordings && (
                <div className="border-t border-slate-200 p-4 text-center">
                  <button type="button" disabled={loading} onClick={() => void loadMore('recordings', activeSearch)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-60">
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
