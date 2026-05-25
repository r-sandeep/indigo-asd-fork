-- =============================================================================
-- Indigo Sample Project Data — GGB Tenant  v2
-- Idempotent: all inserts use ON CONFLICT (id) DO NOTHING.
-- Creates customers directly in the BB customers table.
-- Covers 10 jobs × 10 diverse scenarios (status, loan, permit, phases).
--
-- Run order: customers → jobs → projects → phases → milestones → draw_schedules
--
-- NOTE: milestones use fixed UUIDs so the script is fully idempotent.
-- If you ran the original seed (random UUIDs), those records still exist;
-- this script adds alongside them — clean-up is left to you.
-- =============================================================================

DO $$
DECLARE
  v_tenant_id uuid := '94019f53-f9fa-436b-8071-3b956eb596a4';
  v_pm_id     uuid;

  -- ── Customers (fixed UUIDs) ──────────────────────────────────────────────
  c1  uuid := 'a0000000-0000-0000-0000-000000000001';  -- Hernandez
  c2  uuid := 'a0000000-0000-0000-0000-000000000002';  -- Johnson
  c3  uuid := 'a0000000-0000-0000-0000-000000000003';  -- Martinez
  c4  uuid := 'a0000000-0000-0000-0000-000000000004';  -- Thompson
  c5  uuid := 'a0000000-0000-0000-0000-000000000005';  -- Wong
  c6  uuid := 'a0000000-0000-0000-0000-000000000006';  -- Kim
  c7  uuid := 'a0000000-0000-0000-0000-000000000007';  -- Nguyen
  c8  uuid := 'a0000000-0000-0000-0000-000000000008';  -- Davis
  c9  uuid := 'a0000000-0000-0000-0000-000000000009';  -- Chen
  c10 uuid := 'a0000000-0000-0000-0000-00000000000a';  -- Ramirez

  -- ── Jobs (fixed UUIDs) ──────────────────────────────────────────────────
  j1  uuid := 'b0000000-0000-0000-0000-000000000001';  -- GGB-2025-001 Hernandez
  j2  uuid := 'b0000000-0000-0000-0000-000000000002';  -- GGB-2025-002 Johnson
  j3  uuid := 'b0000000-0000-0000-0000-000000000003';  -- GGB-2025-003 Martinez
  j4  uuid := 'b0000000-0000-0000-0000-000000000004';  -- GGB-2025-004 Thompson
  j5  uuid := 'b0000000-0000-0000-0000-000000000005';  -- GGB-2024-047 Wong
  j6  uuid := 'b0000000-0000-0000-0000-000000000006';  -- GGB-2025-005 Kim
  j7  uuid := 'b0000000-0000-0000-0000-000000000007';  -- GGB-2025-006 Nguyen
  j8  uuid := 'b0000000-0000-0000-0000-000000000008';  -- GGB-2025-007 Davis
  j9  uuid := 'b0000000-0000-0000-0000-000000000009';  -- GGB-2024-046 Chen
  j10 uuid := 'b0000000-0000-0000-0000-00000000000a';  -- GGB-2025-008 Ramirez

  -- ── Projects (fixed UUIDs) ──────────────────────────────────────────────
  p1  uuid := 'c0000000-0000-0000-0000-000000000001';
  p2  uuid := 'c0000000-0000-0000-0000-000000000002';
  p3  uuid := 'c0000000-0000-0000-0000-000000000003';
  p4  uuid := 'c0000000-0000-0000-0000-000000000004';
  p5  uuid := 'c0000000-0000-0000-0000-000000000005';
  p6  uuid := 'c0000000-0000-0000-0000-000000000006';
  p7  uuid := 'c0000000-0000-0000-0000-000000000007';
  p8  uuid := 'c0000000-0000-0000-0000-000000000008';
  p9  uuid := 'c0000000-0000-0000-0000-000000000009';
  p10 uuid := 'c0000000-0000-0000-0000-00000000000a';

  -- ── Phases ──────────────────────────────────────────────────────────────
  -- Hernandez (p1): 3 phases  complete / in_progress / not_started
  ph1a uuid := 'd0000000-0000-0000-0000-000000000001';
  ph1b uuid := 'd0000000-0000-0000-0000-000000000002';
  ph1c uuid := 'd0000000-0000-0000-0000-000000000003';
  -- Martinez ADU (p3): 2 phases  complete / in_progress
  ph3a uuid := 'd0000000-0000-0000-0000-000000000004';
  ph3b uuid := 'd0000000-0000-0000-0000-000000000005';
  -- Kim New Build (p6): 2 phases  approved / in_progress  (job is OVERDUE)
  ph6a uuid := 'd0000000-0000-0000-0000-000000000006';
  ph6b uuid := 'd0000000-0000-0000-0000-000000000007';
  -- Nguyen on_hold (p7): 1 phase  blocked
  ph7a uuid := 'd0000000-0000-0000-0000-000000000008';
  -- Chen complete (p9): 2 phases  both complete
  ph9a uuid := 'd0000000-0000-0000-0000-000000000009';
  ph9b uuid := 'd0000000-0000-0000-0000-00000000000a';

  -- ── Milestones — Hernandez p1 (12 total) ────────────────────────────────
  -- Phase 1a: 4/4 complete
  m1a1 uuid := 'e1000000-0000-0000-0000-000000000001';
  m1a2 uuid := 'e1000000-0000-0000-0000-000000000002';
  m1a3 uuid := 'e1000000-0000-0000-0000-000000000003';
  m1a4 uuid := 'e1000000-0000-0000-0000-000000000004';
  -- Phase 1b: 1 complete, 1 in_progress, 2 not_started
  m1b1 uuid := 'e1000000-0000-0000-0000-000000000005';
  m1b2 uuid := 'e1000000-0000-0000-0000-000000000006';
  m1b3 uuid := 'e1000000-0000-0000-0000-000000000007';
  m1b4 uuid := 'e1000000-0000-0000-0000-000000000008';
  -- Phase 1c: 0/4 (not_started)
  m1c1 uuid := 'e1000000-0000-0000-0000-000000000009';
  m1c2 uuid := 'e1000000-0000-0000-0000-00000000000a';
  m1c3 uuid := 'e1000000-0000-0000-0000-00000000000b';
  m1c4 uuid := 'e1000000-0000-0000-0000-00000000000c';

  -- ── Milestones — Martinez p3 (8 total) ──────────────────────────────────
  m3a1 uuid := 'e3000000-0000-0000-0000-000000000001';
  m3a2 uuid := 'e3000000-0000-0000-0000-000000000002';
  m3a3 uuid := 'e3000000-0000-0000-0000-000000000003';
  m3a4 uuid := 'e3000000-0000-0000-0000-000000000004';
  m3b1 uuid := 'e3000000-0000-0000-0000-000000000005';
  m3b2 uuid := 'e3000000-0000-0000-0000-000000000006';
  m3b3 uuid := 'e3000000-0000-0000-0000-000000000007';
  m3b4 uuid := 'e3000000-0000-0000-0000-000000000008';

  -- ── Milestones — Kim p6 (10 total) ──────────────────────────────────────
  m6a1 uuid := 'e6000000-0000-0000-0000-000000000001';
  m6a2 uuid := 'e6000000-0000-0000-0000-000000000002';
  m6a3 uuid := 'e6000000-0000-0000-0000-000000000003';
  m6a4 uuid := 'e6000000-0000-0000-0000-000000000004';
  m6a5 uuid := 'e6000000-0000-0000-0000-000000000005';
  m6b1 uuid := 'e6000000-0000-0000-0000-000000000006';
  m6b2 uuid := 'e6000000-0000-0000-0000-000000000007';
  m6b3 uuid := 'e6000000-0000-0000-0000-000000000008';
  m6b4 uuid := 'e6000000-0000-0000-0000-000000000009';
  m6b5 uuid := 'e6000000-0000-0000-0000-00000000000a';

  -- ── Milestones — Nguyen p7 (4 total) ────────────────────────────────────
  m7a1 uuid := 'e7000000-0000-0000-0000-000000000001';
  m7a2 uuid := 'e7000000-0000-0000-0000-000000000002';
  m7a3 uuid := 'e7000000-0000-0000-0000-000000000003';
  m7a4 uuid := 'e7000000-0000-0000-0000-000000000004';

  -- ── Milestones — Chen p9 (8 total) ──────────────────────────────────────
  m9a1 uuid := 'e9000000-0000-0000-0000-000000000001';
  m9a2 uuid := 'e9000000-0000-0000-0000-000000000002';
  m9a3 uuid := 'e9000000-0000-0000-0000-000000000003';
  m9a4 uuid := 'e9000000-0000-0000-0000-000000000004';
  m9b1 uuid := 'e9000000-0000-0000-0000-000000000005';
  m9b2 uuid := 'e9000000-0000-0000-0000-000000000006';
  m9b3 uuid := 'e9000000-0000-0000-0000-000000000007';
  m9b4 uuid := 'e9000000-0000-0000-0000-000000000008';

  -- ── Draw Schedules ───────────────────────────────────────────────────────
  ds1 uuid := 'f0000000-0000-0000-0000-000000000001';  -- Hernandez
  ds3 uuid := 'f0000000-0000-0000-0000-000000000003';  -- Martinez
  ds6 uuid := 'f0000000-0000-0000-0000-000000000006';  -- Kim

