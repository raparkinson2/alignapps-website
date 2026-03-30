type ToastType = 'error' | 'success' | 'info';
type ShowFn = (message: string, type?: ToastType) => void;

let _showFn: ShowFn | null = null;

export const toast = {
  register(fn: ShowFn) {
    _showFn = fn;
  },
  show(message: string, type: ToastType = 'info') {
    _showFn?.(message, type);
  },
  error(message: string) {
    _showFn?.(message, 'error');
  },
  success(message: string) {
    _showFn?.(message, 'success');
  },
};
