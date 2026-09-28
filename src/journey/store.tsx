import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  initialState,
  transition,
  type Command,
  type DemoState,
} from "./model";

const KEY = "realreach-instagram-preview-v1";
type Store = {
  state: DemoState;
  send: (command: Command) => boolean;
  toast: (message: string) => void;
  message: string;
  storageError: boolean;
};
const Context = createContext<Store | null>(null);
export function ProductProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved.version === 1 &&
          Array.isArray(saved.campaigns) &&
          Array.isArray(saved.assignments) &&
          Array.isArray(saved.money)
        )
          return saved;
      }
    } catch {
      /* An unreadable demo is replaced without affecting the previous prototype. */
    }
    return initialState();
  });
  const current = useRef(state);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const send = useCallback((command: Command) => {
    try {
      const next = transition(current.current, command);
      current.current = next;
      setState(next);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "That action could not be completed.",
      );
      return false;
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== KEY || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue) as DemoState;
        if (
          next.version !== 1 ||
          !Array.isArray(next.campaigns) ||
          !Array.isArray(next.assignments)
        )
          return;
        current.current = next;
        setState(next);
      } catch {
        /* Ignore incomplete writes from another preview tab. */
      }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const next = transition(current.current, {
        type: "tick",
        now: Date.now(),
      });
      current.current = next;
      setState(next);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Context.Provider
      value={{ state, send, toast: setMessage, message, storageError }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("ProductProvider is required");
  return value;
}
