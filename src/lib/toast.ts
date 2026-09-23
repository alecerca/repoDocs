export type ToastAction = { label: string; onClick: () => void }

export type ToastMsg = {
  msg: string
  action?: ToastAction
  timeout?: number
}

type Listener = (t: ToastMsg) => void

let listener: Listener | null = null

export function toast(msg: string | ToastMsg) {
  listener?.(typeof msg === 'string' ? { msg } : msg)
}

export function subscribeToast(fn: Listener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}