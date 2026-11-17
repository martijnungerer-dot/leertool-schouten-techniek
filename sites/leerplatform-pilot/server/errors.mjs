export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(k => !fields.includes(k))) throw new AppError(400, 'De invoer bevat ongeldige velden.');
}
export function boundedText(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new AppError(400, `${label}: gebruik ${min} tot ${max} tekens.`);
  }
  return value.trim();
}
