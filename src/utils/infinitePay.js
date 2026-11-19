const INFINITEPAY_HOSTS = ["infinitepay.io", "infinitepay.com.br"];

export function getInfinitePayUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trustedHost = INFINITEPAY_HOSTS.some(host => hostname === host || hostname.endsWith("." + host));
    return url.protocol === "https:" && trustedHost && !url.username && !url.password && (!url.port || url.port === "443") ? url.toString() : "";
  } catch {
    return "";
  }
}

export function validateInfinitePayUrl(value) {
  if (!value) return { valid: true, value: "" };
  const safeUrl = getInfinitePayUrl(value);
  if (!safeUrl) {
    return { valid: false, message: "Informe um link HTTPS válido da Loja Online InfinitePay." };
  }
  return { valid: true, value: safeUrl };
}
