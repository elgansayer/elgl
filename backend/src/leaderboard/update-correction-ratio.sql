-- Trigger function to automatically update correction_ratio on users table
-- when a correction is given or received.

CREATE OR REPLACE FUNCTION update_correction_ratio()
RETURNS TRIGGER AS $$
DECLARE
  given_count INTEGER;
  received_count INTEGER;
BEGIN
  -- Count corrections given by the user (where user is the author of a comment with correction_payload)
  SELECT COUNT(*) INTO given_count
  FROM moment_comments
  WHERE author_id = NEW.author_id
    AND correction_payload IS NOT NULL;

  -- Count corrections received by the user (where user is the author of the moment being corrected)
  SELECT COUNT(*) INTO received_count
  FROM moment_comments mc
  JOIN moments m ON m.id = mc.moment_id
  WHERE m.author_id = NEW.author_id
    AND mc.correction_payload IS NOT NULL;

  -- Update correction_ratio (avoid division by zero)
  IF received_count = 0 THEN
    UPDATE users
    SET correction_ratio = 1.0
    WHERE id = NEW.author_id;
  ELSE
    UPDATE users
    SET correction_ratio = LEAST(given_count::FLOAT / received_count, 10.0)
    WHERE id = NEW.author_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on moment_comments table
DROP TRIGGER IF EXISTS trg_update_correction_ratio ON moment_comments;
CREATE TRIGGER trg_update_correction_ratio
AFTER INSERT OR UPDATE OF correction_payload
ON moment_comments
FOR EACH ROW
EXECUTE FUNCTION update_correction_ratio();
