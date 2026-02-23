import { config } from "../../config.js";

export async function checkLive(identifier) {
  if (!config.youtube.apiKey) return null;

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: "snippet",
        channelId: identifier,
        eventType: "live",
        type: "video",
        key: config.youtube.apiKey,
      })
  );

  if (!searchRes.ok) throw new Error(`YouTube API error: ${searchRes.status}`);
  const data = await searchRes.json();
  const item = data.items?.[0];
  if (!item) return null;

  const videoId = item.id?.videoId;
  if (!videoId) return null;

  return {
    live: true,
    title: item.snippet?.title ?? null,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
