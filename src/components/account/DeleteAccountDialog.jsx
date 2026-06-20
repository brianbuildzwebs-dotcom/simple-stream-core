import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

const CONFIRM_PHRASE = 'DELETE';

export default function DeleteAccountDialog({
  open,
  onOpenChange,
  userEmail,
  onConfirm,
  loading = false,
}) {
  const [confirmPhrase, setConfirmPhrase] = useState('');

  useEffect(() => {
    if (!open) {
      setConfirmPhrase('');
    }
  }, [open]);

  const canConfirm = confirmPhrase.trim().toUpperCase() === CONFIRM_PHRASE;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This removes your Simple Streamz account and deletes your profile, subscription,
                stream keys, embeds, and billing access tied to{' '}
                <strong className="text-foreground">{userEmail}</strong>.
              </p>
              <p>
                Active Stripe subscriptions are canceled immediately. Cloudflare stream inputs
                created for your keys are removed. This cannot be undone.
              </p>
              <p>
                Type <strong className="text-foreground">{CONFIRM_PHRASE}</strong> below to
                confirm.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Input
          value={confirmPhrase}
          onChange={(event) => setConfirmPhrase(event.target.value)}
          placeholder={CONFIRM_PHRASE}
          autoComplete="off"
          disabled={loading}
          className="font-mono"
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep my account</AlertDialogCancel>
          <button
            type="button"
            disabled={!canConfirm || loading}
            onClick={() => onConfirm?.(confirmPhrase.trim().toUpperCase())}
            className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete my account'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}