import type { Metadata } from "next";
import { EmployeeProfile } from "@/components/employees/employee-profile";

export const metadata: Metadata = { title: "Employee profile" };
export default function EmployeeProfilePage() { return <EmployeeProfile />; }
