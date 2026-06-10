'use client'

import { useState, useRef, useEffect } from 'react'
import type { Stop } from '@/types/gtfs'

interface StopSearchProps {
  onSelect: (stop: Stop) => void
  disabled?: boolean
}

export default function StopSearch({ onSelect, disabled }: StopSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Stop[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/stops/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data: Stop[] = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(stop: Stop) {
    onSelect(stop)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a stop name…"
          disabled={disabled}
          className={[
            'w-full bg-slate-700 text-white placeholder-slate-400',
            'rounded-lg px-4 py-2.5 text-sm outline-none',
            'focus:ring-2 focus:ring-blue-500 border border-slate-600',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
            …
          </span>
        )}
      </div>

      {open && (
        <ul className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((stop) => (
            <li key={stop.stop_id}>
              <button
                type="button"
                onClick={() => handleSelect(stop)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium">{stop.stop_name}</span>
                <span className="ml-2 text-xs text-slate-400">{stop.stop_id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.length >= 2 && !loading && results.length === 0 && !open && (
        <p className="mt-1 text-xs text-slate-400 px-1">
          No stops found. If your stop isn&apos;t listed, add its ID to{' '}
          <code className="bg-slate-700 px-1 rounded">TARGET_STOP_IDS</code>{' '}
          and re-run the load script.
        </p>
      )}
    </div>
  )
}
