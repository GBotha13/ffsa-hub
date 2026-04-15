export const BASE_CURRENCY = "ZAR";

export const SUPPORTED_CURRENCIES = [
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "KHR", name: "Cambodian Riel", symbol: "៛" },
  { code: "PYG", name: "Paraguayan Guarani", symbol: "₲" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];
