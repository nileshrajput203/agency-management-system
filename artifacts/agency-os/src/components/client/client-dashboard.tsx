"use client";

import { useState } from "react";
import { FolderKanban, FileText, Wallet, CalendarDays, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  ClientData,
  ProjectData,
  ProposalData,
  AgreementData,
  InvoiceData,
  ContentPostData,
} from "./client-dashboard-types";
import { ClientProjectsTab } from "./client-projects-tab";
import { ClientDocumentsTab } from "./client-documents-tab";
import { ClientBillingTab } from "./client-billing-tab";
import { ClientContentTab } from "./client-content-tab";
import { ClientAgreementDialog } from "./client-agreement-dialog";
import { ClientContentDialog } from "./client-content-dialog";

export function ClientDashboard({
  client,
  projects,
  proposals,
  agreements,
  invoices,
  contentPosts,
}: {
  client: ClientData;
  projects: ProjectData[];
  proposals: ProposalData[];
  agreements: AgreementData[];
  invoices: InvoiceData[];
  contentPosts: ContentPostData[];
}) {
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementData | null>(null);
  const [selectedPost, setSelectedPost] = useState<ContentPostData | null>(null);

  const handleClientLogout = () => {
    document.cookie = "client_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.href = "/client/portal";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Client Header */}
      <header className="border-b border-slate-900 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            BB
          </div>
          <div>
            <h1 className="text-md font-bold leading-tight">{client.companyName}</h1>
            <p className="text-xs text-slate-400">Client Workspace · White-label Portal</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClientLogout} className="text-slate-400 hover:text-white">
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </header>

      {/* Workspace Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="projects" className="data-[state=active]:bg-primary/20">
              <FolderKanban className="h-4 w-4 mr-2" /> Projects
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-primary/20">
              <FileText className="h-4 w-4 mr-2" /> Proposals & Contracts
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-primary/20">
              <Wallet className="h-4 w-4 mr-2" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-primary/20">
              <CalendarDays className="h-4 w-4 mr-2" /> Content Planner
            </TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4">
            <ClientProjectsTab projects={projects} />
          </TabsContent>

          {/* Proposals & Contracts Tab */}
          <TabsContent value="documents" className="space-y-6">
            <ClientDocumentsTab
              agreements={agreements}
              proposals={proposals}
              onSelectAgreement={setSelectedAgreement}
            />
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <ClientBillingTab invoices={invoices} client={client} />
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <ClientContentTab contentPosts={contentPosts} onSelectPost={setSelectedPost} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Review & E-Sign Agreement Dialog */}
      <ClientAgreementDialog
        selectedAgreement={selectedAgreement}
        setSelectedAgreement={setSelectedAgreement}
      />

      {/* Review Content & Feedback Dialog */}
      <ClientContentDialog
        selectedPost={selectedPost}
        setSelectedPost={setSelectedPost}
        client={client}
      />
    </div>
  );
}
