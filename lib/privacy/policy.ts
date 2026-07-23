export const PRIVACY_TEXT_VERSION = "2026-07-22.1";
export const ESSENTIAL_CONSENT = "essential_service";
export const OPTIONAL_ANALYTICS_CONSENT = "product_analytics";

export const EXPORT_TTL_HOURS = Number(process.env.EXPORT_TTL_HOURS ?? 24);
export const SUBJECT_REQUEST_RETENTION_DAYS = Number(
  process.env.SUBJECT_REQUEST_RETENTION_DAYS ?? 365,
);

export function validExportTtlHours(value = EXPORT_TTL_HOURS) {
  return Number.isFinite(value) && value >= 1 && value <= 168 ? value : 24;
}
