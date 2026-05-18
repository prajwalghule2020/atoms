"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Edit, Loader2, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Cycle = { id: string; year: number; name: string; isActive: boolean; goalSettingOpen: string | null; q1Open: string | null; q2Open: string | null; q3Open: string | null; q4Open: string | null; _count: { goalSheets: number; thrustAreas: number } };

const EMPTY_FORM = { year: new Date().getFullYear(), name: "", isActive: false, goalSettingOpen: "", q1Open: "", q2Open: "", q3Open: "", q4Open: "" };
function dateVal(d: string | null | undefined) { return d ? new Date(d).toISOString().slice(0, 10) : ""; }

export default function CyclesPage() { /* abbreviated for patch size, same behavior as web app */
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cycle | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { apiFetch<Cycle[]>("/api/admin/cycles").then(setCycles).catch(() => {}).finally(() => setLoading(false)); }, []);
  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setError(null); setDialogOpen(true); }
  function openEdit(cycle: Cycle) { setEditing(cycle); setForm({ year: cycle.year, name: cycle.name, isActive: cycle.isActive, goalSettingOpen: dateVal(cycle.goalSettingOpen), q1Open: dateVal(cycle.q1Open), q2Open: dateVal(cycle.q2Open), q3Open: dateVal(cycle.q3Open), q4Open: dateVal(cycle.q4Open) }); setError(null); setDialogOpen(true); }
  async function save() { setSaving(true); setError(null); try { const body = { ...form, goalSettingOpen: form.goalSettingOpen || undefined, q1Open: form.q1Open || undefined, q2Open: form.q2Open || undefined, q3Open: form.q3Open || undefined, q4Open: form.q4Open || undefined }; const saved = editing ? await apiFetch<Cycle>(`/api/admin/cycles/${editing.id}`, { method: "PUT", body: JSON.stringify(body) }) : await apiFetch<Cycle>("/api/admin/cycles", { method: "POST", body: JSON.stringify(body) }); setCycles((prev) => editing ? prev.map((c) => (c.id === saved.id ? { ...saved, _count: c._count } : c)) : [{ ...saved, _count: { goalSheets: 0, thrustAreas: 0 } }, ...prev]); setDialogOpen(false); } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); } finally { setSaving(false); } }
  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Cycle Management</h1><p className="text-sm text-muted-foreground mt-1">Configure goal-setting and check-in windows</p></div><Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />New Cycle</Button></div><div className="space-y-3">{cycles.map((cycle) => (<Card key={cycle.id} className={cn(cycle.isActive && "border-primary/50")}><CardHeader className="pb-3"><div className="flex items-center justify-between gap-4"><div><CardTitle className="text-base flex items-center gap-2">{cycle.name}{cycle.isActive && <Badge className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />Active</Badge>}</CardTitle><CardDescription>FY {cycle.year} · {cycle._count.goalSheets} sheets · {cycle._count.thrustAreas} thrust areas</CardDescription></div><Button size="sm" variant="outline" onClick={() => openEdit(cycle)} className="gap-1.5"><Edit className="h-3.5 w-3.5" />Edit</Button></div></CardHeader><CardContent><div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">{[{ label: "Goal Setting", val: cycle.goalSettingOpen }, { label: "Q1 Open", val: cycle.q1Open }, { label: "Q2 Open", val: cycle.q2Open }, { label: "Q3 Open", val: cycle.q3Open }, { label: "Q4 Open", val: cycle.q4Open }].map(({ label, val }) => (<div key={label} className="rounded-md bg-muted/50 px-3 py-2"><p className="text-muted-foreground mb-0.5">{label}</p><p className="font-medium">{val ? new Date(val).toLocaleDateString() : <span className="text-muted-foreground">Not set</span>}</p></div>))}</div></CardContent></Card>))}</div><Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? "Edit Cycle" : "Create New Cycle"}</DialogTitle><DialogDescription>Configure the cycle name, year, and window dates.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><Label>Cycle Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. FY 2025-26" /></div><div className="space-y-1.5"><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: parseInt(e.target.value) }))} /></div></div><div className="grid grid-cols-2 gap-3">{[{ label: "Goal Setting Opens", key: "goalSettingOpen" as const }, { label: "Q1 Opens", key: "q1Open" as const }, { label: "Q2 Opens", key: "q2Open" as const }, { label: "Q3 Opens", key: "q3Open" as const }, { label: "Q4 Opens", key: "q4Open" as const }].map(({ label, key }) => (<div key={key} className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type="date" value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="h-8 text-sm" /></div>))}</div><div className="flex items-center gap-2"><input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4 rounded border" /><Label htmlFor="isActive" className="text-sm">Set as active cycle (deactivates others)</Label></div>{error && <p className="text-sm text-destructive">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? "Save Changes" : "Create Cycle"}</Button></DialogFooter></DialogContent></Dialog></div>;
}
