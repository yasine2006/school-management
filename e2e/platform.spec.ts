import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

const ADMIN = { email: "admin@school.ma", password: "password123" };
const TEACHER = { email: "prof@school.ma", password: "password123" };

const uid = Date.now().toString().slice(-6);
const firstName = "Test";
const lastName = `E2E${uid}`;
const studentEmail = `e2e.${uid}@school.ma`;
const studentPassword = "password123";
const teacherEmail = `prof.${uid}@school.ma`;
const announceTitle = `Annonce ${uid}`;

let studentId = 0;
let studentUserId = 0;
let groupId = 0;
let groupName = "";
let monthlyFee = 0;
let invoiceId = 0;
let teacherUserId = 0;

const db = new Client({ connectionString: process.env.DATABASE_URL });

const day = (d: Date, n = 1) => `${d.toISOString().slice(0, 8)}${String(n).padStart(2, "0")}`;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await db.query(sql, params);
  return res.rows as T[];
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/(admin|teacher|student)(\/|$)/),
    page.getByRole("button", { name: "Se connecter" }).click(),
  ]);
}

async function logoutAdmin(page: Page) {
  await Promise.all([page.waitForURL(/\/login$/), page.getByRole("button", { name: /Déconnexion/ }).click()]);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await db.connect();
});

test.afterAll(async () => {
  await db.end();
});

test("1. connexion refusée avec un mauvais mot de passe", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(ADMIN.email);
  await page.locator('input[name="password"]').fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
});

test("2. connexion admin + toutes les pages répondent 200", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);

  const routes = [
    "/admin",
    "/admin/students",
    "/admin/students/new",
    "/admin/groups",
    "/admin/specialties",
    "/admin/levels",
    "/admin/enrollments",
    "/admin/attendance",
    "/admin/timetable",
    "/admin/invoices",
    "/admin/reminders",
    "/admin/reports",
    "/admin/registrations",
    "/admin/notifications",
    "/admin/users",
    "/admin/settings",
    "/api/health",
  ];
  for (const route of routes) {
    const res = await page.request.get(route);
    expect(res.status(), `GET ${route}`).toBe(200);
  }
});

test("3. créer un élève avec compte de connexion", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/students/new");
  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);
  await page.locator('select[name="status"]').selectOption("ACTIVE");
  await page.locator('input[name="parentName"]').fill("Parent E2E");
  await page.locator('input[name="accountEmail"]').fill(studentEmail);
  await page.locator('input[name="accountPassword"]').fill(studentPassword);
  await Promise.all([
    page.waitForURL(/\/admin\/students\/\d+$/),
    page.getByRole("button", { name: /Ajouter l'élève/ }).click(),
  ]);
  await expect(page.getByRole("heading", { name: `${firstName} ${lastName}` })).toBeVisible();

  studentId = Number(page.url().match(/\/admin\/students\/(\d+)/)![1]);
  const [row] = await q<{ id: number; userid: number }>(
    'SELECT id, "userId" AS userid FROM "Student" WHERE id = $1',
    [studentId],
  );
  expect(row.id).toBe(studentId);
  studentUserId = row.userid;
  expect(studentUserId).toBeGreaterThan(0);
});

test("4. affecter l'élève à un groupe (inscription)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/enrollments");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: /Inscrire l'élève/ }) });
  await form.locator('select[name="studentId"]').selectOption({ label: `${lastName} ${firstName}` });
  await form.locator('select[name="groupId"]').selectOption({ index: 1 });
  await form.getByRole("button", { name: /Inscrire l'élève/ }).click();
  await expect(page.getByText("Élève inscrit.")).toBeVisible();

  const [row] = await q<{ groupid: number; name: string; fee: string }>(
    'SELECT e."groupId" AS groupid, g.name, g."monthlyFee"::text AS fee FROM "Enrollment" e JOIN "Group" g ON g.id = e."groupId" WHERE e."studentId" = $1 AND e.status = $2',
    [studentId, "ACTIVE"],
  );
  expect(row).toBeTruthy();
  groupId = row.groupid;
  groupName = row.name;
  monthlyFee = Number(row.fee);
  expect(monthlyFee).toBeGreaterThan(0);
});

