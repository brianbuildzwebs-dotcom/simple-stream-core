import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getPlanChangeConfirmCopy } from '@/lib/plan-change';

export default function PlanChangeConfirmDialog({
  open,
  onOpenChange,
  tier,
  action,
  planLabel,
  plan,
  streamKeyCount = 0,
  onConfirm,
  loading = false,
}) {
  if (!tier || !action || action === 'current') return null;

  const copy = getPlanChangeConfirmCopy({
    action,
    tier,
    planLabel,
    plan,
    streamKeyCount,
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              onConfirm?.();
            }}
            className={copy.destructive ? 'bg-amber-600 hover:bg-amber-600/90' : undefined}
          >
            {loading ? 'Processing…' : copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}