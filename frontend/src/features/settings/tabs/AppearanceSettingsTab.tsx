"use client";

import { MonitorSmartphone, Palette } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FrostCard } from "@/components/shared/FrostCard";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export function AppearanceSettingsTab() {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <FrostCard tone="info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-muted-foreground" />Theme</CardTitle>
          <CardDescription>Choose light, dark, or system mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </FrostCard>

      <FrostCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-muted-foreground" />Visual style</CardTitle>
          <CardDescription>Current dashboard appearance behavior.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <InfoItem title="Frosted cards" text="Cards use translucent surfaces, blur, soft borders, and color-coded tints." />
          <InfoItem title="Responsive layout" text="Desktop uses the sidebar. Mobile uses the bottom navigation and horizontally scrollable settings tabs." />
        </CardContent>
      </FrostCard>
    </section>
  );
}

function InfoItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-background/45 p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
