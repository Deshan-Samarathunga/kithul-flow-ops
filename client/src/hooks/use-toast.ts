import { toast } from "react-hot-toast";

/**
 * Backwards-compatible shim that exposes the `react-hot-toast` helpers through the
 * former hook interface. Prefer importing `toast` directly, but legacy screens that
 * call `const toaster = useToast(); toaster.success("...")` will continue to work.
 */
export function useToast() {
  return toast;
}

export { toast };
