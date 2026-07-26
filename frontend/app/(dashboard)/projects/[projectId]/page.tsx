import type { Metadata } from "next";
import { ProjectDetails } from "@/components/projects/project-details";

export const metadata: Metadata = { title: "Project details" };
export default function ProjectDetailsPage() { return <ProjectDetails />; }
