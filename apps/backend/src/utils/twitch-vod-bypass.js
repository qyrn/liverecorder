const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

const QUALITY_RESOLUTIONS = {
  source: ["chunked", "1080p60", "720p60", "720p30", "480p30", "360p30", "160p30"],
  "1080p": ["1080p60", "chunked", "720p60", "720p30"],
  "720p":  ["720p60", "720p30", "480p30"],
  "480p":  ["480p30", "360p30", "160p30"],
};

export function extractVODId(url) {
  const m = url.match(/twitch\.tv\/videos\/(\d+)/);
  return m?.[1] ?? null;
}

async function gqlFetchVideo(vodId) {
  const resp = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-Id": GQL_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `query {
        video(id: "${vodId}") {
          title
          broadcastType
          createdAt
          seekPreviewsURL
          owner { login }
        }
      }`,
    }),
  });
  if (!resp.ok) throw new Error(`GQL HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json.data?.video) throw new Error("VOD not found via GraphQL");
  return json.data.video;
}

async function probe(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

function buildManifestUrl(domain, vodSpecialID, vodId, broadcastType, daysDiff, channelLogin, res) {
  if (broadcastType === "highlight") {
    return `https://${domain}/${vodSpecialID}/${res}/highlight-${vodId}.m3u8`;
  }
  if (broadcastType === "upload" && daysDiff > 7) {
    return `https://${domain}/${channelLogin}/${vodId}/${vodSpecialID}/${res}/index-dvr.m3u8`;
  }
  return `https://${domain}/${vodSpecialID}/${res}/index-dvr.m3u8`;
}

export async function getTwitchVODDirectUrl(vodId, qualityPreset = "source") {
  const video = await gqlFetchVideo(vodId);
  const { title, broadcastType, createdAt, seekPreviewsURL, owner } = video;

  const previewUrl = new URL(seekPreviewsURL);
  const domain = previewUrl.host;
  const vodSpecialID = previewUrl.pathname.split("/").filter(Boolean)[0];
  const daysDiff = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;

  const resolutions = QUALITY_RESOLUTIONS[qualityPreset] ?? QUALITY_RESOLUTIONS.source;

  for (const res of resolutions) {
    const url = buildManifestUrl(domain, vodSpecialID, vodId, broadcastType, daysDiff, owner.login, res);
    if (await probe(url)) {
      return { url, title, channelLogin: owner.login };
    }
  }

  throw new Error("No accessible resolution found — CDN URLs may have changed");
}
