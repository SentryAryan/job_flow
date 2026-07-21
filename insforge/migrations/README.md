# InsForge migrations

Bootstrap order for a **new** InsForge project:

1. Run `001_initial_schema.sql` via InsForge MCP `run-raw-sql` (statement-by-statement or as a migration).
2. Create the private `resumes` bucket via MCP `create-bucket` (`isPublic: false`).
3. Run `002_harden_schema.sql` (signup trigger hardening + auth-user backfill).

`001_initial_schema.sql` is **not** idempotent — do not re-run on an existing database. Use `002_*` and later numbered files for follow-up changes.

## Storage object key (required for RLS)

- Bucket: `resumes`
- Object key: `{user_id}/resume.pdf` (not `resumes/{user_id}/resume.pdf` — the bucket name is separate from the key)
- Use explicit `.upload(\`${userId}/resume.pdf\`, file)` — never `uploadAuto()`

## Server-side writes (Feature 06+)

Table RLS scopes all rows to `auth.uid()`. Browser client writes work with the user session JWT. API routes and Server Actions must forward the user JWT or use `@insforge/sdk/ssr` — decided in Feature 06.