test("5. déclarer un élève en attente puis le valider", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/students/new");
  const pendingLast = `Attente${uid}`;
  await page.locator('input[name="firstName"]').fill("Eleve");
  await page.locator('input[name="lastName"]').fill(pendingLast);
  await page.locator('select[name="status"]').selectOption("PENDING");
  await Promise.all([
    page.waitForURL(/\/admin\/students\/\d+$/),
    page.getByRole("button", { name: /Ajouter l'élève/ }).click(),
  ]);

  await page.goto("/admin/registrations");
  const row = page.getByRole("row", { name: new RegExp(pendingLast) });
  await expect(row.getByText("En attente")).toBeVisible();
  await Promise.all([page.waitForLoadState("networkidle"), row.getByRole("button", { name: "Valider" }).click()]);
  await expect(page.getByRole("row", { name: new RegExp(pendingLast) }).getByText("Validé")).toBeVisible();

  const [s] = await q<{ status: string }>(
    'SELECT status FROM "Student" WHERE "lastName" = $1',
    [pendingLast],
  );
  expect(s.status).toBe("ACTIVE");
});

test("6. créer un compte enseignant puis désactiver/réactiver", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/users");
  await page.locator('input[name="name"]').fill(`Prof ${uid}`);
  await page.locator('input[name="email"]').fill(teacherEmail);
  await page.locator('select[name="role"]').selectOption("TEACHER");
  await page.locator('input[name="password"]').fill("password123");
  await page.getByRole("button", { name: /Créer le compte/ }).click();
  await expect(page.getByText("Utilisateur créé.")).toBeVisible();

  const [u] = await q<{ id: number; role: string; active: boolean }>(
    'SELECT id, role, active FROM "User" WHERE email = $1',
    [teacherEmail],
  );
  expect(u.role).toBe("TEACHER");
  teacherUserId = u.id;

  const row = page.getByRole("row", { name: new RegExp(teacherEmail) });
  await Promise.all([page.waitForLoadState("networkidle"), row.getByRole("button", { name: "Désactiver" }).click()]);
  await expect(page.getByRole("row", { name: new RegExp(teacherEmail) }).getByText("Désactivé")).toBeVisible();

  const row2 = page.getByRole("row", { name: new RegExp(teacherEmail) });
  await Promise.all([page.waitForLoadState("networkidle"), row2.getByRole("button", { name: "Réactiver" }).click()]);
  await expect(page.getByRole("row", { name: new RegExp(teacherEmail) }).getByText("Actif")).toBeVisible();
});

test("7. assigner un enseignant à un groupe", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/groups");
  const row = page.getByRole("row", { name: new RegExp(groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  await row.locator('select[name="teacherId"]').selectOption(String(teacherUserId));
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/groups")),
    row.getByRole("button", { name: "OK" }).click(),
  ]);

  await expect
    .poll(async () => {
      const [g] = await q<{ teacherid: number | null }>('SELECT "teacherId" AS teacherid FROM "Group" WHERE id = $1', [groupId]);
      return g.teacherid;
    })
    .toBe(teacherUserId);
});

test("8. encaisser un paiement partiel puis le solde", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);

  await page.goto(`/admin/students/${studentId}`);
  await Promise.all([
    page.waitForURL(/\/admin\/invoices\/\d+$/),
    page.getByRole("button", { name: /Encaisser le mois/ }).click(),
  ]);
  invoiceId = Number(page.url().match(/\/invoices\/(\d+)/)![1]);

  const amount = page.locator('input[name="amount"]');
  const remaining = Number(await amount.inputValue());
  expect(remaining).toBeCloseTo(monthlyFee, 2);

  await amount.fill((remaining / 2).toFixed(2));
  await Promise.all([
    page.waitForURL(/\/admin\/invoices$/),
    page.getByRole("button", { name: /Enregistrer le paiement/ }).click(),
  ]);
  await expect(page.getByRole("row", { name: new RegExp(lastName) }).getByText("Partiel")).toBeVisible();

  await page.goto(`/admin/invoices/${invoiceId}`);
  const rest = Number(await page.locator('input[name="amount"]').inputValue());
  await page.locator('input[name="amount"]').fill(rest.toFixed(2));
  await Promise.all([
    page.waitForURL(/\/admin\/invoices$/),
    page.getByRole("button", { name: /Enregistrer le paiement/ }).click(),
  ]);

  await page.goto(`/admin/invoices/${invoiceId}`);
  await expect(page.getByText("Cette facture est entièrement payée.")).toBeVisible();

  const [inv] = await q<{ due: string; paid: string; n: number }>(
    'SELECT (SELECT COALESCE(SUM(amount),0) FROM "InvoiceLine" WHERE "invoiceId" = $1)::text AS due, (SELECT COALESCE(SUM(amount),0) FROM "Payment" WHERE "invoiceId" = $1)::text AS paid, (SELECT COUNT(*) FROM "Payment" WHERE "invoiceId" = $1)::int AS n',
    [invoiceId],
  );
  expect(inv.n).toBe(2);
  expect(Number(inv.paid)).toBeCloseTo(Number(inv.due), 2);
});

