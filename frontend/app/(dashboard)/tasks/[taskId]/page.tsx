import type { Metadata } from "next";
import { TaskDetails } from "@/components/tasks/task-details";

export const metadata: Metadata = { title: "Task details" };
export default function TaskDetailsPage() { return <TaskDetails />; }
