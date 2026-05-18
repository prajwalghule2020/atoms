"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Loader2, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type User = { id: string; name: string; email: string; role: "EMPLOYEE" | "MANAGER" | "ADMIN"; department: { id: string; name: string } | null; manager: { id: string; name: string } | null; _count: { goalSheets: number } };
type Dept = { id: string; name: string };

const ROLE_COLOR: Record<string, string> = { ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", EMPLOYEE: "bg-muted text-muted-foreground" };

export default function UsersPage() { /* full file omitted for brevity in this patch is intended to match web app; will be validated */
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [allManagers, setAllManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "EMPLOYEE", departmentId: "", managerId: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (deptFilter !== "ALL") params.set("departmentId", deptFilter);
    const query = params.toString();
    const data = await apiFetch<User[]>(`/api/admin/users${query ? `?${query}` : ""}`);
    setUsers(data);
  }, [search, roleFilter, deptFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(), apiFetch<Dept[]>("/api/admin/departments"), apiFetch<User[]>("/api/admin/users?role=MANAGER")])
      .then(([, d, m]) => { setDepts(d); setAllManagers(m as unknown as User[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const id = setTimeout(() => fetchUsers(), 300); return () => clearTimeout(id); }, [fetchUsers]);

  function openEdit(user: User) { setEditing(user); setForm({ name: user.name, email: user.email, role: user.role, departmentId: user.department?.id ?? "", managerId: user.manager?.id ?? "" }); setSaveError(null); setDialogOpen(true); }
  async function save() { if (!editing) return; setSaving(true); setSaveError(null); try { const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role }; if (form.departmentId) body.departmentId = form.departmentId; if (form.managerId) body.managerId = form.managerId; const updated = await apiFetch<User>(`/api/admin/users/${editing.id}`, { method: "PUT", body: JSON.stringify(body) }); setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))); setDialogOpen(false); } catch (e) { setSaveError(e instanceof Error ? e.message : "Failed to save"); } finally { setSaving(false); } }

  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">User Management</h1><p className="text-sm text-muted-foreground mt-1">Manage employee roles, departments, and reporting lines</p></div><div className="flex flex-wrap gap-3"><div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search name or email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="ALL">All Roles</SelectItem><SelectItem value="EMPLOYEE">Employee</SelectItem><SelectItem value="MANAGER">Manager</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent></Select><Select value={deptFilter} onValueChange={setDeptFilter}><SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="ALL">All Departments</SelectItem>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div><Card><CardHeader className="pb-2"><CardTitle className="text-base">{users.length} Users</CardTitle></CardHeader><CardContent className="p-0">{loading ? <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40"><th className="text-left px-6 py-3 font-medium">Name</th><th className="text-left px-4 py-3 font-medium">Role</th><th className="text-left px-4 py-3 font-medium">Department</th><th className="text-left px-4 py-3 font-medium">Manager</th><th className="text-center px-4 py-3 font-medium">Sheets</th><th className="px-4 py-3 w-12" /></tr></thead><tbody className="divide-y">{users.map((user) => (<tr key={user.id} className="hover:bg-muted/30 transition-colors"><td className="px-6 py-3"><div className="flex items-center gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{user.name.charAt(0).toUpperCase()}</div><div><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div></div></td><td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_COLOR[user.role])}>{user.role}</span></td><td className="px-4 py-3 text-muted-foreground">{user.department?.name ?? "—"}</td><td className="px-4 py-3 text-muted-foreground">{user.manager?.name ?? "—"}</td><td className="px-4 py-3 text-center">{user._count.goalSheets}</td><td className="px-4 py-3"><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(user)}><Edit className="h-3.5 w-3.5" /></Button></td></tr>))}</tbody></table></div>}</CardContent></Card><Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit User — {editing?.name}</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div><div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Role</Label><Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EMPLOYEE">Employee</SelectItem><SelectItem value="MANAGER">Manager</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Department</Label><Select value={form.departmentId || "none"} onValueChange={(v) => setForm((p) => ({ ...p, departmentId: v === "none" ? "" : v }))}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-1.5"><Label>Reporting Manager</Label><Select value={form.managerId || "none"} onValueChange={(v) => setForm((p) => ({ ...p, managerId: v === "none" ? "" : v }))}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{allManagers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>{saveError && <p className="text-sm text-destructive">{saveError}</p>}</div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Changes</Button></DialogFooter></DialogContent></Dialog></div>;
}
