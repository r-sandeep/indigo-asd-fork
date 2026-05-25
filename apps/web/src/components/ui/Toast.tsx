import { useToastStore, type Toast } from '@/stores/toastStore'
import { CheckIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from './Icons'

const STYLES = {
  success: {
    container: 'bg-white ring-green-200',
    icon:      'text-green-500',
    bar:       'bg-green-500',
    IconCmp:   CheckIcon,
  },
  error: {
    container: 'bg-white ring-red-200',
    icon:      'text-red-500',
    bar:       'bg-red-500',
    IconCmp:   ExclamationCircleIcon,
  },
  warning: {
    container: 'bg-white ring-amber-200',
    icon:      'text-amber-500',
    bar:       'bg-amber-400',
    IconCmp:   ExclamationCircleIcon,
  },
  info: {
    container: 'bg-white ring-brand-200',
    icon:      'text-brand-500',
    bar:       'bg-brand-500',
    IconCmp:   InformationCircleIcon,
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const s = STYLES[toast.type]

  return (
    <div
      className={`animate-slide-up pointer-events-auto relative w-80 overflow-hidden rounded-xl shadow-modal ring-1 ${s.container}`}
      role="alert"
    >
      {/* Colored top bar */}
      <div className={`h-0.5 w-full ${s.bar}`} />

      <div className="flex items-start gap-3 p-4">
        <s.IconCmp className={`mt-0.5 h-4 w-4 shrink-0 ${s.icon}`} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-sm text-gray-500">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => dismiss(toast.id)}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <XMarkIcon className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed bottom-6 right-4 z-50 flex flex-col-reverse items-end gap-2 lg:right-6"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
