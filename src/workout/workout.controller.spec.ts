import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutController } from './workout.controller';
import { WorkoutService } from './workout.service';
import { SuggestWorkoutService } from './suggest-workout.service';
import { ExerciseTemplatesService } from './exercise-templates.service';
import { WorkoutGoalsService } from './workout-goals.service';

describe('WorkoutController', () => {
  let controller: WorkoutController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkoutController],
      providers: [
        {
          provide: WorkoutService,
          useValue: {
            createWorkout: jest.fn(),
            getWorkoutsByDate: jest.fn(),
            deleteWorkout: jest.fn(),
            attachMedia: jest.fn(),
            attachMediaLink: jest.fn(),
            markViewed: jest.fn(),
          },
        },
        { provide: SuggestWorkoutService, useValue: { suggest: jest.fn() } },
        {
          provide: ExerciseTemplatesService,
          useValue: { list: jest.fn(), getByCode: jest.fn() },
        },
        {
          provide: WorkoutGoalsService,
          useValue: {
            getStreak: jest.fn(),
            createGoal: jest.fn(),
            currentGoal: jest.fn(),
            listGoals: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WorkoutController>(WorkoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
