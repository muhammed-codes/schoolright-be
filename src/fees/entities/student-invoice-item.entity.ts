import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { FeeOverrideType } from './student-fee-override.entity';
import { StudentInvoice } from './student-invoice.entity';

@ObjectType()
@Entity('student_invoice_items')
@Index(['studentInvoiceId'])
export class StudentInvoiceItem extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  studentInvoiceId!: string;

  @Field()
  @Column({ type: 'uuid' })
  feeCategoryId!: string;

  /** Snapshot of FeeCategory.name at generation time — never join-read */
  @Field()
  @Column()
  description!: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'int' })
  originalAmount!: number;

  @Column({ type: 'int', default: 0 })
  overrideAmount!: number;

  @Column({
    type: 'enum',
    enum: FeeOverrideType,
    nullable: true,
  })
  overrideType!: FeeOverrideType | null;

  @Column({ type: 'uuid', nullable: true })
  overrideId!: string | null;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  amountPaid!: number;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  balance!: number;

  @Field(() => StudentInvoice)
  @ManyToOne(() => StudentInvoice, (invoice) => invoice.items, { eager: false })
  @JoinColumn({ name: 'studentInvoiceId' })
  invoice!: StudentInvoice;
}
