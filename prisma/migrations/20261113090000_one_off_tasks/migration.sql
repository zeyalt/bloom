-- CreateTable
CREATE TABLE "one_off_tasks" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "tier" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_off_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "one_off_tasks_date_idx" ON "one_off_tasks"("date");

-- AddForeignKey
ALTER TABLE "one_off_tasks" ADD CONSTRAINT "one_off_tasks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

