-- Compatibility no-op.
-- The database predates Prisma's complete migration history and contains
-- orphaned ApplicationVersion rows. Do not add the historical foreign key
-- here or delete/alter those records as part of the SAMM feature.
DO $$
BEGIN
    RAISE NOTICE 'Skipping legacy schema reconciliation; preserving existing historical data.';
END $$;
