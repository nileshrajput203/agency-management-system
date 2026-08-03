import { useAuth } from "@/App";
import { AdminTasksView } from "@/components/tasks/admin-tasks-view";
import { EmployeeTasksView } from "@/components/tasks/employee-tasks-view";

export const TaskApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  MODIFIED: "MODIFIED",
} as const;

export default function TasksPage() {
  const { user } = useAuth();
  const isAdminOrManager = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "ADMIN" || user?.systemRole === "MANAGER" || user?.systemRole === "ACCOUNT_MANAGER";

  if (isAdminOrManager) {
    return <AdminTasksView />;
  }

  return <EmployeeTasksView />;
}
