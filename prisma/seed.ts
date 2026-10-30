import bcrypt from "bcryptjs";
import { createPrisma } from "../src/lib/prisma";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
  console.error("Refusing to seed a production database. Set ALLOW_SEED=1 to override.");
  process.exit(1);
}

const db = createPrisma();

const now = new Date();
const Y = now.getUTCFullYear();
const monthStart = (offset = 0) => new Date(Date.UTC(Y, now.getUTCMonth() + offset, 1));
const ago = (mins: number) => new Date(now.getTime() - mins * 60_000);

const FIRST = ["Sara", "Omar", "Lina", "Adam", "Hiba", "Ayoub", "Rim", "Mehdi", "Nour", "Yassine", "Imane", "Zakaria", "Khadija", "Anas", "Meryem", "Hamza", "Aya", "Bilal", "Salma", "Reda", "Ghita", "Walid", "Hajar", "Amine"];
const LAST = ["Benali", "Idrissi", "Alaoui", "Tazi", "Fassi", "Amrani", "Chraibi", "Berrada", "Ouazzani", "Lahlou", "Kettani", "Bennis", "Sebti", "Cherkaoui", "Zniber", "Naciri"];

const LEVELS = ["Primaire", "Collège", "Lycée", "Prépa Concours"] as const;
type LevelName = (typeof LEVELS)[number];

const SPECIALTIES: [string, string][] = [
  ["Mathématiques", "#2f6bff"],
  ["Physique-Chimie", "#8b5cf6"],
  ["Français", "#22c55e"],
  ["Anglais", "#f59e0b"],
  ["SVT", "#06b6d4"],
  ["Philosophie", "#ec4899"],
];

// name, specialty, level, monthlyFee, kind
const GROUPS: [string, string, LevelName, number, "REGULAR" | "CONCOURS"][] = [
  ["Maths · Primaire", "Mathématiques", "Primaire", 350, "REGULAR"],
  ["Français · Primaire", "Français", "Primaire", 350, "REGULAR"],
  ["Maths · Collège", "Mathématiques", "Collège", 400, "REGULAR"],
  ["Français · Collège", "Français", "Collège", 380, "REGULAR"],
  ["Anglais · Collège", "Anglais", "Collège", 380, "REGULAR"],
  ["Maths · Lycée", "Mathématiques", "Lycée", 450, "REGULAR"],
  ["Physique · Lycée", "Physique-Chimie", "Lycée", 450, "REGULAR"],
  ["SVT · Lycée", "SVT", "Lycée", 420, "REGULAR"],
  ["Philo · Lycée", "Philosophie", "Lycée", 420, "REGULAR"],
  ["Prépa Bac Maths", "Mathématiques", "Prépa Concours", 650, "CONCOURS"],
  ["Prépa Concours Médecine", "SVT", "Prépa Concours", 750, "CONCOURS"],
];

const groupsByLevel = new Map<LevelName, string[]>();
for (const [name, , level] of GROUPS) {
  const list = groupsByLevel.get(level) ?? [];
  list.push(name);
  groupsByLevel.set(level, list);
}

const WEIGHTED_LEVELS: LevelName[] = ["Primaire", "Collège", "Collège", "Lycée", "Lycée", "Lycée", "Prépa Concours"];

const PROBLEM_GROUPS = new Set(["Maths · Collège", "Prépa Bac Maths"]);

const FEATURED: [string, string, LevelName][] = [
  ["Ahmed", "Benali", "Collège"],
  ["Fatima Zahra", "El Idrissi", "Collège"],
  ["Youssef", "Chahdi", "Primaire"],
  ["Salma", "El Mansouri", "Lycée"],
  ["Omar", "Ait Baha", "Prépa Concours"],
  ["Lina", "El Farh", "Lycée"],
  ["Rayan", "Bouchta", "Primaire"],
];

