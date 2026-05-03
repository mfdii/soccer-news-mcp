-- Add topics column to manager_quotes for fast topic-based retrieval
ALTER TABLE manager_quotes ADD COLUMN topics TEXT[];

-- Create GIN index for fast topic lookups
CREATE INDEX idx_manager_quotes_topics ON manager_quotes USING GIN(topics);

-- Categorize existing quotes by topic
-- Note: Quote IDs based on insertion order from seed-quotes.ts

-- Sir Alex Ferguson quotes
UPDATE manager_quotes SET topics = ARRAY['rivalry', 'passion']
WHERE quote = 'Football, bloody hell!';

UPDATE manager_quotes SET topics = ARRAY['winning', 'belief']
WHERE quote = 'If you don''t believe you can win, there is no point in getting out of bed at the end of the day.';

UPDATE manager_quotes SET topics = ARRAY['winning', 'loyalty']
WHERE quote = 'I loathe all this talk about loyalty. I prefer to win.';

-- Bill Shankly quotes
UPDATE manager_quotes SET topics = ARRAY['passion', 'philosophy']
WHERE quote = 'Some people think football is a matter of life and death. I assure you, it''s much more serious than that.';

UPDATE manager_quotes SET topics = ARRAY['leadership', 'winning']
WHERE quote = 'The socialism I believe in is everybody working for the same goal and everybody having a share in the rewards.';

-- Jose Mourinho quotes
UPDATE manager_quotes SET topics = ARRAY['leadership', 'management']
WHERE quote = 'I''m not a defender of old or new football managers. I believe in good ones and bad ones, those that achieve success and those that don''t.';

UPDATE manager_quotes SET topics = ARRAY['tactics', 'philosophy']
WHERE quote = 'Please don''t call me arrogant, but I''m European champion and I think I''m a special one.';

-- Pep Guardiola quotes
UPDATE manager_quotes SET topics = ARRAY['motivation', 'hard work']
WHERE quote = 'I don''t like it when people say: ''I like you because you''re different.'' I like it when people say: ''I like you because you work hard.''';

UPDATE manager_quotes SET topics = ARRAY['tactics', 'philosophy']
WHERE quote = 'I hate tiki-taka. Tiki-taka means passing the ball for the sake of it, with no real aim and no aggression.';

UPDATE manager_quotes SET topics = ARRAY['simplicity', 'philosophy']
WHERE quote = 'Football is simple. You are in time or too late. When you are too late, you should start sooner.';

-- Arsene Wenger quotes
UPDATE manager_quotes SET topics = ARRAY['competition', 'fighting spirit']
WHERE quote = 'At a young age winning is not the most important thing... the important thing is to develop creative and skilled players with good confidence.';

UPDATE manager_quotes SET topics = ARRAY['pressure', 'confidence']
WHERE quote = 'Pressure is something you feel when you don''t know what you''re doing.';

-- Johan Cruyff quotes
UPDATE manager_quotes SET topics = ARRAY['tactics', 'philosophy']
WHERE quote = 'Playing football is very simple, but playing simple football is the hardest thing there is.';

UPDATE manager_quotes SET topics = ARRAY['tactics', 'philosophy']
WHERE quote = 'Why couldn''t you beat a richer club? I''ve never seen a bag of money score a goal.';

UPDATE manager_quotes SET topics = ARRAY['winning', 'objectives']
WHERE quote = 'The minimum I would like to achieve is to qualify for the Champions League. It''s the most important trophy.';

UPDATE manager_quotes SET topics = ARRAY['tactics', 'philosophy']
WHERE quote = 'Choose the best player for every position, and you''ll end up not with a strong XI, but with 11 strong 1s.';

UPDATE manager_quotes SET topics = ARRAY['mistakes', 'philosophy']
WHERE quote = 'Football is a game of mistakes. Whoever makes the fewest mistakes wins.';

-- Additional mixed quotes
UPDATE manager_quotes SET topics = ARRAY['tactics', 'defense']
WHERE quote LIKE '%Attack wins you games%';

UPDATE manager_quotes SET topics = ARRAY['tactics', 'philosophy']
WHERE quote LIKE '%make the field as big as possible%';

UPDATE manager_quotes SET topics = ARRAY['tactics', 'philosophy']
WHERE quote LIKE '%goalie is the first attacker%';

-- Set default topics for any uncategorized quotes
UPDATE manager_quotes SET topics = ARRAY['general', 'philosophy']
WHERE topics IS NULL;
