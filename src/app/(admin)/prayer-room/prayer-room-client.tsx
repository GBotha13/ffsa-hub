"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, PlusCircle, User, Settings } from "lucide-react";
import ScheduleView from "./components/schedule-view";
import SignupForm from "./components/signup-form";
import MyDevoSets from "./components/my-devo-sets";
import AdminPanel from "./components/admin-panel";

interface PrayerRoomClientProps {
  userId: string;
  isAdmin: boolean;
}

export default function PrayerRoomClient({
  userId,
  isAdmin,
}: PrayerRoomClientProps) {
  const [activeTab, setActiveTab] = useState("schedule");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Prayer Room</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedule" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="signup" className="gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Sign Up
          </TabsTrigger>
          <TabsTrigger value="my-sets" className="gap-1.5">
            <User className="h-4 w-4" />
            My Devo Sets
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="schedule">
          <ScheduleView userId={userId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="signup">
          <SignupForm userId={userId} />
        </TabsContent>

        <TabsContent value="my-sets">
          <MyDevoSets userId={userId} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin">
            <AdminPanel userId={userId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
