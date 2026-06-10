'use client'

import { WALK_PACE_PRESETS } from '@/lib/walk'

interface WalkPaceInputProps {
  value: number
  onChange: (minPerKm: number) => void
  disabled?: boolean
}

export default function WalkPaceInput({ value, onChange, disabled }: WalkPaceInputProps) {
  const isPreset = WALK_PACE_PRESETS.some((p) => p.minPerKm === value)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {WALK_PACE_PRESETS.map((preset) => (
          <button
            key={preset.minPerKm}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset.minPerKm)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              value === preset.minPerKm
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {preset.label}
            <span className="ml-1 text-xs opacity-70">{preset.minPerKm} min/km</span>
          </button>
        ))}
      </div>

      {!isPreset && (
        <p className="text-xs text-slate-400">
          Custom pace: {value} min/km
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 w-16">Slow</span>
        <input
          type="range"
          min={6}
          max={18}
          step={0.5}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-blue-500"
        />
        <span className="text-xs text-slate-500 w-16 text-right">Fast</span>
      </div>
    </div>
  )
}
