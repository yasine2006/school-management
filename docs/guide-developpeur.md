# Guide Développeur — Centre Excellence

> Plateforme de gestion d'un centre de soutien scolaire.
> Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL · JWT · jsPDF · ExcelJS · Playwright.

هاد الملف هو المرجع الكامل لأي مطور باغي يخدم على المشروع: البنية، الفلو، قواعد العمل، الأنماط، والنقاط اللي خاصك تعرف قبل ما تلمس الكود.

---

## 0. TL;DR — 10 حقائق أساسية

1. **3 فضاءات**: `ADMIN` / `TEACHER` / `STUDENT`، وكل واحد عندو layout و`requireRole()` خاص بيه.
2. **Tenant واحد** فهاد النسخة: كل جدول تقريبا فيه `schoolId`، وكل query خاصها تفلتر بـ`session.schoolId`.
3. **Auth**: JWT HS256 فكوكي `session` (httpOnly, 7 أيام) + bcrypt. `src/proxy.ts` هو middleware ديال Next 16.
4. **الصفحات server components بالافتراض**. `"use client"` غير فالفورمات/المكونات التفاعلية.
5. **الكتابة كلها server actions** (`"use server"`) + Zod + `audit()` + `revalidatePath()`.
6. **الفاتورة = شهر واحد لكل تلميذ**. سطر لكل inscription نشيطة. بلا prorata. الأجل هو 5 من الشهر.
7. **الفلوس بـ`Prisma.Decimal`**، والتواريخ كلها **UTC**، والشهر دائما أول يوم ديال الشهر.
8. **الـPrisma client lazy** عبر Proxy (`src/lib/db.ts`) باش البناء ما يطيحش بلا `DATABASE_URL`.
9. **الـseed كيدمر الداتا**. فالإنتاج ممنوع إلا `ALLOW_SEED=1`.
10. **الاختبارات**: Playwright E2E (كتعمل reset للـDB) + CI (migrate + db-check + lint + typecheck + build).

---

## 1. Stack & versions

| الطبقة | التقنية | ملاحظة |
|---|---|---|
| Framework | Next.js `16.4.1` | App Router، `proxy.ts` بدل `middleware.ts` |
| UI | React `19.3.0` | Server Components + Server Actions |
| Language | TypeScript 5 (strict) | path alias `@/*` → `src/*` |
| Styles | Tailwind CSS 4 | tokens فـ`src/app/globals.css` عبر `@theme` |
| DB | PostgreSQL 16 | Docker محليا، Neon فالإنتاج |
| ORM | Prisma `6.19.3` + `@prisma/adapter-pg` | driver adapter، بلا binary engine |
| Auth | `jose` (JWT) + `bcryptjs` | cookie httpOnly |
| Validation | `zod` 4 | كل action كتفاليدي |
| Charts | `recharts` | dashboard |
| PDF | `jspdf` + `jspdf-autotable` | reçus + rapports |
| Excel | `exceljs` | exports |
| Icônes | `lucide-react` | |
| E2E | `@playwright/test` | Edge/Chrome |

---

## 2. Démarrage rapide

### 2.1 Prérequis

- Node.js ≥ 18.18 (LTS مستحسن)
- npm
- Docker (للـPostgreSQL المحلي) أو PostgreSQL 16

### 2.2 Installation

```bash
git clone https://github.com/yasine2006/school-management.git
cd school-management
npm install
cp .env.example .env
```

### 2.3 `.env` المحلي

```env
DATABASE_URL="postgresql://school:school@127.0.0.1:5433/school?schema=public"
AUTH_SECRET="<openssl rand -base64 32>"
CRON_SECRET="<openssl rand -base64 32>"
```

> `docker-compose.yml` كيشغل Postgres على المنفذ **5433** (ماشي 5432) باش ما يتعارضش مع Postgres آخر.

### 2.4 DB + seed + dev

```bash
docker compose up -d
npm run db:migrate     # prisma migrate dev
npm run db:seed        # بيانات ديمو (كتمسح كلشي)
npm run dev            # http://localhost:3000
```

### 2.5 Comptes ديمو (الـseed)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@school.ma` | `password123` |
| Enseignant | `prof@school.ma`, `prof2@school.ma`, `prof3@school.ma` | `password123` |
| Élève | `ahmed.benali@school.ma` (+ 3 آخرين) | `password123` |

> ملاحظة: الـseed كيعطي `password123`. إلا الـDB اللي كتخدم عليها (مثلا الإنتاج) تبدلت، استعمل credentials ديالها. ما تفترضش أن seed هو source of truth للإنتاج.

### 2.6 Scripts

