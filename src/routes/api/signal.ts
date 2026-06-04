import { createFileRoute } from "@tanstack/react-router";
import { calculateAIScore } from "@/lib/scoring_engine.js";
import { setLatestSignal, getLatestSignal, type Signal } from "@/lib/signal-store.server";
import { updateSignalFromBinance } from "@/lib/binance-fetcher";

export const Route = createFileRoute("/api/signal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        if (!payload || typeof payload !== "object") {
          return new Response(JSON.stringify({ error: "Payload must be an object" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const result = calculateAIScore(payload) as Signal;
          setLatestSignal(result);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("calculateAIScore failed", err);
          return new Response(
            JSON.stringify({ error: "Scoring failed", detail: String(err) }),
            { status: 422, headers: { "content-type": "application/json" } },
          );
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const symbol = url.searchParams.get("symbol");
        const timeframe = url.searchParams.get("timeframe") ?? "M15";

        if (!symbol) {
          return new Response(
            JSON.stringify({ error: "Symbol parameter is required" }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        let latestSignal = getLatestSignal(symbol, timeframe);
        
        // On Vercel (Serverless), in-memory store is ephemeral.
        // If no signal is found, fetch on-demand — except XAUUSD which comes from MT5 EA.
        if (!latestSignal) {
          if (symbol === "XAUUSD") {
            return new Response(
              JSON.stringify({ error: "Waiting for MT5 data. Please ensure the XAUUSD EA is running and connected." }),
              { status: 503, headers: { "content-type": "application/json" } },
            );
          }
          try {
            await updateSignalFromBinance(symbol, timeframe);
            latestSignal = getLatestSignal(symbol, timeframe);
          } catch (err) {
            console.error("On-demand fetch failed", err);
            return new Response(
              JSON.stringify({
                error: `Failed to fetch data from Binance for ${symbol} @ ${timeframe}. This might be due to Binance API blocking Vercel IPs.`,
                detail: String(err)
              }),
              { status: 500, headers: { "content-type": "application/json" } },
            );
          }
        }

        if (!latestSignal) {
          return new Response(
            JSON.stringify({ error: `No signal data available for ${symbol} @ ${timeframe}` }),
            { status: 404, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify(latestSignal), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
