import { addDays, addHours, format, parseISO } from 'date-fns'
import { useState, type FormEvent } from 'react'
import type { EventInput } from '../../calendarApi'
import { CATEGORIES, type CalendarEvent, type Category } from '../../data'
import { Dialog } from './Dialog'

export interface EventFormProps {
  /** The Atlas event being edited, or none to create one. */
  event?: CalendarEvent
  /** Where a new event starts. */
  start?: Date
  onSave: (input: EventInput, important: boolean) => Promise<void>
  onClose: () => void
}

const day = (date: Date) => format(date, 'yyyy-MM-dd')
const time = (date: Date) => format(date, 'HH:mm')

function initialValues(event?: CalendarEvent, start = new Date()) {
  if (event) {
    const from = parseISO(event.start)
    const to = parseISO(event.end)
    return {
      title: event.title,
      allDay: Boolean(event.allDay),
      date: day(from),
      lastDate: day(event.allDay ? addDays(to, -1) : to),
      startTime: time(from),
      endTime: time(to),
      location: event.location ?? '',
      category: event.category ?? '',
      important: Boolean(event.important),
    }
  }
  return {
    title: '',
    allDay: false,
    date: day(start),
    lastDate: day(start),
    startTime: time(start),
    endTime: time(addHours(start, 1)),
    location: '',
    category: '',
    important: false,
  }
}

/** The event form (#97): title, time, place, category and importance. */
export function EventForm({ event, start, onSave, onClose }: EventFormProps) {
  const [values, setValues] = useState(() => initialValues(event, start))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const input: EventInput = values.allDay
      ? {
          title: values.title.trim(),
          allDay: true,
          start: `${values.date}T00:00`,
          end: `${day(addDays(parseISO(values.lastDate || values.date), 1))}T00:00`,
        }
      : {
          title: values.title.trim(),
          allDay: false,
          start: `${values.date}T${values.startTime}`,
          end: `${values.date}T${values.endTime}`,
        }
    input.location = values.location.trim() || undefined
    input.category = (values.category || undefined) as Category | undefined
    setSaving(true)
    setError('')
    try {
      await onSave(input, values.important)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Dialog
      overline={event ? 'Edit event' : 'New event'}
      title={event ? event.title : 'Add to your calendar'}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit} noValidate>
        <label className="form-field">
          <span>Title</span>
          <input
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            required
            autoFocus
            placeholder="For example: Haskell study"
          />
        </label>

        <label className="form-check">
          <input
            type="checkbox"
            checked={values.allDay}
            onChange={(e) => set('allDay', e.target.checked)}
          />
          All day
        </label>

        <div className="form-row">
          <label className="form-field">
            <span>{values.allDay ? 'From' : 'Date'}</span>
            <input type="date" value={values.date} onChange={(e) => set('date', e.target.value)} required />
          </label>
          {values.allDay ? (
            <label className="form-field">
              <span>To</span>
              <input
                type="date"
                value={values.lastDate}
                min={values.date}
                onChange={(e) => set('lastDate', e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="form-field">
                <span>Starts</span>
                <input
                  type="time"
                  step={900}
                  value={values.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                  required
                />
              </label>
              <label className="form-field">
                <span>Ends</span>
                <input
                  type="time"
                  step={900}
                  value={values.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                  required
                />
              </label>
            </>
          )}
        </div>

        <label className="form-field">
          <span>Place</span>
          <input
            value={values.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Optional"
          />
        </label>

        <div className="form-row">
          <label className="form-field">
            <span>Category</span>
            <select value={values.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">None</option>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="form-check form-check--inline">
            <input
              type="checkbox"
              checked={values.important}
              onChange={(e) => set('important', e.target.checked)}
            />
            Important
          </label>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="item-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {event ? 'Save changes' : 'Add event'}
          </button>
          <button type="button" className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  )
}
