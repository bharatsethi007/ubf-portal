import { useEffect, useRef, useState } from 'react'

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error'

export type AutosaveTask = {
  /** Stable identifier for this saveable group. */
  key: string
  /** Whether this group has unsaved changes right now. */
  dirty: boolean
  /** Content fingerprint — changes on every edit so the debounce resets per keystroke. */
  signature: string
  /** Persists this group. Must reset its own dirty source (snapshot initial) on success. */
  save: () => Promise<void>
}

/**
 * Debounced autosave for one or more independently-saveable groups.
 *
 * Each task debounces on its own `signature`: while the user keeps editing, the
 * signature keeps changing and the timer keeps resetting; `delay` ms after the
 * last edit, `save()` fires. A successful save is expected to flip the task's
 * `dirty` back to false (by snapshotting the new initial), so no re-save loops.
 * On failure the task stays dirty and retries on the next edit.
 */
export function useDebouncedAutosave(tasks: AutosaveTask[], delay = 800): AutosaveState {
  const [state, setState] = useState<AutosaveState>('idle')
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const inFlight = useRef<Set<string>>(new Set())
  // Always call the freshest closures without making them an effect dependency.
  const latest = useRef<AutosaveTask[]>(tasks)
  latest.current = tasks

  // Re-run the scheduler whenever a dirty task's content changes.
  const dep = tasks
    .map((t) => (t.dirty ? `${t.key}:${t.signature}` : `${t.key}:clean`))
    .join('~')

  useEffect(() => {
    for (const t of tasks) {
      const timer = timers.current[t.key]
      if (t.dirty) {
        if (inFlight.current.has(t.key)) continue
        if (timer) clearTimeout(timer)
        timers.current[t.key] = setTimeout(() => {
          const task = latest.current.find((x) => x.key === t.key)
          if (!task || !task.dirty) return
          inFlight.current.add(t.key)
          setState('saving')
          task
            .save()
            .then(() => {
              if (inFlight.current.size <= 1) setState('saved')
            })
            .catch(() => setState('error'))
            .finally(() => inFlight.current.delete(t.key))
        }, delay)
      } else if (timer) {
        clearTimeout(timer)
        delete timers.current[t.key]
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep, delay])

  // Flush all pending timers on unmount.
  useEffect(() => {
    const store = timers.current
    return () => {
      for (const k of Object.keys(store)) clearTimeout(store[k])
    }
  }, [])

  return state
}