async function main() {
  // wipe (demo seed only) — children first
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.attendance.deleteMany();
  await db.payment.deleteMany();
  await db.invoiceLine.deleteMany();
  await db.invoice.deleteMany();
  await db.enrollment.deleteMany();
  await db.session.deleteMany();
  await db.group.deleteMany();
  await db.student.deleteMany();
  await db.registrationPeriod.deleteMany();
  await db.specialty.deleteMany();
  await db.level.deleteMany();
  await db.user.deleteMany();
  await db.school.deleteMany();

  const password = await bcrypt.hash("password123", 10);

  const school = await db.school.create({
    data: {
      name: "Centre Excellence",
      email: "contact@centre-excellence.ma",
      phone: "0522 45 67 89",
      address: "45, Avenue Hassan II, Casablanca",
    },
  });

  const mkUser = (name: string, email: string, role: "ADMIN" | "TEACHER" | "STUDENT", phone?: string) =>
    db.user.create({ data: { schoolId: school.id, name, email, role, phone, password } });
  const admin = await mkUser("Admin Centre", "admin@school.ma", "ADMIN");
  const teacher = await mkUser("Karim Bennani", "prof@school.ma", "TEACHER");
  const teacher2 = await mkUser("Nadia Cherkaoui", "prof2@school.ma", "TEACHER");
  const teacher3 = await mkUser("Hicham Tazi", "prof3@school.ma", "TEACHER");
  const teachers = [teacher, teacher2, teacher3];

  const levels = new Map<string, number>();
  for (const [i, name] of LEVELS.entries()) {
    const l = await db.level.create({ data: { schoolId: school.id, name, order: i } });
    levels.set(name, l.id);
  }

  const specialties = new Map<string, number>();
  for (const [name, color] of SPECIALTIES) {
    const s = await db.specialty.create({ data: { schoolId: school.id, name, color } });
    specialties.set(name, s.id);
  }

  const groups = new Map<string, { id: number; fee: number; level: LevelName }>();
  for (const [i, [name, specialty, level, fee, kind]] of GROUPS.entries()) {
    const g = await db.group.create({
      data: {
        schoolId: school.id,
        specialtyId: specialties.get(specialty)!,
        levelId: levels.get(level)!,
        teacherId: teachers[i % teachers.length]!.id,
        name,
        kind,
        monthlyFee: fee,
        capacity: 18,
      },
    });
    groups.set(name, { id: g.id, fee, level });

    // two weekly sessions per group
    const start = 16 + (i % 3);
    await db.session.createMany({
      data: [
        { groupId: g.id, dayOfWeek: 1 + (i % 5), startTime: `${String(start).padStart(2, "0")}:00`, endTime: `${String(start + 2).padStart(2, "0")}:00`, room: `Salle ${1 + (i % 6)}` },
        { groupId: g.id, dayOfWeek: 6, startTime: `${String(9 + (i % 3)).padStart(2, "0")}:00`, endTime: `${String(11 + (i % 3)).padStart(2, "0")}:00`, room: `Salle ${1 + (i % 6)}` },
      ],
    });
  }

  // ── Roster ────────────────────────────────────────────────────────────────
  const roster: { first: string; last: string; level: LevelName }[] = FEATURED.map(([first, last, level]) => ({ first, last, level }));
  for (let i = 0; roster.length < 56; i++) {
    roster.push({ first: FIRST[(i * 5) % FIRST.length]!, last: LAST[(i * 3 + 1) % LAST.length]!, level: WEIGHTED_LEVELS[(i * 2 + 1) % WEIGHTED_LEVELS.length]! });
  }

  let receipt = 0;
  let demoStudentEmail = "";
  let demoStudentId = 0;
  const curMonthIdx = now.getUTCMonth();

  for (const [i, r] of roster.entries()) {
    const m = Math.min(curMonthIdx, Math.floor(Math.sqrt(((i * 37) % 100) / 100) * (curMonthIdx + 1)));
    const registeredAt = new Date(Date.UTC(Y, m, Math.min(1 + ((i * 7) % 27), m === curMonthIdx ? now.getUTCDate() : 28), 9));

    // the first 4 students get their own login account (role STUDENT)
    const slug = `${r.first}.${r.last}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z.]/g, "");
    const account = i < 4 ? await mkUser(`${r.first} ${r.last}`, `${slug}@school.ma`, "STUDENT") : null;
    if (account && i === 0) {
      demoStudentEmail = account.email;
      demoStudentId = account.id;
    }

    const student = await db.student.create({
      data: {
        schoolId: school.id,
        userId: account?.id ?? null,
        firstName: r.first,
        lastName: r.last,
        parentName: `Parent ${r.last}`,
        parentPhone: `06 ${String(10 + ((i * 13) % 89)).padStart(2, "0")} ${String(10 + ((i * 7) % 89)).padStart(2, "0")} ${String(10 + ((i * 11) % 89)).padStart(2, "0")} ${String(10 + ((i * 17) % 89)).padStart(2, "0")}`,
        parentEmail: `parent${i}@example.com`,
        registeredAt,
        status: i >= roster.length - 3 ? "PENDING" : "ACTIVE",
      },
    });

    // enroll the student into 1-3 groups of their level
    const candidates = groupsByLevel.get(r.level) ?? [];
    const count = Math.min(candidates.length, 1 + (i % 3));
    const enrolled: { name: string; id: number; groupId: number; fee: number }[] = [];
    for (let k = 0; k < count; k++) {
      const name = candidates[(i + k * 3) % candidates.length]!;
      const g = groups.get(name)!;
      if (enrolled.some((e) => e.groupId === g.id)) continue;
      const enr = await db.enrollment.create({
        data: { studentId: student.id, groupId: g.id, monthlyFee: g.fee, startedAt: registeredAt },
      });
      enrolled.push({ name, id: enr.id, groupId: g.id, fee: g.fee });
    }

    // monthly invoices for the last 3 months (full month, no proration)
    for (const offset of [-2, -1, 0]) {
      const month = monthStart(offset);
      const total = enrolled.reduce((s, e) => s + e.fee, 0);
      const invoice = await db.invoice.create({
        data: {
          studentId: student.id,
          month,
          dueDate: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 5)),
          lines: {
            create: enrolled.map((e) => ({ enrollmentId: e.id, label: e.name, amount: e.fee })),
          },
        },
      });

      const roll = (i * 37 + (offset + 3) * 29) % 100;
      const hasProblem = enrolled.some((e) => PROBLEM_GROUPS.has(e.name));
      const paidThreshold = offset === 0 ? (hasProblem ? 28 : 82) : 94;
      let amount = 0;
      if (roll < paidThreshold) amount = total;
      else if (roll < paidThreshold + 8 && offset === 0) amount = Math.round(total / 2);

      if (amount > 0) {
        const paidAt = new Date(Math.min(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 3 + (i % 9), 10), now.getTime()));
        await db.payment.create({
          data: {
            invoiceId: invoice.id,
            amount,
            method: i % 3 === 0 ? "TRANSFER" : "CASH",
            paidAt,
            receiptNo: `R-${Y}-${String(++receipt).padStart(4, "0")}`,
          },
        });
      }
    }
  }

  // ── Attendance: last 5 weekdays, per group ───────────────────────────────
  const days: Date[] = [];
  for (let d = 0; days.length < 5; d++) {
    const dt = new Date(Date.UTC(Y, now.getUTCMonth(), now.getUTCDate() - d));
    if (![0, 6].includes(dt.getUTCDay())) days.push(dt);
  }
  const allEnrollments = await db.enrollment.findMany({ where: { status: "ACTIVE" } });
  const rows: { groupId: number; studentId: number; date: Date; status: "PRESENT" | "ABSENT" | "LATE" }[] = [];
  for (const [i, e] of allEnrollments.entries()) {
    for (const [d, date] of days.entries()) {
      const status = (i + d * 3) % 17 === 0 ? "ABSENT" : (i + d) % 23 === 0 ? "LATE" : "PRESENT";
      rows.push({ groupId: e.groupId, studentId: e.studentId, date, status });
    }
  }
  await db.attendance.createMany({ data: rows });

  // ── Registration window (always open in the demo) ─────────────────────────
  await db.registrationPeriod.create({
    data: {
      schoolId: school.id,
      name: `Inscriptions ${Y}/${Y + 1}`,
      startDate: monthStart(-2),
      endDate: new Date(monthStart(3).getTime() - 1),
    },
  });

  // ── Notifications ────────────────────────────────────────────────────────
  await db.notification.createMany({
    data: [
      { userId: admin.id, title: "Absence non justifiée", body: "Yassine El Amrani · Maths · Collège", createdAt: ago(120) },
      { userId: admin.id, title: "Paiement reçu", body: "Fatima Zahra · Prépa Concours Médecine", createdAt: ago(240) },
      { userId: admin.id, title: "Échéance approchante", body: "Nour Ahmed · Français · Lycée", createdAt: ago(300) },
      { userId: demoStudentId, title: "Paiement reçu", body: "Un paiement de 780 DH a été enregistré.", createdAt: ago(60 * 24 * 2) },
      { userId: demoStudentId, title: "Absence non justifiée", body: "Maths · Collège", createdAt: ago(60 * 26) },
      { userId: demoStudentId, title: "Échéance proche", body: "Rappel : paiement du mois en cours.", createdAt: ago(60 * 50) },
    ],
  });

  await db.auditLog.create({ data: { schoolId: school.id, userId: admin.id, action: "SEED", entity: "School", entityId: school.id } });

  console.log(`Seed OK — ${roster.length} élèves · ${GROUPS.length} groupes · admin@school.ma / prof@school.ma / ${demoStudentEmail} (password123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
