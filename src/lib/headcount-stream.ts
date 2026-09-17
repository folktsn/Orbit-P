import { readCompanyHeadcount } from "@/lib/company-headcount";
import { subscribeToEmployeeChanges } from "@/lib/employeesCache";

export function createHeadcountStream(signal: AbortSignal) {
  const encoder = new TextEncoder();
  let stop = () => {};
  let cleanup = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let refreshing = false;
      let debounce: ReturnType<typeof setTimeout> | undefined;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const refresh = async () => {
        if (closed || refreshing) return;
        refreshing = true;
        try { send("headcount", await readCompanyHeadcount()); }
        catch { send("unavailable", {}); }
        finally { refreshing = false; }
      };
      const unsubscribe = subscribeToEmployeeChanges(() => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { void refresh(); }, 150);
      });
      // Also detect imports, other server processes and Bangkok date changes.
      const interval = setInterval(() => { void refresh(); }, 15_000);
      // Reconnect regularly so the next request rechecks session and page access.
      const expiry = setTimeout(() => { send("reconnect", {}); stop(); }, 55_000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(interval);
        clearTimeout(expiry);
        clearTimeout(debounce);
        signal.removeEventListener("abort", stop);
      };
      stop = () => { if (!closed) { cleanup(); controller.close(); } };
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) { stop(); return; }
      controller.enqueue(encoder.encode("retry: 3000\n: connected\n\n"));
      void refresh();
    },
    cancel() { cleanup(); },
  });
}