| Commande | الدور |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` | build production |
| `npm run start` | start production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | prisma generate |
| `npm run db:migrate` | migrations فالتطوير |
| `npm run db:deploy` | migrations فالإنتاج |
| `npm run db:reset` | reset كامل + seed |
| `npm run db:seed` | seed ديمو (مدمّر) |
| `npm run db:check` | فحص التكامل العلائقي (FK/orphelins/unicité) |
| `npm run db:studio` | Prisma Studio |
| `npm run test:e2e` | Playwright |

---

## 3. Structure du projet

```text
school-management/
├── src/
│   ├── proxy.ts                    # Next 16 middleware: JWT + redirects حسب الدور
│   ├── app/
│   │   ├── layout.tsx              # root layout (html lang=fr)
│   │   ├── page.tsx                # "/" → redirect حسب session
│   │   ├── globals.css             # Tailwind 4 + tokens (navy, brand, page, line…)
│   │   ├── error.tsx / global-error.tsx / not-found.tsx / loading.tsx
│   │   ├── attendance-actions.ts   # action مشتركة admin + teacher
│   │   ├── login/                  # page + form (client) + actions
│   │   ├── logout/route.ts         # GET logout
│   │   ├── admin/                  # فضاء ADMIN
│   │   │   ├── layout.tsx          # requireRole("ADMIN") + AppShell
│   │   │   ├── page.tsx            # dashboard KPI + charts
│   │   │   ├── students/           # liste, new, [id], [id]/edit + actions
│   │   │   ├── groups/             # liste, [id] + actions + forms
│   │   │   ├── specialties/ levels/
│   │   │   ├── enrollments/        # inscriptions + actions
│   │   │   ├── attendance/         # présences élèves
│   │   │   ├── absences/           # absences + justificatifs (note)
│   │   │   ├── teachers-attendance/
│   │   │   ├── timetable/
│   │   │   ├── invoices/           # [invoiceId] + pay-form
│   │   │   ├── reminders/
│   │   │   ├── reports/            # report-builder (client)
│   │   │   ├── registrations/      # période d'inscription
│   │   │   ├── notifications/      # annonces
│   │   │   ├── users/
│   │   │   └── settings/           # école + logo + mot de passe
│   │   ├── teacher/                # فضاء TEACHER
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # mes groupes
│   │   │   └── attendance/
│   │   ├── student/                # فضاء STUDENT (mobile-first)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # accueil + notifications
│   │   │   ├── queries.ts          # requireStudent()
│   │   │   ├── enrollments/ schedule/ attendance/ payments/
│   │   │   └── student-nav.tsx
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── receipts/[paymentId]/route.ts
│   │       ├── reports/route.ts
│   │       ├── reports/preview/route.ts
│   │       └── cron/monthly-invoices|payment-reminders/route.ts
│   ├── components/                 # shell, mobile-menu, ui, charts, pagination…
│   └── lib/                        # logique métier réutilisable (server-only)
├── prisma/
│   ├── schema.prisma               # 16 modèles + 7 enums
│   ├── migrations/                 # 4 migrations SQL
│   └── seed.ts
├── scripts/db-check.ts             # contrôle intégrité DB
├── e2e/                            # Playwright (global-setup + platform.spec)
├── .github/workflows/ci.yml
├── docs/                           # dossier technique + guide
├── docker-compose.yml
├── next.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

### 3.1 دور كل مجلد

| Dossier | الدور |
|---|---|
| `src/app/**` | routing + pages + actions. **كل مجلد = segment URL** |
| `src/app/*/actions.ts` | server actions ديال نفس المجلد |
| `src/app/*/page.tsx` | server component (fetch DB + render) |
| `src/app/*/*-form.tsx` | client components (useActionState / inputs) |
| `src/app/api/**/route.ts` | REST endpoints (PDF, Excel, cron, health) |
| `src/components/` | مكونات UI مشتركة |
| `src/lib/` | business logic + helpers (server-only فالأغلب) |
| `prisma/` | schema + migrations + seed |
| `scripts/` | scripts تشغيلية (db-check) |
| `e2e/` | اختبارات end-to-end |
| `docs/` | وثائق المشروع |

---

## 4. Flux d'une requête (important)

```text
Request
  │
  ├─ src/proxy.ts (matcher: /login, /admin/*, /teacher/*, /student/*)
  │    • يقرا cookie "session" → jwtVerify
  │    • ماشي connecté + منطقة محمية → redirect /login
  │    • connecté ولكن دور غلط → redirect للـhome ديالو
  │    • /login + connecté → redirect للـhome
  │
  ├─ src/app/<area>/layout.tsx
  │    • requireRole("ADMIN" | "TEACHER" | "STUDENT")
  │    • كيتحقق أن المستخدم مازال كاين فـDB + نفس schoolId + نفس role
  │    • كيجيب school + user + unread count
  │
  ├─ page.tsx (server component)
  │    • requireRole() مرة أخرى (defense in depth)
  │    • Prisma queries مفلترة بـschoolId
  │    • render HTML
  │
  └─ Form submit → server action ("use server")
       • requireRole()
       • Zod safeParse
       • تحقق ملكية البيانات (schoolId / teacherId / userId)
       • Prisma write (transaction إلا كان multiple)
       • audit()
       • revalidatePath()
       • redirect() أو return state
```

