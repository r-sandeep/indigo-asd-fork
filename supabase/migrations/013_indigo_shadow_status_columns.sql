-- ============================================================
-- Indigo Migration 013: Shadow status columns for BB check-constrained fields
-- ADDITIVE ONLY — safe to run on production.
--
-- BuildersBooks owns several text fields with check constraints that
-- restrict them to BB's own vocabulary.  The two we already hit:
--
--   jobs.status     (jobs_status_check)    → project_status  [migration 012]
--   jobs.job_type   (jobs_job_type_check)  → project_type    [migration 001]
--
-- This migration adds the same pattern to every other BB table where
-- the same problem will arise once Indigo starts writing to those tables.
--
-- Rule: NEVER set a BB-owned status field from Indigo code.
--       Always let it default.  Track Indigo state in these columns.
--
-- ┌─────────────────────────────┬──────────────────┬───────────────────────────────────────────────────┐
-- │ BB table.column             │ BB default       │ Indigo shadow column (values)                     │
-- ├─────────────────────────────┼──────────────────┼───────────────────────────────────────────────────┤
-- │ invoices.status             │ 'Draft'          │ invoice_status                                    │
-- │ expenses.status             │ 'Draft'          │ expense_status                                    │
-- │ job_change_orders.status    │ 'Pending'        │ co_status                                         │
-- │ subcontracts.status         │ 'Draft'          │ subcontract_status                                │
-- │ subcontractors.status       │ 'Active'         │ subcontractor_status                              │
-- │ subcontract_invoices.status │ 'Received'       │ sub_invoice_status                                │
-- │ subcontract_invoices.lien_waiver_status │ 'None' │ lien_waiver_review_status                     │
-- │ subcontract_change_orders.status │ 'Pending'   │ sub_co_status                                    │
-- └─────────────────────────────┴──────────────────┴───────────────────────────────────────────────────┘
-- ============================================================


-- ── invoices ──────────────────────────────────────────────────
-- BB invoices.status ('Draft') has a check constraint.
-- Indigo tracks the full invoice lifecycle here instead.

alter table invoices
  add column if not exists invoice_status text;
  -- 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void'

comment on column invoices.invoice_status is
  'Indigo invoice lifecycle. Replaces BB invoices.status for Indigo logic. '
  'Values: draft, sent, viewed, partial, paid, overdue, void.';

create index if not exists invoices_invoice_status_idx on invoices(invoice_status);


-- ── expenses ──────────────────────────────────────────────────
-- BB expenses.status ('Draft') has a check constraint.

alter table expenses
  add column if not exists expense_status text;
  -- 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected'

comment on column expenses.expense_status is
  'Indigo expense approval status. '
  'Values: draft, submitted, approved, paid, rejected.';

create index if not exists expenses_expense_status_idx on expenses(expense_status);


-- ── job_change_orders ─────────────────────────────────────────
-- BB job_change_orders.status ('Pending') has a check constraint.

alter table job_change_orders
  add column if not exists co_status text;
  -- 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'void'

comment on column job_change_orders.co_status is
  'Indigo change order workflow status. '
  'Values: draft, pending_approval, approved, rejected, void.';

create index if not exists job_change_orders_co_status_idx on job_change_orders(co_status);


-- ── subcontracts ──────────────────────────────────────────────
-- BB subcontracts.status ('Draft') has a check constraint.

alter table subcontracts
  add column if not exists subcontract_status text;
  -- 'draft' | 'sent' | 'active' | 'complete' | 'cancelled'

comment on column subcontracts.subcontract_status is
  'Indigo subcontract lifecycle status. '
  'Values: draft, sent, active, complete, cancelled.';

create index if not exists subcontracts_subcontract_status_idx on subcontracts(subcontract_status);


-- ── subcontractors ────────────────────────────────────────────
-- BB subcontractors.status ('Active') has a check constraint.

alter table subcontractors
  add column if not exists subcontractor_status text;
  -- 'active' | 'inactive' | 'pending_review'

comment on column subcontractors.subcontractor_status is
  'Indigo subcontractor qualification status. '
  'Values: active, inactive, pending_review.';

create index if not exists subcontractors_subcontractor_status_idx on subcontractors(subcontractor_status);


-- ── subcontract_invoices ──────────────────────────────────────
-- Two constrained fields: status ('Received') and lien_waiver_status ('None').

alter table subcontract_invoices
  add column if not exists sub_invoice_status text,
  -- 'received' | 'reviewing' | 'approved' | 'paid' | 'disputed'
  add column if not exists lien_waiver_review_status text;
  -- 'none' | 'requested' | 'received_conditional' | 'received_unconditional' | 'approved'

comment on column subcontract_invoices.sub_invoice_status is
  'Indigo sub-invoice approval status. '
  'Values: received, reviewing, approved, paid, disputed.';

comment on column subcontract_invoices.lien_waiver_review_status is
  'Indigo lien waiver tracking status. '
  'Values: none, requested, received_conditional, received_unconditional, approved.';

create index if not exists sub_invoices_sub_invoice_status_idx
  on subcontract_invoices(sub_invoice_status);
create index if not exists sub_invoices_lien_waiver_review_status_idx
  on subcontract_invoices(lien_waiver_review_status);


-- ── subcontract_change_orders ─────────────────────────────────
-- BB subcontract_change_orders.status ('Pending') has a check constraint.

alter table subcontract_change_orders
  add column if not exists sub_co_status text;
  -- 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'void'

comment on column subcontract_change_orders.sub_co_status is
  'Indigo sub change order workflow status. '
  'Values: draft, pending_approval, approved, rejected, void.';

create index if not exists sub_co_sub_co_status_idx
  on subcontract_change_orders(sub_co_status);
