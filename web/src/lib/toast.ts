import { toast } from 'sonner';
import { ApiError } from '@/api/errors';

export function errorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export function toastError(e: unknown, fallback?: string) {
  toast.error(errorMessage(e, fallback));
}

export function toastSuccess(
  message: string,
  opts: { undo?: () => Promise<unknown> | unknown; undoLabel?: string } = {},
) {
  if (!opts.undo) {
    toast.success(message);
    return;
  }
  const undo = opts.undo;
  let used = false;
  toast.success(message, {
    duration: 8000,
    action: {
      label: opts.undoLabel ?? 'Undo',
      onClick: () => {
        if (used) return;
        used = true;
        void Promise.resolve()
          .then(undo)
          .catch((e) => toastError(e, 'Could not undo.'));
      },
    },
  });
}