**قاعدة ذهبية**: `proxy.ts` غير redirects. **التحقق الحقيقي دائما فالصفحة/الـaction عبر `requireRole()`**. ما تعتمدش على الـproxy وحدو.

---

## 5. Authentification & autorisation

### 5.1 Session

`src/lib/session.ts`:

```ts
type SessionPayload = { userId: number; schoolId: number; role: Role; name: string };
```

- JWT HS256 موقّع بـ`AUTH_SECRET`، صلاحية **7 أيام**.
- Cookie: `session`, `httpOnly`, `sameSite=lax`, `secure` فالإنتاج.
- `createSession` / `getSession` / `destroySession` / `homeFor(role)`.
- `requireRole(...roles)`:
  1. بلا session → `/login`
  2. دور ماشي مسموح → home ديال الدور
  3. كيتحقق أن `User` مازال كاين بنفس `schoolId` + `role` (باش JWT قديم ما يبقاش صالح بعد reset) → إلا لا `/logout`

### 5.2 Login

`src/app/login/actions.ts`:

- Zod: email + password ≥ 6.
- Rate limit فالميموري: **30 محاولة/IP** و**5 محاولة/IP+email** كل 15 دقيقة.
- bcrypt compare دائما (حتى إلا الإيميل ماكاينش، بـdummy hash) ضد timing attacks.
- كيتحقق `user.active`.
- كيسجل `AuditLog` بـ`LOGIN`.
- redirect حسب الدور.

### 5.3 Rôles & périmètres

| Rôle | يشوف | ما يشوفش |
|---|---|---|
| `ADMIN` | كل بيانات المدرسة | بيانات مدارس أخرى |
| `TEACHER` | غير المجموعات ديالو (`teacherId = userId`) + présences ديالها | باقي المجموعات، الفلوس، الإعدادات |
| `STUDENT` | غير الـ`Student` المرتبط بـ`userId` ديالو (هو/أولاده) | باقي التلاميذ |

- `Student.userId` unique → compte STUDENT مرتبط بتلميذ واحد.
- `src/app/student/queries.ts` → `requireStudent(session)` كيرجع 404 إلا ماكانش مرتبط.
- حتى الـAPI كتعاود تتحقق: مثلا `receipts/[paymentId]` كتسمح غير للـADMIN أو للطالب صاحب الـpayment.

---

## 6. Modèle de données

### 6.1 Vue d'ensemble

```text
School (tenant)
 ├── User (ADMIN / TEACHER / STUDENT)
 │    ├── Group[]            (teacherId)
 │    ├── Student?           (userId)
 │    ├── Notification[]
 │    ├── AuditLog[]
 │    └── TeacherAttendance[] (teacher + recordedBy)
 ├── Level[]      ──< Group[]
 ├── Specialty[]  ──< Group[]
 ├── Group[]      ──< Session[]
 │                ──< Enrollment[] ──< InvoiceLine[]
 │                ──< Attendance[]
 ├── Student[]    ──< Enrollment[]
 │                ──< Invoice[] ──< InvoiceLine[] ──< Payment[]
 │                ──< Attendance[]
 ├── RegistrationPeriod[]
 └── AuditLog[]

Invoice ──< InvoiceLine
Invoice ──< Payment
Payment ─> InvoiceLine? (imputation par matière)
```

### 6.2 Enums (7)

| Enum | Valeurs |
|---|---|
| `Role` | `ADMIN`, `TEACHER`, `STUDENT` |
| `PayMethod` | `CASH`, `TRANSFER` |
| `AttendanceStatus` | `PRESENT`, `ABSENT`, `LATE` |
| `StudentStatus` | `ACTIVE`, `PENDING`, `INACTIVE` |
| `NotificationChannel` | `EMAIL`, `WHATSAPP`, `SMS`, `IN_APP` |
| `EnrollmentStatus` | `ACTIVE`, `STOPPED` |
| `GroupKind` | `REGULAR`, `CONCOURS` |

### 6.3 Modèles (16) & contraintes clés

| Modèle | الدور | Contraintes importantes |
|---|---|---|
| `School` | tenant + infos école + logo | logo = data URL base64 |
| `User` | comptes | `email @unique`, `@@index([schoolId, role])` |
| `Level` | niveau (Primaire, Collège…) | `@@unique([schoolId, name])` |
| `Specialty` | matière | `@@unique([schoolId, name])` |
| `Group` | classe = matière × niveau × prof | `@@unique([schoolId, name])`, `monthlyFee Decimal` |
| `Session` | créneau hebdo | `dayOfWeek` 1=lundi … 7=dimanche, `onDelete: Cascade` |
| `Student` | تلميذ | `userId @unique`, `archived`, `status` |
| `Enrollment` | تلميذ فمجموعة | `@@unique([studentId, groupId])`, `monthlyFee` snapshot |
| `Invoice` | فاتورة شهر | `@@unique([studentId, month])`, `month` = 1er UTC |
| `InvoiceLine` | سطر فاتورة (مادة) | `enrollmentId?` (يقدر يكون null = frais) |
| `Payment` | أداء | `receiptNo @unique`, `lineId?` |
| `Attendance` | حضور تلميذ | `@@unique([groupId, studentId, date])` |
| `RegistrationPeriod` | نافذة التسجيل | `closedAt?` |
| `Notification` | إشعارات in-app | `@@index([userId, readAt])` |
| `AuditLog` | journal | `action`, `entity`, `entityId`, `details Json` |
| `TeacherAttendance` | حضور الأساتذة | `@@unique([teacherId, date])` |

