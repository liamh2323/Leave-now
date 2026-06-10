'use client'

import { useState } from 'react'
import { effectiveWalkMinutes } from '@/lib/walk'
import type { UserStop } from '@/types/gtfs'

interface UserStopListProps {
  stops: UserStop[]
  onRemove: (id: number) => void
  onUpdate: (id: number, updates: { walk_minutes_override?: number | null; label?: string | null }) => void
}

export default function UserStopList({ stops, onRemove, onUpdate }: UserStopListProps) {
  if (stops.length === 0) {
    return (
      <p className="text-slate-400 text-sm py-4">
        No stops added yet. Search above to add your first stop.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {stops.map((stop) => (
        <StopRow
          key={stop.id}
          stop={stop}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />
      ))}
    </ul>
  )
}

function StopRow({
  stop,
  onRemove,
  onUpdate,
}: {
  stop: UserStop
  onRemove: (id: number) => void
  onUpdate: (id: number, updates: { walk_minutes_override?: number | null; label?: string | null }) => void
}) {
  const [editingWalk, setEditingWalk] = useState(false)
  const [walkInput, setWalkInput] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelInput, setLabelInput] = useState(stop.label ?? '')

  const effectiveWalk = effectiveWalkMinutes(stop.walk_minutes_override, stop.walk_minutes)
  const isOverride = stop.walk_minutes_override != null

  function commitWalk() {
    const val = parseFloat(walkInput)
    if (!isNaN(val) && val > 0) {
      onUpdate(stop.id, { walk_minutes_override: val })
    }
    setEditingWalk(false)
  }

  function clearOverride() {
    onUpdate(stop.id, { walk_minutes_override: null })
  }

  function commitLabel() {
    onUpdate(stop.id, { label: labelInput.trim() || null })
    setEditingLabel(false)
  }

  return (
    <li className="bg-slate-700 rounded-lg p-3 flex items-start gap-3">
      {/* Icon */}
      <div className="mt-0.5 text-blue-400 flex-shrink-0">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Stop name */}
        <p className="text-sm font-medium text-white truncate">
          {stop.stop_name ?? stop.stop_id}
        </p>
        <p className="text-xs text-slate-400">{stop.stop_id}</p>

        {/* Label */}
        <div className="mt-1">
          {editingLabel ? (
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
              placeholder="Add a label (e.g. Home)"
              autoFocus
              className="text-xs bg-slate-600 text-white rounded px-2 py-1 outline-none w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setLabelInput(stop.label ?? ''); setEditingLabel(true) }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {stop.label ? `"${stop.label}"` : '+ Add label'}
            </button>
          )}
        </div>

        {/* Walk time */}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {editingWalk ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={walkInput}
                onChange={(e) => setWalkInput(e.target.value)}
                onBlur={commitWalk}
                onKeyDown={(e) => e.key === 'Enter' && commitWalk()}
                min={1}
                max={60}
                step={0.5}
                placeholder={String(effectiveWalk)}
                autoFocus
                className="text-xs bg-slate-600 text-white rounded px-2 py-1 outline-none w-20"
              />
              <span className="text-xs text-slate-400">min walk</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setWalkInput(String(effectiveWalk)); setEditingWalk(true) }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {effectiveWalk} min walk{isOverride ? ' (custom)' : ''}
            </button>
          )}

          {isOverride && !editingWalk && (
            <button
              type="button"
              onClick={clearOverride}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              title="Reset to calculated value"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(stop.id)}
        className="flex-shrink-0 text-slate-500 hover:text-red-400 transition-colors mt-0.5"
        aria-label="Remove stop"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  )
}
