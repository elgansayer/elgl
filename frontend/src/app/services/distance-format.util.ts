const METRES_PER_MILE = 1609.344;
const FEET_PER_METRE = 3.28084;

/**
 * Formats a proximity distance in a single unit system.
 *
 * en-US uses imperial units; all currently supported non-US locales use metric.
 * Short ranges intentionally use metres/feet and all values are rounded so the
 * UI does not imply precision beyond what Nearby discovery needs.
 */
export function formatApproximateDistance(
  metres: number | undefined,
  locale: string,
): string {
  if (metres == null || !Number.isFinite(metres) || metres < 0) return '';

  const useImperial = locale.toLowerCase() === 'en-us';
  if (useImperial) {
    const miles = metres / METRES_PER_MILE;
    if (miles < 1) {
      const roundedFeet = Math.max(500, Math.round((metres * FEET_PER_METRE) / 500) * 500);
      return `~${roundedFeet.toLocaleString('en-US')} ft`;
    }

    const roundedMiles = miles < 10 ? Math.round(miles * 2) / 2 : Math.round(miles);
    return `~${roundedMiles.toLocaleString('en-US', { maximumFractionDigits: 1 })} mi`;
  }

  if (metres < 1000) {
    const roundedMetres = Math.max(100, Math.round(metres / 100) * 100);
    return `~${roundedMetres} m`;
  }

  const kilometres = metres / 1000;
  const roundedKilometres =
    kilometres < 10 ? Math.round(kilometres * 2) / 2 : Math.round(kilometres);
  return `~${roundedKilometres.toLocaleString(locale, { maximumFractionDigits: 1 })} km`;
}
