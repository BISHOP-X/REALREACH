import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { db, friendlyError, SUPABASE_URL } from "./client";
import { useAuth } from "./AuthContext";
import type { WorkspaceData } from "./marketplace.types";

const publicKey =
  (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
    .VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
export async function marketplaceRequest<T>(
  action: string,
  payload: Record<string, unknown> = {},
  signal?: AbortSignal,
  expectedUserId?: string,
): Promise<T> {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
    : AbortSignal.timeout(30_000);
  requestSignal.throwIfAborted();
  const { data: { session } } = await db().auth.getSession();
  if (!session) throw new Error("Please sign in to continue.");
  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new Error("Your account changed. Open this page again.");
  }
  requestSignal.throwIfAborted();
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/realreach-marketplace`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publicKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ...payload, action }),
      signal: requestSignal,
    },
  );
  const result = await response.json().catch(() => null);
  requestSignal.throwIfAborted();
  const { data: { session: currentSession } } = await db().auth.getSession();
  if (currentSession?.user.id !== session.user.id) {
    throw new Error("Your account changed. Open this page again.");
  }
  requestSignal.throwIfAborted();
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Your session expired. Please sign in again.");
    }
    throw new Error(
      result?.error || "We couldn’t complete that request. Please try again.",
    );
  }
  return result as T;
}

type MarketContext = {
  data: WorkspaceData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  act: <T = { id: string }>(
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<T>;
};
const Context = createContext<MarketContext | null>(null);
export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const owner = user && !authLoading && profile && (profile.account_type || isAdmin)
    ? `${user.id}:${profile.account_type ?? "admin"}:${isAdmin}`
    : null;
  const [view, setView] = useState<{owner:string|null;data:WorkspaceData|null;loading:boolean;error:string}>(
    {owner:null,data:null,loading:false,error:""},
  );
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const workspaceController = useRef<AbortController | null>(null);
  const mutations = useRef(new Set<AbortController>());
  const refresh = useCallback(() => {
    if (!owner || !user) return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const current = generation.current;
    const controller = new AbortController();
    workspaceController.current = controller;
    setView(previous=>({owner,data:previous.owner===owner?previous.data:null,loading:true,error:""}));
    const pending = marketplaceRequest<WorkspaceData>("workspace",{},controller.signal,user.id).then(
      (result) => {
        if (generation.current === current) {
          setView({owner,data:result,loading:false,error:""});
        }
      },
    ).catch((err) => {
      if (generation.current === current && !controller.signal.aborted) {
        setView(previous=>({...previous,error:friendlyError(err)}));
      }
    }).finally(() => {
      if (generation.current === current) {
        setView(previous=>({...previous,loading:false}));
        inFlight.current = null;
        workspaceController.current = null;
      }
    });
    inFlight.current = pending;
    return pending;
  }, [user?.id, owner]);
  useEffect(() => {
    generation.current += 1;
    inFlight.current = null;
    setView({owner,data:null,loading:!!owner,error:""});
    if (owner) void refresh();
    return () => {
      generation.current += 1;
      workspaceController.current?.abort();
      for (const controller of mutations.current) controller.abort();
      mutations.current.clear();
    };
  }, [owner, refresh]);
  useEffect(() => {
    if (!user) return;
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [user?.id, refresh]);
  const act = useCallback(
    async <T,>(
      action: string,
      payload: Record<string, unknown> = {},
    ): Promise<T> => {
      if (!owner || !user) throw new Error("Please sign in to continue.");
      const current = generation.current;
      const controller = new AbortController();
      mutations.current.add(controller);
      const assertCurrent = () => {
        if (controller.signal.aborted || current !== generation.current) {
          throw new Error("Your account changed. Open this page again.");
        }
      };
      try {
        const result = await marketplaceRequest<T>(action,payload,controller.signal,user.id);
        assertCurrent();
        // Wait for a pre-mutation read, then replace it with the saved state.
        await inFlight.current;
        assertCurrent();
        // A refresh outage does not reinterpret a saved operation as failed.
        await refresh();
        assertCurrent();
        return result;
      } finally {
        mutations.current.delete(controller);
      }
    },
    [refresh, owner, user?.id],
  );
  // Never expose a previous owner's snapshot while effect cleanup is pending.
  const currentView = owner && view.owner === owner
    ? view
    : {data:null,loading:!!owner,error:""};
  return (
    <Context.Provider value={{ ...currentView, refresh, act }}>
      {children}
    </Context.Provider>
  );
}
export function useMarketplace() {
  const context = useContext(Context);
  if (!context) throw new Error("MarketplaceProvider required");
  return context;
}
