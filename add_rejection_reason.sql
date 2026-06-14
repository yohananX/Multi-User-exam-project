-- Add rejection_reason column to subjects table
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Add rejection_reason column to images table as well (per-image rejection)
ALTER TABLE public.images
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