### 6.4 Migrations

```text
20261019173437_init
20261020221955_payment_line_attribution
20261022190000_search_unaccent        # CREATE EXTENSION unaccent
20261023184421_teacher_attendance
```

> `unaccent` ضرورية للبحث بلا accents. إلا درت DB جديدة، `prisma migrate deploy` كتطبقها.

---

## 7. Règles métier (لا تخرقها)

### 7.1 Facturation mensuelle

- **فاتورة واحدة لكل تلميذ لكل شهر** (`studentId + month` unique).
- `month` دائما **أول يوم ديال الشهر بـUTC** (`monthStart`).
- `dueDate` = **5 من الشهر**.
- **سطر واحد لكل inscription نشيطة** وقت الفاتورة. المجموع = مجموع السطور.
- **بلا prorata**: حتى إلا سجل متأخر، كيخلص الشهر كامل.
- `billableEnrollments` = `startedAt <= monthEnd`.
- `MAX_BILLING_MONTHS = 12` → backfill حتى 12 شهر.
- `ensureInvoiceForMonth` idempotent وكيتعامل مع race `P2002`.
- `generateMissingInvoices` كتخدم غير على:
  - students `archived=false`, `status=ACTIVE`, عندهم enrollment `ACTIVE`
  - ماكاينش invoice لهاد الشهر
- الفاتورة كتخلق تلقائيا عبر:
  - cron `POST /api/cron/monthly-invoices`
  - زر admin فـ`/admin/invoices`
  - `openInvoiceForMonth` / `ensureMonthlyInvoice` من فiche تلميذ

### 7.2 Paiements

- `amount > 0`.
- إلا `lineId` معطى: الحد الأقصى = reste ديال **ديك المادة** (amount - payments المرتبطة بيها).
- إلا لا: الحد الأقصى = reste ديال الفاتورة كاملة.
- ما يمكنش تخلص أكثر من reste → error Zod-like.
- `receiptNo = R-<année>-<paymentId pad4>`.
- كل payment:
  - كيخلق `Notification` "Paiement reçu" إلا التلميذ عندو compte
  - `audit(..., "PAYMENT", ...)`
- الحالة محسوبة، ماشي مخزنة:
  - `paid = 0` → `UNPAID`
  - `0 < paid < due` → `PARTIAL`
  - `paid >= due` → `PAID`
- `isOverdue` = ماشي PAID و`dueDate < now`.

### 7.3 Relances (reminders)

- `reminderRows(schoolId, month)` كتحسب لكل تلميذ: due / paid / remaining / daysLate / remindedToday / waHref.
- `sendReminders` كترسل غير إلا:
  - invoice كاينة
  - `remaining > 0`
  - `userId` مرتبط
  - ما تم إرسال اليوم (AuditLog `REMINDER` لنفس invoice)
  - `onlyOverdue` → `daysLate > 0`
- الإرسال = **Notification in-app** + AuditLog. **ماشي email/SMS/WhatsApp حقيقي**.
- WhatsApp = link `wa.me` فقط، ماكاينش إرسال أوتوماتيكي.
- Cron يومي: `POST /api/cron/payment-reminders` (كل المدارس، الشهر الحالي، onlyOverdue).

### 7.4 Inscriptions (enrollment)

- «Arrêter» → `status=STOPPED`, `stoppedAt=now` (ما كتحذفش، كتحافظ على التاريخ والفواتير).
- «Réactiver» → `status=ACTIVE`, `stoppedAt=null`.
- «Supprimer» مسموح **غير إلا ماكانش عندها invoice lines**.
- إعادة التسجيل فنفس المجموعة: إلا كانت STOPPED كترجع ACTIVE وكتاخد `monthlyFee` الحالي.

### 7.5 Période d'inscription

- مفتوحة إلا: `now ∈ [startDate, endDate]` و`closedAt == null`.
- محسوبة عند القراءة (`registrationState`) → **بلا cron**.
- `savePeriod` كتحدّث آخر période، و`closePeriod` كتسدها بكري.

### 7.6 Présences

- `Attendance` unique على `(groupId, studentId, date)` → `upsert`.
- أول مرة كيتحط `ABSENT` → `Notification` للتلميذ (إلا عندو compte).
- Teacher: غير المجموعات ديالو (`teacherId = session.userId`).
- `TeacherAttendance`: ADMIN فقط، unique على `(teacherId, date)`.

