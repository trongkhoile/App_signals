export interface SignalPayload {
  symbol?: string;
  timestamp?: number;
  layer_2: { rsi: number };
  layer_3: { stoch_k: number; stoch_d: number };
  layer_4: { flow: number; delta: number };
}
export interface ScoredSignal {
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
}
export function calculateAIScore(payload: any): ScoredSignal;
