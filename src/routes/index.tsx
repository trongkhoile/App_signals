import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { calculateAIScore } from "@/lib/scoring_engine.js";

// ─── TOAST COMPONENT ─────────────────────────────────────────────────────────
function Toast({ message, show }: { message: string; show: boolean }) {
  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      top: 20,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.8)",
      color: "#fff",
      padding: "10px 20px",
      borderRadius: 8,
      zIndex: 1000,
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      fontSize: 14,
      fontWeight: 600,
      animation: "fadeInDown 0.3s ease-out",
    }}>
      {message}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Signals App",
      },
    ],
  }),
  component: QiPrimeDashboard,
});

// ─── PALETTE (Light Mode Premium) ─────────────────────────────────────────────
const C = {
  bg: "#F4F6F8",
  surface: "#FFFFFF",
  surfaceMuted: "#F8F9FA",
  border: "#E6E9EE",
  borderSoft: "#EEF1F5",
  text: "#1A1F2B",
  textMuted: "#6B7280",
  textFaint: "#9AA3AF",
  buy: "#0FAE6B",
  buyBg: "#E8F7EF",
  sell: "#E5354A",
  sellBg: "#FCE9EC",
  neutral: "#94A3B8",
  accent: "#2563EB",
  amber: "#D97706",
  violet: "#7C3AED",
  shadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
  shadowMd: "0 4px 12px rgba(16,24,40,0.06), 0 2px 4px rgba(16,24,40,0.04)",
};

// ─── CIRCULAR GAUGE (Light) ──────────────────────────────────────────────────
function CircularGauge({ score, maxScore = 90, color }: { score: number; maxScore?: number; color: string }) {
  const size = 180, r = 76, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(score / maxScore, 1);
  const dash = pct * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF1F5" strokeWidth="12" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fill={C.text}
        style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`, fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
        {score}
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`, fontSize: 10, fontWeight: 600, letterSpacing: 2 }}
        fill={C.textMuted}>
        AI SCORE / {maxScore}
      </text>
    </svg>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────
