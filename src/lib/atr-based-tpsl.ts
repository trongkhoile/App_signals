type Direction = "BUY" | "SELL";

interface TPSLResult {
  sl: number;
  tp1: number;
  tp2: number;
}

interface Multipliers {
  sl: number;
  tp1: number;
  tp2: number;
}

// M15: short-term scalping | H1: balanced ⭐ | H4: trend-following
const TIMEFRAME_MULTIPLIERS: Record<string, Multipliers> = {
  M15: { sl: 0.5, tp1: 0.8, tp2: 1.5 },
  H1:  { sl: 0.6, tp1: 1.0, tp2: 2.0 },
  H4:  { sl: 0.7, tp1: 1.2, tp2: 2.5 },
};

const DEFAULT_MULTIPLIERS: Multipliers = { sl: 0.6, tp1: 1.0, tp2: 2.0 };

export default class ATRBasedTPSL {
  calculateTPSL(
    entry: number,
    atr: number,
    timeframe: string,
    _symbol: string,
    direction: Direction
  ): TPSLResult {
    const mults = TIMEFRAME_MULTIPLIERS[timeframe.toUpperCase()] ?? DEFAULT_MULTIPLIERS;

    const slDist  = atr * mults.sl;
    const tp1Dist = atr * mults.tp1;
    const tp2Dist = atr * mults.tp2;

    if (direction === "BUY") {
      return {
        sl:  entry - slDist,
        tp1: entry + tp1Dist,
        tp2: entry + tp2Dist,
      };
    } else {
      return {
        sl:  entry + slDist,
        tp1: entry - tp1Dist,
        tp2: entry - tp2Dist,
      };
    }
  }
}
