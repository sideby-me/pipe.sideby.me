export interface LogEnv {
  LOGTAIL_SOURCE_TOKEN?: string;
}

export function logProxyEvent(env: LogEnv, record: object) {
  const payload = { ...record, service: "pipe", ts: Date.now() };

  if (env.LOGTAIL_SOURCE_TOKEN) {
    // Fire and forget - don't await to avoid slowing down responses
    fetch("https://in.logs.betterstack.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LOGTAIL_SOURCE_TOKEN}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {}); // Silently ignore logging failures
  } else {
    console.log("[proxy-event]", JSON.stringify(payload));
  }
}
