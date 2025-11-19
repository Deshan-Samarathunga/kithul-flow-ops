/**
 * Legacy exports removed in favor of `react-hot-toast` based notifications.
 *
 * This module intentionally throws when imported to make any lingering
 * dependencies obvious at build time.
 */
const moduleName = "@/components/ui/toast";

const unsupported = () => {
  throw new Error(`${moduleName} has been removed. Use react-hot-toast instead.`);
};

export const Toast = unsupported;
export const ToastProvider = unsupported;
export const ToastViewport = unsupported;
export const ToastClose = unsupported;
export const ToastTitle = unsupported;
export const ToastDescription = unsupported;
export const ToastAction = unsupported;
