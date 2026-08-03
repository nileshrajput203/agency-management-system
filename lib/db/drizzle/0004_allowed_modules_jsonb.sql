ALTER TABLE "users" ALTER COLUMN "allowed_modules" TYPE jsonb USING CASE WHEN "allowed_modules" IS NULL THEN '[]'::jsonb WHEN "allowed_modules" LIKE '[%' THEN "allowed_modules"::jsonb ELSE to_jsonb(string_to_array("allowed_modules", ',')) END;
ALTER TABLE "users" ALTER COLUMN "allowed_modules" SET DEFAULT '[]'::jsonb;
