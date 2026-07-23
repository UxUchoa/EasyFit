export function describeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /CriOS\//.test(userAgent)
      ? "Chrome"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /FxiOS\//.test(userAgent) || /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navegador";
  const device = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X/.test(userAgent)
            ? "Mac"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "dispositivo";
  return `${browser} em ${device}`;
}

export function approximateLocation(input: {
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
}) {
  const values = [input.city, input.region, input.countryCode].filter(Boolean);
  return values.length ? values.join(", ") : "Localização aproximada indisponível";
}
