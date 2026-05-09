-- Seed the blog's default category tree once at migration time.
INSERT INTO "Category" ("name", "slug", "description", "parentId")
VALUES ('diary', 'diary', '', NULL)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name";

INSERT INTO "Category" ("name", "slug", "description", "parentId")
VALUES (
  'fingertip',
  'fingertip',
  '',
  (SELECT "id" FROM "Category" WHERE "slug" = 'diary')
)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "parentId" = (SELECT "id" FROM "Category" WHERE "slug" = 'diary');

INSERT INTO "Category" ("name", "slug", "description", "parentId")
VALUES (
  'elephantrunk',
  'elephantrunk',
  '',
  (SELECT "id" FROM "Category" WHERE "slug" = 'diary')
)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "parentId" = (SELECT "id" FROM "Category" WHERE "slug" = 'diary');