### 7.7 Suppression forcée (élève)

`canForceDeleteStudent` كتسمح غير إلا:
- عندو **impayé > 0**
- و**maxDaysLate > 30**

+ confirmation كتابية: `NOM PRENOM` (case-insensitive).
+ الحذف داخل transaction: attendance → payments → invoiceLines → invoices → enrollments → notifications → student.
+ AuditLog بـ`reason: UNPAID_OVER_30_DAYS`.

### 7.8 Recherche

- `studentSearchWhere`:
  - tokens (max 5)
  - `unaccent(...) ILIKE unaccent(...)`
  - كتقلب فـ: firstName, lastName, parentName, group.name, specialty.name
  - escape `%`, `_`, `\`
- النتيجة كترجع `{ id: { in: [...] } }` → كتدمج مع باقي filters.

---

## 8. Couche `src/lib` (المرجع)

| Fichier | الدور | exports مهمة |
|---|---|---|
| `db.ts` | Prisma lazy Proxy (singleton) | `db` |
| `prisma.ts` | إنشاء client بـadapter-pg | `createPrisma()` |
| `session.ts` | JWT + cookie + garde | `requireRole`, `getSession`, `homeFor` |
| `audit.ts` | journalisation | `audit()` |
| `fees.ts` | calculs facture + statuts + période | `invoiceTotals`, `invoiceStatus`, `isOverdue`, `firstOfMonth`, `registrationState`, `statusMeta`, `kindMeta` |
| `invoicing.ts` | génération factures | `monthStart/End`, `addMonths`, `monthKey`, `monthsBetween`, `ensureInvoiceForMonth`, `generateMissingInvoices`, `countMissingInvoices` |
| `reminders.ts` | relances + WhatsApp link | `reminderRows`, `sendReminders`, `reminderSummary` |
| `collection.ts` | règle suppression forcée | `canForceDeleteStudent` |
| `search.ts` | recherche unaccent | `studentSearchWhere`, `searchTokens` |
| `reports.ts` | datasets rapports | `buildDataset` |
| `pdf.ts` | PDF reçus + tableaux | `receiptPdf`, `tablePdf` |
| `format.ts` | formats FR | `formatDH`, `formatDate`, `formatMonth`, `formatLongDate`, `timeAgo`, `initials`, `toInputDate` |
| `rate-limit.ts` | anti-bruteforce mémoire | `clientIp`, `consumeAttempt`, `resetAttempts` |

> `server-only` فـ`session`, `invoicing`, `reminders`, `audit`, `search`, `reports`, `pdf`, `collection`, `rate-limit` → ما يمكنش تستوردهم فclient component.

---

## 9. Cartographie des routes

### 9.1 ADMIN

| Route | الوظيفة |
|---|---|
| `/admin` | dashboard KPI + courbes + notifications |
| `/admin/students` | liste + recherche + filtres + pagination |
| `/admin/students/new` | إنشاء تلميذ (+ compte اختياري) |
| `/admin/students/[id]` | fiche: inscriptions, factures, actions |
| `/admin/students/[id]/edit` | تعديل |
| `/admin/groups` | liste المجموعات + assign prof |
| `/admin/groups/[id]` | تفاصيل + inscrits + créneaux + ajout élève |
| `/admin/specialties` | matières |
| `/admin/levels` | niveaux |
| `/admin/enrollments` | inscriptions + stop/reactivate/delete |
| `/admin/attendance` | présences élèves (par groupe + date) |
| `/admin/absences` | absences + justificatifs (note) |
| `/admin/teachers-attendance` | présences enseignants |
| `/admin/timetable` | emploi du temps |
| `/admin/invoices` | liste factures + génération mensuelle |
| `/admin/invoices/[invoiceId]` | détail + encaissement (total ou par matière) |
| `/admin/reminders` | impayés + relances + WhatsApp |
| `/admin/reports` | rapports PDF/Excel (4 onglets) |
| `/admin/registrations` | période + validation PENDING |
| `/admin/notifications` | annonces + marquer lu |
| `/admin/users` | comptes (création, activation) |
| `/admin/settings` | école + logo + mot de passe |

### 9.2 TEACHER

| Route | الوظيفة |
|---|---|
| `/teacher` | مجموعاتو + élèves + créneaux |
| `/teacher/attendance` | présences غير لمجموعاتو |

### 9.3 STUDENT (mobile-first)

| Route | الوظيفة |
|---|---|
| `/student` | accueil + notifications |
| `/student/enrollments` | مواده |
| `/student/schedule` | emploi du temps |
| `/student/attendance` | حضوره + motifs |
| `/student/payments` | factures + reçus PDF |

### 9.4 API

| Endpoint | Auth | الدور |
|---|---|---|
| `GET /api/health` | عام | `{status, db, latencyMs, uptime}` |
| `GET /api/receipts/[paymentId]` | session | ADMIN أو STUDENT صاحب الـpayment |
| `GET /api/reports?type=...&format=pdf|xlsx` | session | ADMIN فقط |
| `GET /api/reports/preview?...` | session | ADMIN فقط (aperçu JSON) |
| `POST /api/cron/monthly-invoices` | `Bearer CRON_SECRET` | cron |
| `POST /api/cron/payment-reminders` | `Bearer CRON_SECRET` | cron |

> الـcron: بلا `CRON_SECRET` → `503`. secret غلط → `401`. `GET` → `405`.

---

## 10. Patterns & conventions

### 10.1 Server component أولاً

```tsx
// src/app/admin/students/page.tsx
export default async function StudentsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const { q, page } = await searchParams;   // Next 16: Promise
  ...
}
```

- فـNext 16: `params` و`searchParams` **Promises** → `await`.
- `cookies()` و`headers()` تا هما async.

### 10.2 Client components

غير إلا احتجت:
- `useState` / `useEffect` / `usePathname`
- `useActionState`
- portails / événements / charts

أمثلة: `*-form.tsx`, `report-builder.tsx`, `charts.tsx`, `mobile-menu.tsx`, `confirm-button.tsx`, `auto-form.tsx`, `nav-link.tsx`.

### 10.3 Server action نموذجية

```ts
"use server";

