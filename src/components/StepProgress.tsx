import { Sparkles } from 'lucide-react'

type StepProgressProps = {
  step: number
}

export function StepProgress({ step }: StepProgressProps) {
  return (
    <div className="fixed left-3 top-3 z-40 sm:left-6 sm:top-6">
      <div className="glass-card flex items-center gap-2 rounded-full px-3 py-2 sm:gap-2.5 sm:px-4">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-rose-500 sm:text-xs">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          20/10 Story
        </span>
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => {
            const dotStep = index + 1
            const state = dotStep === step ? 'current' : dotStep < step ? 'complete' : 'upcoming'
            return <span className={`step-dot step-dot--${state}`} key={dotStep} />
          })}
        </div>
        <span className="ml-0.5 whitespace-nowrap text-xs font-bold text-gray-600" aria-live="polite">
          {step}/9
        </span>
      </div>
    </div>
  )
}
