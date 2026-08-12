export const VERSION_POLITICA_PRIVACIDAD =
  process.env.PRIVACY_POLICY_VERSION?.trim() || "acuerdo-csn-369-2020-03-09";

export const URL_POLITICA_PRIVACIDAD =
  "https://scout.org.co/politica-privacidad";
export function esVersionPoliticaVigente(value: unknown) {
  return value === VERSION_POLITICA_PRIVACIDAD;
}
