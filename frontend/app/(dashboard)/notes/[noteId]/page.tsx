import type { Metadata } from "next";
import { NoteDetails } from "@/components/notes/note-details";

export const metadata: Metadata = { title: "Note" };
export default function NotePage() { return <NoteDetails />; }
