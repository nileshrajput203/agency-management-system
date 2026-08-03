import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCheck } from "lucide-react";
import { PLATFORMS } from "./content-types";

type Client = {
  id: string;
  companyName: string;
};

interface ContentWorkspacesTableProps {
  clients: Client[];
  onSelectClient: (client: Client, mode: "admin" | "handler") => void;
}

export function ContentWorkspacesTable({ clients, onSelectClient }: ContentWorkspacesTableProps) {
  return (
    <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
      <CardHeader className="py-4 border-b border-slate-800 bg-slate-950/20">
        <CardTitle className="text-base font-bold text-slate-200">
          Social Publishing Brand Workspaces
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Select a client workspace to enter Admin or Social Media Handler view for core multi-channel cross-publishing.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/40 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Client Brand Name</th>
                <th className="px-6 py-4">API Credential Channels</th>
                <th className="px-6 py-4">Workspace Access Level</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40 transition scale-hover">
                  <td className="px-6 py-4 font-semibold text-slate-200 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center font-bold text-white text-xs uppercase shadow-sm">
                      {c.companyName.substring(0, 2)}
                    </div>
                    {c.companyName}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORMS.map((p) => (
                        <span
                          key={p.id}
                          className={`text-[9px] px-2 py-0.5 rounded font-semibold border ${p.bg} ${p.color} ${p.border}`}
                        >
                          {p.name.replace(" Spotlight", "").replace(" (Twitter)", "")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <Badge variant="outline" className="border-indigo-500/20 text-indigo-400 bg-indigo-500/5">
                      8 Channels Integrated
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button
                      size="xs"
                      variant="outline"
                      className="border-blue-500/30 text-blue-400 bg-blue-500/5 hover:bg-blue-500/15 text-[11px] h-7"
                      onClick={() => onSelectClient(c, "admin")}
                    >
                      <Shield className="h-3 w-3 mr-1" /> Admin Panel
                    </Button>
                    <Button
                      size="xs"
                      className="text-[11px] h-7 bg-primary hover:bg-primary/90"
                      onClick={() => onSelectClient(c, "handler")}
                    >
                      <UserCheck className="h-3 w-3 mr-1" /> Handler View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
