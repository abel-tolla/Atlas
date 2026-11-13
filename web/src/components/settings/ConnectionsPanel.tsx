'use client'

import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ConnectionView } from '../../server/connections'
import { useShell } from '../AppShell'
import { SourceMark } from '../calendar/parts'

const ICON = { size: 14, strokeWidth: 1.75, absoluteStrokeWidth: true, 'aria-hidden': true } as const

/** Settings → Connections: connect Canvas, pick courses, sync (#190, #191, #214). */
export function ConnectionsPanel() {
  const [connections, setConnections] = useState<ConnectionView[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/connections', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      setConnections(((await res.json()) as { connections: ConnectionView[] }).connections)
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const canvas = connections?.find((c) => c.provider === 'canvas')

  return (
    <section className="settings" aria-labelledby="connections-heading">
      <div>
        <h2 id="connections-heading" className="settings-title">
          Calendar connections
        </h2>
        <p className="settings-sub">
          Atlas only reads these. It never changes anything in Canvas or your other calendars.
        </p>
      </div>
      {loadFailed && (
        <p className="alert" role="alert">
          Your connections didn’t load.{' '}
          <button type="button" className="link" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {connections === null && !loadFailed ? (
        <div className="conn-card card" aria-busy="true">
          <span className="skeleton conn-skeleton" />
        </div>
      ) : (
        !loadFailed && <CanvasCard connection={canvas} onChanged={load} />
      )}
    </section>
  )
}

function CanvasCard({ connection, onChanged }: { connection?: ConnectionView; onChanged: () => Promise<void> }) {
  const { notify } = useShell()
  const [editing, setEditing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [courses, setCourses] = useState(connection?.calendars ?? [])

  useEffect(() => setCourses(connection?.calendars ?? []), [connection])

  if (!connection || editing) {
    return (
      <div className="conn-card card">
        <CardHead title="Canvas" detail={connection ? connection.label : 'Assignments and due dates'} />
        <CanvasConnectForm
          initialMethod={connection?.method === 'token' ? 'token' : 'feed'}
          onCancel={connection ? () => setEditing(false) : undefined}
          onConnected={async (message) => {
            notify(message)
            setEditing(false)
            await onChanged()
          }}
        />
      </div>
    )
  }

  const toggle = async (id: string, visible: boolean) => {
    setCourses((list) => list.map((c) => (c.id === id ? { ...c, visible } : c)))
    const res = await fetch(`/api/connections/${connection.id}/calendars/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visible }),
    }).catch(() => null)
    if (!res?.ok) {
      setCourses((list) => list.map((c) => (c.id === id ? { ...c, visible: !visible } : c)))
      notify('That change didn’t save. Try again.')
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    setSyncNote(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const body = await res.json()
      if (res.status === 429) {
        setSyncNote(body.message)
      } else if (!res.ok) {
        setSyncNote('Sync didn’t start. Try again in a moment.')
      } else {
        const result = (body.results as { accountId: string; outcome: string; message: string | null; counts: { created: number; removed: number } | null }[])
          .find((r) => r.accountId === connection.id)
        if (result?.outcome === 'succeeded') {
          const added = result.counts?.created ?? 0
          notify(added > 0 ? `Canvas synced. ${added} new ${added === 1 ? 'deadline' : 'deadlines'}.` : 'Canvas is up to date.')
        }
        await onChanged()
      }
    } catch {
      setSyncNote('Sync didn’t start. Check your connection and try again.')
    } finally {
      setSyncing(false)
    }
  }

  const needsReconnect = connection.state === 'needs_reconnect'

  return (
    <div className="conn-card card">
      <CardHead
        title="Canvas"
        detail={`${connection.label}  ·  ${connection.method === 'feed' ? 'Calendar feed link' : 'Access token'}`}
        state={connection.state}
      />

      {connection.message && connection.state !== 'ok' && (
        <p className={needsReconnect || connection.state === 'error' ? 'alert' : 'notice'} role="status">
          {connection.message}
        </p>
      )}

      <p className="hint">
        {connection.lastSyncedAt
          ? `Last synced ${format(new Date(connection.lastSyncedAt), "MMM d 'at' h:mm a")}. Atlas also syncs once a day.`
          : 'Not synced yet.'}
      </p>

      {courses.length > 0 && (
        <fieldset className="conn-courses">
          <legend className="overline">Courses to show</legend>
          {courses.map((course) => (
            <label key={course.id}>
              <input type="checkbox" checked={course.visible} onChange={(e) => void toggle(course.id, e.target.checked)} />
              {course.name}
            </label>
          ))}
          <p className="hint">Hidden courses are left out of your calendar and skipped when syncing.</p>
        </fieldset>
      )}

      {syncNote && (
        <p className="notice" role="status">
          {syncNote}
        </p>
      )}

      <div className="item-actions conn-actions">
        {needsReconnect ? (
          <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
            Reconnect Canvas
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => void syncNow()} disabled={syncing}>
            <RefreshCw {...ICON} className={syncing ? 'spin' : undefined} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        )}
        {!needsReconnect && (
          <button type="button" className="btn btn--text" onClick={() => setEditing(true)}>
            Change how it connects
          </button>
        )}
      </div>
    </div>
  )
}

const STATE_LABEL = {
  ok: 'Connected',
  delayed: 'Sync delayed',
  needs_reconnect: 'Needs reconnecting',
  error: 'Sync failed',
} as const

function CardHead({ title, detail, state }: { title: string; detail: string; state?: ConnectionView['state'] }) {
  return (
    <div className="conn-head" data-source="canvas">
      <SourceMark source="canvas" />
      <div className="conn-name">
        <h3>{title}</h3>
        <p className="item-meta">{detail}</p>
      </div>
      {state && (
        <span className="conn-state" data-state={state}>
          {STATE_LABEL[state]}
        </span>
      )}
    </div>
  )
}

type Method = 'feed' | 'token'

function CanvasConnectForm({
  initialMethod,
  onCancel,
  onConnected,
}: {
  initialMethod: Method
  onCancel?: () => void
  onConnected: (message: string) => Promise<void>
}) {
  const [method, setMethod] = useState<Method>(initialMethod)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body =
      method === 'feed'
        ? { method, feedUrl: String(form.get('feedUrl') ?? '') }
        : { method, schoolUrl: String(form.get('schoolUrl') ?? ''), token: String(form.get('token') ?? '') }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/connect/canvas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(result.message ?? 'Canvas didn’t connect. Try again.')
        return
      }
      const created = result.sync?.counts?.created ?? 0
      await onConnected(
        result.sync?.outcome === 'succeeded'
          ? `Canvas connected. ${created} ${created === 1 ? 'deadline' : 'deadlines'} added to your calendar.`
          : `Canvas connected, but the first sync didn’t finish. ${result.sync?.message ?? ''}`.trim(),
      )
    } catch {
      setError('Canvas didn’t connect. Check your internet connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form conn-form" onSubmit={submit} noValidate>
      <div className="segments conn-methods" role="group" aria-label="How to connect">
        <button type="button" aria-pressed={method === 'feed'} onClick={() => setMethod('feed')}>
          Calendar feed link
        </button>
        <button type="button" aria-pressed={method === 'token'} onClick={() => setMethod('token')}>
          Access token
        </button>
      </div>

      {method === 'feed' ? (
        <>
          <ol className="conn-steps">
            <li>In Canvas, open <strong>Calendar</strong>.</li>
            <li>At the bottom right, choose <strong>Calendar Feed</strong>.</li>
            <li>Copy the whole link and paste it below.</li>
          </ol>
          <label className="field">
            Calendar feed link
            <input
              name="feedUrl"
              type="url"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="https://yourschool.instructure.com/feeds/calendars/user_….ics"
            />
          </label>
          <p className="hint">
            Treat this link like a password: anyone with it can see your Canvas calendar. Atlas stores it encrypted.
          </p>
        </>
      ) : (
        <>
          <ol className="conn-steps">
            <li>In Canvas, open <strong>Account → Settings</strong>.</li>
            <li>Choose <strong>+ New Access Token</strong>, name it “Atlas”, and generate it.</li>
            <li>Copy the token right away. Canvas shows it only once.</li>
          </ol>
          <label className="field">
            Your school’s Canvas address
            <input name="schoolUrl" required autoComplete="url" spellCheck={false} placeholder="canvas.yourschool.edu" />
          </label>
          <label className="field">
            Access token
            <input name="token" type="password" required autoComplete="off" spellCheck={false} />
          </label>
          <p className="hint">
            Some schools turn access tokens off. If you don’t see the button in Canvas, use the calendar feed link
            instead.
          </p>
        </>
      )}

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="item-actions conn-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Connecting… importing your assignments' : 'Connect Canvas'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--text" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
