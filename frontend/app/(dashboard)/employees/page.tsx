import type { Metadata } from "next";
import { EmployeesWorkspace } from "@/components/employees/employees-workspace";
export const metadata: Metadata = { title: "Employees" };
export default function EmployeesPage() { return <EmployeesWorkspace />; }
