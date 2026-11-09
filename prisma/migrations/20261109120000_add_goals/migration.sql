-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "target_date" DATE NOT NULL,
    "achieved_date" DATE,
    "unit" VARCHAR(20),
    "target_value" DOUBLE PRECISION,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_checkpoints" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "hit_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "goal_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_entries" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "value" DOUBLE PRECISION,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_child_id_idx" ON "goals"("child_id");

-- CreateIndex
CREATE INDEX "goal_checkpoints_goal_id_idx" ON "goal_checkpoints"("goal_id");

-- CreateIndex
CREATE INDEX "goal_entries_goal_id_idx" ON "goal_entries"("goal_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_checkpoints" ADD CONSTRAINT "goal_checkpoints_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_entries" ADD CONSTRAINT "goal_entries_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

