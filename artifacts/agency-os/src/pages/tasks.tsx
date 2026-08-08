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
  // Account managers may have full access to Sales, but their task workspace
  // remains personal. Only true task managers can see the company board.
  const isAdminOrManager = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "ADMIN" || user?.systemRole === "MANAGER";

  if (isAdminOrManager) {
    return <AdminTasksView />;
  }

  return <EmployeeTasksView />;
}
