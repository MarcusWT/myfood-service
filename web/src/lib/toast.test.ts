import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { errorMessage, toastError, toastSuccess } from './toast';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

describe('toast helpers', () => {
  it('errorMessage prefers ApiError/Error messages, else fallback', () => {
    expect(errorMessage(new ApiError(500, 'boom', []))).toBe('boom');
    expect(errorMessage(new Error('x'))).toBe('x');
    expect(errorMessage('weird', 'fb')).toBe('fb');
    expect(errorMessage(null)).toBe('Something went wrong.');
  });

  it('toastError forwards the message', () => {
    toastError(new Error('nope'));
    expect(toast.error).toHaveBeenCalledWith('nope');
  });

  it('toastSuccess without undo has no action', () => {
    toastSuccess('Done');
    expect(toast.success).toHaveBeenCalledWith('Done');
  });

  it('undo runs once even if clicked twice', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    toastSuccess('Done', { undo });
    const opts = vi.mocked(toast.success).mock.calls[0]![1] as unknown as {
      action: { onClick: () => void };
    };
    opts.action.onClick();
    opts.action.onClick();
    await vi.waitFor(() => expect(undo).toHaveBeenCalled());
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('toastSuccess with undo adds an Undo action; failure toasts an error', async () => {
    const undo = vi.fn().mockRejectedValue(new Error('fail'));
    toastSuccess('Done', { undo });
    const opts = vi.mocked(toast.success).mock.calls[0]![1] as {
      duration: number;
      action: { label: string; onClick: () => void };
    };
    expect(opts.action.label).toBe('Undo');
    expect(opts.duration).toBe(8000);
    opts.action.onClick();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('fail'));
    expect(undo).toHaveBeenCalled();
  });
});