test("8b. encaisser un mois précis, un mois à la fois", async ({ page }) => {
  const prev = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1));
  const [enrollment] = await q<{ id: number }>(
    'SELECT id FROM "Enrollment" WHERE "studentId" = $1 AND status = $2 LIMIT 1',
    [studentId, "ACTIVE"],
  );
  const [oldInvoice] = await q<{ id: number }>(
    `INSERT INTO "Invoice" ("studentId", "month", "dueDate") VALUES ($1, $2, $3) RETURNING id`,
    [studentId, prev.toISOString().slice(0, 10), day(prev, 5)],
  );
  await q(
    `INSERT INTO "InvoiceLine" ("invoiceId", "enrollmentId", "label", "amount") VALUES ($1, $2, $3, $4)`,
    [oldInvoice.id, enrollment.id, groupName, monthlyFee],
  );

  await login(page, ADMIN.email, ADMIN.password);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" }).format(prev);
  await page.goto(`/admin/students/${studentId}`);
  const row = page.getByRole("row", { name: new RegExp(monthLabel) });
  await row.getByRole("link", { name: "Encaisser" }).click();
  await page.waitForURL(/\/admin\/invoices\/\d+$/);
  expect(Number(page.url().match(/\/invoices\/(\d+)/)![1])).toBe(oldInvoice.id);

  const amount = page.locator('input[name="amount"]');
  await amount.fill(Number(await amount.inputValue()).toFixed(2));
  await Promise.all([
    page.waitForURL(/\/admin\/invoices$/),
    page.getByRole("button", { name: /Enregistrer le paiement/ }).click(),
  ]);

  await page.goto(`/admin/students/${studentId}`);
  await expect(page.getByRole("row", { name: new RegExp(monthLabel) }).getByText("Payé")).toBeVisible();
  const [paid] = await q<{ paid: string }>(
    'SELECT COALESCE(SUM(amount),0)::text AS paid FROM "Payment" WHERE "invoiceId" = $1',
    [oldInvoice.id],
  );
  expect(Number(paid.paid)).toBeCloseTo(monthlyFee, 2);
});

test("8c. cron mensuel: factures manquantes générées automatiquement", async ({ page }) => {
  const secret = process.env.CRON_SECRET;
  expect(secret, "CRON_SECRET manquant dans .env").toBeTruthy();

  const denied = await page.request.post("/api/cron/monthly-invoices");
  expect(denied.status()).toBe(401);

  const ok = await page.request.post("/api/cron/monthly-invoices", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.ok).toBe(true);
  expect(Number(body.generated)).toBeGreaterThanOrEqual(0);
});

