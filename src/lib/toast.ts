type Listener = (msg: string) => void

let listener: Listener | null = null

export function toast(msg: string) {
  listener?.(msg)
}

export function subscribeToast(fn: Listener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}