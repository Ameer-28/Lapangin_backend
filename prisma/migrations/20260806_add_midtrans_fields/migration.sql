-- Add Midtrans payment fields to bookings table
ALTER TABLE "bookings" ADD COLUMN "payment_status" VARCHAR(20) NOT NULL DEFAULT 'unpaid';
ALTER TABLE "bookings" ADD COLUMN "midtrans_order_id" VARCHAR(100);
ALTER TABLE "bookings" ADD COLUMN "snap_token" VARCHAR(500);

-- Add unique constraint on midtrans_order_id
CREATE UNIQUE INDEX "bookings_midtrans_order_id_key" ON "bookings"("midtrans_order_id");
