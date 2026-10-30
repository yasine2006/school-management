# Gestion Scolaire

Plateforme web de gestion pour écoles privées : élèves, classes, inscriptions, présences, paiements mensuels, rapports PDF / Excel.

Trois espaces selon le rôle : **Administrateur**, **Enseignant**, **Parent**.

**Stack** : Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma 6 + `@prisma/adapter-pg` · PostgreSQL 16 · JWT + bcryptjs · Recharts · jsPDF · ExcelJS

## 1) Prérequis

- [Node.js](https://nodejs.org/) **>= 18.18** (recommandé LTS/actuel)
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) (pour PostgreSQL en local) ou un serveur PostgreSQL existant
- Accès au terminal / shell

## 2) Installation (développement)

```bash
# Cloner le projet
git clone <url-du-repo> school-management
cd school-management

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env
# Ouvrir .env et générer un secret fort : openssl rand -base64 32
```

Configurer `.env` :

```env
DATABASE_URL="postgresql://school:school@127.0.0.1:5433/school?schema=public"
AUTH_SECRET="REMPLACER_PAR_UNE_CHAINE_ALEATOIRE_LONGUE"
CRON_SECRET="REMPLACER_PAR_UNE_AUTRE_CHAINE_ALEATOIRE_LONGUE"
```

Démarrer la base et l'application :

```bash
# Démarrer PostgreSQL
docker compose up -d

# Appliquer les migrations Prisma
npm run db:migrate

# Créer les données de démo
npm run db:seed

# Lancer en développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

**Comptes de démo** (mot de passe `password123`) :
- `admin@school.ma` — Administrateur
- `prof@school.ma` — Enseignant
- `ahmed.benali@school.ma` — Parent/Élève

> `npm run db:seed` **efface et recrée** les données. En production il est bloqué sauf si `ALLOW_SEED=1`.
> `npm run db:reset` réinitialise complètement la base (migrations + seed).
> `npm run db:check` vérifie l'intégrité relationnelle (clés étrangères, orphelins, contraintes uniques).
> `GET /api/health` retourne `{"status":"ok","db":"up",...}` si tout est OK.

## 3) Règles métier

| Règle | Détails |
|---|---|
| **Mensualités** | Une facture par élève et par mois. Chaque ligne correspond à une inscription active. Montant au mois entier, **sans prorata**. |
| **Échéance** | Le 5 de chaque mois. |
| **Relances** | Démarrent après 5 jours de retard. |
| **Paiement par matière** | Un encaissement peut être affecté à une ligne de facture précise (matière). Le reçu garde la trace de la matière concernée. |
| **Retirer/Réactiver une matière** | « Retirer » met l'inscription en `STOPPED` (`stoppedAt`) sans supprimer (préserve l'historique et les lignes de facture). « Réactiver » la remet en `ACTIVE`. |
| **Inscriptions** | Ouvertes si `maintenant ∈ [début, fin]` et non clôturées. Calculé à la lecture. |
| **Sécurité** | `requireRole()` sur toutes les pages/actions. Filtrage par `schoolId`. Un parent ne voit que ses enfants. Un enseignant ne voit que ses classes. Journal d'audit (`AuditLog`). |
| **Absences** | Saisie d'absence → notification automatique au compte parent/liée à l'élève. L'administrateur peut consulter/completer les **preuves/justifications** dans `Présences & Preuves`. |
| **Présence enseignants** | L'administrateur enregistre lui-même la présence des enseignants dans `Présence enseignants`. |

## 4) Fonctionnalités détaillées

| Espace | Fonctionnalités |
|---|---|
| **Administrateur** | Tableau de bord (KPI, « payé/impayé ce mois », répartition), Élèves (recherche multi-critères nom/prénom/parent/groupe/spécialité, fiche complète), Classes/Groupes, Inscriptions, Présences élèves, **Présences & Preuves**, **Présence enseignants**, Paiements / Factures (encaissement par mois ou par matière, reçu PDF), **Relances & impayés**, Rapports PDF/Excel, Annonces/Notifications, Utilisateurs, Paramètres école (nom/logo). |
| **Enseignant** | Ses groupes, saisie des présences uniquement sur ses classes. |
| **Parent/Élève** | Ses enfants, emploi du temps, présences (avec preuve/motif), paiements + reçus PDF, notifications. |

## 5) Déploiement en production

### 5.1 Variables d'environnement

Créer `.env` en production (ne **jamais** commiter ce fichier) :

```env
DATABASE_URL="postgresql://UTILISATEUR:MOTDEPASSE@HOTE:5432/NOM_BDD?schema=public"
AUTH_SECRET="<généré avec: openssl rand -base64 32>"
CRON_SECRET="<généré avec: openssl rand -base64 32>"
NODE_ENV="production"
```

### 5.2 Installation sur serveur

```bash
# Installer les dépendances (production)
npm ci --omit=dev

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations (OBLIGATOIRE en prod)
npx prisma migrate deploy

