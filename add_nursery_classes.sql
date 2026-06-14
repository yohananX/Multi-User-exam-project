-- Add Nursery 1 and Nursery 2 classes with their subjects
-- Required: at least one school must already exist

DO $$
DECLARE
  school_id_var BIGINT;
  nursery1_id BIGINT;
  nursery2_id BIGINT;
BEGIN
  -- Find the first school (or create "Default School")
  SELECT id INTO school_id_var FROM public.schools ORDER BY id LIMIT 1;
  IF school_id_var IS NULL THEN
    INSERT INTO public.schools (name) VALUES ('Default School') RETURNING id INTO school_id_var;
  END IF;

  -- Create or get Nursery 1 class
  SELECT id INTO nursery1_id FROM public.classes WHERE name = 'Nursery 1' AND school_id = school_id_var;
  IF nursery1_id IS NULL THEN
    INSERT INTO public.classes (name, section, school_id)
    VALUES ('Nursery 1', 'Nursery', school_id_var)
    RETURNING id INTO nursery1_id;
  END IF;

  -- Create or get Nursery 2 class
  SELECT id INTO nursery2_id FROM public.classes WHERE name = 'Nursery 2' AND school_id = school_id_var;
  IF nursery2_id IS NULL THEN
    INSERT INTO public.classes (name, section, school_id)
    VALUES ('Nursery 2', 'Nursery', school_id_var)
    RETURNING id INTO nursery2_id;
  END IF;

  -- Add subjects for Nursery 1
  INSERT INTO public.subjects (name, class_id)
  SELECT v.name, nursery1_id
  FROM (VALUES
    ('English Studies'),
    ('Mathematics'),
    ('Basic Science'),
    ('Social Studies'),
    ('Health & Physical Education'),
    ('Creative Arts'),
    ('Handwriting'),
    ('Phonics & Rhymes'),
    ('Moral Instruction')
  ) AS v(name)
  WHERE nursery1_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.subjects s WHERE s.name = v.name AND s.class_id = nursery1_id
    );

  -- Add subjects for Nursery 2
  INSERT INTO public.subjects (name, class_id)
  SELECT v.name, nursery2_id
  FROM (VALUES
    ('English Studies'),
    ('Mathematics'),
    ('Basic Science'),
    ('Social Studies'),
    ('Health & Physical Education'),
    ('Creative Arts'),
    ('Handwriting'),
    ('Phonics & Rhymes'),
    ('Quantitative Reasoning'),
    ('Verbal Reasoning'),
    ('Moral Instruction')
  ) AS v(name)
  WHERE nursery2_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.subjects s WHERE s.name = v.name AND s.class_id = nursery2_id
    );

  RAISE NOTICE 'Done. Nursery 1 id=%, Nursery 2 id=%', nursery1_id, nursery2_id;
END $$;
