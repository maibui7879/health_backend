// Repro worst-case prod: load entity modules theo thứ tự xấu nhất
// (template/goal trước workout/user), rồi build metadata TypeORM.
// Chạy sau `npm run build`. Pass = hết lỗi enum validator.
const { DataSource } = require('typeorm');
const path = require('path');

const D = (...p) => require(path.join(__dirname, '..', 'dist', ...p));

async function main() {
  // Thứ tự đảo ngược alphabet để ép cycle (nếu còn) bộc lộ.
  const goal = D('workout', 'entities', 'workout-goal.entity.js');
  const tpl = D('workout', 'entities', 'exercise-template.entity.js');
  const w = D('workout', 'entities', 'workout.entity.js');
  const user = D('users', 'entities', 'user.entity.js');
  const profile = D('users', 'entities', 'user-profile.entity.js');
  const setting = D('users', 'entities', 'user-setting.entity.js');
  const allergy = D('users', 'entities', 'user-allergy.entity.js');
  const dn = D('nutrition', 'entities', 'daily-nutrition.entity.js');
  const food = D('nutrition', 'entities', 'food.entity.js');
  const fav = D('nutrition', 'entities', 'favorite-food.entity.js');
  const meal = D('nutrition', 'entities', 'meal.entity.js');
  const mealItem = D('nutrition', 'entities', 'meal-item.entity.js');
  const plan = D('nutrition', 'entities', 'nutrition-plan.entity.js');

  const ds = new DataSource({
    type: 'postgres',
    entities: [
      goal.WorkoutGoal,
      tpl.ExerciseTemplate,
      w.Workout,
      user.User,
      profile.UserProfile,
      setting.UserSetting,
      allergy.UserAllergy,
      dn.DailyNutrition,
      food.Food,
      fav.FavoriteFood,
      meal.Meal,
      mealItem.MealItem,
      plan.NutritionPlan,
    ],
  });
  await ds.buildMetadatas();
  const names = ds.entityMetadatas.map((m) => m.name).sort();
  console.log('METADATA OK:', names.length, 'entities:', names.join(','));
}

main().catch((e) => {
  console.log('FAIL:', e.message);
  process.exit(1);
});
