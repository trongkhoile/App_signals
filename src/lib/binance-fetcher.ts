import { calculateAIScore } from "./scoring_engine";
import { setLatestSignal } from "./signal-store.server.js";

// Use data-api.binance.vision as it is less likely to block Vercel/AWS IPs
const BINANCE_API_BASE = "https://data-api.binance.vision";

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<Kline[]> {
  const url = `${BINANCE_API_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.map((d: any[]) => ({
    openTime: d[0],
    open: d[1],
    high: d[2],
    low: d[3],
    close: d[4],
    volume: d[5],
    closeTime: d[6],
    quoteAssetVolume: d[7],
    numberOfTrades: d[8],
    takerBuyBaseAssetVolume: d[9],
    takerBuyQuoteAssetVolume: d[10],
  }));
}

export function calculateRSI(closes: number[], period: number = 14): number {
  const validCloses = closes.filter((value) => Number.isFinite(value));

  if (validCloses.length < period + 1) {
    return 50; // Not enough data
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Seed RSI with the SMA of the first `period` price changes.
  for (let i = 1; i <= period; i++) {
    const change = validCloses[i] - validCloses[i - 1];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss -= change;
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Wilder smoothing, matching the standard RSI used by MT5/TradingView.
  for (let i = period + 1; i < validCloses.length; i++) {
    const change = validCloses[i] - validCloses[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100;
  }

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateStochastic(
  klines: { high: number; low: number; close: number }[],
  period: number = 14
): { k: number; d: number } {
  if (klines.length < period) {
    return { k: 50, d: 50 }; // Not enough data
  }

  const closes = klines.map((k) => k.close);
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);

  const lastClose = closes[closes.length - 1];
  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));

  const k = ((lastClose - lowestLow) / (highestHigh - lowestLow)) * 100;

  let sumK = 0;
  let count = 0;
  for (let i = Math.max(0, klines.length - 3); i < klines.length; i++) {
      const h = Math.max(...highs.slice(Math.max(0, i - period + 1), i + 1));
      const l = Math.min(...lows.slice(Math.max(0, i - period + 1), i + 1));
      if (h !== l) {
          sumK += ((closes[i] - l) / (h - l)) * 100;
      } else {
          sumK += 50; // Avoid division by zero
      }
      count++;
  }
  const d = count > 0 ? sumK / count : 50;

  return { k, d };
}

export interface KlineInput {
  openTime: number;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
  closeTime?: number;
}

export async function updateSignalFromKlines(symbol: string, timeframe: string, klines: KlineInput[]) {
  const orderedKlines = [...klines].sort((a, b) => Number(a.openTime) - Number(b.openTime));

  const closes = orderedKlines.map((k) => parseFloat(String(k.close)));
  const highs = orderedKlines.map((k) => parseFloat(String(k.high)));
  const lows = orderedKlines.map((k) => parseFloat(String(k.low)));
  const volumes = orderedKlines.map((k) => parseFloat(String(k.volume)));

  const calculateEMA = (data: number[], period: number): number => {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    // If fewer bars than period, seed EMA with SMA of available data
    const seedLen = Math.min(period, data.length);
    let ema = data.slice(0, seedLen).reduce((sum, v) => sum + v, 0) / seedLen;
    for (let i = seedLen; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const emaFast = calculateEMA(closes, 21);
  const emaMid = calculateEMA(closes, 50);
  const emaSlow = calculateEMA(closes, 200);

  const latestClose = closes[closes.length - 1];
  const trendDirection: "UP" | "DOWN" | "SIDEWAYS" = latestClose > emaSlow ? "UP" : latestClose < emaSlow ? "DOWN" : "SIDEWAYS";
  const allowedSide: "BUY" | "SELL" = latestClose > emaFast ? "BUY" : "SELL";

  const rsi = calculateRSI(closes);
  const { k: stochK, d: stochD } = calculateStochastic(
    orderedKlines.map((k) => ({
      high: parseFloat(String(k.high)),
      low: parseFloat(String(k.low)),
      close: parseFloat(String(k.close)),
    }))
  );

  const flow = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
  const delta = volumes[volumes.length - 1] - volumes[volumes.length - 2];

  const payload = {
    symbol,
    timestamp: Date.now(),
    execution_timeframe: timeframe,
    layer_1_trend: {
      trend_direction: trendDirection,
      ema_fast_value: emaFast,
      ema_mid_value: emaMid,
      ema_slow_value: emaSlow,
      allowed_side: allowedSide,
    },
    layer_2: { rsi },
    layer_3: { stoch_k: stochK, stoch_d: stochD },
    layer_4: { flow, delta },
  };

  const result = calculateAIScore(payload);
  const finalSignal = {
    ...result,
    price: {
      current: latestClose,
      bid: latestClose * 0.9999,
      ask: latestClose * 1.0001,
      spread: latestClose * 0.0002,
    },
    layer_1_trend: payload.layer_1_trend,
    execution_timeframe: timeframe,
  };

  setLatestSignal(finalSignal);
  console.log(`Updated signal for ${symbol} [${timeframe}]:`, finalSignal);
}

export async function updateSignalFromBinance(symbol: string, timeframe: string) {
  try {
    const intervalMap: Record<string, string> = {
      "M5": "5m",
      "M15": "15m",
      "H1": "1h",
      "H4": "4h",
    };
    const interval = intervalMap[timeframe] || "15m";
    const klines = await fetchKlines(symbol, interval, 200);
    await updateSignalFromKlines(symbol, timeframe, klines);
  } catch (error) {
    console.error(`Failed to update signal from Binance for ${symbol} [${timeframe}]:`, error);
    throw error;
  }
}

const TRACKED_SYMBOLS = ["BTCUSDT", "ETHUSDT"];
const INTERVAL_MS = 10000; // Update every minute

export function startBinanceFetcher() {
  const TIMEFRAMES = ["M5", "M15", "H1", "H4"];
  const updateAll = async () => {
    for (const symbol of TRACKED_SYMBOLS) {
      for (const tf of TIMEFRAMES) {
        await updateSignalFromBinance(symbol, tf);
      }
    }
  };

  updateAll(); // Initial fetch
  setInterval(updateAll, INTERVAL_MS);
}