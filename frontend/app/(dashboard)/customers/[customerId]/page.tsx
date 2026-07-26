import type { Metadata } from "next";
import { CustomerProfile } from "@/components/customers/customer-profile";

export const metadata: Metadata = { title: "Customer profile" };
export default function CustomerProfilePage() { return <CustomerProfile />; }
