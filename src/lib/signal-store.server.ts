// In-memory latest-signal store with ATR-based dynamic TP/SL
import ATRBasedTPSL from './atr-based-tpsl';

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

// Fallback for legacy code (rarely used now)
const SL_DIST_LEGACY  = 5.0;
const TP1_DIST_LEGACY = 5.0;
const TP2_DIST_LEGACY = 10.0;

// ATR-based TP/SL calculator
const tpslCalculator = new ATRBasedTPSL();

let latestSignals: Map<string, Signal> = new Map();

/**
 * Estimate ATR from signal metrics (simplified)
 * In production, fetch from klines data
 */
function estimateATRFromMetrics(metrics: Signal['metrics'], symbol: string): number {
  // Fallback ATR estimates by symbol
  const defaultATRs: Record<string, number> = {
    BTCUSDT: 250,
    ETHUSDT: 200,
    BNBUSDT: 100,
    XAUUSD: 12,
    EURUSD: 80,
    GBPUSD: 100,
  };

  // TODO: In production, calculate real ATR from klines
  // For now, return a reasonable estimate
  return defaultATRs[symbol] || 150;
}

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
    // First tick of a new active signal — lock TP/SL using ATR-based calculation
    const entry = s.price?.current;
    if (entry) {
      const direction = s.label === "BUY NOW" ? "BUY" : "SELL";
      const symbol = s.symbol ?? "BTCUSDT";
      const timeframe = s.execution_timeframe ?? "H1";

      // Estimate ATR (TODO: get from actual klines)
      const atr = estimateATRFromMetrics(s.metrics, symbol);

      // Calculate optimal TP/SL using ATR-based ratios
      const tpslResult = tpslCalculator.calculateTPSL(entry, atr, timeframe, symbol, direction);

      lockedTpsl = {
        sl: tpslResult.sl,
        tp1: tpslResult.tp1,
        tp2: tpslResult.tp2
      };
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
