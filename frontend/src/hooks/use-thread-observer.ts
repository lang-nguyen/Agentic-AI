import { useEffect, useRef } from "react";
import { useStreamContext } from "@/providers/Stream";

export function useThreadObserver(threadId: string | null) {
  const stream = useStreamContext();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!threadId) return;

    // Reset tracking for new thread
    activeRunIdRef.current = null;

    const checkAndJoinActiveRun = async () => {
      // If the stream is already loading, do not initiate another join
      if (stream.isLoading) return;

      try {
        // List runs on the current thread
        const runs = await stream.client.runs.list(threadId, {
          limit: 10,
        });

        // Find runs that are active (running or pending)
        const activeRun = runs.find(
          (run) => run.status === "running" || run.status === "pending"
        );

        if (activeRun && activeRun.run_id !== activeRunIdRef.current) {
          activeRunIdRef.current = activeRun.run_id;
          console.log(`[Observer] Active run detected: ${activeRun.run_id}. Joining stream...`);
          await stream.joinStream(activeRun.run_id);
        } else if (!activeRun) {
          // Reset the run ID tracking if there is no active run
          activeRunIdRef.current = null;
        }
      } catch (err) {
        console.error("[Observer] Error checking active runs:", err);
      }
    };

    // Check immediately on mount/threadId change
    checkAndJoinActiveRun();

    // Poll every 3 seconds for new runs
    pollIntervalRef.current = setInterval(checkAndJoinActiveRun, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [threadId, stream.isLoading, stream.client]);

  return stream;
}
