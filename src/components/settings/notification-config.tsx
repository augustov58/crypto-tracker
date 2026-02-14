"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Send, CheckCircle } from "lucide-react";

export function NotificationConfig() {
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  const handleTestNotification = (channel: string) => {
    console.log("Testing notification:", channel);
    setTestStatus("success");
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure how you receive alert notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="telegram">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="telegram">Telegram</TabsTrigger>
            <TabsTrigger value="ntfy">Ntfy.sh</TabsTrigger>
          </TabsList>

          <TabsContent value="telegram" className="mt-6 space-y-4">
            <div className="p-4 bg-accent/30 rounded-lg">
              <h4 className="font-medium mb-2">How to set up Telegram notifications:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Message @BotFather on Telegram and create a new bot</li>
                <li>Copy the bot token and paste it below</li>
                <li>Send any message to your new bot</li>
                <li>Visit the URL to get your chat ID (it will appear after you message the bot)</li>
              </ol>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bot Token</label>
                <Input
                  type="password"
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Chat ID</label>
                <Input
                  placeholder="123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleTestNotification("telegram")}
                  disabled={!telegramToken || !telegramChatId}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Message
                </Button>
                {testStatus === "success" && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Sent!
                  </Badge>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ntfy" className="mt-6 space-y-4">
            <div className="p-4 bg-accent/30 rounded-lg">
              <h4 className="font-medium mb-2">How to set up Ntfy.sh notifications:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Download the Ntfy app on your phone (iOS/Android)</li>
                <li>Choose a unique topic name (e.g., crypto-portfolio-yourname)</li>
                <li>Subscribe to that topic in the app</li>
                <li>Enter the same topic name below</li>
              </ol>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Topic Name</label>
                <Input
                  placeholder="crypto-portfolio-alerts"
                  value={ntfyTopic}
                  onChange={(e) => setNtfyTopic(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL will be: https://ntfy.sh/{ntfyTopic || "your-topic"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleTestNotification("ntfy")}
                  disabled={!ntfyTopic}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Message
                </Button>
                {testStatus === "success" && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Sent!
                  </Badge>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-6 border-t">
          <Button>Save Notification Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}
