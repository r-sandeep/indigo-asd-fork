-- ============================================================
-- Indigo Migration 011: Seed Data
-- Seeds notification templates, line item library, and project
-- templates. Does NOT insert tenants/customers/jobs — those
-- already exist in BuildersBooks.
-- Run in development only, or selectively in production.
-- ============================================================

-- ── Retrieve tenant IDs from BuildersBooks ─────────────────────
-- Before running this seed, verify these match your actual tenant IDs:
--   SELECT id, name FROM tenants;
--
-- Replace the DO block below with your actual tenant UUIDs if needed.
-- The seed uses a variable pattern so it adapts to real IDs.

do $$
declare
  ggb_custom_id  uuid;
  ggb_express_id uuid;
begin
  -- Pull the first two tenants by name (adjust if your names differ)
  select id into ggb_custom_id  from tenants where name ilike '%custom%'  limit 1;
  select id into ggb_express_id from tenants where name ilike '%express%' limit 1;

  -- Fall back to any tenant if name-based lookup fails
  if ggb_custom_id  is null then select id into ggb_custom_id  from tenants limit 1; end if;
  if ggb_express_id is null then select id into ggb_express_id from tenants limit 1; end if;

  -- ── Notification Templates ─────────────────────────────────

  insert into notification_templates (tenant_id, slug, channel, subject, body) values
    (null, 'milestone_approved',       'sms',    null,
      'Hi {{client_first_name}}, {{milestone_name}} on {{project_name}} has been approved! 🎉'),
    (null, 'milestone_approval_needed','in_app',  null,
      '{{milestone_name}} is ready for client approval.'),
    (null, 'co_pending_signature',     'sms',    null,
      'Hi {{client_first_name}}, Change Order #{{co_number}} (${{co_amount}}) needs your signature: {{signing_link}}'),
    (null, 'co_approved',              'in_app',  null,
      'Change Order #{{co_number}} has been approved by {{client_name}}.'),
    (null, 'invoice_sent',             'email',  'Invoice {{invoice_number}} — ${{invoice_total}}',
      E'Hi {{client_first_name}},\n\nYour invoice for {{project_name}} is ready.\nTotal: ${{invoice_total}} due {{due_date}}.\n\nPay here: {{payment_link}}\n\nGood Guy Builders'),
    (null, 'payment_received',         'sms',    null,
      'GGB: Payment of ${{payment_amount}} received. Thank you, {{client_first_name}}!'),
    (null, 'daily_log_published',      'email',  'Daily Update — {{project_name}} — {{log_date}}',
      E'Hi {{client_first_name}},\n\n{{ai_summary}}\n\nView all updates: {{portal_link}}\n\nGood Guy Builders'),
    (null, 'selection_due',            'sms',    null,
      'Hi {{client_first_name}}, your {{selection_name}} selection is due {{due_date}}: {{portal_link}}'),
    (null, 'draw_funded',              'in_app',  null,
      'Draw #{{draw_number}} (${{draw_amount}}) funded by {{lender_name}}.'),
    (null, 'rfi_answered',             'in_app',  null,
      'RFI #{{rfi_number}}: "{{rfi_subject}}" has been answered.'),
    (null, 'warranty_submitted',       'in_app',  null,
      'New warranty claim submitted by {{client_name}}: {{claim_title}}'),
    (null, 'punch_item_closed',        'in_app',  null,
      'Punch item closed: {{punch_title}}')
  on conflict (tenant_id, slug, channel) do nothing;

  -- ── Line Item Template Library ───────────────────────────────

  insert into line_item_templates
    (tenant_id, name, unit, default_unit_cost, default_markup_pct, csi_division, trade)
  values
    -- Demo
    (ggb_custom_id, 'Demolition — Bathroom',          'ls',  250000, 20, '02_existing',       'demo'),
    (ggb_custom_id, 'Demolition — Kitchen',            'ls',  350000, 20, '02_existing',       'demo'),
    (ggb_custom_id, 'Dumpster Rental',                 'ea',   60000, 15, '01_general',        'general'),
    (ggb_custom_id, 'Selective Demo — Walls',          'sf',     800, 20, '02_existing',       'demo'),
    -- Framing
    (ggb_custom_id, 'Framing Labor',                   'sf',    1500, 20, '06_wood_plastic',   'framing'),
    (ggb_custom_id, 'Framing Materials',               'sf',     800, 10, '06_wood_plastic',   'framing'),
    (ggb_custom_id, 'Blocking & Backing',              'ls',   75000, 20, '06_wood_plastic',   'framing'),
    -- Plumbing
    (ggb_custom_id, 'Rough Plumbing — Bathroom',       'ls',  450000, 25, '22_plumbing',       'plumbing'),
    (ggb_custom_id, 'Finish Plumbing — Bathroom',      'ls',  250000, 25, '22_plumbing',       'plumbing'),
    (ggb_custom_id, 'Rough Plumbing — Kitchen',        'ls',  350000, 25, '22_plumbing',       'plumbing'),
    (ggb_custom_id, 'Finish Plumbing — Kitchen',       'ls',  200000, 25, '22_plumbing',       'plumbing'),
    (ggb_custom_id, 'Water Heater — Tankless Install', 'ea',  180000, 25, '22_plumbing',       'plumbing'),
    -- Electrical
    (ggb_custom_id, 'Rough Electrical — Bathroom',     'ls',  300000, 25, '26_electrical',     'electrical'),
    (ggb_custom_id, 'Finish Electrical — Bathroom',    'ls',  175000, 25, '26_electrical',     'electrical'),
    (ggb_custom_id, 'Rough Electrical — Kitchen',      'ls',  400000, 25, '26_electrical',     'electrical'),
    (ggb_custom_id, 'Panel Upgrade — 200A',            'ea',  500000, 20, '26_electrical',     'electrical'),
    -- HVAC
    (ggb_custom_id, 'Exhaust Fan — Bathroom',          'ea',   35000, 25, '23_hvac',           'hvac'),
    (ggb_custom_id, 'Range Hood Install',              'ea',   45000, 25, '23_hvac',           'hvac'),
    -- Tile & Stone
    (ggb_custom_id, 'Tile Install — Floor',            'sf',    1800, 25, '09_finishes',       'tile'),
    (ggb_custom_id, 'Tile Install — Shower Wall',      'sf',    2200, 25, '09_finishes',       'tile'),
    (ggb_custom_id, 'Tile Install — Backsplash',       'sf',    2000, 25, '09_finishes',       'tile'),
    (ggb_custom_id, 'Tile Allowance',                  'sf',    1500,  0, '09_finishes',       'tile'),
    (ggb_custom_id, 'Waterproofing — Shower',          'ls',   95000, 20, '07_thermal_moisture','tile'),
    -- Drywall
    (ggb_custom_id, 'Drywall & Tape',                  'sf',     600, 20, '09_finishes',       'drywall'),
    (ggb_custom_id, 'Cement Board Install',            'sf',     500, 20, '09_finishes',       'drywall'),
    -- Painting
    (ggb_custom_id, 'Interior Paint — Per Room',       'ea',  120000, 30, '09_finishes',       'painting'),
    (ggb_custom_id, 'Interior Paint — Full House',     'sf',     400, 30, '09_finishes',       'painting'),
    (ggb_custom_id, 'Cabinet Painting',                'ls',  280000, 30, '09_finishes',       'painting'),
    -- Cabinets & Millwork
    (ggb_custom_id, 'Kitchen Cabinets — Allowance',   'ls', 1500000,  0, '12_furnishings',    'cabinets'),
    (ggb_custom_id, 'Bathroom Vanity — Allowance',    'ls',  300000,  0, '12_furnishings',    'cabinets'),
    (ggb_custom_id, 'Cabinet Install Labor',           'ls',  400000, 25, '12_furnishings',    'cabinets'),
    (ggb_custom_id, 'Floating Shelves',                'lf',   18000, 25, '12_furnishings',    'cabinets'),
    -- Countertops
    (ggb_custom_id, 'Countertops — Quartz — Allowance','sf',   12000,  0, '09_finishes',       'stone'),
    (ggb_custom_id, 'Countertop Fabrication & Install','sf',    8000, 20, '09_finishes',       'stone'),
    -- Fixtures & Appliances
    (ggb_custom_id, 'Fixture Allowance — Bathroom',   'ls',  250000,  0, '22_plumbing',       'plumbing'),
    (ggb_custom_id, 'Appliance Allowance — Kitchen',  'ls',  500000,  0, '11_equipment',      'general'),
    -- Flooring
    (ggb_custom_id, 'Hardwood Flooring — Materials',  'sf',    1200,  0, '09_finishes',       'flooring'),
    (ggb_custom_id, 'Hardwood Flooring — Install',    'sf',     800, 25, '09_finishes',       'flooring'),
    (ggb_custom_id, 'LVP Install',                    'sf',     750, 25, '09_finishes',       'flooring'),
    -- General Conditions
    (ggb_custom_id, 'General Conditions & Supervision','ls',       0,  0, '01_general',        'general'),
    (ggb_custom_id, 'Permits & Fees',                  'ls',       0,  0, '01_general',        'general'),
    (ggb_custom_id, 'Temporary Power & Utilities',     'ls',   45000, 15, '01_general',        'general'),
    (ggb_custom_id, 'Site Protection & Clean',         'ls',   60000, 15, '01_general',        'general'),
    (ggb_custom_id, 'Final Clean',                     'ls',   35000, 20, '01_general',        'general')
  on conflict do nothing;

  -- ── Project Templates — Express Bathroom ────────────────────

  insert into project_templates (tenant_id, name, project_type, description)
  values (ggb_express_id, 'GGB Express — Bathroom Remodel', 'express_bathroom',
          'Standard 3–4 week bathroom remodel')
  on conflict do nothing;

  -- ── Project Templates — Custom Bathroom Addition ─────────────

  insert into project_templates (tenant_id, name, project_type, description)
  values (ggb_custom_id, 'GGB Custom — Kitchen Remodel', 'major_remodel',
          'Full kitchen remodel, 6–10 weeks')
  on conflict do nothing;

end $$;
