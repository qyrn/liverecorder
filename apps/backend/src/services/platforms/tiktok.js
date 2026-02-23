import { config } from "../../config.js";
import { spawnProcess } from "../../utils/subprocess.js";

export function checkLive(identifier) {
  return new Promise((resolve) => {
    const url = `https://www.tiktok.com/@${identifier}/live`;
    const proc = spawnProcess(config.ytdlpPath, [
      "--no-colors",
      "--simulate",
      "--print", "is_live",
      url,
    ]);

    let output = "";
    proc.stdout.on("data", (d) => { output += d.toString(); });
    proc.stderr.on("data", () => {});

    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      const isLive = output.trim() === "True";
      if (!isLive) return resolve(null);
      resolve({
        live: true,
        title: null,
        url,
      });
    });

    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 15000);
  });
}
