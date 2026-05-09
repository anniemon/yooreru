# yooreru.com

Custom Next.js blog for `yooreru.com`, built to replace the current WordPress.com site while keeping the domain, permalink shape, categories, tags, comments, and admin publishing flow.

## Stack

- Next.js App Router + TypeScript
- Prisma + Postgres, intended for Neon
- Resend for subscription/admin email
- Vercel Blob-ready media model
- WordPress WXR import script

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:generate
```

For a real database, set `DATABASE_URL`, then run:

```bash
npm run db:migrate:dev
npm run db:seed
npm run dev
```

Without `DATABASE_URL`, public pages render sample content so the layout can be reviewed locally. Admin mutations require a database.

## WordPress Import

Export WordPress content from WordPress.com as a WXR XML file, then run:

```bash
npm run wp:import -- ./wordpress-export.xml
```

The importer handles posts/pages, category/tag terms, WordPress IDs, permalink values, comment status, and nested comments where the parent comment has already been imported.

## Deployment Notes

1. Create a Neon Postgres database and set `DATABASE_URL` in Vercel.
2. Set `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `NEXT_PUBLIC_SITE_URL`, and `APP_TIME_ZONE` (`Asia/Seoul` by default).
3. Optional: set `RESEND_API_KEY`, `RESEND_FROM`, and `BLOB_READ_WRITE_TOKEN`.
4. Run the production migration and seed admin once.
5. Keep the `yooreru.com` domain registration at WordPress.com, but replace WordPress.com DNS records with the Vercel-provided DNS records when ready to launch.

Do not cancel or remove the WordPress.com domain registration unless the domain is transferred to another registrar first.
