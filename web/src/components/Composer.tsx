import { ArrowUp, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { FALLBACK_ANSWER, SUGGESTIONS } from '../data'

const REPLY_DELAY_MS = 700

interface ComposerProps {
  draft: string
  onDraftChange: (draft: string) => void
  inputRef: RefObject<HTMLInputElement | null>
}

export function Composer({ draft, onDraftChange, inputRef }: ComposerProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const ask = (text: string) => {
    clearTimeout(timer.current)
    setQuestion(text)
    setAnswer('')
    onDraftChange('')
    timer.current = setTimeout(() => {
      const match = SUGGESTIONS.find((s) => s.question === text)
      setAnswer(match?.answer ?? FALLBACK_ANSWER)
    }, REPLY_DELAY_MS)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) ask(draft.trim())
  }

  const closeAnswer = () => {
    clearTimeout(timer.current)
    setQuestion('')
    setAnswer('')
  }

  return (
    <section aria-label="Ask Atlas">
      <form className="composer card" onSubmit={submit}>
        <span className="orb orb--large">
          <Sparkles size={20} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
        </span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Ask Atlas about your day..."
          aria-label="Ask Atlas about your day"
        />
        <button
          type="submit"
          className="send-button"
          aria-label="Send"
          disabled={!draft.trim()}
        >
          <ArrowUp size={18} strokeWidth={2.1} absoluteStrokeWidth aria-hidden />
        </button>
      </form>

      {question && (
        <div className="answer card" aria-live="polite">
          <div>
            <p className="answer-question">{question}</p>
            <p className="answer-text">{answer || 'Thinking...'}</p>
          </div>
          <button
            type="button"
            className="answer-close"
            aria-label="Close answer"
            onClick={closeAnswer}
          >
            <X size={16} strokeWidth={1.75} absoluteStrokeWidth aria-hidden />
          </button>
        </div>
      )}

      <div className="suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.question}
            type="button"
            className="suggestion"
            onClick={() => ask(suggestion.question)}
          >
            {suggestion.question}
          </button>
        ))}
      </div>
    </section>
  )
}
