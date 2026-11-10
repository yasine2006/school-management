# Dossier technique — Centre Excellence

Plan de contenu + charte, pour reconstruction libre du PDF.
Version 1.0 — Novembre 2026.

---

## 1. Le principe (l'idée à faire passer)

**FR —** Le centre gère aujourd'hui ses élèves, ses inscriptions, ses présences et ses paiements avec des registres, des fichiers Excel et des reçus manuscrits. La plateforme remplace tout cela par un seul système : une seule saisie, une facturation automatique, des reçus PDF et un espace pour les parents. Ce n'est pas un projet à financer : l'outil tourne déjà, avec les données réelles du centre.

**AR —** يعتمد المركز اليوم على سجلات ورقية وملفات Excel ووصولات مكتوبة بخط اليد لتسيير التلاميذ والتسجيلات والحضور والأداءات. المنصة تعوّض كل ذلك بنظام واحد: إدخال واحد، فوترة تلقائية، وصولات PDF، وفضاء خاص بالأولياء. وهي ليست مشروعًا قيد الإنشاء، بل أداة تعمل فعليًا ببيانات المركز الحقيقية.

**Trois messages clés :**
1. **Temps gagné** — la facturation et les relances ne se recalculent plus à la main.
2. **Argent protégé** — chaque impayé est visible dès le premier jour de retard.
3. **Image renforcée** — reçus PDF, espace parent, suivi en ligne : le centre paraît moderne et rigoureux.

---

## 2. Les pages (18 pages A4)

### Partie I — Français (pages 1 à 10)

| # | Page | Contenu |
|---|---|---|
| 1 | **Couverture** | Logo réel, « Dossier technique · وثيقة تقنية », titre « Plateforme numérique de gestion du centre », sous-titre bilingue, destinataires / version / confidentialité. |
| 2 | **Sommaire** | Deux colonnes : sommaire FR (8 sections) + فهرس AR (7 sections), avec numéros de page. Encadré « En une phrase ». |
| 3 | **01. Le centre et son contexte** | Présentation du centre (soutien scolaire, Casablanca), outils actuels non connectés, promesse d'une source unique. 8 indicateurs réels : 46 élèves · 12 groupes · 7 matières · 4 niveaux · 4 enseignants · 72 inscriptions · 239 factures · 113 paiements. Encadré « ces chiffres sont réels ». |
| 4 | **02. Les limites de la gestion actuelle** | Tableau Domaine / Situation actuelle / Conséquence (inscriptions, facturation, encaissements, impayés, présences, parents, direction, continuité). Coût en temps, en argent, en image. |
| 5 | **03. La solution : une plateforme unique** | 3 cartes : Espace Administration / Enseignant / Parent-Élève. « Une seule source de vérité ». Tableau Avant / Après (5 lignes). |
| 6 | **04. Modules et fonctionnalités** | Tableau de 14 modules : tableau de bord, élèves, groupes, matières & niveaux, inscriptions, présences, présences & preuves, présence enseignants, factures, paiements, relances & impayés, rapports, notifications, utilisateurs & paramètres. |
| 7 | **05. Règles métier et sécurité** | 8 règles (mensualité, échéance le 5, mois entier sans prorata, paiement par matière, retrait = suspension, réactivation, relances après 5 jours, périodes d'inscription) + sécurité (bcrypt, JWT, contrôle par rôle, cloisonnement, audit, HTTPS). |
| 8 | **06. Rapports, exports et architecture** | Documents (élèves, inscriptions, état des paiements, reçus PDF, exports Excel, impayés, aperçu direct, filtres période) + tableau technique (Next.js 16, TypeScript, Tailwind, PostgreSQL/Neon, Prisma, JWT+bcrypt, jsPDF, ExcelJS, Vercel, /api/health). Encadré automatisation (factures le 1er à 01:00, relances à 09:00). |
| 9 | **07. Bénéfices et mise en service** | 7 bénéfices (temps, recouvrement, traçabilité, image, pilotage, pérennité, sérénité) + 5 étapes d'installation + encadré évolutions (interface AR/RTL, WhatsApp/SMS réels, paiement en ligne, messagerie, sauvegarde auto). |
| 10 | **08. Contact et validation** | Coordonnées du centre, 5 points à valider ensemble, encadré transparence (données propriété du centre), 2 blocs de signature, mention version. |

### Séparateur (page 11)

| # | Page | Contenu |
|---|---|---|
| 11 | **Partie II — الجزء العربي** | Page de séparation pleine page, fond bleu, titre bilingue. |

### Partie II — العربية (pages 12 à 18)

| # | Page | Contenu |
|---|---|---|
| 12 | **٠١. المركز وسياقه** | نفس التقديم + نفس الأرقام الثمانية (46 تلميذًا، 12 مجموعة، 7 مواد، 4 مستويات، 4 أساتذة، 72 تسجيلًا، 239 فاتورة، 113 أداء). |
| 13 | **٠٢. الإشكالات والحل** | جدول المجال / الوضع الحالي / النتيجة + 3 بطاقات (فضاء الإدارة، الأستاذ، ولي الأمر). |
| 14 | **٠٣. الوحدات والوظائف** | جدول بـ14 وحدة (نفس محتوى الصفحة 6). |
| 15 | **٠٤. القواعد التجارية والأمان** | 8 قواعد + الأمان والخصوصية (كلمات السر، الجلسة، الأدوار، عزل البيانات، سجل التتبّع، HTTPS). |
| 16 | **٠٥. التقارير والبنية التقنية** | الوثائق المتاحة + جدول البنية التقنية + أتمتة الفوترة والتذكيرات. |
| 17 | **٠٦. الفوائد وخطة الإطلاق** | جدول 6 فوائد + 5 مراحل الإطلاق + التزام بالشفافية. |
| 18 | **٠٧. التواصل والتوقيع** | معطيات المركز، 5 نقاط للتحقق، خلاصة، توقيعان، رقم الإصدار. |

---

## 3. Charte pour rester cohérent

- **Format** : A4 portrait, marges 17 mm (latéral) / 15 mm (haut) / 13 mm (bas).
- **Couleurs** : bleu principal `#1a56db`, bleu profond `#123a8f`, marine `#0b1b3b`, accent doré `#c8a24a`, texte `#0f1b33`, gris `#5b6b85`, filets `#e2e8f2`.
- **Typo** : Segoe UI / Inter pour le français (titres 20 pt, texte 10,5 pt, tableaux 8,6 pt) ; Segoe UI / Tahoma pour l'arabe (texte 11 pt, interligne 1,8).
- **Éléments récurrents** : en-tête (logo + nom + partie), pied de page (nom + numéro), pastille de section `01.`, encadrés bleu clair pour les messages importants.
- **Règle d'or** : chaque page = une idée, un tableau ou trois cartes maximum.

---

## 4. Où trouver le texte intégral

Le texte complet, déjà rédigé et relu, se trouve dans :

- `docs/dossier-technique.html` — version mise en page (copier-coller le texte depuis le navigateur) ;
- `docs/dossier-technique.pdf` — version imprimable de référence (18 pages).

Le PDF peut être régénéré après modification du HTML avec :

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="docs\dossier-technique.pdf" "file:///C:/Users/yassi/OneDrive/Bureau/school-management/docs/dossier-technique.html"
```
