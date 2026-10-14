import "server-only";
import { config } from "../config";
import { createOneMapClient } from "./oneMapClient.mjs";

// One shared renewal flight per server process; nothing is persisted to the browser.
export const oneMap = createOneMapClient({ getEnv: config });
