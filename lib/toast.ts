export type ToastVariant = "success" | "error" | "info";

export type ToastPayload = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastListener = (payload: ToastPayload) => void;

const listeners = new Set<ToastListener>();

export const toast = {
  show: (payload: ToastPayload) => {
    listeners.forEach((listener) => listener(payload));
  },
  success: (message: string, durationMs?: number) =>
    toast.show({ message, variant: "success", durationMs }),
  error: (message: string, durationMs?: number) =>
    toast.show({ message, variant: "error", durationMs }),
  info: (message: string, durationMs?: number) =>
    toast.show({ message, variant: "info", durationMs }),
};

export const subscribeToasts = (listener: ToastListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
