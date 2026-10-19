import { useEffect, useRef } from 'react'

type Petal = {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  rotation: number
  rotationSpeed: number
  color: string
  opacity: number
}

const colors = ['#fbcfe8', '#fda4af', '#f43f5e', '#fed7aa']

function PetalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let width = window.innerWidth
    let height = window.innerHeight
    let frameId = 0
    canvas.width = width
    canvas.height = height

    const petals: Petal[] = Array.from({ length: 28 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      size: Math.random() * 8 + 6,
      speedX: Math.random() * 1.5 - 0.75,
      speedY: Math.random() * 1.2 + 0.8,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 2 - 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: Math.random() * 0.5 + 0.3,
    }))

    const resizeCanvas = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const render = () => {
      context.clearRect(0, 0, width, height)
      petals.forEach((petal) => {
        context.save()
        context.translate(petal.x, petal.y)
        context.rotate((petal.rotation * Math.PI) / 180)
        context.fillStyle = petal.color
        context.globalAlpha = petal.opacity
        context.beginPath()
        context.moveTo(0, 0)
        context.bezierCurveTo(
          petal.size / 2,
          -petal.size,
          petal.size,
          -petal.size / 2,
          petal.size,
          0,
        )
        context.bezierCurveTo(
          petal.size,
          petal.size / 2,
          petal.size / 2,
          petal.size,
          0,
          petal.size,
        )
        context.bezierCurveTo(
          -petal.size / 2,
          petal.size,
          -petal.size,
          petal.size / 2,
          -petal.size,
          0,
        )
        context.bezierCurveTo(
          -petal.size,
          -petal.size / 2,
          -petal.size / 2,
          -petal.size,
          0,
          0,
        )
        context.fill()
        context.restore()

        petal.x += petal.speedX
        petal.y += petal.speedY
        petal.rotation += petal.rotationSpeed
        if (petal.y > height + 20) {
          petal.y = -20
          petal.x = Math.random() * width
        }
      })
      frameId = window.requestAnimationFrame(render)
    }

    window.addEventListener('resize', resizeCanvas)
    frameId = window.requestAnimationFrame(render)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="petals-canvas" aria-hidden="true" />
}

export default PetalCanvas
