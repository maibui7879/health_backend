import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('foods')
export class Food {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  food_name_vi!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  food_name_en!: string | null;

  @Column({ type: 'float', default: 0 })
  kcal_100g!: number;

  @Column({ type: 'float', default: 0 })
  protein_100g!: number;

  @Column({ type: 'float', default: 0 })
  carbs_100g!: number;

  @Column({ type: 'float', default: 0 })
  fat_100g!: number;

  // Nguồn số liệu: 'VFCT 2007' (Bảng thành phần VN) hoặc 'estimate' (ước tính).
  @Column({ type: 'varchar', length: 30, nullable: true })
  source!: string | null;

  // Tên vi+en viết thường bỏ dấu (VD 'Phở bò' -> 'pho bo'), trigger duy trì.
  // Xem migration 011 + src/nutrition/search-norm.ts (quy tắc phải khớp).
  @Column({ type: 'text', nullable: true })
  search_norm!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
