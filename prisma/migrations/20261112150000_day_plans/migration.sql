-- AlterTable
ALTER TABLE "task_ticks" ADD COLUMN     "by" VARCHAR(10) NOT NULL DEFAULT 'child';

-- CreateTable
CREATE TABLE "day_plans" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "saved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "day_plans_child_id_date_key" ON "day_plans"("child_id", "date");

-- AddForeignKey
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

