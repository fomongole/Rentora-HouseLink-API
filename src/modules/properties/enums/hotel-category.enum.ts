/**
 * HotelCategory — only applicable when PropertyType = HOTEL_LODGE.
 *
 * Determines the tier / service level of the hotel or lodge.
 * Enforced in PROPERTY_FIELD_CONFIG: shown only for HOTEL_LODGE,
 * stripped for all other types in stripInapplicableFields().
 */
export enum HotelCategory {
  ORDINARY = 'ORDINARY',
  VIP      = 'VIP',
  VVIP     = 'VVIP',
}