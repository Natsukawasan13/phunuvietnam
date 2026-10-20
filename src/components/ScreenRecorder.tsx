import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, ScreenShare, Square, X } from 'lucide-react'
import { getVisitorSessionId } from '../services/telemetry'

type ScreenRecorderProps = {
  visible: boolean
  allowed: boolean
  onReady: () => void
}

function ScreenRecorder({ visible, allowed, onReady }: ScreenRecorderProps) {
  const [isDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const captureStreams = useRef<MediaStream[]>([])
  const readyNotified = useRef(false)
  const mounted = useRef(false)
  const discardRecording = useRef(false)

  const notifyReady = useCallback(() => {
    if (readyNotified.current) return
    readyNotified.current = true
    onReady()
  }, [onReady])

  useEffect(() => {
    mounted.current = true
    if (!isDesktop) notifyReady()

    return () => {
      mounted.current = false
      if (recorder.current?.state === 'recording') recorder.current.stop()
      captureStreams.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
    }
  }, [allowed, isDesktop, notifyReady])

  useEffect(() => {
    if (allowed || recorder.current?.state !== 'recording') return
    discardRecording.current = true
    recorder.current.stop()
    captureStreams.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
    captureStreams.current = []
    setRecording(false)
    setSaving(false)
    setNotice('')
  }, [allowed])

  const downloadRecording = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  }

  const startRecording = async () => {
    setError('')
    setNotice('')
    if (!navigator.mediaDevices?.getDisplayMedia || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setError('Trình duyệt không hỗ trợ quay màn hình và micro. Hãy sử dụng Chrome hoặc Edge trên máy tính.')
      return
    }

    let screenRequest: Promise<MediaStream>
    let microphoneRequest: Promise<MediaStream>
    try {
      screenRequest = navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      microphoneRequest = navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      setError('Không thể mở yêu cầu chia sẻ màn hình hoặc micro. Hãy kiểm tra quyền của trình duyệt.')
      return
    }

    const [screenResult, microphoneResult] = await Promise.allSettled([screenRequest, microphoneRequest])
    const screenStream = screenResult.status === 'fulfilled' ? screenResult.value : null
    const microphoneStream = microphoneResult.status === 'fulfilled' ? microphoneResult.value : null

    if (!screenStream || !microphoneStream) {
      screenStream?.getTracks().forEach((track) => track.stop())
      microphoneStream?.getTracks().forEach((track) => track.stop())
      const denied = [screenResult, microphoneResult].some(
        (result) => result.status === 'rejected' && result.reason instanceof DOMException
          && ['NotAllowedError', 'PermissionDeniedError'].includes(result.reason.name),
      )
      setError(denied
        ? 'Cần cho phép chia sẻ màn hình và truy cập micro để bật nút tiếp tục.'
        : 'Không thể khởi tạo quay màn hình hoặc micro. Hãy kiểm tra thiết bị và thử lại.')
      return
    }

    captureStreams.current = [screenStream, microphoneStream]
    const recordingStream = new MediaStream([
      ...screenStream.getVideoTracks(),
      ...screenStream.getAudioTracks(),
      ...microphoneStream.getAudioTracks(),
    ])

    try {
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const activeRecorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType })
        : new MediaRecorder(recordingStream)
      const chunks: Blob[] = []
      recorder.current = activeRecorder
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      activeRecorder.onerror = () => {
        if (mounted.current) setError('Đã xảy ra lỗi trong khi ghi màn hình.')
      }
      activeRecorder.onstop = () => {
        const recordingBlob = new Blob(chunks, { type: activeRecorder.mimeType || 'video/webm' })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `screen-recording-${timestamp}.webm`
        captureStreams.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
        captureStreams.current = []
        recorder.current = null
        if (discardRecording.current) {
          discardRecording.current = false
          return
        }

        if (!recordingBlob.size) {
          if (mounted.current) {
            setRecording(false)
            setSaving(false)
            setError('Bản ghi trống nên không thể lưu.')
          }
          return
        }

        downloadRecording(recordingBlob, filename)
        if (mounted.current) {
          setRecording(false)
          setSaving(true)
          setNotice('Đang tải video về máy và lưu bản sao trong PostgreSQL...')
        }

        void fetch('/api/recordings', {
          method: 'POST',
          headers: {
            'Content-Type': recordingBlob.type,
            'X-Session-Id': getVisitorSessionId(),
          },
          body: recordingBlob,
        }).then(async (response) => {
          if (!response.ok) throw new Error(`Recording upload failed: ${response.status}`)
          const result: unknown = await response.json()
          const recordingId = typeof result === 'object' && result !== null && 'id' in result
            && (typeof result.id === 'string' || typeof result.id === 'number') ? result.id : null
          if (mounted.current) {
            setSaving(false)
            setNotice(`Đã tải video về máy và lưu trong PostgreSQL${recordingId ? ` (bản ghi #${recordingId})` : ''}.`)
          }
        }).catch(() => {
          if (mounted.current) {
            setSaving(false)
            setError('Video đã tải về máy nhưng không lưu được trong PostgreSQL. Hãy kiểm tra máy chủ ứng dụng.')
          }
        })
      }
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (activeRecorder.state === 'recording') {
          setRecording(false)
          setSaving(true)
          activeRecorder.stop()
        }
      }, { once: true })
      activeRecorder.start(1000)
      setRecording(true)
      setNotice('Đang ghi màn hình và micro. Dừng chia sẻ hoặc nhấn Dừng và lưu để hoàn tất.')
      notifyReady()
    } catch {
      captureStreams.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
      captureStreams.current = []
      setError('Không thể bắt đầu ghi. Hãy kiểm tra quyền chia sẻ màn hình và thiết bị micro.')
    }
  }

  const stopRecording = () => {
    if (recorder.current?.state !== 'recording') return
    setRecording(false)
    setSaving(true)
    setNotice('Đang hoàn tất video...')
    recorder.current.stop()
  }

  if (!isDesktop || (!visible && !recording)) return null

  if (recording && !visible) {
    return (
      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-rose-200 bg-white px-4 py-3 shadow-xl">
        <span className="flex items-center gap-2 text-sm font-medium text-rose-700" role="status">
          <Mic className="h-4 w-4" aria-hidden="true" />
          Đang ghi màn hình và micro
        </span>
        <button type="button" className="secondary-button" onClick={stopRecording}>
          <Square className="h-4 w-4 fill-current" aria-hidden="true" />
          <span>Dừng và lưu</span>
        </button>
      </div>
    )
  }

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="screen-recorder-title"
        aria-describedby="screen-recorder-description"
      >
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-4 focus:ring-rose-100"
          aria-label="Đóng và tiếp tục không chia sẻ"
          title="Tiếp tục không chia sẻ"
          onClick={notifyReady}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <ScreenShare className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 id="screen-recorder-title" className="mb-2 text-xl font-bold text-gray-800">
          Chia sẻ màn hình và bật micro
        </h2>
        <p id="screen-recorder-description" className="mb-5 text-sm leading-relaxed text-gray-600">
          Nhấn nút để mở hộp thoại chia sẻ của trình duyệt. Chọn màn hình hoặc tab muốn ghi và cho phép dùng micro.
          Bản ghi sẽ được tải về máy và lưu trong PostgreSQL để quản trị viên đã xác thực xem lại.
        </p>
        {!recording ? (
          <button
            type="button"
            className="primary-button w-full"
            disabled={saving || !allowed}
            onClick={() => void startRecording()}
          >
            <ScreenShare className="h-4 w-4" aria-hidden="true" />
            <span>{saving ? 'Đang lưu video...' : 'Cho phép chia sẻ màn hình & micro'}</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700" role="status">
              <Mic className="h-4 w-4" aria-hidden="true" />
              Đang ghi màn hình và micro
            </p>
            <button type="button" className="secondary-button" onClick={stopRecording}>
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
              <span>Dừng và lưu</span>
            </button>
          </div>
        )}
        {notice && <p className="mt-4 text-sm text-emerald-700" role="status">{notice}</p>}
        {error && <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p>}
      </div>
    </section>
  )
}

export default ScreenRecorder
