"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type AuditLog = { id: string; entity: string; entityId: string; action: string; oldData: unknown; newData: unknown; createdAt: string; changedBy: { id: string; name: string; email: string } };
type LogResponse = { logs: AuditLog[]; total: number; page: number; pages: number };
const ACTION_COLOR: Record<string, string> = { UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", APPROVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", RETURN: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", UNLOCK: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", CREATE: "bg-muted text-muted-foreground" };

function DiffRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const hasData = !!(log.oldData || log.newData);
  return <div><div className={cn("flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors", hasData && "cursor-pointer")} onClick={() => hasData && setOpen((o) => !o)}><span className="text-xs text-muted-foreground w-32 shrink-0">{new Date(log.createdAt).toLocaleString()}</span><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium w-20 text-center shrink-0", ACTION_COLOR[log.action] ?? ACTION_COLOR.CREATE)}>{log.action}</span><span className="text-sm font-medium w-28 shrink-0">{log.entity}</span><span className="text-sm text-muted-foreground flex-1 truncate">{log.changedBy.name}</span>{hasData ? (open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />) : null}</div>{open && hasData && <div className="mx-6 mb-3 rounded-md bg-muted/40 border text-xs font-mono overflow-x-auto"><div className="grid grid-cols-2 divide-x"><div className="p-3"><p className="text-muted-foreground mb-1 font-sans font-medium not-italic">Before</p><pre className="whitespace-pre-wrap">{JSON.stringify(log.oldData, null, 2)}</pre></div><div className="p-3"><p className="text-muted-foreground mb-1 font-sans font-medium not-italic">After</p><pre className="whitespace-pre-wrap">{JSON.stringify(log.newData, null, 2)}</pre></div></div></div>}</div>;
}

export default function AuditPage() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  function buildQuery() { const p = new URLSearchParams({ page: String(page), limit: "50" }); if (entityFilter !== "ALL") p.set("entity", entityFilter); if (from) p.set("from", from); if (to) p.set("to", to); return p.toString(); }
  useEffect(() => { setLoading(true); apiFetch<LogResponse>(`/api/admin/audit-logs?${buildQuery()}`).then(setData).catch(() => {}).finally(() => setLoading(false)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityFilter, actionFilter, from, to, page]);

  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1><p className="text-sm text-muted-foreground mt-1">Full change history across all entities</p></div><div className="flex flex-wrap gap-3"><Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}><SelectTrigger className="w-40"><SelectValue placeholder="Entity" /></SelectTrigger><SelectContent><SelectItem value="ALL">All Entities</SelectItem><SelectItem value="GoalSheet">Goal Sheet</SelectItem><SelectItem value="Goal">Goal</SelectItem><SelectItem value="User">User</SelectItem><SelectItem value="QuarterlyUpdate">Quarterly Update</SelectItem></SelectContent></Select><div className="flex items-center gap-2"><Input type="date" className="w-36 h-9 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /><span className="text-muted-foreground text-sm">→</span><Input type="date" className="w-36 h-9 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div></div><Card><CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-base">{data ? `${data.total} entries` : "Loading…"}</CardTitle>{data && data.pages > 1 && <div className="flex items-center gap-2 text-sm"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40 hover:text-primary">← Prev</button><span className="text-muted-foreground">Page {page}/{data.pages}</span><button disabled={page === data.pages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40 hover:text-primary">Next →</button></div>}</CardHeader><CardContent className="p-0">{loading ? <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : !data?.logs.length ? <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No audit logs found</div> : <div className="divide-y"><div className="flex items-center gap-4 px-6 py-2 bg-muted/40 text-xs text-muted-foreground font-medium border-b"><span className="w-32 shrink-0">Timestamp</span><span className="w-20 shrink-0">Action</span><span className="w-28 shrink-0">Entity</span><span className="flex-1">Changed By</span></div>{data.logs.map((log) => <DiffRow key={log.id} log={log} />)}</div>}</CardContent></Card></div>;
}
