-- Add indexes to User table
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- Add indexes to Doctor table
CREATE INDEX IF NOT EXISTS "Doctor_specialization_idx" ON "Doctor"("specialization");
CREATE INDEX IF NOT EXISTS "Doctor_userId_idx" ON "Doctor"("userId");

-- Add indexes to Patient table
CREATE INDEX IF NOT EXISTS "Patient_phone_idx" ON "Patient"("phone");
CREATE INDEX IF NOT EXISTS "Patient_email_idx" ON "Patient"("email");
CREATE INDEX IF NOT EXISTS "Patient_firstName_lastName_idx" ON "Patient"("firstName", "lastName");

-- Add indexes to Appointment table
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_idx" ON "Appointment"("doctorId");
CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX IF NOT EXISTS "Appointment_dateTime_idx" ON "Appointment"("dateTime");
CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status");

-- Handle Gender enum: replace OTHER with PREFER_NOT_TO_SAY
-- Step 1: Create new enum type
CREATE TYPE "Gender_new" AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY');

-- Step 2: Alter the column to use the new type, mapping 'OTHER' to 'PREFER_NOT_TO_SAY'
ALTER TABLE "Patient" ALTER COLUMN "gender" TYPE "Gender_new" USING (
  CASE "gender"::text
    WHEN 'OTHER' THEN 'PREFER_NOT_TO_SAY'::text
    ELSE "gender"::text
  END
)::"Gender_new";

-- Step 3: Drop old enum type
DROP TYPE IF EXISTS "Gender" CASCADE;

-- Step 4: Rename new type to original name
ALTER TYPE "Gender_new" RENAME TO "Gender";