test("8d. encaisser une seule matière de la facture", async ({ page }) => {
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 3, 1));
  const [enrollment] = await q<{ id: number }>(
    'SELECT id FROM "Enrollment" WHERE "studentId" = $1 AND status = $2 LIMIT 1',
    [studentId, "ACTIVE"],
  );
  const [inv] = await q<{ id: number }>(
    `INSERT INTO "Invoice" ("studentId", "month", "dueDate") VALUES ($1, $2, $3) RETURNING id`,
    [studentId, month.toISOString().slice(0, 10), day(month, 5)],
  );
  await q(
    `INSERT INTO "InvoiceLine" ("invoiceId", "enrollmentId", "label", "amount") VALUES ($1, $2, $3, $4), ($1, NULL, $5, $6)`,
    [inv.id, enrollment.id, groupName, monthlyFee, "Frais de dossier", 100],
  );
  const [feeLine] = await q<{ id: number }>(
    'SELECT id FROM "InvoiceLine" WHERE "invoiceId" = $1 AND label = $2',
    [inv.id, "Frais de dossier"],
  );

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/invoices/${inv.id}`);
  await Promise.all([
    page.waitForURL(new RegExp(`/admin/invoices/${inv.id}\\?line=`)),
    page.getByRole("row", { name: /Frais de dossier/ }).getByRole("link", { name: "Encaisser" }).click(),
  ]);
  await expect(page.getByText("Matière : Frais de dossier")).toBeVisible();
  await expect(page.locator('input[name="amount"]')).toHaveValue("100");
  await Promise.all([
    page.waitForURL(/\/admin\/invoices$/),
    page.getByRole("button", { name: /Enregistrer pour cette matière/ }).click(),
  ]);

  const [paid] = await q<{ amount: string; lineid: number | null }>(
    'SELECT amount::text AS amount, "lineId" AS lineid FROM "Payment" WHERE "invoiceId" = $1 ORDER BY id DESC LIMIT 1',
    [inv.id],
  );
  expect(paid.lineid).toBe(feeLine.id);
  expect(Number(paid.amount)).toBeCloseTo(100, 2);

  await page.goto(`/admin/invoices/${inv.id}`);
  await expect(page.getByRole("row", { name: /Frais de dossier/ }).getByText("Réglé")).toBeVisible();
  const line2 = page.getByRole("row", { name: new RegExp(groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  await expect(line2.getByText("Encaisser")).toBeVisible();
  await expect(page.locator('input[name="amount"]')).toHaveValue(String(monthlyFee));
});

test("8e. retirer l'élève d'une matière puis le réactiver", async ({ page }) => {
  const [enrollment] = await q<{ id: number }>(
    'SELECT id FROM "Enrollment" WHERE "studentId" = $1 AND status = $2 LIMIT 1',
    [studentId, "ACTIVE"],
  );

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/students/${studentId}`);
  const item = page.locator("ul li").first();
  page.once("dialog", (d) => d.accept());
  await item.getByRole("button", { name: "Retirer cette matière ?" }).click();
  await expect(item.getByText("Arrêtée")).toBeVisible();

  let [row] = await q<{ status: string }>('SELECT status FROM "Enrollment" WHERE id = $1', [enrollment.id]);
  expect(row.status).toBe("STOPPED");

  await page.reload();
  await item.getByTitle("Réactiver la matière").click();
  await expect(item.getByText("Active")).toBeVisible();

  [row] = await q<{ status: string }>('SELECT status FROM "Enrollment" WHERE id = $1', [enrollment.id]);
  expect(row.status).toBe("ACTIVE");
});

test("8f. recherche par nom insensible à la casse", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/students");
  const search = page.locator('input[placeholder="Rechercher un élève…"]');
  await search.fill(`e2e${uid}`);
  await Promise.all([page.waitForURL(/q=/), search.press("Enter")]);
  await expect(page.getByRole("link", { name: `${firstName} ${lastName}` })).toBeVisible();

  await page.goto(`/admin/students?q=${lastName.toLowerCase()}`);
  await expect(page.getByRole("link", { name: `${firstName} ${lastName}` })).toBeVisible();
});

test("8g. recherche d'un groupe (sans accents, via le header)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const header = page.locator('input[placeholder="Rechercher un élève, un groupe…"]');
  await header.fill("prepa maths");
  await Promise.all([page.waitForURL(/\/admin\/students\?q=/), header.press("Enter")]);

  await expect(page.getByRole("link", { name: "Voir la fiche" }).first()).toBeVisible();

  const res = await page.request.get("/admin/students?q=PREPA");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("Voir la fiche");
});