# Construire l'application
npm run build

# Démarrer
npm run start
```

L'application écoute par défaut sur le port **3000**. Utiliser un reverse proxy (Nginx/Caddy) devant avec HTTPS.

### 5.3 Exemple Nginx + HTTPS (rapide)

```nginx
server {
    listen 80;
    server_name ton-domaine.ma www.ton-domaine.ma;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ton-domaine.ma www.ton-domaine.ma;

    ssl_certificate /etc/letsencrypt/live/ton-domaine.ma/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ton-domaine.ma/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.4 Lancer en arrière-plan (PM2 recommandé)

```bash
npm install -g pm2
pm2 start npm --name "school-management" -- start
pm2 save
pm2 startup
```

## 6) Tâches planifiées (Cron)

Planifier ces URLs avec `CRON_SECRET` dans l'en-tête `Authorization: Bearer $CRON_SECRET`.

| Tâche | Fréquence | Endpoint |
|---|---|---|
| **Génération factures mensuelles** | 1er du mois à 01:00 | `POST https://ton-domaine.ma/api/cron/monthly-invoices` |
| **Relances impayés** | Tous les jours à 09:00 | `POST https://ton-domaine.ma/api/cron/payment-reminders` |

Exemples crontab :

```cron
0 1 1 * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://ton-domaine.ma/api/cron/monthly-invoices
0 9 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://ton-domaine.ma/api/cron/payment-reminders
```

> Sans `CRON_SECRET` configuré → `503`. Mauvais secret → `401`. Les relances créent une notification in-app **une seule fois par jour et par facture**. Le bouton WhatsApp ouvre uniquement `wa.me` (aucun envoi automatique).

## 7) Rapports & exports

- **Rapports** : `Admin > Rapports` — onglets Élèves / Inscriptions / État des paiements / Factures / Reçus. Filtres par période. Aperçu en direct. Export **PDF** et **Excel**.
- **Impayés** : Dans `État des paiements`, boutons `Impayés — Excel / PDF` ou filtre `Statut des factures`. Depuis `Relances & impayés`, bouton `Impayés Excel` pour le mois affiché.
- **Reçus** : Téléchargeables depuis la fiche facture/paiement ou depuis `Rapports > Factures / Reçus`.

## 8) Fichiers uploadés

Les logos/photos (si utilisés) sont enregistrés dans `uploads/`. Ce dossier est ignoré par Git (`.gitignore`) mais **doit être persistant** en production (volume Docker, dossier partagé ou stockage objet).

## 9) Commandes utiles

| Commande | Usage |
|---|---|
| `npm run dev` | Développement |
| `npm run build` | Build production |
| `npm run start` | Démarrage production |
| `npm run lint` | Linting |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:migrate` | Migrations dev |
| `npm run db:deploy` | Migrations prod |
| `npm run db:reset` | Reset DB + seed |
| `npm run db:seed` | Seed démo |
| `npm run db:check` | Contrôle intégrité DB |
| `npm run db:studio` | Prisma Studio (http://localhost:5555) |

## 10) À savoir avant mise en ligne

- **Secrets** : changer obligatoirement `AUTH_SECRET` et `CRON_SECRET` par des valeurs aléatoires fortes.
- **Migrations** : utiliser **uniquement** `prisma migrate deploy` en production.
- **Sauvegarde** : prévoir un `pg_dump` automatique (cron/systemd) de la base PostgreSQL.
- **HTTPS** : indispensable derrière reverse proxy (le `next.config.ts` contient déjà HSTS/CSP).
- **Données** : `db:seed` ne doit **pas** être exécuté sur une vraie base de production.

## 11) À faire plus tard

- Arabe / RTL
- Envoi réel Email / WhatsApp / SMS
- Paiement en ligne
- Messagerie Prof ↔ Admin
- Sauvegarde automatique intégrée
#   s c h o o l - m a n a g e m e n t  
 