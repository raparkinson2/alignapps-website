import { differenceInDays, parseISO } from 'date-fns';

// Helper to calculate correct payment status from actual payment amounts
export const calculatePaymentStatus = (paidAmount: number | undefined, periodAmount: number): 'paid' | 'partial' | 'unpaid' => {
  const paid = paidAmount ?? 0;
  if (paid >= periodAmount) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
};

// Helper to get due date color based on urgency
export const getDueDateColor = (dueDate: string, allPaid: boolean): { text: string; hex: string } => {
  if (allPaid) {
    return { text: 'text-green-400', hex: '#4ade80' };
  }

  const now = new Date();
  const due = parseISO(dueDate);
  const daysUntilDue = differenceInDays(due, now);

  if (daysUntilDue <= 0) {
    // Past due or due today
    return { text: 'text-red-500', hex: '#ef4444' };
  } else if (daysUntilDue < 15) {
    return { text: 'text-red-500', hex: '#ef4444' };
  } else if (daysUntilDue < 30) {
    return { text: 'text-orange-500', hex: '#f97316' };
  } else if (daysUntilDue < 45) {
    return { text: 'text-yellow-500', hex: '#eab308' };
  }
  return { text: 'text-slate-400', hex: '#94a3b8' };
};
