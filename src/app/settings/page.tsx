'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import WalkPaceInput from '@/components/WalkPaceInput'
import StopSearch from '@/components/StopSearch'
import UserStopList from '@/components/UserStopList'
import NotificationToggle from '@/components/NotificationToggle'
import type { UserSettings, UserStop, Stop } from '@/types/gtfs'

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [userStops, setUserStops] = useState<UserStop[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingPace, setSavingPace] = useState(false)

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings')
    if (res.ok) setSettings(await res.json())
    setLoadingSettings(false)
  }, [])

  const fetchUserStops = useCallback(async () => {
    const res = await fetch('/api/user-stops')
    if (res.ok) setUserStops(await res.json())
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchUserStops()
  }, [fetchSettings, fetchUserStops])

  async function updatePace(minPerKm: number) {
    if (!settings) return
    setSavingPace(true)
    setSettings({ ...settings, walk_pace_min_per_km: minPerKm })
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walk_pace_min_per_km: minPerKm }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSettings(updated)
        await fetchUserStops() // walk_minutes may have been recalculated
      }
    } finally {
      setSavingPace(false)
    }
  }

  async function addStop(stop: Stop) {
    const res = await fetch('/api/user-stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stop_id: stop.stop_id }),
    })
    if (res.ok) await fetchUserStops()
    else if (res.status === 409) {
      alert('That stop is already in your list.')
    }
  }

  async function removeStop(id: number) {
    const res = await fetch(`/api/user-stops?id=${id}`, { method: 'DELETE' })
    if (res.ok) setUserStops((prev) => prev.filter((s) => s.id !== id))
  }

  async function updateStop(
    id: number,
    updates: { walk_minutes_override?: number | null; label?: string | null }
  ) {
    const res = await fetch(`/api/user-stops?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const updated = await res.json()
      setUserStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)))
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* Section: Walking pace */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Walking pace
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Used to calculate when to leave. The app will notify you when it&apos;s time to put
          your shoes on.
        </p>
        {loadingSettings ? (
          <div className="h-10 bg-slate-700 rounded-lg animate-pulse" />
        ) : (
          <WalkPaceInput
            value={settings?.walk_pace_min_per_km ?? 12}
            onChange={updatePace}
            disabled={savingPace}
          />
        )}
      </section>

      {/* Section: Your stops */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Your stops
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Only stops in the loaded GTFS dataset are searchable. To add a stop not listed, add
          its ID to <code className="bg-slate-700 px-1 rounded text-xs">TARGET_STOP_IDS</code>{' '}
          and re-run <code className="bg-slate-700 px-1 rounded text-xs">npm run load-gtfs</code>.
        </p>

        <div className="mb-4">
          <StopSearch onSelect={addStop} />
        </div>

        <UserStopList
          stops={userStops}
          onRemove={removeStop}
          onUpdate={updateStop}
        />
      </section>

      {/* Section: Notifications */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Notifications
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Get a push notification when it&apos;s time to leave for your next bus. Install this
          app to your home screen first for background delivery to work.
        </p>
        <NotificationToggle />
      </section>
    </div>
  )
}
