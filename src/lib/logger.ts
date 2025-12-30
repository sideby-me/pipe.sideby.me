export function logProxyEvent(record: object) {
  const payload = { ...record, service: "pipe", ts: Date.now() };
  console.log("[proxy-event]", JSON.stringify(payload));
}
