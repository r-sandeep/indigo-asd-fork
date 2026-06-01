-- migration: 034_work_session_mileage
-- Adds a mileage column to work_sessions so employees can log miles driven
-- per shift (to/from site). Optional — null means not recorded.

alter table work_sessions
  add column if not exists mileage_miles numeric(6, 1);

comment on column work_sessions.mileage_miles is
  'Miles driven by the employee for this shift (to/from site). Entered at clock-out.';
