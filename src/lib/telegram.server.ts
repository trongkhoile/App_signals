import type { Signal, LockedTpsl } from './signal-store.server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

const fmt = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';

export async function sendSignalAlert(s: Signal, entry: number, tpsl: LockedTpsl) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const isBuy = s.label === 'BUY NOW';
  const emoji = isBuy ? '🟢' : '🔴';
  const direction = isBuy ? 'BUY NOW' : 'SELL NOW';
  const symbol = s.symbol ?? 'UNKNOWN';
  const tf = s.execution_timeframe ?? 'N/A';

  const text = [
    `${emoji} *QI PRIME SIGNAL: ${direction}*`,
    ``,
    `📌 Asset: \`${symbol}\``,
    `⏱ Timeframe: \`${tf}\``,
    `🤖 AI Score: \`${s.ai_score}%\``,
    ``,
    `━━━━━━━━━━━━━━━`,
    `🔵 ENTRY:     \`${fmt(entry)}\``,
    `❌ STOP LOSS: \`${fmt(tpsl.sl)}\``,
    `✅ TP 1:      \`${fmt(tpsl.tp1)}\``,
    `✅ TP 2:      \`${fmt(tpsl.tp2)}\``,
    `━━━━━━━━━━━━━━━`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch {
    // Non-critical — don't crash the signal pipeline
  }
}
