// In-memory latest-signal store (single Worker instance demo).
export type LockedTpsl = { sl: number; tp1: number; tp2: number };

export type Signal = {
  symbol: string | null;
  timestamp: number;
  ai_score: number;
  label: "BUY NOW" | "SELL NOW" | "WAIT";
  color_state: "buy" | "sell" | "neutral";
  breakdown: { l2: number; l3: number; l4: number };
  metrics: {
    rsi: number | null;
    stoch_k: number | null;
    stoch_d: number | null;
    flow: number | null;
    delta: number | null;
  };
  price?: { current: number; bid?: number; ask?: number; spread?: number };
  // Layer 1 EMA trend information – will be populated per‑timeframe
  layer_1_trend?: {
    trend_direction: "UP" | "DOWN" | "SIDEWAYS";
    ema_fast_value: number;
    ema_mid_value: number;
    ema_slow_value: number;
    allowed_side: "BUY" | "SELL";
  };
  execution_timeframe?: string;
  // Locked at the first tick of a signal; cleared when signal becomes WAIT
  lockedTpsl?: LockedTpsl | null;
};

const SL_DIST  = 5.0;
const TP1_DIST = 5.0;
const TP2_DIST = 10.0;

let latestSignals: Map<string, Signal> = new Map();

export function setLatestSignal(s: Signal) {
  const key = `${s.symbol ?? "UNKNOWN"}:${s.execution_timeframe ?? "M15"}`;
  const prev = latestSignals.get(key);
  const isActive = s.label === "BUY NOW" || s.label === "SELL NOW";

  let lockedTpsl: LockedTpsl | null | undefined = undefined;

  if (!isActive) {
    // Signal became WAIT — clear the lock
    lockedTpsl = null;
  } else if (prev?.lockedTpsl) {
    // Signal still active — keep the original lock unchanged
    lockedTpsl = prev.lockedTpsl;
  } else {
    // First tick of a new active signal — lock TP/SL from entry price
    const entry = s.price?.current;
    if (entry) {
      const direction = s.label === "BUY NOW" ? "BUY" : "SELL";
      lockedTpsl = direction === "BUY"
        ? { sl: entry - SL_DIST, tp1: entry + TP1_DIST, tp2: entry + TP2_DIST }
        : { sl: entry + SL_DIST, tp1: entry - TP1_DIST, tp2: entry - TP2_DIST };
    }
  }

  latestSignals.set(key, { ...s, lockedTpsl });
}

export function getLatestSignal(symbol: string, timeframe?: string): Signal | null {
  if (timeframe) {
    const key = `${symbol}:${timeframe}`;
    return latestSignals.get(key) ?? null;
  }
  // Fallback: return any signal for this symbol (backward compatibility)
  for (const [key, value] of latestSignals.entries()) {
    if (key.startsWith(symbol + ":")) {
      return value;
    }
  }
  return null;
}
