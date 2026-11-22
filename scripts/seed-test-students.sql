-- =============================================================================
-- Données de TEST — 8 nouveaux élèves (LOCAL UNIQUEMENT)
-- =============================================================================
-- Ne PAS exécuter sur la DB de production / Vercel.
-- Usage : psql "$DATABASE_URL" -f scripts/seed-test-students.sql
--
-- Le script est idempotent : il supprime d'abord les anciennes lignes de test
-- (celles dont parentEmail commence par "testnew-"), puis il réinsère tout.
--
-- Cas couverts :
--   a  retard 1 jour       (inscription = hier)      + facture du mois en cours impayée + compte + WhatsApp
--   b  retard 0 jour       (inscription = aujourd'hui) + facture "à échéance" + compte
--   c  mois précédent + mois courant impayés          + compte + WhatsApp  => relance 2 mois
--   d  mois courant PARTIELlement payé                + compte + WhatsApp
--   e  tous les mois payés                            + compte + WhatsApp  => aucune relance
--   f  mois précédent + courant impayés, SANS compte + WhatsApp uniquement
--   g  retard 3 jours, SANS compte et SANS téléphone => ni notif ni lien WhatsApp
--   h  statut PENDING                                 => exclu des relances
-- =============================================================================

BEGIN;

-- ── Nettoyage des anciennes données de test ───────────────────────────────────
DELETE FROM "Payment" p
USING "Invoice" i, "Student" s
WHERE p."invoiceId" = i.id
  AND i."studentId" = s.id
  AND s."parentEmail" LIKE 'testnew-%@example.test';

DELETE FROM "InvoiceLine" il
USING "Invoice" i, "Student" s
WHERE il."invoiceId" = i.id
  AND i."studentId" = s.id
  AND s."parentEmail" LIKE 'testnew-%@example.test';

DELETE FROM "Invoice" i
USING "Student" s
WHERE i."studentId" = s.id
  AND s."parentEmail" LIKE 'testnew-%@example.test';

DELETE FROM "Attendance" a
USING "Student" s
WHERE a."studentId" = s.id
  AND s."parentEmail" LIKE 'testnew-%@example.test';

DELETE FROM "Enrollment" e
USING "Student" s
WHERE e."studentId" = s.id
  AND s."parentEmail" LIKE 'testnew-%@example.test';

DELETE FROM "Student"
WHERE "parentEmail" LIKE 'testnew-%@example.test';

DELETE FROM "User"
WHERE email LIKE 'testnew-%@example.test';

-- ── Insertion ────────────────────────────────────────────────────────────────
WITH school AS (
  SELECT id FROM "School" ORDER BY id LIMIT 1
),
pw AS (
  SELECT password
  FROM (
    (SELECT password, 1 AS ord FROM "User" WHERE role = 'STUDENT'::"Role" ORDER BY id LIMIT 1)
    UNION ALL
    (SELECT password, 2 AS ord FROM "User" WHERE role = 'ADMIN'::"Role" ORDER BY id LIMIT 1)
  ) p
  ORDER BY ord
  LIMIT 1
),
months AS (
  SELECT
    date_trunc('month', now() AT TIME ZONE 'UTC')::timestamp AS cur,
    (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month')::timestamp AS prev
),
group_pick AS (
  SELECT
    v.group_code,
    COALESCE(g.id, f.id)            AS id,
    COALESCE(g.name, f.name)        AS name,
    COALESCE(g."monthlyFee", f."monthlyFee") AS "monthlyFee"
  FROM (VALUES
    ('g_math_college',   'Maths · Collège'),
    ('g_math_primaire',  'Maths · Primaire'),
    ('g_prepa_bac',      'Prépa Bac Maths'),
    ('g_math_lycee',     'Maths · Lycée'),
    ('g_svt_lycee',      'SVT · Lycée'),
    ('g_anglais_college','Anglais · Collège'),
    ('g_physique_lycee', 'Physique · Lycée')
  ) v(group_code, group_name)
  CROSS JOIN school sc
  LEFT JOIN "Group" g
    ON g."schoolId" = sc.id AND g.name = v.group_name AND g.active = true
  LEFT JOIN LATERAL (
    SELECT id, name, "monthlyFee"
    FROM "Group"
    WHERE "schoolId" = sc.id AND active = true
    ORDER BY id
    LIMIT 1
  ) f ON g.id IS NULL
),
spec(code, first_name, last_name, group_code, started_at, want_prev, want_cur,
     pay_prev, pay_cur, has_user, parent_phone, student_status) AS (
  VALUES
    ('a', 'Salma',   'Idrissi',  'g_math_college',
      (now() AT TIME ZONE 'UTC' - interval '1 day')::timestamp,
      false, true, 'NONE', 'NONE', true,  '06 61 23 45 67', 'ACTIVE'),
    ('b', 'Youssef', 'Alami',    'g_math_primaire',
      (now() AT TIME ZONE 'UTC')::timestamp,
      false, true, 'NONE', 'NONE', true,  '06 62 24 56 78', 'ACTIVE'),
    ('c', 'Nadia',   'Bennani',  'g_prepa_bac',
      ((date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month') + interval '10 days')::timestamp,
      true,  true, 'NONE', 'NONE', true,  '06 63 35 67 89', 'ACTIVE'),
    ('d', 'Omar',    'Tazi',     'g_math_lycee',
      ((date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month') + interval '15 days')::timestamp,
      true,  true, 'FULL', 'HALF', true,  '06 64 46 78 90', 'ACTIVE'),
    ('e', 'Hiba',    'Chraibi',  'g_svt_lycee',
      ((date_trunc('month', now() AT TIME ZONE 'UTC') - interval '2 months') + interval '5 days')::timestamp,
      true,  true, 'FULL', 'FULL', true,  '06 65 57 89 01', 'ACTIVE'),
    ('f', 'Mehdi',   'Fassi',    'g_anglais_college',
      ((date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month') + interval '20 days')::timestamp,
      true,  true, 'NONE', 'NONE', false, '06 66 68 90 12', 'ACTIVE'),
    ('g', 'Aya',     'Ouazzani', 'g_physique_lycee',
      (now() AT TIME ZONE 'UTC' - interval '3 days')::timestamp,
      false, true, 'NONE', 'NONE', false, NULL,             'ACTIVE'),
    ('h', 'Rayan',   'Naciri',   'g_math_college',
      (now() AT TIME ZONE 'UTC' - interval '2 days')::timestamp,
      false, true, 'NONE', 'NONE', false, '06 67 79 01 23', 'PENDING')
),
new_users AS (
  INSERT INTO "User" ("schoolId", "name", "email", "phone", "password", "role", "active")
  SELECT
    sc.id,
    v.first_name || ' ' || v.last_name,
    'testnew-' || v.code || '@example.test',
    v.parent_phone,
    pw.password,
    'STUDENT'::"Role",
    true
  FROM spec v
  CROSS JOIN school sc
  CROSS JOIN pw
  WHERE v.has_user
  RETURNING id, email
),
new_students AS (
  INSERT INTO "Student"
    ("schoolId", "userId", "firstName", "lastName", "parentName", "parentPhone",
     "parentEmail", "registeredAt", "status")
  SELECT
    sc.id,
    u.id,
    v.first_name,
    v.last_name,
    'Parent TEST ' || v.last_name,
    v.parent_phone,
    'testnew-' || v.code || '@example.test',
    v.started_at,
    v.student_status::"StudentStatus"
  FROM spec v
  CROSS JOIN school sc
  LEFT JOIN new_users u ON u.email = 'testnew-' || v.code || '@example.test'
  RETURNING id, "parentEmail", "registeredAt", "status"
),
student_spec AS (
  SELECT s.id AS student_id, v.*
  FROM new_students s
  JOIN spec v ON s."parentEmail" = 'testnew-' || v.code || '@example.test'
),
new_enrollments AS (
  INSERT INTO "Enrollment"
    ("studentId", "groupId", "monthlyFee", "status", "startedAt")
  SELECT
    ss.student_id,
    g.id,
    g."monthlyFee",
    'ACTIVE'::"EnrollmentStatus",
    ss.started_at
  FROM student_spec ss
  JOIN group_pick g ON g.group_code = ss.group_code
  RETURNING id, "studentId", "startedAt"
),
invoice_plan AS (
  SELECT
    ss.student_id,
    e.id AS enrollment_id,
    e."startedAt" AS started_at,
    g.name AS group_name,
    g."monthlyFee" AS fee,
    ss.code,
    x.month,
    x.pay_mode
  FROM student_spec ss
  JOIN new_enrollments e ON e."studentId" = ss.student_id
  JOIN group_pick g ON g.group_code = ss.group_code
  CROSS JOIN months m
  CROSS JOIN LATERAL (VALUES
    (m.prev, ss.want_prev, ss.pay_prev),
    (m.cur,  ss.want_cur,  ss.pay_cur)
  ) x(month, want, pay_mode)
  WHERE x.want
),
new_invoices AS (
  INSERT INTO "Invoice" ("studentId", "month", "dueDate")
  SELECT
    ip.student_id,
    ip.month,
    date_trunc('day', ip.started_at)::timestamp
  FROM invoice_plan ip
  RETURNING id, "studentId", month
),
new_lines AS (
  INSERT INTO "InvoiceLine" ("invoiceId", "enrollmentId", "label", "amount")
  SELECT i.id, ip.enrollment_id, ip.group_name, ip.fee
  FROM new_invoices i
  JOIN invoice_plan ip
    ON ip.student_id = i."studentId" AND ip.month = i.month
  RETURNING id
),
new_payments AS (
  INSERT INTO "Payment" ("invoiceId", "amount", "method", "paidAt", "receiptNo")
  SELECT
    i.id,
    CASE ip.pay_mode
      WHEN 'FULL' THEN ip.fee
      WHEN 'HALF' THEN round(ip.fee / 2, 2)
    END,
    CASE WHEN ip.code IN ('a', 'c', 'e')
      THEN 'TRANSFER'::"PayMethod"
      ELSE 'CASH'::"PayMethod"
    END,
    least((now() AT TIME ZONE 'UTC')::timestamp, ip.month + interval '3 days 10 hours'),
    'TESTNEW-' || ip.code || '-' || to_char(ip.month, 'YYYYMM')
  FROM new_invoices i
  JOIN invoice_plan ip
    ON ip.student_id = i."studentId" AND ip.month = i.month
  WHERE ip.pay_mode <> 'NONE'
  RETURNING id
)
SELECT jsonb_build_object(
  'students',    (SELECT count(*) FROM new_students),
  'users',       (SELECT count(*) FROM new_users),
  'enrollments', (SELECT count(*) FROM new_enrollments),
  'invoices',    (SELECT count(*) FROM new_invoices),
  'lines',       (SELECT count(*) FROM new_lines),
  'payments',    (SELECT count(*) FROM new_payments)
) AS result;

COMMIT;
