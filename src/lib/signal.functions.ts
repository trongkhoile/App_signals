import { createServerFn } from "@tanstack/react-start";
import { getLatestSignal } from "./signal-store.server";

export const getCurrentSignal = createServerFn({ method: "GET" }).handler(async () => {
  return getLatestSignal();
});
