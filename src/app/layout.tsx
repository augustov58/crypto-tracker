import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Crypto Portfolio Tracker",
  description: "Track your crypto portfolio across multiple chains",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6 pt-20 lg:pt-6 max-w-full">
            <div className="max-w-full overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
