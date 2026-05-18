"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PushSharedGoalSchema } from "@repo/validators";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type ThrustArea = { id: string; name: string };
type User = { id: string; name: string; department: { name: string } | null };
type FormValues = z.input<typeof PushSharedGoalSchema>;

export function ShareGoalClient({ thrustAreas, users }: { thrustAreas: ThrustArea[]; users: User[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(PushSharedGoalSchema),
    defaultValues: {
      title: "",
      description: "",
      thrustAreaId: "",
      uomType: "NUMERIC_MAX",
      defaultWeightage: 10,
      recipientUserIds: [],
    },
  });

  const uomType = form.watch("uomType");
  const recipients = form.watch("recipientUserIds");

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      const result = await apiFetch<{ message?: string; errors?: string[] }>("/api/admin/goals/share", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (result.errors && result.errors.length > 0) {
        toast.warning(`Partially complete. ${result.errors.length} failed.`, {
          description: result.errors[0]
        });
      } else {
        toast.success(result.message || "Shared goal successfully pushed.");
      }
      form.reset();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to push shared goal");
    } finally {
      setLoading(false);
    }
  }

  const toggleUser = (userId: string) => {
    const current = new Set(recipients);
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    form.setValue("recipientUserIds", Array.from(current), { shouldValidate: true });
  };

  const selectAll = () => {
    form.setValue("recipientUserIds", users.map(u => u.id), { shouldValidate: true });
  };
  const clearAll = () => {
    form.setValue("recipientUserIds", [], { shouldValidate: true });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader>
          <CardTitle>Goal Details</CardTitle>
          <CardDescription>Define the metrics for this shared goal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g., Increase sales by 20%" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="thrustAreaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thrust Area</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a thrust area" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {thrustAreas.map((ta) => (
                            <SelectItem key={ta.id} value={ta.id}>
                              {ta.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultWeightage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Weightage (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormDescription>Can be adjusted by recipients.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide details about how this goal should be achieved..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="uomType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measurement (UoM)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select UoM Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NUMERIC_MIN">Numeric (Higher is better)</SelectItem>
                          <SelectItem value="NUMERIC_MAX">Numeric (Lower is better)</SelectItem>
                          <SelectItem value="TIMELINE">Timeline (Date-based)</SelectItem>
                          <SelectItem value="ZERO">Zero (Zero = Success)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {uomType === "TIMELINE" ? (
                  <FormField
                    control={form.control}
                    name="targetDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : uomType !== "ZERO" ? (
                  <FormField
                    control={form.control}
                    name="targetValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Value</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Push Goal to {recipients.length} Employees
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
          <CardDescription>Select employees to receive this goal.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
             <Button variant="outline" size="sm" onClick={selectAll} className="flex-1">Select All</Button>
             <Button variant="outline" size="sm" onClick={clearAll} className="flex-1">Clear</Button>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {users.map(u => (
              <div
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                  recipients.includes(u.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <div>
                  <p className="font-medium text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.department?.name || 'No Department'}</p>
                </div>
                {recipients.includes(u.id) && <Check className="h-4 w-4 text-primary" />}
              </div>
            ))}
          </div>
          {form.formState.errors.recipientUserIds && (
            <p className="text-[0.8rem] font-medium text-destructive mt-2">
              {form.formState.errors.recipientUserIds.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