export async function createX(_: State, formData: FormData): Promise<State> {
  const session = await requireRole("ADMIN");          // 1. auth
  const parsed = schema.safeParse(Object.fromEntries(formData)); // 2. validation
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const row = await db.x.findFirst({ where: { id, schoolId: session.schoolId } }); // 3. tenant
  if (!row) return { message: "Introuvable." };

  await db.x.create({ data: { ... } });                // 4. write
  await audit(session, "CREATE", "X", row.id);         // 5. audit
  revalidatePath("/admin", "layout");                  // 6. refresh
  redirect("/admin/x");                                // 7. navigation
}
```

- استعمل `revalidatePath("/admin", "layout")` من بعد أي write.
- `redirect()` كيرمي exception → ما تحطش كود من بعدو.
- إلا بغيت ترجع state للفورم: بلا redirect، ورجع `{ ok, errors, message }`.

### 10.4 Validation Zod

- `z.coerce.number()` للمعرّفات/المبالغ من `FormData`.
- `z.enum([...])` للـenums.
- `z.iso.date()` للتواريخ (`YYYY-MM-DD`).
- `z.flattenError(parsed.error).fieldErrors` → يسهل عرض الأخطاء تحت الحقول.

### 10.5 Argent & dates

- **Money**: `Prisma.Decimal` دائما. ما تستعملش `number` فالحسابات.
- عند العرض: `Number(decimal.toString())` أو `formatDH`.
- **Dates**: UTC. الشهر = `Date.UTC(y, m, 1)`. التنسيق بـ`timeZone: "UTC"`.
- `toInputDate` = `yyyy-mm-dd` لـ`<input type="date">`.

### 10.6 UI system

- `src/components/ui.tsx`: `Card`, `PageHeader`, `Badge`, `Avatar`, `Field`, `inputCls`, `selectCls`, `btnPrimary`, `btnGhost`, `th`, `td`.
- الألوان من `@theme` فـ`globals.css`:
  - `navy-950/900/800/700`
  - `brand-50/100/500/600/700`
  - `page`, `line`, `ink`, `muted`
- استعمل هاد tokens، ماشي hex عشوائي.
- Sidebar: `AppShell` + `variant="blue"` (gradient) فالديسكتوب والموبايل.
- Mobile drawer: portal لـ`document.body`, `z-[9999]`, `100dvh`.

### 10.7 Pagination & filtres

- `Pagination` component: `page`, `pageSize`, `total`, `basePath`, `params`, `noun`.
- `AutoForm` (client): GET form كيتصيفط أوتوماتيكيا عند تغيير select/date/month.

### 10.8 Multi-tenant

- كل query على بيانات المدرسة خاصها `schoolId`.
- كل query على تلميذ خاصها إما `student.schoolId` أو `schoolId` مباشرة.
- كل action كتتحقق من الملكية قبل أي write.
- ما تعتمدش على ID من الـURL بلا ما تتحقق من `schoolId`.

---

## 11. Variables d'environnement

| Variable | إلزامية | الدور |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres (pooled فالإنتاج) |
| `AUTH_SECRET` | ✅ | توقيع JWT (≥ 32 bytes عشوائي) |
| `CRON_SECRET` | ✅ | حماية endpoints ديال cron |
| `NODE_ENV` | auto | production/dev |
| `ALLOW_SEED` | اختياري | `1` باش تسمح seed فالإنتاج |
| `E2E_PORT` / `E2E_BASE_URL` / `E2E_CHANNEL` / `E2E_SKIP_RESET` | اختياري | Playwright |

`.env` غير مدرج فGit. `.env.example` هو المرجع.

---

## 12. Base de données

### 12.1 Migrations

```bash
# dev: يخلق migration جديدة
npx prisma migrate dev --name ma_migration

