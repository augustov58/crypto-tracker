"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Wallet, 
  Calculator, 
  TrendingUp, 
  Bell, 
  Settings,
  Bitcoin
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

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
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
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
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
  );
}
