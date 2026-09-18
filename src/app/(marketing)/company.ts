/**
 * The company's own particulars, in one place.
 *
 * The Consumer Protection (E-Commerce) Rules, 2020 require an e-commerce
 * entity to display its legal name, the address of its head office, its
 * website details, customer-care contact and the Grievance Officer's name,
 * designation and contact "in a clear and accessible manner". Three pages
 * carry parts of that, and three copies of an address is how one of them ends
 * up a house number out of date.
 *
 * Each field below is a fact about the company, so none of it is invented.
 * The gaps are deliberate and are listed in `MISSING` — a value that is not
 * known is absent rather than guessed, because a wrong CIN or a made-up PIN
 * code on a legal page is worse than an incomplete one.
 */
export const COMPANY = {
  legalName: 'tapashub Pvt Ltd',
  /** Registered office. Street line and PIN code still to be supplied. */
  addressLines: ['Manikonda, Hyderabad', 'Telangana, India'],
  website: 'hugfab.com',
  /** Customer care and the Grievance Officer share one inbox at this size. */
  contactEmail: 'contact@hugfab.com',
  /**
   * Courts of the place where the registered office sits, which is the
   * ordinary default. Confirm before relying on it.
   */
  jurisdiction: 'Hyderabad, Telangana',
  /** Statutory maxima under the Consumer Protection (E-Commerce) Rules, 2020. */
  grievanceAcknowledgeHours: 48,
  grievanceResolveDays: 30,
} as const;

/**
 * Facts the legal pages need and do not yet have. Each one is a blank on a
 * published page, not a nice-to-have:
 *
 *   - Grievance Officer's name and designation — Rule 5(3) of the Consumer
 *     Protection (E-Commerce) Rules, 2020 and Rule 3(2)(a) of the IT Rules,
 *     2021 both require the name, not merely a mailbox.
 *   - Street line and PIN code of the registered office.
 *   - CIN of the company.
 *   - Region of the Supabase project, for the transfer section.
 *   - Retention periods for account data and click records.
 */
export const MISSING = [
  'grievanceOfficerName',
  'registeredAddressStreetAndPin',
  'cin',
  'databaseRegion',
  'retentionPeriods',
] as const;

/** The date the legal pages were last substantively changed. */
export const LEGAL_UPDATED = '18 September 2026';