# prod: يطبق غير الموجود
npx prisma migrate deploy

# بعد أي تغيير فschema
npx prisma generate
```

### 12.2 Seed

`prisma/seed.ts`:
- كيمسح كل الجداول (children first)
- كيخلق: مدرسة، 1 admin، 3 profs، 4 levels، 6 specialties، 11 groups، 2 sessions/group، ~56 students (4 بـcompte)، enrollments، 3 months invoices/payments، attendance (5 أيام)، période، notifications، audit.
- محمي: فالإنتاج كيرفض إلا `ALLOW_SEED=1`.

### 12.3 db-check

`npm run db:check` كيطبع:
- row counts
- foreign keys + orphelins (خاصهم يكونو 0)
- unique/primary keys
- exit code 1 إلا كان انتهاك

### 12.4 Prisma Studio

```bash
npm run db:studio   # http://localhost:5555
```

> ملاحظة: `.env` المحلي كي指向 Docker (5433). إلا بغيت تخدم على Neon، export `DATABASE_URL` ديال Neon فالجلسة قبل أي script.

---

## 13. Tests

### 13.1 Playwright

- `playwright.config.ts`:
  - testDir `./e2e`
  - `fullyParallel: false`, `workers: 1` (serial)
  - `webServer`: `npm run start -- -p 3100` (إلا ماكانش `E2E_BASE_URL`)
  - browser: `msedge` (أو `E2E_CHANNEL`)
- `e2e/global-setup.ts`:
  - كيقرا `.env`
  - `prisma migrate reset --force --skip-generate` (إلا `E2E_SKIP_RESET != 1`)
- `e2e/platform.spec.ts`: سيناريو كامل:
  login خاطئ → admin routes 200 → créer élève + compte → inscription → validation PENDING → compte prof → assign prof → paiement partiel/solde → mois précis → cron factures → paiement par matière → stop/reactivate → recherche → relances + WhatsApp + cron → login élève → annonce → exports PDF/Excel → présences → login prof → logout.

```bash
npx playwright install msedge   # إلا ماكانش
npm run test:e2e
```

> الاختبارات كتخدم على DB حقيقية وكتعمل reset. **ما تشغلهاش على الإنتاج**.

### 13.2 CI

`.github/workflows/ci.yml` (push main + PR):
- Postgres 16 service
- `npm ci`
- `prisma migrate deploy`
- `npm run db:check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

> E2E ماشي فCI حاليا.

---

## 14. Déploiement

### 14.1 Vercel + Neon (الوضع الحالي)

- Repo: `yasine2006/school-management` (branch `main`).
- Vercel project: `school-management`.
- DB: Neon Postgres (pooled connection string).
- Build: `next build` + `postinstall: prisma generate`.
- `serverExternalPackages`: `@prisma/client`, `exceljs`, `jspdf` (باش ما يتحزمش).

### 14.2 Variables على Vercel

```
DATABASE_URL = <Neon pooled URL>
AUTH_SECRET  = <random 32+ bytes>
CRON_SECRET  = <random 32+ bytes>
```

### 14.3 Cron

ماكاينش `vercel.json` حاليا. الـcron كيتصيفط من برا (crontab / service) بـ`Authorization: Bearer $CRON_SECRET`:

```cron
0 1 1 * *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/monthly-invoices
0 9 * * *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/payment-reminders
```

إلا بغيت Vercel Cron، زيد `vercel.json` بـ`crons` (خاصك تكون واعي بحدود الخطة).

### 14.4 Healthcheck

`GET /api/health`:
- `200` + `{"status":"ok","db":"up",...}` إلا DB خدامة
- `503` + `{"status":"degraded","db":"down"}` إلا لا

### 14.5 Sécurité

`next.config.ts` كيزيد headers على كل المسارات:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Strict-Transport-Security`
- `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`

> `frame-ancestors 'none'` كتمنع iframe. إلا احتجت embed، بدلها.

---

## 15. Recettes (مهام متكررة)

### 15.1 زيد صفحة admin جديدة

1. `src/app/admin/ma-page/page.tsx`
2. فالأول: `const { schoolId } = await requireRole("ADMIN");`
3. جيب الداتا بـPrisma (فلتر `schoolId`).
4. استعمل `PageHeader` + `Card`.
5. زيد الرابط فـ`NAV.ADMIN` فـ`src/components/shell.tsx`.
6. إلا كان write: `src/app/admin/ma-page/actions.ts` بـ`"use server"`.

### 15.2 زيد field فmodel

1. عدل `prisma/schema.prisma`.
2. `npx prisma migrate dev --name add_x`.
3. `npx prisma generate`.
4. حدّث الـform + action + Zod + العرض.
5. إلا كان field إلزامي، حط default أو migration بـbackfill.

### 15.3 زيد server action

```ts
"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";
import { revalidatePath } from "next/cache";

const schema = z.object({ name: z.string().trim().min(1) });

