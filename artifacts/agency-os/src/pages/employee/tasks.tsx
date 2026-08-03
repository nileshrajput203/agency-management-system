import { EmployeeTasksView } from "@/components/tasks/employee-tasks-view";

export default function EmployeeTasksPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      <EmployeeTasksView />
    </div>
  );
}
