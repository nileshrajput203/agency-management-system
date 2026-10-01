export interface TaskOwnerFields {
  assigneeId?: string | null;
  requestedBy?: string | null;
  approvalStatus?: string | null;
}

export function canEmployeeAccessTask(task: TaskOwnerFields, userId: string): boolean {
  return task.assigneeId === userId ||
    (task.approvalStatus === "PENDING" && task.requestedBy === userId);
}