test("8h. relances: notifier un impayé, dédoublonné, + WhatsApp + cron", async ({ page }) => {
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 3, 1));
  const key = month.toISOString().slice(0, 7);
  const [inv] = await q<{ id: number }>('SELECT id FROM "Invoice" WHERE "studentId" = $1 AND month = $2', [
    studentId,
    month.toISOString().slice(0, 10),
  ]);

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/reminders?month=${key}`);
  const row = page.getByRole("row", { name: new RegExp(lastName) });
  await expect(row.getByText("Partiel")).toBeVisible();
  expect(await page.locator('a[href^="https://wa.me/"]').count()).toBeGreaterThan(0);

  await Promise.all([page.waitForURL(/sent=1/), row.getByRole("button", { name: /Notifier/ }).click()]);
  await expect(page.getByText("1 rappel(s) envoyé(s)")).toBeVisible();

  const [n1] = await q<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM "Notification" WHERE "userId" = $1 AND title = $2',
    [studentUserId, "Rappel de paiement"],
  );
  expect(n1.c).toBe(1);
  const [log] = await q<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM "AuditLog" WHERE action = $1 AND "entityId" = $2',
    ["REMINDER", inv.id],
  );
  expect(log.c).toBe(1);

  const row2 = page.getByRole("row", { name: new RegExp(lastName) });
  await expect(row2.getByRole("button", { name: /Relancé/ })).toBeDisabled();
  await page.reload();
  const [n2] = await q<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM "Notification" WHERE "userId" = $1 AND title = $2',
    [studentUserId, "Rappel de paiement"],
  );
  expect(n2.c).toBe(1);

  const denied = await page.request.post("/api/cron/payment-reminders");
  expect(denied.status()).toBe(401);
  const ok = await page.request.post("/api/cron/payment-reminders", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).ok).toBe(true);
});

test("9. l'élève se connecte et voit la notification de paiement", async ({ page }) => {
  const [n] = await q<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM "Notification" WHERE "userId" = $1 AND title = $2',
    [studentUserId, "Paiement reçu"],
  );
  expect(n.c).toBeGreaterThan(0);

  await page.goto("/login");
  await login(page, studentEmail, studentPassword);
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByText("Paiement reçu").first()).toBeVisible();

  for (const route of ["/student/enrollments", "/student/schedule", "/student/attendance", "/student/payments"]) {
    const res = await page.request.get(route);
    expect(res.status(), `GET ${route}`).toBe(200);
  }
});

test("10. l'admin envoie une annonce aux élèves", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/notifications");
  await page.locator('select[name="groupId"]').selectOption({ index: 0 });
  await page.locator('input[name="title"]').fill(announceTitle);
  await page.locator('textarea[name="body"]').fill("Message de test E2E.");
  await Promise.all([
    page.waitForURL(/\/admin\/notifications\?sent=\d+/),
    page.getByRole("button", { name: /Envoyer/ }).click(),
  ]);
  await expect(page.getByText(/Annonce envoyée à \d+ élève/)).toBeVisible();

  const [c] = await q<{ c: number }>('SELECT COUNT(*)::int AS c FROM "Notification" WHERE title = $1', [announceTitle]);
  expect(c.c).toBeGreaterThan(0);

  const markAll = page.getByRole("button", { name: /Tout marquer comme lu/ });
  if (await markAll.isVisible()) {
    await Promise.all([page.waitForLoadState("networkidle"), markAll.click()]);
    await expect(page.getByText("Tout est lu")).toBeVisible();
  }
});

test("11. exports: rapport Excel + reçu PDF", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);

  const xlsx = await page.request.get("/api/reports?type=students&format=xlsx");
  expect(xlsx.status()).toBe(200);
  expect(String(xlsx.headers()["content-type"])).toContain("spreadsheet");

  const [pay] = await q<{ id: number }>('SELECT id FROM "Payment" ORDER BY id DESC LIMIT 1');
  const pdf = await page.request.get(`/api/receipts/${pay.id}`);
  expect(pdf.status()).toBe(200);
  expect(String(pdf.headers()["content-type"])).toContain("pdf");
});

test("12. présences admin: enregistrer", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/attendance");
  const rows = page.locator("tbody tr");
  test.skip((await rows.count()) === 0, "aucun élève dans le groupe");
  await rows.first().getByText("Absent", { exact: true }).click();
  const day = await page.locator('input[name="date"]').inputValue();
  await Promise.all([
    page.waitForURL(/saved=1/),
    page.getByRole("button", { name: /Enregistrer les présences/ }).click(),
  ]);
  await expect(page.getByText("Présences enregistrées.")).toBeVisible();
  const gid = new URL(page.url()).searchParams.get("groupId")!;
  const [c] = await q<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM "Attendance" WHERE "groupId" = $1 AND date = $2 AND status = $3',
    [Number(gid), `${day}T00:00:00.000Z`, "ABSENT"],
  );
  expect(c.c).toBeGreaterThan(0);
});

test("13. l'enseignant se connecte et ouvre ses présences", async ({ page }) => {
  await login(page, TEACHER.email, TEACHER.password);
  await expect(page).toHaveURL(/\/teacher$/);
  const res = await page.request.get("/teacher/attendance");
  expect(res.status()).toBe(200);
});

test("14. déconnexion", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await logoutAdmin(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
