-- Store the concrete SAMMwise questionnaire selections and allow derived fractional scores.
ALTER TABLE "SammAssessmentResponse"
  ADD COLUMN IF NOT EXISTS "answers" JSONB;

ALTER TABLE "SammAssessmentResponse"
  ALTER COLUMN "score" TYPE DOUBLE PRECISION USING "score"::DOUBLE PRECISION;
