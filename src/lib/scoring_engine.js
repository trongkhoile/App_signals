// Trading signal scoring engine (schema v2)
// Replace with your own implementation — same exports expected by the dashboard.

/**
 * @typedef {Object} SignalPayload
 * @property {string} [symbol]
 * @property {number} [timestamp]
 * @property {{ rsi: number }} layer_2
 * @property {{ stoch_k: number, stoch_d: number }} layer_3
 * @property {{ flow: number, delta: number }} layer_4
 */

/**
 * Compute layer contributions (each 0..30) for a v2 payload.
 * @param {SignalPayload} p
 */
function layerContributions(p) {
  const rsi = clamp(p.layer_2?.rsi ?? 50, 0, 100);
  const k = clamp(p.layer_3?.stoch_k ?? 50, 0, 100);
  const d = clamp(p.layer_3?.stoch_d ?? 50, 0, 100);
  const flow = p.layer_4?.flow ?? 0;
  const delta = p.layer_4?.delta ?? 0;

  // L2: RSI distance from neutral (50) → strength of momentum signal (0..35)
  const l2 = (Math.abs(rsi - 50) / 50) * 35;

  // L3: Stochastic alignment + extremity (0..40) — STRONGEST confirmation!
  const stochAvg = (k + d) / 2;
  const aligned = 1 - Math.min(1, Math.abs(k - d) / 30); // 1 when k≈d
  const extreme = Math.abs(stochAvg - 50) / 50;
  const l3 = aligned * extreme * 40;

  // L4: order-flow + delta agreement (0..25) — less weight on noisy flows
  const flowNorm = clamp(flow, -1, 1);
  const deltaNorm = clamp(delta / 1000, -1, 1); // assume delta in contracts
  const agree = Math.sign(flowNorm) === Math.sign(deltaNorm) && flowNorm !== 0 ? 1 : 0.5;
  const l4 = ((Math.abs(flowNorm) + Math.abs(deltaNorm)) / 2) * agree * 25;

  // Directional bias: positive → BUY, negative → SELL
  const bias =
    Math.sign(rsi - 50) * 0.4 +
    Math.sign(stochAvg - 50) * 0.3 +
    Math.sign(flowNorm + deltaNorm) * 0.3;

  return {
    l2: round1(l2),
    l3: round1(l3),
    l4: round1(l4),
    bias, // -1..1
  };
}

/**
 * Main entry: compute the AI score and label from a v2 payload.
 * @param {SignalPayload} payload
 */
export function calculateAIScore(payload) {
  const { l2, l3, l4, bias } = layerContributions(payload);
  const ai_score = clamp(round1(l2 + l3 + l4), 0, 100);

  let label = "WAIT";
  let color_state = "neutral"; // 'buy' | 'sell' | 'neutral'

  if (ai_score >= 32) {
    if (bias > 0.15) {
      label = "BUY NOW";
      color_state = "buy";
    } else if (bias < -0.15) {
      label = "SELL NOW";
      color_state = "sell";
    }
  }

  return {
    symbol: payload.symbol ?? null,
    timestamp: payload.timestamp ?? Date.now(),
    ai_score,
    label,
    color_state,
    breakdown: { l2, l3, l4 },
    metrics: {
      rsi: payload.layer_2?.rsi ?? null,
      stoch_k: payload.layer_3?.stoch_k ?? null,
      stoch_d: payload.layer_3?.stoch_d ?? null,
      flow: payload.layer_4?.flow ?? null,
      delta: payload.layer_4?.delta ?? null,
    },
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function round1(v) {
  return Math.round(v * 10) / 10;
}