function MetricCard({ title, value, label, accent, tone, large }: {
  title: string; value: any; label: string; accent?: string; tone?: "buy" | "sell" | "neutral" | "accent"; large?: boolean;
}) {
  const toneColor = tone === "buy" ? C.buy : tone === "sell" ? C.sell : tone === "accent" ? C.accent : accent || C.textMuted;
  const toneBg    = tone === "buy" ? "rgba(15,174,107,0.06)"
                  : tone === "sell" ? "rgba(229,53,74,0.06)"
                  : tone === "accent" ? "rgba(37,99,235,0.06)"
                  : "rgba(148,163,184,0.05)";
  return (
    <div className="qi-metric-card" style={{
      position: "relative", overflow: "hidden",
      background: `linear-gradient(135deg, #FFFFFF 0%, ${toneBg} 130%)`,
      border: `1px solid ${C.border}`, borderRadius: 12,
      padding: large ? "18px 20px" : "14px 16px", boxShadow: C.shadow,
      transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, transparent, ${toneColor}, transparent)`,
                    opacity: 0.7 }} />
      <div style={{ position: "absolute", top: -30, right: -30, width: 80, height: 80,
                    background: `radial-gradient(circle, ${toneColor}22, transparent 70%)`,
                    pointerEvents: "none" }} />
      <div className="qi-eyebrow" style={{ color: C.textMuted, fontSize: large ? 10 : 9, marginBottom: large ? 10 : 8, position: "relative" }}>
        {title}
      </div>
      <div className="qi-display" style={{
        color: C.text, fontSize: large ? 36 : 24, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: -0.6, position: "relative",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
      </div>
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 5,
                    color: toneColor, fontSize: large ? 11 : 10.5, marginTop: large ? 10 : 8, fontWeight: 700,
                    background: toneBg, padding: "2px 8px", borderRadius: 999,
                    border: `1px solid ${toneColor}30` }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: toneColor,
                       boxShadow: `0 0 6px ${toneColor}` }} />
        {label}
      </div>
    </div>
  );
}

// ─── SCORE BAR ───────────────────────────────────────────────────────────────
function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="qi-eyebrow" style={{ color: C.textMuted, fontSize: 9 }}>{label}</span>
        <span className="qi-mono" style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>
          {score}<span style={{ color: C.textFaint }}>/{max}</span>
        </span>
      </div>
      <div style={{ position: "relative", background: C.surfaceMuted, borderRadius: 999, height: 8, overflow: "hidden",
                    border: `1px solid ${C.borderSoft}` }}>
        <div style={{ width: `${pct}%`, height: "100%",
                      background: `linear-gradient(90deg, ${color}aa, ${color})`,
                      borderRadius: 999, transition: "width 0.6s ease",
                      boxShadow: `0 0 12px ${color}55` }} />
      </div>
    </div>
  );
}

// ─── SECTION (Card container with title) ─────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(180deg, #FFFFFF 0%, #FBFCFD 100%)",
      border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 16, boxShadow: C.shadow,
    }}>
      <div style={{ position: "absolute", top: 0, left: 16, right: 16, height: 1,
                    background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.4), rgba(124,58,237,0.3), transparent)" }} />
      <div className="qi-eyebrow" style={{ display: "flex", alignItems: "center", gap: 8,
                    color: C.textFaint, fontSize: 9, marginBottom: 12 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%",
                       background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                       boxShadow: "0 0 8px rgba(37,99,235,0.6)" }} />
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── DEMO DATA ───────────────────────────────────────────────────────────────
const DEMO_DATA: any = {
  instrument: { symbol: "BTCUSDT", execution_timeframe: "M5", strategy_mode: "SMART_FLOW" },
  price: { current: 74082, bid: 74081.5, ask: 74082.5, spread: 1.0 },
  signal_main: { direction: "SELL", label: "SELL NOW", ai_score: 90, confidence_pct: 90,
                 color_state: "RED_STRONG", signal_type: "STOP_HUNT_EXPANSION" },
  layer_1_trend: { trend_direction: "DOWN", ema_fast_value: 74250, ema_mid_value: 74480,
                   ema_slow_value: 75100, allowed_side: "SELL" },
  layer_2_momentum: { rsi_value: 42.2, score: 20 },
  layer_3_trigger:  { stoch_k: 78.4, stoch_d: 72.1, score: 30 },
  layer_4_flow:     { flow: -4122, delta: -319, power: -634.7,
                      buy_ratio: 0.6, sell_ratio: 9.9, score: 40 },
  ai_score_breakdown: { total: 90, layer_2_rsi: 20, layer_3_stoch: 30, layer_4_flow: 40 },
  meta: { last_update: new Date().toISOString(), update_age_seconds: 3,
          webhook_event: "SIGNAL_UPDATE", schema_version: "2.0" }
};

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "XAUUSD"];
const DISPLAY_MAP: Record<string, string> = {
  BTCUSDT: "BTC",
  ETHUSDT: "ETH",
  XAUUSD: "XAUUSD",
};
const TIMEFRAMES = ["M5", "M15", "H1", "H4"];

function QiPrimeDashboard() {
  const [data, setData]           = useState<any>(DEMO_DATA);
  const [score, setScore]         = useState<any>(null);
  const [lastAge, setLastAge]     = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [symbol, setSymbol]       = useState<string>(DEMO_DATA.instrument.symbol);
  const [timeframe, setTimeframe] = useState<string>(DEMO_DATA.instrument.execution_timeframe);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const toastTimerRef = useRef<number | null>(null);
  const closeToast = useCallback(() => setShowToast(false), []);

  useEffect(() => {
    setLoading(true);
    setConnected(false);
    setError(null);
  }, [symbol, timeframe]);

  useEffect(() => {
    const t = setInterval(() => {
      const ts = data.meta?.last_update ? new Date(data.meta.last_update).getTime() : data.timestamp;
      const age = Math.floor((Date.now() - ts) / 1000);
      setLastAge(age > 0 ? age : 0);
    }, 1000);
    return () => clearInterval(t);
  }, [data.meta?.last_update, data.timestamp]);

  const pullSignal = useCallback(async () => {
    try {
      const res = await fetch(`/api/signal?symbol=${symbol}&timeframe=${timeframe}`);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const b = await res.json(); if (b?.error) msg = b.error; } catch {}
        throw new Error(msg);
      }
      const json = await res.json();
      
      const adaptedScore = {
        ...json,
        direction: json.label === "BUY NOW" ? "BUY" : json.label === "SELL NOW" ? "SELL" : "WAIT",
        breakdown: {
          ...json.breakdown,
          ...json.metrics,
          power: json.metrics?.flow ? json.metrics.flow * 1000 : 0,
          buy_ratio: 50,
          sell_ratio: 50
        }
      };

      setScore(adaptedScore);
      setData(json);
      setConnected(true);
      setError(null);
      setLoading(false);
    } catch (e: any) {
      setConnected(false);
      setError(e.message);
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    pullSignal();
    const t = setInterval(pullSignal, 3000);
    return () => clearInterval(t);
  }, [pullSignal]);

  // TP/SL is now locked server-side — just read from score
  const tpsl = score?.lockedTpsl ?? { sl: null, tp1: null, tp2: null };

  const copySignal = () => {
    const signalStatus = score?.label ?? score?.direction ?? "STANDBY";

    const triggerToast = (msg: string) => {
      // Clear existing timer if any
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      
      setToastMessage(msg);
      setShowToast(true);
      
      // Set new timer to hide toast after 3 seconds
      toastTimerRef.current = window.setTimeout(() => {
        setShowToast(false);
        toastTimerRef.current = null;
      }, 3000);
    };

    if (signalStatus === "STANDBY" || signalStatus === "WAIT") {
      triggerToast("Hiện tại hệ thống đang STANDBY, chưa có tín hiệu BUY NOW hoặc SELL NOW để copy.");
      return;
    }

    const asset = data.instrument?.symbol ?? symbol ?? "N/A";
    const tf = data.instrument?.execution_timeframe ?? timeframe ?? "N/A";
    const entry = data.price?.current;
    const fmt = (value: number | null | undefined) =>
      typeof value === "number" ? value.toFixed(2) : "N/A";

    const message = [
      `🔴 QI PRIME SIGNAL: ${signalStatus}`,
      `🔹 Asset: ${asset}`,
      `🔹 Timeframe: ${tf}`,
      `-------------------------`,
      `🔹 ENTRY: ${fmt(entry)}`,
      `❌ STOP LOSS: ${fmt(tpsl.sl)}`,
      `✅ TAKE PROFIT 1: ${fmt(tpsl.tp1)}`,
      `✅ TAKE PROFIT 2: ${fmt(tpsl.tp2)}`,
      `-------------------------`,
      `🔥 AI Confidence Score: ${score.ai_score}%`
    ].join("\n");

    navigator.clipboard.writeText(message);
    triggerToast("Signal copied to clipboard!");
  };

  const lastUpdateStr = useMemo(() => {
    const ts = data.meta?.last_update ? new Date(data.meta.last_update).getTime() : data.timestamp;
    return ts ? new Date(ts).toLocaleTimeString() : "N/A";
  }, [data.meta?.last_update, data.timestamp]);

  if (!score) return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 16, gap: 12 }}>
      {error ? (
        <>
          <div style={{ color: C.sell, fontWeight: 700, fontSize: 18 }}>Error loading signal</div>
          <div style={{ color: C.textMuted, fontSize: 14, textAlign: "center", maxWidth: 400 }}>{error}</div>
          <button onClick={pullSignal} style={{
            marginTop: 8, padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.surface, color: C.text, fontWeight: 600, cursor: "pointer", boxShadow: C.shadow
          }}>
            Retry
          </button>
        </>
      ) : (
        "Loading..."
      )}
    </div>
  );

  const isSell   = score.direction === "SELL";
  const isBuy    = score.direction === "BUY";
  const sigColor = isSell ? C.sell : isBuy ? C.buy : C.neutral;
  const sigBg    = isSell ? C.sellBg : isBuy ? C.buyBg : "#F1F5F9";
  const bd       = score.breakdown;
  const stopHunt = data.signal_main?.signal_type === "STOP_HUNT_EXPANSION";

  const selectStyle: React.CSSProperties = {
    appearance: "none", background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "8px 30px 8px 12px", fontSize: 13, fontWeight: 600,
    color: C.text, cursor: "pointer", outline: "none", boxShadow: C.shadow,
    backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
  };


  return (
    <div className="qi-tech-bg" style={{ minHeight: "100vh",
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  padding: "24px 20px", color: C.text }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
          {/* Control Panel */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={selectStyle}>
              {SYMBOLS.map(s => <option key={s} value={s}>{DISPLAY_MAP[s] ?? s}</option>)}
            </select>
            <div style={{ display: "flex", gap: 4, background: C.surface, padding: 4,
                          borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
              {TIMEFRAMES.map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)} style={{
                  background: timeframe === tf ? "linear-gradient(135deg, #1A1F2B, #2563EB)" : "transparent",
                  color: timeframe === tf ? "#fff" : C.textMuted,
                  border: "none", padding: "6px 12px", fontSize: 12, fontWeight: 700,
                  borderRadius: 6, cursor: "pointer", letterSpacing: 0.5, transition: "all .15s ease",
                }}>{tf}</button>
              ))}
            </div>
            <span className="qi-eyebrow" style={{ color: C.textFaint, fontSize: 10, marginLeft: 6 }}>
              · {data.instrument?.strategy_mode}
            </span>
          </div>

          {/* Live status */}
          <div className="qi-live-pill" style={{ display: "flex", gap: 8, alignItems: "center",
                        background: C.surface, border: `1px solid ${C.border}`,
                        borderRadius: 999, padding: "6px 12px", boxShadow: C.shadow }}>
            {loading ? (
              <div style={{ width: 8, height: 8, border: `2px solid ${C.border}`,
                borderTopColor: C.accent, borderRadius: "50%",
                animation: "spin 0.8s linear infinite" }} />
            ) : (
              <div className="animate-pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%",
                background: connected ? C.buy : C.amber,
                boxShadow: `0 0 8px ${connected ? C.buy : C.amber}` }} />
            )}
            <span className="qi-eyebrow" style={{ color: C.textMuted, fontSize: 10 }}>
              {loading ? "LOADING" : connected ? "LIVE" : "DEMO"}
            </span>
            {error && <span style={{ color: C.amber, fontSize: 10 }}>· {error}</span>}
          </div>
        </div>

        {/* ── MAIN SIGNAL CARD ── */}
        <div style={{ background: `linear-gradient(135deg, #FFFFFF 0%, ${sigBg} 140%)`,
                      border: `1px solid ${C.border}`, borderRadius: 16,
                      padding: 24, marginBottom: 16, display: "flex", alignItems: "center",
                      justifyContent: "space-between", boxShadow: C.shadowMd,
                      flexWrap: "wrap", gap: 24,
                      backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${sigBg} 140%), linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)`,
                      backgroundSize: "auto, 22px 22px, 22px 22px" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="qi-eyebrow" style={{ color: sigColor, fontSize: 11, marginBottom: 10, opacity: 0.85 }}>
              ◆ Current Signal
            </div>
            <div className="qi-display qi-signal-text" style={{ fontSize: 60, fontWeight: 800, color: sigColor, lineHeight: 1, letterSpacing: -2 }}>
              {score.label}
            </div>
            <div style={{ color: "#8C95A3", fontSize: 13, marginTop: 12, marginBottom: 18, fontWeight: 400, letterSpacing: 0.3 }}>
              <span style={{ color: C.text, fontWeight: 600 }}>QiPrime</span> Intelligent Flow Engine <span className="qi-mono" style={{ color: C.accent, fontWeight: 700 }}>v2.0</span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={pullSignal}
                style={{ background: sigColor, color: "#fff", fontWeight: 700, fontSize: 13,
                         padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                         boxShadow: C.shadow }}>
                Refresh Data
              </button>
              <button onClick={copySignal}
                style={{ background: C.surface, color: C.text, fontWeight: 800, fontSize: 13,
                         padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`,
                         cursor: "pointer", letterSpacing: 0.4 }}>
                Copy Signal
              </button>
            </div>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, background: "rgba(0,0,0,0.02)", padding: 12, borderRadius: 8, border: `1px solid ${C.borderSoft}` }}>
              <div>
                <div style={{ color: C.textMuted, fontSize: 10, fontWeight: 800, marginBottom: 4 }}>STOP LOSS</div>
                <div style={{ color: C.sell, fontSize: 18, fontWeight: 800 }}>{tpsl.sl?.toFixed(2) ?? "N/A"}</div>
              </div>
              <div>
                <div style={{ color: C.textMuted, fontSize: 10, fontWeight: 800, marginBottom: 4 }}>TP 1 (1:1)</div>
                <div style={{ color: C.buy, fontSize: 18, fontWeight: 800 }}>{tpsl.tp1?.toFixed(2) ?? "N/A"}</div>
              </div>
              <div>
                <div style={{ color: C.textMuted, fontSize: 10, fontWeight: 800, marginBottom: 4 }}>TP 2 (1:2)</div>
                <div style={{ color: C.buy, fontSize: 18, fontWeight: 800 }}>{tpsl.tp2?.toFixed(2) ?? "N/A"}</div>
              </div>
            </div>
          </div>

            {/* AI SCORE Section - Responsive Layout */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
               {/* MOBILE LAYOUT: Gauge | (RSI over Price) */}
               <div className="flex md:hidden" style={{ alignItems: "center", justifyContent: "center", gap: 12, width: "100%" }}>
                 <div style={{ background: sigBg, borderRadius: "50%", padding: 6, flexShrink: 0 }}>
                   <CircularGauge score={score.ai_score} maxScore={90} color={sigColor} />
                 </div>

                 <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
                   {/* Mobile RSI */}
                   <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center", boxShadow: C.shadow, overflow: "hidden" }}>
                     <div style={{ color: C.textFaint, fontSize: 9, fontWeight: 700, marginBottom: 3 }}>RSI ({timeframe})</div>
                     <div style={{ color: C.text, fontSize: 15, fontWeight: 800 }}>{bd.rsi?.toFixed(1)}</div>
                   </div>

                   {/* Mobile Price */}
                   <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center", boxShadow: C.shadow, overflow: "hidden" }}>
                     <div style={{ color: C.textFaint, fontSize: 9, fontWeight: 700, marginBottom: 3 }}>{DISPLAY_MAP[data.instrument?.symbol ?? symbol] ?? data.instrument?.symbol ?? symbol}</div>
                     <div style={{ color: C.text, fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.price?.current?.toLocaleString()}</div>
                   </div>
                 </div>
               </div>

              {/* DESKTOP LAYOUT: Gauge + Last Update */}
              <div className="hidden md:flex" style={{ flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ background: sigBg, borderRadius: "50%", padding: 8 }}>
                  <CircularGauge score={score.ai_score} maxScore={90} color={sigColor} />
                </div>
                <div style={{
                  background: C.surfaceMuted, border: `1px solid ${C.borderSoft}`,
                  borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 180,
                }}>
                  <div style={{ color: C.textFaint, fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>
                    LAST UPDATE
                  </div>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                    {lastUpdateStr}
                  </div>
                  <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 500, marginTop: 1 }}>
                    {lastAge}s ago
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* ── 3-COLUMN LAYOUT ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16, marginBottom: 16,
        }}>

          {/* Column 1 — Trend & Momentum */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
             <Section title={`LAYER 1 — TREND GATE (${timeframe} EMA)`}>
               <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                 {[
                   { label: "EMA 21", val: data.layer_1_trend?.ema_fast_value },
                   { label: "EMA 50", val: data.layer_1_trend?.ema_mid_value },
                   { label: "EMA 200", val: data.layer_1_trend?.ema_slow_value },
                 ].map(({ label, val }) => {
                   const belowEMA = data.price?.current < val;
                   return (
                     <div key={label} style={{ textAlign: "center", background: C.surfaceMuted,
                                               borderRadius: 8, padding: "10px 4px",
                                               border: `1px solid ${C.borderSoft}` }}>
                       <div style={{ color: C.textMuted, fontSize: 10, fontWeight: 600 }}>{label}</div>
                       <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginTop: 2 }}>
                         {val?.toLocaleString()}
                       </div>
                       <div style={{ color: belowEMA ? C.sell : C.buy, fontSize: 10, marginTop: 2, fontWeight: 600 }}>
                         {belowEMA ? "BELOW ↓" : "ABOVE ↑"}
                       </div>
                     </div>
                   );
                 })}
               </div>
               <div style={{ marginTop: 12, textAlign: "center" }}>
                 <span style={{ background: sigBg, color: sigColor,
                               padding: "5px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                               border: `1px solid ${sigColor}33` }}>
                   GATE: {data.layer_1_trend?.trend_direction} · {data.layer_1_trend?.allowed_side} ONLY
                 </span>
               </div>
             </Section>
               <div className="hidden md:flex" style={{ flexDirection: "column", gap: 12, marginTop: 12 }}>
                 <MetricCard title={`RSI (${timeframe})`} value={bd.rsi?.toFixed(1)}
                   label={bd.rsi < 40 ? "Bearish momentum" : bd.rsi > 60 ? "Bullish momentum" : "Neutral"}
                   tone={bd.rsi < 40 ? "sell" : bd.rsi > 60 ? "buy" : "neutral"} large />
                 <MetricCard title={DISPLAY_MAP[data.instrument?.symbol ?? symbol] ?? data.instrument?.symbol ?? symbol} value={data.price?.current?.toLocaleString()}
                   label={score.direction} tone={isSell ? "sell" : isBuy ? "buy" : "neutral"} large />
               </div>
          </div>

          {/* Column 2 — Stochastic Triggers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Section title={`LAYER 3 — STOCHASTIC TRIGGER (${timeframe})`}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: C.surfaceMuted, border: `1px solid ${C.borderSoft}`,
                              borderRadius: 10, padding: 12 }}>
                  <div style={{ color: C.textMuted, fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>STOCH %K</div>
                  <div style={{ color: C.text, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                    {bd.stoch_k?.toFixed(1)}
                  </div>
                  <div style={{ color: bd.stoch_k > 80 ? C.sell : bd.stoch_k < 20 ? C.buy : C.textMuted,
                                fontSize: 10, fontWeight: 700, marginTop: 4 }}>
                    {bd.stoch_k > 80 ? "OVERBOUGHT ⚡" : bd.stoch_k < 20 ? "OVERSOLD ⚡" : "NEUTRAL"}
                  </div>
                </div>
                <div style={{ background: C.surfaceMuted, border: `1px solid ${C.borderSoft}`,
                              borderRadius: 10, padding: 12 }}>
                  <div style={{ color: C.textMuted, fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>STOCH %D</div>
                  <div style={{ color: C.text, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                    {bd.stoch_d?.toFixed(1)}
                  </div>
                  <div style={{ color: bd.stoch_k < bd.stoch_d ? C.sell : C.buy,
                                fontSize: 10, fontWeight: 700, marginTop: 4 }}>
                    {bd.stoch_k < bd.stoch_d ? "BEARISH CROSS ↓" : "BULLISH CROSS ↑"}
                  </div>
                </div>
              </div>
            </Section>

            {/* AI Score Breakdown moved here for vertical balance */}
            <Section title={`AI SCORE BREAKDOWN — ${score.ai_score}/90`}>
              <ScoreBar label="L2 · RSI Momentum" score={bd.l2 ?? 0} max={20} color={C.accent} />
              <ScoreBar label="L3 · Stochastic Trigger" score={bd.l3 ?? 0} max={30} color={C.amber} />
              <ScoreBar label="L4 · Flow / Delta / Power" score={bd.l4 ?? 0} max={40} color={sigColor} />
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 12 }}>TOTAL</span>
                  <span style={{ color: sigColor, fontWeight: 800, fontSize: 14 }}>{score.ai_score}/90</span>
                </div>
                <div style={{ background: C.surfaceMuted, borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${(score.ai_score / 90) * 100}%`, height: "100%",
                                background: sigColor, borderRadius: 999, transition: "width 0.6s ease" }} />
                </div>
              </div>
            </Section>
          </div>

          {/* Column 3 — Order Flow */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Section title="LAYER 4 — ORDER FLOW">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MetricCard title="FLOW" value={bd.flow?.toLocaleString()}
                  label={bd.flow < 0 ? "Seller dominant" : "Buyer dominant"}
                  tone={bd.flow < 0 ? "sell" : "buy"} />
                <MetricCard title="DELTA" value={bd.delta?.toFixed(0)}
                  label={bd.delta < 0 ? "Seller attack" : "Buyer attack"}
                  tone={bd.delta < 0 ? "sell" : "buy"} />
                <MetricCard title="POWER" value={bd.power?.toFixed(1)}
                  label={bd.power < 0 ? "Bearish power" : "Bullish power"}
                  tone={bd.power < 0 ? "sell" : "buy"} />
                <MetricCard title="BUY/SELL" value={`${bd.buy_ratio?.toFixed(1)}/${bd.sell_ratio?.toFixed(1)}`}
                  label="Pressure ratio" tone="accent" />
              </div>
            </Section>
            <MetricCard title="CONFIDENCE" value={`${score.ai_score}%`}
              label={`${score.direction} bias`} tone={isSell ? "sell" : isBuy ? "buy" : "neutral"} />
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, color: C.textFaint,
                      fontSize: 11, fontWeight: 500 }}>
          QiPrime Smart Flow Dashboard v2.0 · MT5 EA Bridge · Schema v2
        </div>
      </div>
      <Toast message={toastMessage} show={showToast} />
    </div>
  );
}
