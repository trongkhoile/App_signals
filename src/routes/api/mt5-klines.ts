import { createFileRoute } from "@tanstack/react-router";
import { updateSignalFromKlines, type KlineInput } from "@/lib/binance-fetcher";

const MT5_SECRET = process.env["MT5_SECRET"];

export const Route = createFileRoute("/api/mt5-klines")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (MT5_SECRET) {
          const authHeader = request.headers.get("x-mt5-secret");
          if (authHeader !== MT5_SECRET) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
        }

        let body: unknown;
        let rawText: string | undefined;
        try {
          rawText = await request.text();
          body = JSON.parse(rawText);
        } catch (e) {
          console.error("mt5-klines: invalid JSON, first 500 chars:", rawText?.slice(0, 500));
          return new Response(JSON.stringify({ error: "Invalid JSON", detail: String(e), preview: rawText?.slice(0, 200) }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const { symbol, timeframe, klines } = body as any;

        if (!symbol || !timeframe || !Array.isArray(klines) || klines.length === 0) {
          return new Response(
            JSON.stringify({
              error: "Required: symbol (string), timeframe (string), klines (non-empty array)",
              received: { symbol, timeframe, klinesType: typeof klines, klinesLength: Array.isArray(klines) ? klines.length : "not-array" },
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          );
        }

        const validTimeframes = ["M5", "M15", "H1", "H4"];
        if (!validTimeframes.includes(timeframe)) {
          return new Response(
            JSON.stringify({ error: `timeframe must be one of: ${validTimeframes.join(", ")}`, received: timeframe }),
            { status: 400, headers: { "content-type": "application/json" } }
          );
        }

        try {
          await updateSignalFromKlines(symbol, timeframe, klines as KlineInput[]);
          return new Response(
            JSON.stringify({ ok: true, symbol, timeframe, candles: klines.length }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        } catch (err) {
          console.error("mt5-klines processing failed", err);
          return new Response(
            JSON.stringify({ error: "Signal processing failed", detail: String(err) }),
            { status: 500, headers: { "content-type": "application/json" } }
          );
        }
      },
    },
  },
});
