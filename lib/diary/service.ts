import { db } from "@/lib/db";
import { STANDARD_MEALS } from "./constants";

export async function ensureDayLog(
  userId: string,
  logicalDate: Date,
  timezone: string,
) {
  const dayStart = logicalDate;
  const dayEnd = new Date(logicalDate.getTime() + 86_400_000 - 1);
  const goal = await db.goalPlan.findFirst({
    where: {
      userId,
      validFrom: { lte: dayEnd },
      OR: [{ validUntil: null }, { validUntil: { gt: dayStart } }],
    },
    orderBy: { validFrom: "desc" },
    select: { id: true },
  });

  return db.dayLog.upsert({
    where: { userId_logicalDate: { userId, logicalDate } },
    create: {
      userId,
      logicalDate,
      timezone,
      goalPlanId: goal?.id,
      meals: {
        create: STANDARD_MEALS.map((meal) => ({
          kind: meal.kind,
          slug: meal.slug,
          position: meal.position,
        })),
      },
    },
    update: {},
    include: { meals: { orderBy: { position: "asc" } } },
  });
}

export function findDayLog(userId: string, logicalDate: Date) {
  return db.dayLog.findUnique({
    where: { userId_logicalDate: { userId, logicalDate } },
    include: {
      goalPlan: true,
      meals: {
        orderBy: { position: "asc" },
        include: {
          entries: {
            orderBy: { createdAt: "asc" },
            include: { revisions: { orderBy: { correctedAt: 'desc' }, take: 10 } },
          },
        },
      },
      workouts: { orderBy: { createdAt: "desc" } },
    },
  });
}

export function findDiaryDay(userId: string, logicalDate: Date) {
  return db.dayLog.findUnique({
    where: { userId_logicalDate: { userId, logicalDate } },
    select: {
      meals: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          kind: true,
          slug: true,
          customName: true,
          entries: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              updatedAt: true,
              kind: true,
              quantity: true,
              unit: true,
              snapshotName: true,
              snapshotBrand: true,
              snapshotCalories: true,
              snapshotProtein: true,
              snapshotCarbohydrate: true,
              snapshotFat: true,
              macrosComplete: true,
              revisions: {
                orderBy: { correctedAt: "desc" },
                take: 10,
                select: {
                  id: true,
                  previousQuantity: true,
                  nextQuantity: true,
                  reason: true,
                  correctedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export function findTodaySummaryDay(userId: string, logicalDate: Date) {
  return db.dayLog.findUnique({
    where: { userId_logicalDate: { userId, logicalDate } },
    select: {
      meals: {
        orderBy: { position: "asc" },
        select: {
          slug: true,
          customName: true,
          entries: {
            select: {
              kind: true,
              snapshotCalories: true,
              snapshotProtein: true,
              snapshotCarbohydrate: true,
              snapshotFat: true,
              macrosComplete: true,
            },
          },
        },
      },
      workouts: {
        where: { status: { in: ["IN_PROGRESS", "PLANNED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, name: true, status: true },
      },
    },
  });
}
