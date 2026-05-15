import { agentApi } from "./agent.js";
import { corridorApi, invalidateCorridorCache } from "./corridor.js";
import { identityApi } from "./identity.js";
import { pathApi } from "./path.js";

export { ApiError } from "./client.js";
export { invalidateCorridorCache };

export const api = {
  identity: identityApi,
  corridor: corridorApi,
  path: pathApi,
  agent: agentApi,
};

export type Api = typeof api;
