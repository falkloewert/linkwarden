-- Factory sandbox seed: empties every app table and creates one user. Run by the mock's
-- POST /_mock/reset before each browser test; never point it at a real database.
DO $$
DECLARE
  t text;
BEGIN
  IF current_database() <> 'linkwarden_factory' THEN
    RAISE EXCEPTION 'factory seed refuses database %', current_database();
  END IF;
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'AppMigration')
  LOOP
    EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
  END LOOP;
END $$;

-- Login: tester / factory-local-only (sandbox only). German UI, AI tagging off, no usage analytics.
INSERT INTO "User" (uuid, name, username, "emailVerified", password, locale, "shareUsageAnalytics")
VALUES (
  gen_random_uuid(), 'Factory Tester', 'tester', now(),
  '$2b$10$SFDYo5mW35fs2cay1yWpguYZZ3T96/6uB9wRev1m0ws6y6.ASMJD.',
  'de', false
);

INSERT INTO "DashboardSection" ("userId", type, "order")
VALUES (1, 'STATS', 0), (1, 'RECENT_LINKS', 1), (1, 'PINNED_LINKS', 2);
