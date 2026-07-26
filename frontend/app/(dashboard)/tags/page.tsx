import type { Metadata } from "next";
import { TagsWorkspace } from "@/components/tags/tags-workspace";

export const metadata: Metadata = { title: "Tags" };
export default function TagsPage() { return <TagsWorkspace />; }
