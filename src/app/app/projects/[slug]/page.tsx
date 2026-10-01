import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ProjectBoardScreen } from "@/components/app/screens/project-board";
import { project } from "@/lib/demo-data";

export const metadata: Metadata = { title: "14 Elm Road" };

export function generateStaticParams() {
  return [{ slug: project.slug }];
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== project.slug) notFound();
  return (
    <AppShell active="board">
      <ProjectBoardScreen />
    </AppShell>
  );
}
