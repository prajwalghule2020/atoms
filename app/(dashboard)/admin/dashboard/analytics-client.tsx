"use client";

import { useEffect, useState } from "react";
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type AnalyticsData = {
  goalDistribution: { name: string; value: number }[];
  sheetStatusDistribution: { name: string; value: number }[];
  checkinStats: { name: string; COMPLETED: number; ON_TRACK: number; NOT_STARTED: number }[];
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7300'];

export function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<AnalyticsData>("/api/admin/analytics");
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-8">Loading analytics...</div>;
  if (!data) return <div className="p-8">No data available</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Goal Distribution by Thrust Area</CardTitle>
          <CardDescription>Breakdown of all active goals across thrust areas.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {data.goalDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.goalDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {data.goalDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">No goals found</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Goal Sheet Statuses</CardTitle>
          <CardDescription>Current phase of employee goal sheets.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {data.sheetStatusDistribution.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={data.sheetStatusDistribution}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={100}
                   fill="#82ca9d"
                   dataKey="value"
                   label
                 >
                   {data.sheetStatusDistribution.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                   ))}
                 </Pie>
                 <RechartsTooltip />
                 <Legend />
               </PieChart>
             </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-muted-foreground">No sheets found</div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Quarterly Check-in Status</CardTitle>
          <CardDescription>Organization-wide check-in completion rates by quarter.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.checkinStats}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Bar dataKey="COMPLETED" stackId="a" fill="#10b981" />
              <Bar dataKey="ON_TRACK" stackId="a" fill="#3b82f6" />
              <Bar dataKey="NOT_STARTED" stackId="a" fill="#f43f5e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
