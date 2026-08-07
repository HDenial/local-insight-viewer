import { createServerFn } from "@tanstack/react-start";
import type { Mission } from "./missions.server";

export const getMissions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Mission[]> => {
    const { loadMissions } = await import("./missions.server");
    return loadMissions();
  },
);

export type { Mission, Reading } from "./missions.server";
