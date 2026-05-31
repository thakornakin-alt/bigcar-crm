export function preservePhoneInput(value: unknown) {
  return String(value ?? "").trim();
}
