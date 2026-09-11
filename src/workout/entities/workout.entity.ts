import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('workouts')
export class Workout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'date' })
  log_date!: Date;

  @Column({ type: 'varchar' })
  exercise_name!: string;

  @Column({ type: 'int', default: 0 })
  duration_minutes!: number;

  @Column({ type: 'varchar', length: 50, default: 'MEDIUM' })
  intensity!: string;

  @Column({ type: 'int', default: 0 })
  kcal_burned!: number;

  @CreateDateColumn()
  created_at!: Date;
}