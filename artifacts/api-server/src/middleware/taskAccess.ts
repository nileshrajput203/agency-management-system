export interface TaskOwnerFields {
  assigneeId?: string | null;
  requestedBy?: string | null;
  approvalStatus?: string | null;
  coAssignees?: string[] | unknown | null;
}

export function canEmployeeAccessTask(task: TaskOwnerFields, userId: string): boolean {
  if (task.assigneeId === userId) return true;
  if (task.approvalStatus === "PENDING" && task.requestedBy === userId) return true;
  if (Array.isArray(task.coAssignees) && task.coAssignees.includes(userId)) return true;
  return false;
}
