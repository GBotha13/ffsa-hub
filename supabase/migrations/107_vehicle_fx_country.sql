-- ============================================================
-- FFSA Hub — Migration 107: Vehicle rental home-country + FX + Xero item code
-- ============================================================
-- Adds the renter's home country to a booking (drives the Xero org:
-- US → US Xero / others → SA Xero, via getXeroRegionForStudent), records
-- the live USD→ZAR rate used on each payment, and standardises every
-- vehicle's Xero item code to 'VehicleRent'. Requires migrations 103/105.
-- ============================================================

ALTER TABLE public.vehicle_bookings ADD COLUMN IF NOT EXISTS home_country text;

ALTER TABLE public.vehicle_payments ADD COLUMN IF NOT EXISTS fx_rate    numeric(12,6);
ALTER TABLE public.vehicle_payments ADD COLUMN IF NOT EXISTS usd_amount numeric(10,2);

-- All vehicle rentals post under the single Xero item code 'VehicleRent'
-- (resolves to SA 1050/No-VAT or US 1040/Tax-Exempt per the org the invoice
-- lands in). Seed the existing fleet; new vehicles default to it in code.
UPDATE public.vehicles
   SET xero_item_code = 'VehicleRent'
 WHERE xero_item_code IS NULL OR btrim(xero_item_code) = '';

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT name, xero_item_code FROM public.vehicles ORDER BY sort_order;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='vehicle_bookings' AND column_name='home_country';
-- ============================================================
