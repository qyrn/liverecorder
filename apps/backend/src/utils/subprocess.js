import { spawn } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export function spawnProcess(bin, args, options = {}) {
  const proc = spawn(bin, args, {
    windowsHide: true,
    ...options,
  });
  return proc;
}

export async function killProcess(pid) {
  try {
    await execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"]);
  } catch {
  }
}

export function probeVersion(bin) {
  return execFileAsync(bin, ["--version"], { timeout: 5000 });
}
