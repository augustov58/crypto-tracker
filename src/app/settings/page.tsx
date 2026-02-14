import { WalletManager } from "@/components/settings/wallet-manager";
import { NotificationConfig } from "@/components/settings/notification-config";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage wallets and notifications</p>
      </div>

      <WalletManager />
      <NotificationConfig />
    </div>
  );
}