export async function createThing(_: { message?: string }, formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Données invalides." };

  const row = await db.thing.create({
    data: { schoolId: session.schoolId, name: parsed.data.name },
  });
  await audit(session, "CREATE", "Thing", row.id);
  revalidatePath("/admin", "layout");
  return { message: "Créé." };
}
```

### 15.4 زيد dataset فRapports

1. `src/lib/reports.ts` → زيد `if (type === "mon-type") { ... return Dataset }`.
2. حط `head`, `rows`, `money` (indexes), `slug`.
3. `src/app/admin/reports/page.tsx` → زيد tab فـ`TABS`.
4. الـPDF/Excel كيتولاو أوتوماتيكيا من `buildDataset`.

### 15.5 زيد rôle جديد

1. `Role` enum فschema + migration.
2. `SessionPayload` + `homeFor` فـ`session.ts`.
3. `HOME` فـ`proxy.ts`.
4. Layout + `requireRole` + NAV.
5. راجع كل query فيها `role`/`teacherId`/`userId`.

---

## 16. Pièges & gotchas

| # | Piège | الحل |
|---|---|---|
| 1 | Prisma client كيتخلق وقت build بلا `DATABASE_URL` | `src/lib/db.ts` lazy Proxy + `serverExternalPackages` |
| 2 | `params`/`searchParams` فNext 16 Promises | دائما `await` |
| 3 | `cookies()`/`headers()` async | `await cookies()` |
| 4 | `middleware.ts` قديم | فNext 16 سميتو `proxy.ts` |
| 5 | نسيان `schoolId` فquery | كل query خاصها tenant filter |
| 6 | نسيان `requireRole` فaction | كل action كتبدأ بيها |
| 7 | استعمال `number` للمال | `Prisma.Decimal` |
| 8 | تواريخ محلية | UTC + `monthStart` |
| 9 | `revalidatePath` ناقص | من بعد كل write |
| 10 | `redirect()` وسط `try/catch` | `redirect` كيرمي exception؛ ما تصيدهاش |
| 11 | rate limit فالميموري | ما كيتشاركش بين instances فVercel؛ للإنتاج جدّي استعمل Redis/Upstash |
| 12 | seed على الإنتاج | ممنوع إلا `ALLOW_SEED=1` |
| 13 | logo base64 كبير | حد 400KB، PNG/JPG فقط |
| 14 | `uploads/` | الكود الحالي كيستعمل base64 للـlogo وURL للصور؛ ما كاينش upload عام |
| 15 | WhatsApp/Email/SMS | غير in-app + رابط wa.me؛ ماشي إرسال حقيقي |
| 16 | E2E كيعمل reset | ماتشغلهاش على DB فيها داتا حقيقية |
| 17 | `prisma migrate dev` فالإنتاج | استعمل `migrate deploy` |
| 18 | `@/` alias | مضبوط ف`tsconfig.json` → `src/*` |
| 19 | Tailwind classes ديناميكية | استعمل tokens/ثوابت، ماشي string interpolation معقد |
| 20 | `AGENTS.md` | قبل أي كود Next، اقرا `node_modules/next/dist/docs/` (إصدار 16 فيه breaking changes) |

---

## 17. Dette technique / roadmap

- [ ] إرسال حقيقي Email / WhatsApp / SMS (دابا in-app فقط).
- [ ] Paiement en ligne (CMI/Stripe).
- [ ] Arabe / RTL كامل.
- [ ] Messagerie Prof ↔ Admin.
- [ ] Sauvegarde automatique (pg_dump) + restore.
- [ ] Rate limit موزّع (Redis).
- [ ] E2E فCI.
- [ ] Observabilité (Sentry/logs structurés).
- [ ] Upload d'images via stockage objet (دابا base64/URL).

---

## 18. Checklist onboarding

- [ ] `npm install`
- [ ] `.env` من `.env.example` + secrets
- [ ] `docker compose up -d`
- [ ] `npm run db:migrate`
- [ ] `npm run db:seed`
- [ ] `npm run dev` + login `admin@school.ma` / `password123`
- [ ] قرا `prisma/schema.prisma`
- [ ] قرا `src/lib/session.ts` + `src/proxy.ts`
- [ ] قرا `src/lib/invoicing.ts` + `fees.ts` + `reminders.ts`
- [ ] قرا `src/app/admin/invoices/actions.ts` (نموذج action كاملة)
- [ ] قرا `src/app/admin/students/page.tsx` (نموذج page)
- [ ] `npm run typecheck` + `npm run lint`
- [ ] `npm run db:check`
- [ ] (اختياري) `npm run test:e2e` على DB محلية

---

## 19. Liens utiles

- Live: `https://school-management-ochre-eight.vercel.app`
- Repo: `https://github.com/yasine2006/school-management`
- Dossier technique: `docs/dossier-technique.html` / `.pdf`
- Plan du dossier: `docs/dossier-technique-plan.md`
- README: `README.md`

---

> آخر تحديث: 2026-11-12 — إلا بدلتي schema ولا business rule، حدّث هاد الملف مع الكود.
