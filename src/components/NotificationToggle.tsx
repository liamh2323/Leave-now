'use client'

import { useState, useEffect } from 'react'

export default function NotificationToggle() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported'>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus(Notification.permission)

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    })
  }, [])

  async function subscribe() {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      alert('Push notifications not configured yet (no VAPID key). Complete Stage 3 setup.')
      return
    }

    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission)
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ).buffer as ArrayBuffer,
      })

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      setSubscribed(true)
    } catch (err) {
      console.error('[NotificationToggle] subscribe error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'unsupported') {
    return (
      <p className="text-sm text-slate-400">
        Push notifications aren&apos;t supported in this browser. Install the PWA on your phone for notifications.
      </p>
    )
  }

  if (status === 'denied') {
    return (
      <p className="text-sm text-amber-400">
        Notifications blocked. Open your browser/OS settings and allow notifications for this site.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={[
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          subscribed
            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            : 'bg-blue-600 text-white hover:bg-blue-500',
          loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        {loading
          ? '…'
          : subscribed
            ? 'Disable notifications'
            : 'Enable notifications'}
      </button>

      {subscribed && (
        <span className="text-sm text-green-400 flex items-center gap-1">
          <span>●</span> Active
        </span>
      )}
    </div>
  )
}

// Convert a base64url-encoded string to a Uint8Array (required for VAPID)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)))
}
