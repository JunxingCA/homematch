import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export function refreshState(directory = ".cache/research-refresh") {
  const root = resolve(directory);
  const lockPath = `${root}/lock.json`,
    statusPath = `${root}/status.json`;
  return {
    async read() {
      try {
        return JSON.parse(await readFile(statusPath, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return {};
        throw error;
      }
    },
    async write(value) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const path = `${root}/${randomUUID()}.tmp`;
      await writeFile(path, JSON.stringify(value), { mode: 0o600 });
      await rename(path, statusPath);
    },
    async acquire() {
      await mkdir(root, { recursive: true, mode: 0o700 });
      let handle;
      try {
        handle = await open(lockPath, "wx", 0o600);
      } catch (error) {
        if (error.code === "EEXIST") return null;
        throw error;
      }
      const owner = randomUUID();
      try {
        await handle.writeFile(
          JSON.stringify({
            owner,
            pid: process.pid,
            startedAt: new Date().toISOString(),
          }),
        );
      } catch (error) {
        await handle.close();
        await unlink(lockPath);
        throw error;
      }
      await handle.close();
      return async () => {
        const current = JSON.parse(await readFile(lockPath, "utf8"));
        if (current.owner !== owner)
          throw new Error("Refresh lock ownership changed");
        await unlink(lockPath);
      };
    },
  };
}