BEGIN

  -- -------------------------------------------------------------------------
  -- 0. Resolve PM user
  -- -------------------------------------------------------------------------
  SELECT id INTO v_pm_id
  FROM auth.users
  WHERE email = 'santosh@goodguybuilders.com'
  LIMIT 1;

  IF v_pm_id IS NULL THEN
    RAISE EXCEPTION 'PM user santosh@goodguybuilders.com not found. Run create_superadmin.sql first.';
  END IF;

  -- -------------------------------------------------------------------------
  -- 1. Customers
  --    Inserting directly into the BB customers table.
  --    customer_name is the single combined name field — no first_name/last_name.
  -- -------------------------------------------------------------------------
  INSERT INTO public.customers (
    id, tenant_id, customer_name, company, email, phone,
    billing_address, property_address, notes, is_active
  ) VALUES
    (c1,  v_tenant_id, 'Marcus & Rachel Hernandez', '',                       'marcus.hernandez@email.com',   '(310) 555-0101',
     '1842 Westwood Blvd, Los Angeles, CA 90024',  '1842 Westwood Blvd, Los Angeles, CA 90024',  'Primary contact: Marcus. Morning site visits preferred.',         true),
    (c2,  v_tenant_id, 'David Johnson',             '',                       'djohnson@email.com',           '(626) 555-0202',
     '327 Oak Knoll Ave, Pasadena, CA 91103',       '327 Oak Knoll Ave, Pasadena, CA 91103',       'Cabinets arrive May 12. Client travels Mondays.',                 true),
    (c3,  v_tenant_id, 'Elena & Carlos Martinez',   '',                       'emartinez@email.com',          '(818) 555-0303',
     '4418 Kenneth Rd, Glendale, CA 91205',         '4418 Kenneth Rd, Glendale, CA 91205',         'Wants weekly photo updates to client portal.',                    true),
    (c4,  v_tenant_id, 'William Thompson',          'Thompson Development LLC','wt@thompsondev.com',           '(310) 555-0404',
     '750 Loma Vista Dr, Beverly Hills, CA 90210',  '750 Loma Vista Dr, Beverly Hills, CA 90210',  'High-value client. Architect: Tanner & Associates.',              true),
    (c5,  v_tenant_id, 'Jennifer Wong',             '',                       'jwong@email.com',              '(818) 555-0505',
     '2211 N Frederic St, Burbank, CA 91502',       '2211 N Frederic St, Burbank, CA 91502',       'Job complete. Excellent reference — referred Chen family.',        true),
    (c6,  v_tenant_id, 'Michael & Sarah Kim',       '',                       'mskim@email.com',              '(310) 555-0606',
     '1204 Alta Ave, Santa Monica, CA 90402',       '1204 Alta Ave, Santa Monica, CA 90402',       'Architect: Patel & Cruz Design. Weekly OAC meetings Tuesdays.',   true),
    (c7,  v_tenant_id, 'Nguyen Family Trust',       '',                       'trust@nguyen-family.com',      '(213) 555-0707',
     '3340 Descanso Dr, Los Angeles, CA 90026',     '3340 Descanso Dr, Los Angeles, CA 90026',     'Project on hold — client traveling internationally, resumes Q3.', true),
    (c8,  v_tenant_id, 'Patricia Davis',            '',                       'pdavis@email.com',             '(818) 555-0808',
     '8823 Jumilla Ave, Winnetka, CA 91306',        '8823 Jumilla Ave, Winnetka, CA 91306',        '',                                                                true),
    (c9,  v_tenant_id, 'Robert & Linda Chen',       '',                       'bobchen@email.com',            '(626) 555-0909',
     '445 Arden Rd, Pasadena, CA 91106',            '445 Arden Rd, Pasadena, CA 91106',            'Referred by Wong family. Excellent clients.',                     true),
    (c10, v_tenant_id, 'Carmen Ramirez',            '',                       'cramirez@email.com',           '(323) 555-0010',
     '2019 W 23rd St, Los Angeles, CA 90018',       '2019 W 23rd St, Los Angeles, CA 90018',       'Awaiting HOA approval before signing. Budget-conscious.',         true)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 2. Jobs
  --
  --  #  | Job #         | Client      | Status   | Type    | Loan | Permit | Phases
  -- ----+---------------+-------------+----------+---------+------+--------+-------
  --  1  | GGB-2025-001  | Hernandez   | active   | custom  |  ✓   |  ✓     |  3 (complete/in_progress/not_started)
  --  2  | GGB-2025-002  | Johnson     | active   | express |      |        |  none
  --  3  | GGB-2025-003  | Martinez    | active   | custom  |  ✓   |  ✓     |  2 (complete/in_progress)
  --  4  | GGB-2025-004  | Thompson    | bidding  | custom  |      |        |  none (no dates)
  --  5  | GGB-2024-047  | Wong        | complete | express |      |        |  none (actual_completion set)
  --  6  | GGB-2025-005  | Kim         | active   | custom  |  ✓   |  ✓     |  2 (approved/in_progress — OVERDUE)
  --  7  | GGB-2025-006  | Nguyen      | on_hold  | custom  |      |  ✓     |  1 (blocked)
  --  8  | GGB-2025-007  | Davis       | active   | express |      |  ✓     |  none
  --  9  | GGB-2024-046  | Chen        | complete | custom  |      |  ✓     |  2 (both complete)
  -- 10  | GGB-2025-008  | Ramirez     | bidding  | express |      |        |  none (awaiting HOA)
  -- -------------------------------------------------------------------------
  INSERT INTO public.jobs (
    id, tenant_id, job_number, job_name, customer_id,
    status, job_type, project_type, project_status,
    start_date, target_completion, actual_completion,
    contract_amount_cents, current_contract_cents, contract_value_cents,
    address_line1, city, state, zip, job_address,
    description, notes, internal_notes,
    has_construction_loan, pm_user_id,
    permit_number, permit_issued_date, permit_expiry_date,
    lender_name, loan_amount_cents,
    package_name, tags
  ) VALUES

  -- 1. Hernandez — Active Custom, construction loan, 3 phases in progress
  (j1, v_tenant_id, 'GGB-2025-001', 'Hernandez Residence — Full Remodel', c1,
   'Estimate', 'General', 'custom', 'active',
   '2025-02-10', '2025-11-30', null,
   48500000, 51200000, 48500000,
   '1842 Westwood Blvd', 'Los Angeles', 'CA', '90024', '1842 Westwood Blvd, Los Angeles, CA 90024',
   'Full gut renovation of 3,200 sq ft single-family residence. Includes new kitchen, two full bathroom remodels, master suite addition, and complete HVAC replacement.',
   'Client prefers morning site visits. Code compliance review in progress.',
   'Watch permit timeline — city has been slow on inspections.',
   true, v_pm_id,
   'BLD-2025-04412', '2025-01-28', '2026-01-27',
   'Pacific Premier Bank', 62000000,
   'Premium Interior', ARRAY['remodel', 'addition', 'hvac']),

  -- 2. Johnson — Active Express, no phases, no loan
  (j2, v_tenant_id, 'GGB-2025-002', 'Johnson Kitchen & Bath Renovation', c2,
   'Estimate', 'General', 'express', 'active',
   '2025-04-01', '2025-07-15', null,
   6250000, 6250000, 6250000,
   '327 Oak Knoll Ave', 'Pasadena', 'CA', '91103', '327 Oak Knoll Ave, Pasadena, CA 91103',
   'Kitchen full remodel and two bathroom updates. New cabinetry, countertops, tile, and fixtures throughout.',
   'Materials ordered — cabinets arrive May 12.',
   null,
   false, v_pm_id,
   null, null, null,
   null, null,
   'Express Kitchen', ARRAY['kitchen', 'bath', 'express']),

  -- 3. Martinez — Active Custom, construction loan, 2 phases in progress
  (j3, v_tenant_id, 'GGB-2025-003', 'Martinez Detached ADU', c3,
   'Estimate', 'General', 'custom', 'active',
   '2025-03-15', '2025-12-20', null,
   29500000, 31800000, 29500000,
   '4418 Kenneth Rd', 'Glendale', 'CA', '91205', '4418 Kenneth Rd, Glendale, CA 91205',
   'New detached ADU, 1,100 sq ft, 2BR/1BA. Includes separate utility meters, covered parking, and landscaped separation from main house.',
   'Client wants weekly photo updates sent to client portal.',
   'Subcontractor bids for framing still pending.',
   true, v_pm_id,
   'ADU-2025-00887', '2025-02-20', '2026-02-19',
   'First Republic Bank', 37500000,
   'ADU Standard', ARRAY['adu', 'new-construction']),

  -- 4. Thompson Estate — Bidding, no dates, large contract
  (j4, v_tenant_id, 'GGB-2025-004', 'Thompson Estate — New Construction', c4,
   'Estimate', 'General', 'custom', 'bidding',
   null, null, null,
   185000000, null, null,
   '750 Loma Vista Dr', 'Beverly Hills', 'CA', '90210', '750 Loma Vista Dr, Beverly Hills, CA 90210',
   'Custom 6,400 sq ft estate on 0.8 acre lot. Full scope includes pool house, detached garage, smart home integration, and custom millwork throughout.',
   'Bid review meeting scheduled for June 3. Architect: Tanner & Associates.',
   'High-value client — flag for priority scheduling if bid accepted.',
   false, v_pm_id,
   null, null, null,
   null, null,
   'Estate Premium', ARRAY['new-construction', 'luxury', 'pool']),

  -- 5. Wong — Complete Express, punch list cleared
  (j5, v_tenant_id, 'GGB-2024-047', 'Wong Master Bathroom Remodel', c5,
   'Estimate', 'General', 'express', 'complete',
   '2024-10-07', '2024-12-15', '2024-12-12',
   3875000, 3875000, 3875000,
   '2211 N Frederic St', 'Burbank', 'CA', '91502', '2211 N Frederic St, Burbank, CA 91502',
   'Master bathroom gut renovation. Walk-in shower, freestanding tub, heated floors, custom vanity.',
   'Final punch list cleared Dec 12. Client signed off.',
   null,
   false, v_pm_id,
   null, null, null,
   null, null,
   'Express Bath', ARRAY['bath', 'express']),

  -- 6. Kim — Active Custom, construction loan, OVERDUE (target was April 2025, now past)
  --    Rain delays pushed schedule ~6 weeks. Tests the "overdue" metric card.
  (j6, v_tenant_id, 'GGB-2025-005', 'Kim Residence — New Custom Build', c6,
   'Estimate', 'General', 'custom', 'active',
   '2024-09-15', '2025-04-30', null,
   92500000, 97800000, 92500000,
   '1204 Alta Ave', 'Santa Monica', 'CA', '90402', '1204 Alta Ave, Santa Monica, CA 90402',
   'New 2,800 sq ft single-family residence on existing footprint. Includes detached 2-car garage, rooftop deck, and fully integrated Crestron smart home system.',
   'Structural engineer sign-off pending. Client approved all selections Jan 15.',
   'Rain delays pushed schedule ~6 weeks. Client is aware.',
   true, v_pm_id,
   'SFD-2024-01193', '2024-08-10', '2025-08-09',
   'Western Alliance Bank', 115000000,
   'Custom New Build', ARRAY['new-construction', 'smart-home']),

  -- 7. Nguyen — On Hold, 1 blocked phase (permit stuck in plan check)
  (j7, v_tenant_id, 'GGB-2025-006', 'Nguyen Residence — Kitchen + Primary Suite', c7,
   'Estimate', 'General', 'custom', 'on_hold',
   '2025-03-01', '2025-09-30', null,
   18400000, 18400000, 18400000,
   '3340 Descanso Dr', 'Los Angeles', 'CA', '90026', '3340 Descanso Dr, Los Angeles, CA 90026',
   'Full kitchen gut remodel and primary suite expansion (~350 sq ft addition), new walk-in closet, and spa bathroom.',
   'Project on hold — owner traveling internationally. Resumes Q3 2025.',
   'Materials and sub bids locked. Ready to restart on short notice.',
   false, v_pm_id,
   'BLD-2025-06210', '2025-02-14', '2026-02-13',
   null, null,
   'Premium Interior', ARRAY['remodel', 'addition']),

  -- 8. Davis — Active Express ADU, permit in hand, no phases
  (j8, v_tenant_id, 'GGB-2025-007', 'Davis Detached ADU', c8,
   'Estimate', 'General', 'express', 'active',
   '2025-05-01', '2025-08-31', null,
   15200000, 15200000, 15200000,
   '8823 Jumilla Ave', 'Winnetka', 'CA', '91306', '8823 Jumilla Ave, Winnetka, CA 91306',
   'Detached 800 sq ft ADU, 1BR/1BA. City-approved standard plan set. Minimal site modifications required.',
   'Owner will vacate during construction. Neighbor coordination needed at start.',
   null,
   false, v_pm_id,
   'ADU-2025-03341', '2025-04-05', '2026-04-04',
   null, null,
   'ADU Express', ARRAY['adu', 'express']),

  -- 9. Chen — Complete Custom, all phases done, permit on file
  (j9, v_tenant_id, 'GGB-2024-046', 'Chen Master Suite Addition', c9,
   'Estimate', 'General', 'custom', 'complete',
   '2024-06-10', '2024-10-31', '2024-10-28',
   22750000, 23900000, 22750000,
   '445 Arden Rd', 'Pasadena', 'CA', '91106', '445 Arden Rd, Pasadena, CA 91106',
   'Master suite addition approximately 480 sq ft. New primary bedroom, walk-in closet, spa bathroom with steam shower, and private deck.',
   'Excellent execution. Client left 5-star review. Strong referral source.',
   null,
   false, v_pm_id,
   'BLD-2024-08821', '2024-05-28', '2025-05-27',
   null, null,
   'Custom Addition', ARRAY['addition', 'bath']),

  -- 10. Ramirez — Bidding Express, awaiting HOA approval
  (j10, v_tenant_id, 'GGB-2025-008', 'Ramirez Primary Bathroom Remodel', c10,
   'Estimate', 'General', 'express', 'bidding',
   null, null, null,
   3200000, null, null,
   '2019 W 23rd St', 'Los Angeles', 'CA', '90018', '2019 W 23rd St, Los Angeles, CA 90018',
   'Primary bathroom gut remodel. Walk-in shower conversion, new vanity, tile throughout.',
   'Awaiting HOA approval letter before contract signing.',
   'Small job but easy margins. Good neighborhood referral potential.',
   false, v_pm_id,
   null, null, null,
   null, null,
   'Express Bath', ARRAY['bath', 'express'])

  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 3. Projects (thin join table)
  -- -------------------------------------------------------------------------
  INSERT INTO public.projects (id, tenant_id, job_id, created_by)
  VALUES
    (p1,  v_tenant_id, j1,  v_pm_id),
    (p2,  v_tenant_id, j2,  v_pm_id),
    (p3,  v_tenant_id, j3,  v_pm_id),
    (p4,  v_tenant_id, j4,  v_pm_id),
    (p5,  v_tenant_id, j5,  v_pm_id),
    (p6,  v_tenant_id, j6,  v_pm_id),
    (p7,  v_tenant_id, j7,  v_pm_id),
    (p8,  v_tenant_id, j8,  v_pm_id),
    (p9,  v_tenant_id, j9,  v_pm_id),
    (p10, v_tenant_id, j10, v_pm_id)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 4. Phases — Hernandez (p1)
  --    Phase 1: Demo & Rough-In     → complete (4/4 milestones done)
  --    Phase 2: Framing & MEP       → in_progress (1/4 done, 1 in_progress, 2 pending)
  --    Phase 3: Finishes & Close-Out → not_started (0/4)
  -- -------------------------------------------------------------------------
  INSERT INTO public.project_phases (id, project_id, tenant_id, name, sequence, status, color, start_date, end_date)
  VALUES
    (ph1a, p1, v_tenant_id, 'Demo & Rough-In',        1, 'complete',    '#16a34a', '2025-02-10', '2025-04-15'),
    (ph1b, p1, v_tenant_id, 'Framing & MEP',           2, 'in_progress', '#6366f1', '2025-04-16', '2025-07-01'),
    (ph1c, p1, v_tenant_id, 'Finishes & Close-Out',    3, 'not_started', '#d1d5db', '2025-07-02', '2025-11-30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.milestones (
    id, project_id, tenant_id, phase_id, name, status, sequence,
    due_date, completed_date,
    is_client_visible, requires_client_approval, triggers_draw_request, triggers_invoice
  ) VALUES
    -- Phase 1a — all complete
    (m1a1, p1, v_tenant_id, ph1a, 'Demolition Complete',         'complete',    1,  '2025-02-28', '2025-02-27', true,  false, false, false),
    (m1a2, p1, v_tenant_id, ph1a, 'Rough Plumbing Inspection',   'complete',    2,  '2025-03-20', '2025-03-22', false, false, false, false),
    (m1a3, p1, v_tenant_id, ph1a, 'Rough Electrical Inspection', 'complete',    3,  '2025-04-05', '2025-04-08', false, false, false, false),
    (m1a4, p1, v_tenant_id, ph1a, 'Foundation Draw Request',     'complete',    4,  '2025-04-10', '2025-04-10', true,  true,  true,  true),
    -- Phase 1b — mixed states
    (m1b1, p1, v_tenant_id, ph1b, 'Framing Complete',            'complete',    5,  '2025-05-15', '2025-05-18', true,  false, false, false),
    (m1b2, p1, v_tenant_id, ph1b, 'HVAC Rough-In',               'in_progress', 6,  '2025-06-01', null,         false, false, false, false),
    (m1b3, p1, v_tenant_id, ph1b, 'Insulation & Drywall',        'not_started', 7,  '2025-06-20', null,         false, false, false, false),
    (m1b4, p1, v_tenant_id, ph1b, 'Framing Draw Request',        'not_started', 8,  '2025-06-25', null,         true,  true,  true,  true),
    -- Phase 1c — all not started
    (m1c1, p1, v_tenant_id, ph1c, 'Tile & Flooring',             'not_started', 9,  '2025-08-15', null,         false, false, false, false),
    (m1c2, p1, v_tenant_id, ph1c, 'Cabinetry Install',           'not_started', 10, '2025-09-01', null,         true,  false, false, false),
    (m1c3, p1, v_tenant_id, ph1c, 'Final Inspection',            'not_started', 11, '2025-11-10', null,         true,  true,  false, false),
    (m1c4, p1, v_tenant_id, ph1c, 'Final Draw & Completion',     'not_started', 12, '2025-11-30', null,         true,  true,  true,  true)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 5. Phases — Martinez ADU (p3)
  -- -------------------------------------------------------------------------
  INSERT INTO public.project_phases (id, project_id, tenant_id, name, sequence, status, color, start_date, end_date)
  VALUES
    (ph3a, p3, v_tenant_id, 'Site Work & Foundation', 1, 'complete',    '#16a34a', '2025-03-15', '2025-05-10'),
    (ph3b, p3, v_tenant_id, 'Framing & Enclosure',    2, 'in_progress', '#6366f1', '2025-05-11', '2025-08-30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.milestones (
    id, project_id, tenant_id, phase_id, name, status, sequence,
    due_date, completed_date,
    is_client_visible, requires_client_approval, triggers_draw_request, triggers_invoice
  ) VALUES
    (m3a1, p3, v_tenant_id, ph3a, 'Site Grading Complete',   'complete',    1, '2025-03-25', '2025-03-26', false, false, false, false),
    (m3a2, p3, v_tenant_id, ph3a, 'Foundation Poured',       'complete',    2, '2025-04-15', '2025-04-18', true,  false, false, false),
    (m3a3, p3, v_tenant_id, ph3a, 'Foundation Inspection',   'complete',    3, '2025-04-30', '2025-05-02', false, false, false, false),
    (m3a4, p3, v_tenant_id, ph3a, 'Foundation Draw Request', 'complete',    4, '2025-05-05', '2025-05-06', true,  true,  true,  true),
    (m3b1, p3, v_tenant_id, ph3b, 'Framing Started',         'complete',    5, '2025-05-20', '2025-05-21', true,  false, false, false),
    (m3b2, p3, v_tenant_id, ph3b, 'Roof Sheathing',          'in_progress', 6, '2025-06-15', null,         false, false, false, false),
    (m3b3, p3, v_tenant_id, ph3b, 'Windows & Doors',         'not_started', 7, '2025-07-10', null,         true,  false, false, false),
    (m3b4, p3, v_tenant_id, ph3b, 'Weathertight Inspection', 'not_started', 8, '2025-08-01', null,         false, false, false, false)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 6. Phases — Kim New Build (p6) — job is OVERDUE (target April 2025)
  --    Phase 1: approved (all milestones done, draw funded)
  --    Phase 2: in_progress (partial, overdue)
  -- -------------------------------------------------------------------------
  INSERT INTO public.project_phases (id, project_id, tenant_id, name, sequence, status, color, start_date, end_date)
  VALUES
    (ph6a, p6, v_tenant_id, 'Site & Foundation',     1, 'approved',    '#16a34a', '2024-09-15', '2024-12-20'),
    (ph6b, p6, v_tenant_id, 'Structure & Enclosure', 2, 'in_progress', '#6366f1', '2025-01-06', '2025-04-30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.milestones (
    id, project_id, tenant_id, phase_id, name, status, sequence,
    due_date, completed_date,
    is_client_visible, requires_client_approval, triggers_draw_request, triggers_invoice
  ) VALUES
    -- Phase 6a — all complete/approved
    (m6a1, p6, v_tenant_id, ph6a, 'Site Clearing & Grading',   'complete', 1, '2024-09-30', '2024-09-28', false, false, false, false),
    (m6a2, p6, v_tenant_id, ph6a, 'Foundation Excavation',     'complete', 2, '2024-10-20', '2024-10-22', false, false, false, false),
    (m6a3, p6, v_tenant_id, ph6a, 'Foundation Poured & Cured', 'complete', 3, '2024-11-15', '2024-11-17', true,  false, false, false),
    (m6a4, p6, v_tenant_id, ph6a, 'Foundation Draw Request',   'approved', 4, '2024-11-20', '2024-11-21', true,  true,  true,  true),
    (m6a5, p6, v_tenant_id, ph6a, 'Slab On Grade',             'complete', 5, '2024-12-10', '2024-12-12', false, false, false, false),
    -- Phase 6b — in progress, running late
    (m6b1, p6, v_tenant_id, ph6b, 'Framing Level 1',            'complete',    6, '2025-02-01', '2025-02-04', true,  false, false, false),
    (m6b2, p6, v_tenant_id, ph6b, 'Framing Level 2',            'complete',    7, '2025-02-28', '2025-03-05', false, false, false, false),
    (m6b3, p6, v_tenant_id, ph6b, 'Roof Framing & Sheathing',   'in_progress', 8, '2025-03-25', null,         false, false, false, false),
    (m6b4, p6, v_tenant_id, ph6b, 'Framing Draw Request',       'not_started', 9, '2025-04-15', null,         true,  true,  true,  true),
    (m6b5, p6, v_tenant_id, ph6b, 'Windows & Doors Installed',  'not_started', 10, '2025-04-28', null,        true,  false, false, false)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 7. Phases — Nguyen on_hold (p7) — plan check blocked
  -- -------------------------------------------------------------------------
  INSERT INTO public.project_phases (id, project_id, tenant_id, name, sequence, status, color, start_date, end_date)
  VALUES
    (ph7a, p7, v_tenant_id, 'Design & Permits', 1, 'blocked', '#ef4444', '2025-03-01', '2025-04-30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.milestones (
    id, project_id, tenant_id, phase_id, name, status, sequence,
    due_date, completed_date,
    is_client_visible, requires_client_approval, triggers_draw_request, triggers_invoice
  ) VALUES
    (m7a1, p7, v_tenant_id, ph7a, 'Design Development Complete', 'complete',    1, '2025-03-15', '2025-03-14', true,  false, false, false),
    (m7a2, p7, v_tenant_id, ph7a, 'Plan Check Submitted',        'complete',    2, '2025-03-20', '2025-03-20', false, false, false, false),
    (m7a3, p7, v_tenant_id, ph7a, 'Plan Check Approved',         'blocked',     3, '2025-04-15', null,         false, false, false, false),
    (m7a4, p7, v_tenant_id, ph7a, 'Permit Issued',               'not_started', 4, '2025-04-25', null,         true,  false, false, false)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 8. Phases — Chen Master Suite (p9) — all phases complete
  -- -------------------------------------------------------------------------
  INSERT INTO public.project_phases (id, project_id, tenant_id, name, sequence, status, color, start_date, end_date)
  VALUES
    (ph9a, p9, v_tenant_id, 'Demo & Framing', 1, 'complete', '#16a34a', '2024-06-10', '2024-08-15'),
    (ph9b, p9, v_tenant_id, 'Finishes',       2, 'complete', '#16a34a', '2024-08-16', '2024-10-28')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.milestones (
    id, project_id, tenant_id, phase_id, name, status, sequence,
    due_date, completed_date,
    is_client_visible, requires_client_approval, triggers_draw_request, triggers_invoice
  ) VALUES
    (m9a1, p9, v_tenant_id, ph9a, 'Demo Complete',      'complete', 1, '2024-06-25', '2024-06-24', false, false, false, false),
    (m9a2, p9, v_tenant_id, ph9a, 'Framing Complete',   'complete', 2, '2024-07-20', '2024-07-22', true,  false, false, false),
    (m9a3, p9, v_tenant_id, ph9a, 'MEP Rough-In',       'complete', 3, '2024-08-10', '2024-08-12', false, false, false, false),
    (m9a4, p9, v_tenant_id, ph9a, 'Framing Draw',       'complete', 4, '2024-08-14', '2024-08-14', true,  true,  true,  true),
    (m9b1, p9, v_tenant_id, ph9b, 'Tile & Flooring',    'complete', 5, '2024-09-10', '2024-09-08', false, false, false, false),
    (m9b2, p9, v_tenant_id, ph9b, 'Cabinetry & Vanity', 'complete', 6, '2024-09-28', '2024-09-30', true,  false, false, false),
    (m9b3, p9, v_tenant_id, ph9b, 'Fixtures & Punch',   'complete', 7, '2024-10-20', '2024-10-22', true,  false, false, false),
    (m9b4, p9, v_tenant_id, ph9b, 'Final Draw & CO',    'complete', 8, '2024-10-28', '2024-10-28', true,  true,  true,  true)
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 9. Draw Schedules (for the 3 jobs with construction loans)
  --    draw_schedules schema: id, tenant_id, job_id, lender_name,
  --                           lender_contact, lender_email, loan_amount_cents,
  --                           holdback_pct, created_at
  -- -------------------------------------------------------------------------
  INSERT INTO public.draw_schedules (id, tenant_id, job_id, lender_name, lender_contact, lender_email, loan_amount_cents, holdback_pct)
  VALUES
    (ds1, v_tenant_id, j1, 'Pacific Premier Bank',  'Jessica Ruiz',    'jruiz@ppb.com',                 62000000,  10),
    (ds3, v_tenant_id, j3, 'First Republic Bank',   'Marco Santos',    'msantos@frb.com',               37500000,  10),
    (ds6, v_tenant_id, j6, 'Western Alliance Bank', 'Christine Park',  'cpark@westernalliancebank.com', 115000000, 10)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Seed v2 complete.';
  RAISE NOTICE '  Tenant   : %', v_tenant_id;
  RAISE NOTICE '  Customers: 10  (Hernandez, Johnson, Martinez, Thompson, Wong,';
  RAISE NOTICE '                  Kim, Nguyen, Davis, Chen, Ramirez)';
  RAISE NOTICE '  Jobs     : GGB-2024-046/047, GGB-2025-001 through 008';
  RAISE NOTICE '  Projects : 10 linked';
  RAISE NOTICE '  Phases   : Hernandez(3) Martinez(2) Kim(2) Nguyen(1) Chen(2)';
  RAISE NOTICE '  Milestones: 42 total across 5 projects';
  RAISE NOTICE '  Draw Schedules: Hernandez, Martinez, Kim';
  RAISE NOTICE '================================================================';

END $$;
