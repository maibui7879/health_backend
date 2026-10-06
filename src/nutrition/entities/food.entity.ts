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

  // Mã ổn định cho seed (VD 'VFCT-0296', 'EST-0001', 'LEGACY-<md5>').
  // Seed upsert theo `code`, KHÔNG theo tên — đổi tên hiển thị không gãy seed.
  // Xem migration 015. Cột NULL với dữ liệu cũ trước backfill.
  @Column({ type: 'varchar', length: 60, nullable: true, unique: true })
  code!: string | null;

  // Tên hiển thị do admin hiệu chỉnh (VD 'thịt ba chỉ').
  // `food_name_vi` giữ tên canonical của nguồn để seed match; search dùng cả 2.
  // Xem migration 015.
  @Column({ type: 'varchar', length: 255, nullable: true })
  display_name_vi!: string | null;

  // Tên vi+en viết thường bỏ dấu (VD 'Phở bò' -> 'pho bo'), trigger duy trì.
  // Xem migration 011 + src/nutrition/search-norm.ts (quy tắc phải khớp).
  @Column({ type: 'text', nullable: true })
  search_norm!: string | null;

  // Vector embedding 768 chiều (nomic-embed-text-v1_5, Phase 8).
  // select:false để find() thường không tải vector nặng; đọc qua raw SQL.
  @Column({ type: 'text', nullable: true, select: false })
  embedding!: string | null;

  // Ảnh minh họa (Wikimedia Commons, migration 021). NULL = chưa có.
  // image_credit giữ attribution tác giả/license (bắt buộc CC BY-SA).
  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image_credit!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
