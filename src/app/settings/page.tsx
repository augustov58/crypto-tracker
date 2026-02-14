import { WalletManager } from "@/components/settings/wallet-manager";
import { NotificationConfig } from "@/components/settings/notification-config";
import { ApiKeysSettings } from "@/components/settings/api-keys";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage wallets, API keys, and notifications</p>
      </div>

      <WalletManager />
      <ApiKeysSettings />
      <NotificationConfig />
    </div>
  );
}
