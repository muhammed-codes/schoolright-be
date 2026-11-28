# Automation Events

The backend records domain changes in `automation_outbox_events` and processes
them with an in-process dispatcher. The outbox is written in the same
transaction as the domain change whenever the source method already has a
transaction. There is no external queue dependency.

The dispatcher refreshes active dynamic guardian groups for school-scoped fee,
student, guardian-link and term events. Guardian API authorization remains a
live check in the access engine; the outbox never grants access and never
replaces direct enforcement.

## Event catalog

| Event | Source | Derived work |
| --- | --- | --- |
| `PAYMENT_APPROVED` | `FeesService.recordOfflinePayment`, `FeesService.approveShare` | Refresh dynamic groups for the affected student |
| `PAYMENT_REJECTED` | `FeesService.rejectShare` | Recorded for audit; no fee metric changes |
| `PAYMENT_REVERSED` | Reserved | No reversal/refund workflow exists yet |
| `FEE_ALLOCATION_CHANGED` | `FeesService.approveShare` when allocations are replaced | Refresh dynamic groups for the affected student |
| `FEE_DISCOUNT_CHANGED` | `FeesService.bulkCreateOverrides`, `FeesService.removeOverride` | Refresh dynamic groups for the affected students |
| `FEE_WAIVER_CHANGED` | `FeesService.bulkCreateOverrides` when the override type is `WAIVER` | Refresh dynamic groups for the affected students |
| `INVOICE_CHANGED` | `FeesService.generateInvoices` | Refresh dynamic groups for generated students |
| `STUDENT_STATUS_CHANGED` | `StudentsService.createStudent`, `updateStudent`, `bulkImportStudents`, `promoteStudents` | Refresh dynamic groups for the affected students |
| `STUDENT_CLASS_CHANGED` | `StudentsService.updateStudent`, `promoteStudents` | Refresh dynamic groups for the affected students |
| `GUARDIAN_RELATIONSHIP_ADDED` | `StudentsService.createStudent`, `linkParent` | Refresh dynamic groups for the affected students |
| `GUARDIAN_RELATIONSHIP_CHANGED` | `StudentsService.updateStudent` | Refresh dynamic groups for the affected students |
| `GUARDIAN_RELATIONSHIP_REMOVED` | `StudentsService.unlinkParent` | Refresh dynamic groups for the affected students |
| `ATTENDANCE_RECORDED` | `AttendanceService.markStudentAttendance` | Recorded for future automation; attendance is not a supported group condition |
| `ATTENDANCE_CORRECTED` | `AttendanceService.markStudentAttendance` | Recorded for future automation |
| `ATTENDANCE_STATUS_CHANGED` | `AttendanceService.markStudentAttendance` | Recorded for future automation |
| `GUARDIAN_GROUP_CREATED` | `GuardianGroupService.create` | Recorded; creation already syncs membership |
| `GUARDIAN_GROUP_UPDATED` | `GuardianGroupService.update` | Recorded; update already syncs membership |
| `GUARDIAN_GROUP_MEMBERS_CHANGED` | `GuardianGroupService.addMembers`, `removeMembers` | Recorded; member changes already sync membership |
| `GUARDIAN_GROUP_CONDITION_CHANGED` | `GuardianGroupService.create`, `update` | Refresh active dynamic groups |
| `GUARDIAN_GROUP_ACTIVATED` | `GuardianGroupService.setActive` | Refresh the activated group |
| `GUARDIAN_GROUP_DEACTIVATED` | `GuardianGroupService.setActive`, `remove` | Recorded; inactive groups are excluded from refresh |
| `GUARDIAN_ACCESS_POLICY_CHANGED` | `GuardianPolicyManagementService.create`, `update`, `setEnabled` | Recorded; enforcement remains direct |
| `GUARDIAN_ACCESS_POLICY_DISABLED` | `GuardianPolicyManagementService.setEnabled`, `remove` | Recorded; enforcement remains direct |
| `TERM_CHANGED` | `TermsService.activateTerm`, `closeTerm`, `unlockTerm` | Refresh active dynamic groups because fee metrics are term-scoped |

## Processing

`AutomationOutboxService` claims pending and retryable rows with a locked,
skip-locked query, marks them `PROCESSING`, dispatches handlers, and writes
`COMPLETED`, `FAILED`, or `DEAD` with attempt and failure metadata. Failed rows
are retried with capped exponential backoff; after eight attempts they are
dead-lettered. Idempotency keys are stable hashes of event type, school scope,
aggregate and payload, so duplicate enqueues are ignored.

The in-process poller starts automatically outside tests. Set
`AUTOMATION_OUTBOX_WORKER=disabled` to stop polling while still recording
events. Serverless deployments do not get a persistent poller; enqueue still
succeeds and a later process with the worker enabled can drain the queue.

## Unsupported event sources

Payment reversal and refund are not implemented. `PaymentSubmissionStudentShare`
only supports `PENDING`, `APPROVED`, and `REJECTED`, and `rejectShare` does not
reverse invoice amounts, allocations or receipts. `PAYMENT_REVERSED` is reserved
until a real reversal workflow exists.
