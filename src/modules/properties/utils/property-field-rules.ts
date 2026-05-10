/**
 * property-field-rules.ts
 *
 * Single source of truth for which fields are applicable per PropertyType.
 * Backend uses it to strip inapplicable fields before persisting.
 * Frontend uses it to conditionally show/hide form fields.
 *
 * IMPORTANT: Keep this file in sync between backend and frontend.
 * Backend:  src/modules/properties/utils/property-field-rules.ts
 * Frontend: src/lib/property-field-rules.ts
 *
 * v2.2 changes:
 *   - Removed showBedrooms / showBathrooms
 *   + Added showNumberOfRooms (single unified room count for non-hostel types)
 *   + Added showTotalRooms    (hostel-only: cap for HostelRoom entries)
 *   + Added showHotelCategory (hotel/lodge-only: ORDINARY | VIP | VVIP)
 *   - showFloor is now true for HOSTEL and HOTEL_LODGE
 */

import { PropertyType } from '../enums/property-type.enum';
import { BillingCycle }  from '../enums/billing-cycle.enum';

export interface PropertyFieldConfig {
  /**
   * Unified room count field (replaces the old bedrooms + bathrooms pair).
   * False for HOSTEL — rooms are managed as individual HostelRoom entities.
   */
  showNumberOfRooms: boolean;

  showParking: boolean;
  showFloor: boolean;
  showFurnishing: boolean;

  /** Whether a billingCycle must be set at the property level */
  showBillingCycle: boolean;

  /** Which billing cycles are valid for this type */
  allowedBillingCycles: BillingCycle[];

  showSecurityDeposit: boolean;

  /** Only true for RESIDENTIAL_HOUSE — admin picks SINGLE or DOUBLE */
  showResidentialSubtype: boolean;

  /** Sub-units are managed via the HostelRooms module */
  isHostel: boolean;

  /** Supports DAILY billing; checkout date required for daily bookings */
  isHotelLodge: boolean;

  /**
   * HOSTEL only: total room capacity (cap for HostelRoom entries).
   * NULL on the property = no cap enforced.
   */
  showTotalRooms: boolean;

  /**
   * HOTEL_LODGE only: service-tier category (ORDINARY | VIP | VVIP).
   */
  showHotelCategory: boolean;
}

