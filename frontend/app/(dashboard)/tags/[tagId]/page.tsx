import type { Metadata } from "next";
import { TagDetails } from "@/components/tags/tag-details";

export const metadata: Metadata = { title: "Tag usage" };
export default function TagDetailsPage() { return <TagDetails />; }
