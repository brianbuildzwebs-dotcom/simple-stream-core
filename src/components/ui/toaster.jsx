import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      <ToastViewport>
        {toasts
          .filter((toast) => toast.open !== false)
          .map(({ id, title, description, action, ...props }) => (
            <Toast key={id} {...props}>
              <div className="grid gap-1 pr-6">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
              {action}
              <ToastClose
                type="button"
                aria-label="Dismiss notification"
                className="opacity-100"
                onClick={() => dismiss(id)}
              />
            </Toast>
          ))}
      </ToastViewport>
    </ToastProvider>
  );
} 