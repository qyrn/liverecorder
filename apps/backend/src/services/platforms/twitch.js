import { config } from "../../config.js";

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.twitch.clientId,
      client_secret: config.twitch.clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) throw new Error(`Twitch token error: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function checkLive(identifier) {
  if (!config.twitch.clientId || !config.twitch.clientSecret) return null;

  const token = await getToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(identifier)}`,
    {
      headers: {
        "Client-ID": config.twitch.clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) throw new Error(`Twitch streams API error: ${res.status}`);
  const data = await res.json();
  const stream = data.data?.[0];
  if (!stream) return null;

  return {
    live: true,
    title: stream.title,
    url: `https://www.twitch.tv/${identifier}`,
  };
}
