import type { Metadata } from "next";
import { CustomersWorkspace } from "@/components/customers/customers-workspace";

export const metadata: Metadata = { title: "Customers" };
export default function CustomersPage() { return <CustomersWorkspace />; }
