// In-memory latest-signal store with ATR-based dynamic TP/SL
import ATRBasedTPSL from './atr-based-tpsl';
import { sendSignalAlert } from './telegram.server';

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
  lockedEntry?: number | null;
};

// Fallback for legacy code (rarely used now)
const SL_DIST_LEGACY  = 5.0;
const TP1_DIST_LEGACY = 5.0;
const TP2_DIST_LEGACY = 10.0;

// ATR-based TP/SL calculator
const tpslCalculator = new ATRBasedTPSL();

let latestSignals: Map<string, Signal> = new Map();

// ATR as % of price per timeframe — calibrated to BTC: M15≈200, H1≈250, H4≈300 at $65k
const ATR_PCT: Record<string, number> = {
  M15: 0.003,   // BTC@65k → ~195
  H1:  0.0038,  // BTC@65k → ~247
  H4:  0.0046,  // BTC@65k → ~299
};

function estimateATRFromMetrics(_metrics: Signal['metrics'], _symbol: string, price: number, timeframe: string): number {
  const pct = ATR_PCT[timeframe.toUpperCase()] ?? 0.0038;
  return price * pct;
}

export function setLatestSignal(s: Signal) {
  const key = `${s.symbol ?? "UNKNOWN"}:${s.execution_timeframe ?? "M15"}`;
  const prev = latestSignals.get(key);
  const isActive = s.label === "BUY NOW" || s.label === "SELL NOW";

  let lockedTpsl: LockedTpsl | null | undefined = undefined;
  let lockedEntry: number | null | undefined = undefined;

  if (!isActive) {
    // Signal became WAIT — clear the lock
    lockedTpsl = null;
    lockedEntry = null;
  } else if (prev?.lockedTpsl && prev?.lockedEntry != null) {
    // Signal still active — keep the original lock unchanged
    lockedTpsl = prev.lockedTpsl;
    lockedEntry = prev.lockedEntry;
  } else {
    // First tick of a new active signal — lock entry + TP/SL
    const entry = s.price?.current;
    if (entry) {
      const direction = s.label === "BUY NOW" ? "BUY" : "SELL";
      const symbol = s.symbol ?? "BTCUSDT";
      const timeframe = s.execution_timeframe ?? "H1";

      lockedEntry = entry;

      const atr = estimateATRFromMetrics(s.metrics, symbol, entry, timeframe);
      const tpslResult = tpslCalculator.calculateTPSL(entry, atr, timeframe, symbol, direction);

      lockedTpsl = {
        sl: tpslResult.sl,
        tp1: tpslResult.tp1,
        tp2: tpslResult.tp2
      };

      // Fire-and-forget Telegram alert on first tick of new signal (skip M5)
      if (timeframe !== "M5") sendSignalAlert(s, entry, lockedTpsl);
    }
  }

  latestSignals.set(key, { ...s, lockedEntry, lockedTpsl });
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
