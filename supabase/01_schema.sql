-- ============================================================
-- BLOOM: Enrichment Tracker — Database Schema
-- Run this first in Supabase SQL Editor
-- ============================================================

-- 1. Children
CREATE TABLE IF NOT EXISTS children (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  date_of_birth DATE,
  school TEXT,
  color_code TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🌱',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Activity Categories
CREATE TABLE IF NOT EXISTS activity_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color_code TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES activity_categories(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  instructor_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'dropped')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Recurring Schedules
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME,
  duration_minutes INT,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Attendance Logs
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  duration_minutes INT,
  status TEXT NOT NULL CHECK (status IN (
    'attended', 'absent', 'replacement', 'trial',
    'grading', 'online', 'sparring', 'competition',
    'cancelled_by_provider', 'league_game'
  )),
  sent_by TEXT,
  instructor_name TEXT,
  lesson_number TEXT,
  level TEXT,
  location TEXT,
  diary_notes TEXT,
  absence_reason TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES activity_categories(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  institution TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  paid_by TEXT NOT NULL,
  year INT NOT NULL,
  receipt_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Progress Milestones
CREATE TABLE IF NOT EXISTS milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'grading', 'level_up', 'competition', 'achievement', 'term_start', 'term_end', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Senders
CREATE TABLE IF NOT EXISTS senders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_activities_child ON activities(child_id);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category_id);
CREATE INDEX IF NOT EXISTS idx_attendance_activity ON attendance_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_attendance_child ON attendance_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_logs(status);
CREATE INDEX IF NOT EXISTS idx_expenses_child ON expenses(child_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(year);
CREATE INDEX IF NOT EXISTS idx_milestones_activity ON milestones(activity_id);
CREATE INDEX IF NOT EXISTS idx_schedules_activity ON schedules(activity_id);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT
  a.id AS activity_id,
  c.name AS child_name,
  ac.name AS category_name,
  a.institution,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE al.status = 'attended') AS attended,
  COUNT(*) FILTER (WHERE al.status = 'absent') AS absent,
  COUNT(*) FILTER (WHERE al.status = 'replacement') AS replacements,
  COUNT(*) FILTER (WHERE al.status = 'cancelled_by_provider') AS cancelled,
  ROUND(
    COUNT(*) FILTER (WHERE al.status IN ('attended', 'replacement', 'online', 'sparring', 'grading', 'competition', 'league_game'))::DECIMAL
    / NULLIF(COUNT(*), 0) * 100, 1
  ) AS attendance_rate
FROM attendance_logs al
JOIN activities a ON al.activity_id = a.id
JOIN children c ON al.child_id = c.id
JOIN activity_categories ac ON a.category_id = ac.id
GROUP BY a.id, c.name, ac.name, a.institution;

CREATE OR REPLACE VIEW v_monthly_expenses AS
SELECT
  c.name AS child_name,
  ac.name AS category_name,
  DATE_TRUNC('month', e.payment_date)::DATE AS month,
  e.year,
  SUM(e.amount) AS total_amount,
  COUNT(*) AS num_payments
FROM expenses e
JOIN children c ON e.child_id = c.id
JOIN activity_categories ac ON e.category_id = ac.id
GROUP BY c.name, ac.name, DATE_TRUNC('month', e.payment_date), e.year
ORDER BY month DESC;

CREATE OR REPLACE VIEW v_weekly_schedule AS
SELECT
  s.day_of_week,
  s.start_time,
  s.end_time,
  s.duration_minutes,
  s.location,
  a.institution,
  a.instructor_name,
  ac.name AS category_name,
  ac.color_code AS category_color,
  c.name AS child_name,
  c.color_code AS child_color
FROM schedules s
JOIN activities a ON s.activity_id = a.id
JOIN activity_categories ac ON a.category_id = ac.id
JOIN children c ON a.child_id = c.id
WHERE s.is_active = true
  AND a.status = 'active'
ORDER BY s.day_of_week, s.start_time;

-- ============================================================
-- DISABLE RLS (single-user app, no auth in Phase 1)
-- ============================================================
ALTER TABLE children DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE senders DISABLE ROW LEVEL SECURITY;
