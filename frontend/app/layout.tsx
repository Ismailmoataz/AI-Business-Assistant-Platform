import type { Metadata } from "next"; import "./globals.css"; import { Providers } from "@/components/providers";
export const metadata:Metadata={title:{default:"Orbit — Business, in sync",template:"%s · Orbit"},description:"Your company knowledge and operations, intelligently connected."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><body className="antialiased"><Providers>{children}</Providers></body></html>}
