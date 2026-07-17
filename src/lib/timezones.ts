export interface TzOption { value: string; label: string }

export const TIMEZONES: TzOption[] = [
  // North America
  { value: "America/New_York",      label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago",       label: "Central Time (US & Canada)" },
  { value: "America/Denver",        label: "Mountain Time (US & Canada)" },
  { value: "America/Phoenix",       label: "Arizona (no DST)" },
  { value: "America/Los_Angeles",   label: "Pacific Time (US & Canada)" },
  { value: "America/Anchorage",     label: "Alaska" },
  { value: "Pacific/Honolulu",      label: "Hawaii" },
  { value: "America/Toronto",       label: "Toronto (Eastern)" },
  { value: "America/Vancouver",     label: "Vancouver (Pacific)" },
  { value: "America/Winnipeg",      label: "Winnipeg (Central)" },
  { value: "America/Edmonton",      label: "Edmonton (Mountain)" },
  { value: "America/Halifax",       label: "Atlantic Time (Canada)" },
  { value: "America/St_Johns",      label: "Newfoundland" },
  // Latin America
  { value: "America/Mexico_City",   label: "Mexico City (Central)" },
  { value: "America/Monterrey",     label: "Monterrey (Central)" },
  { value: "America/Tijuana",       label: "Tijuana (Pacific)" },
  { value: "America/Bogota",        label: "Bogotá (Colombia)" },
  { value: "America/Lima",          label: "Lima (Peru)" },
  { value: "America/Santiago",      label: "Santiago (Chile)" },
  { value: "America/Caracas",       label: "Caracas (Venezuela)" },
  { value: "America/Buenos_Aires",  label: "Buenos Aires (Argentina)" },
  { value: "America/Sao_Paulo",     label: "São Paulo (Brazil)" },
  { value: "America/Manaus",        label: "Manaus (Brazil −4)" },
  { value: "America/Guatemala",     label: "Guatemala (Central America)" },
  { value: "America/El_Salvador",   label: "El Salvador" },
  { value: "America/Tegucigalpa",   label: "Tegucigalpa (Honduras)" },
  { value: "America/Managua",       label: "Managua (Nicaragua)" },
  { value: "America/Costa_Rica",    label: "Costa Rica" },
  { value: "America/Panama",        label: "Panama" },
  { value: "America/Santo_Domingo", label: "Santo Domingo" },
  { value: "America/Puerto_Rico",   label: "Puerto Rico" },
  // Europe
  { value: "UTC",                   label: "UTC" },
  { value: "Europe/London",         label: "London (GMT/BST)" },
  { value: "Europe/Madrid",         label: "Madrid (CET)" },
  { value: "Europe/Paris",          label: "Paris (CET)" },
  { value: "Europe/Berlin",         label: "Berlin (CET)" },
  { value: "Europe/Rome",           label: "Rome (CET)" },
  // Asia / Pacific
  { value: "Asia/Tokyo",            label: "Tokyo (JST)" },
  { value: "Australia/Sydney",      label: "Sydney (AEST)" },
];

export function tzLabel(value: string): string {
  return TIMEZONES.find(t => t.value === value)?.label ?? value;
}
