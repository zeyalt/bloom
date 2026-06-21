-- ============================================================
-- BLOOM: Core Seed Data — Children, Categories, Activities,
--        Schedules, Senders
-- Run this second (after 01_schema.sql)
-- ============================================================

-- ============================================================
-- Children
-- ============================================================
INSERT INTO children (id, name, nickname, school, color_code, avatar_emoji) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Zayyan', NULL, 'Edgefield Primary School', '#2563EB', '🌿'),
  ('22222222-2222-2222-2222-222222222222', 'Zara',   NULL, 'Skool4Kidz',               '#DB2777', '🌸')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Activity Categories
-- ============================================================
INSERT INTO activity_categories (id, name, color_code, icon) VALUES
  ('aaaa0001-0000-0000-0000-000000000000', 'Taekwondo',               '#EF4444', 'swords'),
  ('aaaa0002-0000-0000-0000-000000000000', 'Swimming',                '#3B82F6', 'waves'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Football',                '#22C55E', 'circle-dot'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Religious Class',         '#8B5CF6', 'book-open'),
  ('aaaa0005-0000-0000-0000-000000000000', 'Academic Tuition',        '#F59E0B', 'graduation-cap'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Speedcubing',             '#F97316', 'box'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Other Hobbies',           '#EC4899', 'palette'),
  ('aaaa0008-0000-0000-0000-000000000000', 'Abacus',                  '#14B8A6', 'calculator'),
  ('aaaa0009-0000-0000-0000-000000000000', 'English Speech & Drama',  '#6366F1', 'mic'),
  ('aaaa0010-0000-0000-0000-000000000000', 'K-Pop Dance',             '#D946EF', 'music')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Senders
-- ============================================================
INSERT INTO senders (name, relationship) VALUES
  ('Zeya',        'Father'),
  ('Atiqah',      'Mother'),
  ('Both',        'Both Parents'),
  ('Grandparent', 'Grandparent'),
  ('Helper',      'Helper')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Activities — Zayyan (active)
-- ============================================================
INSERT INTO activities (id, child_id, category_id, institution, instructor_name, status, start_date, notes) VALUES
  ('bb000001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0001-0000-0000-0000-000000000000',
    'Jeong-in Taekwondo',        NULL,          'active',    '2022-11-26', 'Started with trial class Nov 2022'),
  ('bb000002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0002-0000-0000-0000-000000000000',
    'Coach Reuben (Swimming)',   'Coach Reuben','active',    '2025-11-15', 'Switched from Coach Kang Nov 2025'),
  ('bb000003-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0003-0000-0000-0000-000000000000',
    'Barca Academy',             NULL,          'active',    '2025-09-20', 'Select Team. Switched from Punggol21 CC / OnePA'),
  ('bb000004-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0004-0000-0000-0000-000000000000',
    'ALIVE (Masjid Al-Islah)',   NULL,          'active',    '2024-09-17', 'Madrasah. Previously at Masjid Al-Mawaddah, then Masjid En-Naem'),
  ('bb000005-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0004-0000-0000-0000-000000000000',
    'AQSA (Masjid Al-Islah)',    NULL,          'active',    '2025-01-09', 'Quran reading class'),
  ('bb000006-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0005-0000-0000-0000-000000000000',
    'Berries',                   NULL,          'active',    '2023-07-05', 'Chinese tuition. Started with trial class'),
  ('bb000007-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0006-0000-0000-0000-000000000000',
    'Coach Daryl (Speedcubing)', 'Daryl Tan',  'active',    '2025-05-16', '1-to-1 coaching'),
  ('bb000008-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0005-0000-0000-0000-000000000000',
    'The Learning Lab',          NULL,          'active',    '2025-10-11', 'English tuition. Starts Term 1 2026')
ON CONFLICT (id) DO NOTHING;

-- Activities — Zayyan (historical)
INSERT INTO activities (id, child_id, category_id, institution, instructor_name, status, start_date, notes) VALUES
  ('bb000009-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0002-0000-0000-0000-000000000000',
    'Coach Kang (Swimming)',       'Coach Kang',       'completed', '2025-01-11', 'Ended Nov 2025. Switched to Coach Reuben'),
  ('bb000010-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0003-0000-0000-0000-000000000000',
    'Punggol21 CC (OnePA Football)', NULL,             'completed', '2024-12-07', 'Ended ~Sep 2025. Switched to Barca Academy'),
  ('bb000011-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0007-0000-0000-0000-000000000000',
    'NK Robotics',                 NULL,               'completed', '2023-04-09', 'Term 2 & 3 2023 only'),
  ('bb000012-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0007-0000-0000-0000-000000000000',
    'Mixed Media Art (OnePA)',     NULL,               'completed', '2025-10-11', '8 classes Oct-Nov 2025'),
  ('bb000013-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0006-0000-0000-0000-000000000000',
    'Mofunland (Speedcubing)',     NULL,               'completed', '2025-01-25', 'Trial classes only'),
  ('bb000014-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0006-0000-0000-0000-000000000000',
    'Cubewerkz (Speedcubing)',     'Hong Liang',       'completed', '2025-03-19', 'Trial class only'),
  ('bb000015-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0006-0000-0000-0000-000000000000',
    'Coach Arun (Speedcubing)',    'Arun Rodrigues',   'completed', '2025-05-15', 'Trial / short engagement via Rubiks Magic')
ON CONFLICT (id) DO NOTHING;

-- Activities — Zara (active)
INSERT INTO activities (id, child_id, category_id, institution, instructor_name, status, start_date, notes) VALUES
  ('bb000020-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'aaaa0002-0000-0000-0000-000000000000',
    'Coach Reuben (Swimming)',       'Coach Reuben', 'active',    '2025-11-15', 'Switched from Coach Kang Nov 2025'),
  ('bb000021-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'aaaa0005-0000-0000-0000-000000000000',
    'Berries',                       NULL,           'active',    '2025-12-31', 'Chinese tuition. K2 level'),
  ('bb000022-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'aaaa0008-0000-0000-0000-000000000000',
    'Crestar (Abacus)',              NULL,           'active',    '2026-01-06', 'Started Term 1 2026'),
  ('bb000023-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'aaaa0009-0000-0000-0000-000000000000',
    'Crestar (English Speech & Drama)', NULL,        'active',    '2026-01-06', 'Started Term 1 2026'),
  ('bb000024-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'aaaa0010-0000-0000-0000-000000000000',
    'Crestar (K-Pop Dance)',         NULL,           'active',    '2025-06-26', 'Started Term 3 2025')
ON CONFLICT (id) DO NOTHING;

-- Activities — Zara (historical)
INSERT INTO activities (id, child_id, category_id, institution, instructor_name, status, start_date, notes) VALUES
  ('bb000025-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'aaaa0002-0000-0000-0000-000000000000',
    'Coach Kang (Swimming)',     'Coach Kang', 'completed', '2025-02-05', 'Ended Nov 2025. Switched to Coach Reuben'),
  ('bb000026-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'aaaa0007-0000-0000-0000-000000000000',
    'Mixed Media Art (OnePA)',   NULL,         'completed', '2025-10-11', '8 classes Oct-Nov 2025')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Recurring Schedules (current as of 2026)
-- ============================================================
INSERT INTO schedules (activity_id, day_of_week, start_time, end_time, duration_minutes, is_active, effective_from) VALUES
  -- Zayyan: Taekwondo — Sat 11:00-12:00 (Normal) + 12:00-13:00 (Sparring)
  ('bb000001-0000-0000-0000-000000000000', 6, '11:00', '12:00', 60,  true, '2025-01-01'),
  ('bb000001-0000-0000-0000-000000000000', 6, '12:00', '13:00', 60,  true, '2025-01-01'),
  -- Zayyan: Swimming (Coach Reuben) — Sat 08:15-09:00
  ('bb000002-0000-0000-0000-000000000000', 6, '08:15', '09:00', 45,  true, '2025-11-15'),
  -- Zayyan: Football (Barca) — Sat 09:30-11:00 + Sun 18:00-19:30
  ('bb000003-0000-0000-0000-000000000000', 6, '09:30', '11:00', 90,  true, '2025-10-01'),
  ('bb000003-0000-0000-0000-000000000000', 0, '18:00', '19:30', 90,  true, '2025-10-01'),
  -- Zayyan: ALIVE (Madrasah) — Mon 15:00-18:00
  ('bb000004-0000-0000-0000-000000000000', 1, '15:00', '18:00', 180, true, '2025-01-01'),
  -- Zayyan: AQSA (Quran) — Wed 16:00-18:00
  ('bb000005-0000-0000-0000-000000000000', 3, '16:00', '18:00', 120, true, '2025-01-01'),
  -- Zayyan: Berries (Chinese) — Wed 14:30-16:30
  ('bb000006-0000-0000-0000-000000000000', 3, '14:30', '16:30', 120, true, '2026-01-01'),
  -- Zara: Swimming (Coach Reuben) — Sat 08:15-09:00
  ('bb000020-0000-0000-0000-000000000000', 6, '08:15', '09:00', 45,  true, '2025-11-15'),
  -- Zara: Berries (Chinese) — Wed 14:30-16:15
  ('bb000021-0000-0000-0000-000000000000', 3, '14:30', '16:15', 105, true, '2025-12-31');
