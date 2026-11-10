export interface TaskOwnerFields {
  assigneeId?: string | null;
  requestedBy?: string | null;
  approvalStatus?: string | null;
  coAssignees?: string[] | unknown | null;
}

export function canEmployeeAccessTask(task: TaskOwnerFields, userId: string): boolean {
  if (task.assigneeId === userId) return true;
  if (task.approvalStatus === "PENDING" && task.requestedBy === userId) return true;
  let co: unknown = task.coAssignees;
  if (typeof co === "string") {
    try {
      co = JSON.parse(co);
    } catch {
      // not JSON, keep as is
    }
  }
  if (Array.isArray(co) && co.includes(userId)) return true;
  return false;
}