export const PROPERTY_FIELD_CONFIG: Record<PropertyType, PropertyFieldConfig> = {

  [PropertyType.RESIDENTIAL_HOUSE]: {
    showNumberOfRooms:    true,
    showParking:          true,
    showFloor:            false,          // houses are ground-level
    showFurnishing:       true,
    showBillingCycle:     true,
    allowedBillingCycles: [
      BillingCycle.MONTHLY,
      BillingCycle.QUARTERLY,
      BillingCycle.BIANNUAL,
      BillingCycle.ANNUAL,
    ],
    showSecurityDeposit:   true,
    showResidentialSubtype: true,
    isHostel:              false,
    isHotelLodge:          false,
    showTotalRooms:        false,
    showHotelCategory:     false,
  },

  [PropertyType.APARTMENT]: {
    showNumberOfRooms:    true,
    showParking:          true,
    showFloor:            true,
    showFurnishing:       true,
    showBillingCycle:     true,
    allowedBillingCycles: [
      BillingCycle.MONTHLY,
      BillingCycle.QUARTERLY,
      BillingCycle.BIANNUAL,
      BillingCycle.ANNUAL,
    ],
    showSecurityDeposit:   true,
    showResidentialSubtype: false,
    isHostel:              false,
    isHotelLodge:          false,
    showTotalRooms:        false,
    showHotelCategory:     false,
  },

  [PropertyType.AIRBNB]: {
    showNumberOfRooms:    true,
    showParking:          true,
    showFloor:            true,
    showFurnishing:       true,
    showBillingCycle:     true,
    allowedBillingCycles: [
      BillingCycle.DAILY,
      BillingCycle.MONTHLY,
      BillingCycle.QUARTERLY,
      BillingCycle.BIANNUAL,
      BillingCycle.ANNUAL,
    ],
    showSecurityDeposit:   true,
    showResidentialSubtype: false,
    isHostel:              false,
    isHotelLodge:          false,
    showTotalRooms:        false,
    showHotelCategory:     false,
  },

  [PropertyType.OFFICE_SPACE]: {
    showNumberOfRooms:    true,           // number of office rooms / units
    showParking:          true,
    showFloor:            true,
    showFurnishing:       true,
    showBillingCycle:     true,
    allowedBillingCycles: [
      BillingCycle.MONTHLY,
      BillingCycle.QUARTERLY,
      BillingCycle.BIANNUAL,
      BillingCycle.ANNUAL,
    ],
    showSecurityDeposit:   true,
    showResidentialSubtype: false,
    isHostel:              false,
    isHotelLodge:          false,
    showTotalRooms:        false,
    showHotelCategory:     false,
  },

  [PropertyType.BUSINESS_SPACE]: {
    showNumberOfRooms:    true,
    showParking:          true,
    showFloor:            true,
    showFurnishing:       false,          // commercial spaces are rarely furnished
    showBillingCycle:     true,
    allowedBillingCycles: [
      BillingCycle.MONTHLY,
      BillingCycle.QUARTERLY,
      BillingCycle.BIANNUAL,
      BillingCycle.ANNUAL,
    ],
    showSecurityDeposit:   true,
    showResidentialSubtype: false,
    isHostel:              false,
    isHotelLodge:          false,
    showTotalRooms:        false,
    showHotelCategory:     false,
  },

  [PropertyType.HOSTEL]: {
    showNumberOfRooms:    false,          // individual rooms managed via HostelRoom entity
    showParking:          true,
    showFloor:            true,           // ← enabled per client request (v2.2)
    showFurnishing:       false,          // per-room
    showBillingCycle:     false,          // billingCycle lives on each HostelRoom, not the property
    allowedBillingCycles: [],             // N/A at property level
    showSecurityDeposit:  false,          // per-room booking
    showResidentialSubtype: false,
    isHostel:             true,
    isHotelLodge:         false,
    showTotalRooms:       true,           // ← new: maximum HostelRoom entries allowed
    showHotelCategory:    false,
  },

  [PropertyType.HOTEL_LODGE]: {
    showNumberOfRooms:    true,
    showParking:          true,
    showFloor:            true,           // ← enabled per client request (v2.2)
    showFurnishing:       true,           // hotel rooms are always furnished
    showBillingCycle:     true,
    allowedBillingCycles: [
      BillingCycle.DAILY,
      BillingCycle.MONTHLY,
    ],
    showSecurityDeposit:  false,          // not standard for hotels/lodges
    showResidentialSubtype: false,
    isHostel:             false,
    isHotelLodge:         true,
    showTotalRooms:       false,
    showHotelCategory:    true,           // ← new: ORDINARY | VIP | VVIP
  },

};

/**
 * Strips fields that are not applicable for the given property type.
 * Called in service layer before create/update to ensure data integrity
 * regardless of what the client sends.
 */
export function stripInapplicableFields<T extends Record<string, unknown>>(
  data: T,
  type: PropertyType,
): T {
  const config = PROPERTY_FIELD_CONFIG[type];
  if (!config) return data;

  const result = { ...data };

  if (!config.showNumberOfRooms)      delete result.numberOfRooms;
  if (!config.showParking)            delete result.parkingAvailable;
  if (!config.showFloor)              delete result.floor;
  if (!config.showFurnishing)         delete result.furnishing;
  if (!config.showBillingCycle)       delete result.billingCycle;
  if (!config.showSecurityDeposit)    delete result.securityDeposit;
  if (!config.showResidentialSubtype) delete result.residentialSubtype;
  if (!config.showTotalRooms)         delete result.totalRooms;
  if (!config.showHotelCategory)      delete result.hotelCategory;

  return result;
}

/**
 * Validates that the supplied billingCycle is allowed for the property type.
 * Returns a descriptive error string, or null if valid.
 * Caller wraps the return value in BadRequestException.
 */
export function validateBillingCycle(
  type: PropertyType,
  billingCycle: BillingCycle | undefined,
): string | null {
  const config = PROPERTY_FIELD_CONFIG[type];

  if (!config.showBillingCycle) return null; // not applicable (e.g. HOSTEL)

  if (!billingCycle) {
    return `billingCycle is required for property type ${type}.`;
  }

  if (!config.allowedBillingCycles.includes(billingCycle)) {
    return (
      `billingCycle "${billingCycle}" is not valid for ${type}. ` +
      `Allowed values: ${config.allowedBillingCycles.join(', ')}.`
    );
  }

  return null; // valid
}