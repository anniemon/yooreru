CREATE TYPE "ViewSource" AS ENUM ('GOOGLE', 'INSTAGRAM', 'NAVER', 'OTHER', 'UNKNOWN');

CREATE TABLE "PostViewCount" (
    "postId" INTEGER NOT NULL,
    "source" "ViewSource" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PostViewCount_pkey" PRIMARY KEY ("postId", "source")
);

ALTER TABLE "PostViewCount" ADD CONSTRAINT "PostViewCount_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
