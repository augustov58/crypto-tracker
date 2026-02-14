"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Wallet, 
  Calculator, 
  TrendingUp, 
  Bell, 
  Settings,
  Bitcoin,
  Menu,
  X
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/cost-basis", label: "Cost Basis", icon: Calculator },
  { href: "/projections", label: "Projections", icon: TrendingUp },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-40">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bitcoin className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold">CryptoTracker</span>
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-accent rounded-lg"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col z-50 transition-transform duration-300",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Desktop Logo - hidden on mobile since we have the header */}
        <div className="hidden lg:block p-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bitcoin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">CryptoTracker</h1>
              <p className="text-xs text-muted-foreground">Portfolio Manager</p>
            </div>
          </Link>
        </div>

        {/* Mobile: add top padding to account for header */}
        <div className="lg:hidden h-16" />
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeSidebar}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-border">
          <div className="px-4 py-3 bg-accent/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="text-sm font-medium">Just now</p>
          </div>
        </div>
      </aside>
    </>
  );
}
