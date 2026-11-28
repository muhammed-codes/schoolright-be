import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeFeeAmountsToNaira1794800000000
  implements MigrationInterface
{
  name = 'NormalizeFeeAmountsToNaira1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Normalize fee structures that were stored with 100x kobo factor (legacy seed)
    await queryRunner.query(`
      UPDATE fee_structures
      SET amount = amount / 100
      WHERE amount >= 100000 AND (amount % 100) = 0;
    `);

    // 2. Normalize student invoice items
    await queryRunner.query(`
      UPDATE student_invoice_items
      SET amount = amount / 100
      WHERE amount >= 100000 AND (amount % 100) = 0;
    `);

    // 3. Normalize legacy demo offline payment batches and shares
    await queryRunner.query(`
      UPDATE payment_submission_batches
      SET "totalAmount" = "totalAmount" / 100
      WHERE "totalAmount" >= 100000 AND ("totalAmount" % 100) = 0
        AND (note LIKE 'BFIS demo offline payment%' OR note LIKE 'Recorded offline payment%');
    `);

    await queryRunner.query(`
      UPDATE payment_submission_student_shares s
      SET amount = s.amount / 100
      FROM payment_submission_batches b
      WHERE s."batchId" = b.id
        AND s.amount >= 100000 AND (s.amount % 100) = 0
        AND (b.note LIKE 'BFIS demo offline payment%' OR b.note LIKE 'Recorded offline payment%');
    `);

    await queryRunner.query(`
      UPDATE payment_allocations a
      SET amount = a.amount / 100
      FROM payment_submission_student_shares s, payment_submission_batches b
      WHERE a."studentShareId" = s.id AND s."batchId" = b.id
        AND a.amount >= 100000 AND (a.amount % 100) = 0
        AND (b.note LIKE 'BFIS demo offline payment%' OR b.note LIKE 'Recorded offline payment%');
    `);

    // 4. Reconcile invoice item paid amounts and balances from allocations
    await queryRunner.query(`
      UPDATE student_invoice_items i
      SET "amountPaid" = COALESCE((
        SELECT SUM(amount) FROM payment_allocations WHERE "studentInvoiceItemId" = i.id
      ), 0);
    `);

    await queryRunner.query(`
      UPDATE student_invoice_items
      SET balance = GREATEST(0, amount - "amountPaid");
    `);

    // 5. Reconcile student invoice totals, paid amounts, balances and status
    await queryRunner.query(`
      UPDATE student_invoices inv
      SET "totalAmount" = COALESCE((
        SELECT SUM(amount) FROM student_invoice_items WHERE "studentInvoiceId" = inv.id
      ), 0),
      "totalPaid" = COALESCE((
        SELECT SUM("amountPaid") FROM student_invoice_items WHERE "studentInvoiceId" = inv.id
      ), 0);
    `);

    await queryRunner.query(`
      UPDATE student_invoices
      SET balance = GREATEST(0, "totalAmount" - "totalPaid"),
      status = CASE
        WHEN ("totalAmount" - "totalPaid") <= 0 AND "totalAmount" > 0 THEN 'PAID'::invoice_status_enum
        WHEN "totalPaid" > 0 THEN 'PARTIALLY_PAID'::invoice_status_enum
        ELSE 'OPEN'::invoice_status_enum
      END;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse operation: scale demo records back by 100 if reverted
    await queryRunner.query(`
      UPDATE fee_structures
      SET amount = amount * 100;
    `);

    await queryRunner.query(`
      UPDATE student_invoice_items
      SET amount = amount * 100;
    `);

    await queryRunner.query(`
      UPDATE payment_submission_batches
      SET "totalAmount" = "totalAmount" * 100
      WHERE (note LIKE 'BFIS demo offline payment%' OR note LIKE 'Recorded offline payment%');
    `);

    await queryRunner.query(`
      UPDATE payment_submission_student_shares s
      SET amount = s.amount * 100
      FROM payment_submission_batches b
      WHERE s."batchId" = b.id
        AND (b.note LIKE 'BFIS demo offline payment%' OR b.note LIKE 'Recorded offline payment%');
    `);

    await queryRunner.query(`
      UPDATE payment_allocations a
      SET amount = a.amount * 100
      FROM payment_submission_student_shares s, payment_submission_batches b
      WHERE a."studentShareId" = s.id AND s."batchId" = b.id
        AND (b.note LIKE 'BFIS demo offline payment%' OR b.note LIKE 'Recorded offline payment%');
    `);

    await queryRunner.query(`
      UPDATE student_invoice_items i
      SET "amountPaid" = COALESCE((
        SELECT SUM(amount) FROM payment_allocations WHERE "studentInvoiceItemId" = i.id
      ), 0);
    `);

    await queryRunner.query(`
      UPDATE student_invoice_items
      SET balance = GREATEST(0, amount - "amountPaid");
    `);

    await queryRunner.query(`
      UPDATE student_invoices inv
      SET "totalAmount" = COALESCE((
        SELECT SUM(amount) FROM student_invoice_items WHERE "studentInvoiceId" = inv.id
      ), 0),
      "totalPaid" = COALESCE((
        SELECT SUM("amountPaid") FROM student_invoice_items WHERE "studentInvoiceId" = inv.id
      ), 0);
    `);

    await queryRunner.query(`
      UPDATE student_invoices
      SET balance = GREATEST(0, "totalAmount" - "totalPaid"),
      status = CASE
        WHEN ("totalAmount" - "totalPaid") <= 0 AND "totalAmount" > 0 THEN 'PAID'::invoice_status_enum
        WHEN "totalPaid" > 0 THEN 'PARTIALLY_PAID'::invoice_status_enum
        ELSE 'OPEN'::invoice_status_enum
      END;
    `);
  }
}
