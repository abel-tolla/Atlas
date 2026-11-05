import { Check } from 'lucide-react'
import { TASKS, type Task } from '../data'

interface TasksDueProps {
  done: string[]
  onToggle: (id: string) => void
}

export function TasksDue({ done, onToggle }: TasksDueProps) {
  const remaining = TASKS.length - done.length

  return (
    <section className="tasks card" aria-labelledby="tasks-heading">
      <div className="card-head">
        <h2 id="tasks-heading">Tasks due</h2>
        <span className="tasks-count">{remaining}</span>
      </div>
      <ul>
        {TASKS.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            done={done.includes(task.id)}
            onToggle={() => onToggle(task.id)}
          />
        ))}
      </ul>
    </section>
  )
}

interface TaskRowProps {
  task: Task
  done: boolean
  onToggle: () => void
}

function TaskRow({ task, done, onToggle }: TaskRowProps) {
  const { tag } = task

  return (
    <li className={done ? 'task task--done' : 'task'}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={task.title}
        className="task-check"
        onClick={onToggle}
      >
        {done && <Check size={12} strokeWidth={2.5} absoluteStrokeWidth aria-hidden />}
      </button>
      <div className="task-body">
        <div className="task-text">
          <p className="task-title">{task.title}</p>
          <p className="task-meta">{task.meta}</p>
        </div>
        <span
          className="tag"
          data-source={tag.kind === 'source' ? tag.source : undefined}
          data-important={tag.kind === 'important' || undefined}
        >
          {tag.label}
        </span>
      </div>
    </li>
  )
}
