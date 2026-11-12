'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface Props {
  name: string
  label: string
  autoComplete: 'current-password' | 'new-password'
  onChange?: (value: string) => void
  autoFocus?: boolean
}

/** A password input with a show/hide button. */
export function PasswordField({ name, label, autoComplete, onChange, autoFocus }: Props) {
  const [shown, setShown] = useState(false)
  const Icon = shown ? EyeOff : Eye
  return (
    <label className="field">
      {label}
      <span className="field-row">
        <input
          name={name}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          onChange={onChange && ((e) => onChange(e.target.value))}
        />
        <button
          type="button"
          className="field-toggle"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
        >
          <Icon size={18} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
        </button>
      </span>
    </label>
  )
}
