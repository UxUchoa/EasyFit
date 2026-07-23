-- EasyFit accesses PostgreSQL only through the private Prisma backend.
-- Keep the Supabase Data API roles denied by default and let the backend's
-- database role remain the sole application data path.

ALTER TABLE public."AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BodyMeasurement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ConsentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DayLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DietPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DietPlanVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Exercise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExerciseSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExternalProviderState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Food" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FoodFavorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FoodPortion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FoodSourceChoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GoalPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImportItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Meal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MealEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MealEntryRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OperationalMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SavedMeal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SavedMealItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SubjectRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportAccessObject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkoutPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkoutPlanExercise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkoutPlanVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkoutSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkoutSessionExercise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public."AuditEvent",
  public."BodyMeasurement",
  public."ConsentRecord",
  public."DayLog",
  public."DietPlan",
  public."DietPlanVersion",
  public."Exercise",
  public."ExerciseSet",
  public."ExternalProviderState",
  public."Food",
  public."FoodFavorite",
  public."FoodPortion",
  public."FoodSourceChoice",
  public."GoalPlan",
  public."ImportItem",
  public."ImportJob",
  public."Meal",
  public."MealEntry",
  public."MealEntryRevision",
  public."NotificationPreference",
  public."NotificationSettings",
  public."OperationalMetric",
  public."Profile",
  public."RateLimitBucket",
  public."SavedMeal",
  public."SavedMealItem",
  public."Session",
  public."SubjectRequest",
  public."SupportAccess",
  public."SupportAccessObject",
  public."User",
  public."WorkoutPlan",
  public."WorkoutPlanExercise",
  public."WorkoutPlanVersion",
  public."WorkoutSession",
  public."WorkoutSessionExercise",
  public."_prisma_migrations"
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prevent_audit_event_mutation()
FROM PUBLIC, anon, authenticated;

-- Prevent tables, sequences and functions created by future Prisma migrations
-- from being exposed automatically through the Supabase API roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
