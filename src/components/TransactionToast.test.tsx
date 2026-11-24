import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionToast, ToastContainer, type ToastOptions } from './TransactionToast';

function makeToast(overrides: Partial<ToastOptions> = {}): ToastOptions {
  return {
    id: 'toast-1',
    status: 'success',
    title: 'Transaction confirmed',
    ...overrides,
  };
}

describe('TransactionToast', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('accessibility and status rendering', () => {
    it('renders role="alert" with aria-live="assertive" for error status', () => {
      const onClose = vi.fn();
      render(
        <TransactionToast
          toast={makeToast({ status: 'error', title: 'Transaction failed', message: 'Insufficient funds' })}
          onClose={onClose}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
      expect(alert).toHaveClass('toast', 'toast-error');
      expect(screen.getByText('Transaction failed')).toBeInTheDocument();
      expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
    });

    it.each(['pending', 'success'] as const)(
      'renders role="alert" with aria-live="polite" for %s status',
      (status) => {
        const onClose = vi.fn();
        render(
          <TransactionToast
            toast={makeToast({ status, title: 'Status: ' + status })}
            onClose={onClose}
          />
        );

        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'polite');
        expect(alert).toHaveClass('toast', 'toast-' + status);
      }
    );

    it.each([
      ['pending', 'toast-icon-pending'],
      ['success', 'toast-icon-success'],
      ['error', 'toast-icon-error'],
    ] as const)('renders %s icon class for %s status', (status, expectedIconClass) => {
      const onClose = vi.fn();
      const { container } = render(
        <TransactionToast toast={makeToast({ status })} onClose={onClose} />
      );

      const icon = container.querySelector('.toast-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass(expectedIconClass);
    });

    it('omits message element when message is not provided', () => {
      const onClose = vi.fn();
      const { container } = render(
        <TransactionToast toast={makeToast({ message: undefined })} onClose={onClose} />
      );

      expect(container.querySelector('.toast-message')).not.toBeInTheDocument();
    });
  });

  describe('auto-close behavior', () => {
    it('auto-closes success toast and calls onClose(id) after timeout and exit animation', () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      render(
        <TransactionToast
          toast={makeToast({ id: 'success-1', status: 'success' })}
          onClose={onClose}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).not.toHaveClass('removing');

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(alert).not.toHaveClass('removing');
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(alert).toHaveClass('removing');
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('success-1');
    });

    it('auto-closes error toast and calls onClose(id) after timeout and exit animation', () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      render(
        <TransactionToast
          toast={makeToast({ id: 'error-1', status: 'error' })}
          onClose={onClose}
        />
      );

      act(() => {
        vi.advanceTimersByTime(5300);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('error-1');
    });

    it('does not auto-close pending toast', () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      render(
        <TransactionToast
          toast={makeToast({ id: 'pending-1', status: 'pending' })}
          onClose={onClose}
        />
      );

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.getByRole('alert')).not.toHaveClass('removing');
      expect(onClose).not.toHaveBeenCalled();
    });

    it.each(['success', 'error'] as const)(
      'does not auto-close %s toast when autoClose is false',
      (status) => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(
          <TransactionToast
            toast={makeToast({ id: status + '-manual', status, autoClose: false })}
            onClose={onClose}
          />
        );

        act(() => {
          vi.advanceTimersByTime(10000);
        });

        expect(screen.getByRole('alert')).not.toHaveClass('removing');
        expect(onClose).not.toHaveBeenCalled();
      }
    );
  });

  describe('manual close button', () => {
    it('adds removing class on click and calls onClose(id) after 300ms', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onClose = vi.fn();

      render(
        <TransactionToast
          toast={makeToast({ id: 'manual-1', status: 'pending' })}
          onClose={onClose}
        />
      );

      const alert = screen.getByRole('alert');
      const closeButton = screen.getByRole('button', { name: 'Close notification' });

      await user.click(closeButton);

      expect(alert).toHaveClass('removing');
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('manual-1');
    });
  });

  describe('action button', () => {
    it('renders toast-action-danger for error status and calls onAction', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onAction = vi.fn();

      render(
        <TransactionToast
          toast={makeToast({
            status: 'error',
            actionText: 'Retry',
            onAction,
          })}
          onClose={onClose}
        />
      );

      const actionBtn = screen.getByRole('button', { name: 'Retry' });
      expect(actionBtn).toHaveClass('toast-action-btn', 'toast-action-danger');
      expect(actionBtn).not.toHaveClass('toast-action-primary');

      await user.click(actionBtn);
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it.each(['pending', 'success'] as const)(
      'renders toast-action-primary for %s status and calls onAction',
      async (status) => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onAction = vi.fn();

        render(
          <TransactionToast
            toast={makeToast({
              status,
              actionText: 'View details',
              onAction,
            })}
            onClose={onClose}
          />
        );

        const actionBtn = screen.getByRole('button', { name: 'View details' });
        expect(actionBtn).toHaveClass('toast-action-btn', 'toast-action-primary');
        expect(actionBtn).not.toHaveClass('toast-action-danger');

        await user.click(actionBtn);
        expect(onAction).toHaveBeenCalledTimes(1);
      }
    );

    it('does not render action button when actionText or onAction is missing', () => {
      const onClose = vi.fn();
      render(
        <TransactionToast
          toast={makeToast({ actionText: 'View details', onAction: undefined })}
          onClose={onClose}
        />
      );

      expect(screen.queryByRole('button', { name: 'View details' })).not.toBeInTheDocument();
    });
  });
});

describe('ToastContainer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders one toast per entry and forwards removeToast', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const removeToast = vi.fn();
    const toasts: ToastOptions[] = [
      makeToast({ id: 't-1', status: 'pending', title: 'Submitting payment' }),
      makeToast({ id: 't-2', status: 'success', title: 'Payment received', autoClose: false }),
      makeToast({ id: 't-3', status: 'error', title: 'Network error', autoClose: false }),
    ];

    render(<ToastContainer toasts={toasts} removeToast={removeToast} />);

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(3);
    expect(screen.getByText('Submitting payment')).toBeInTheDocument();
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();

    const closeButtons = screen.getAllByRole('button', { name: 'Close notification' });
    await user.click(closeButtons[1]);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(removeToast).toHaveBeenCalledTimes(1);
    expect(removeToast).toHaveBeenCalledWith('t-2');
  });
});
