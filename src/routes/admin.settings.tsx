import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MapPin, Crosshair } from "lucide-react";
import { getPosition } from "@/lib/geo";

interface Company {
  id: string;
  name: string;
  office_lat: number | null;
  office_lng: number | null;
  geofence_radius_m: number;
  work_start: string;
  late_after: string;
}

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <RequireRole allow={["admin"]}>
      <SettingsPage />
    </RequireRole>
  ),
});

function SettingsPage() {
  const { profile } = useAuth();
  const [c, setC] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.company_id) return;
    supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle()
      .then(({ data }) => setC(data as Company | null));
  }, [profile?.company_id]);

  const useCurrent = async () => {
    try {
      const pos = await getPosition();
      setC((prev) => prev && { ...prev, office_lat: pos.coords.latitude, office_lng: pos.coords.longitude });
      toast.success("Used your current location");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get location");
    }
  };

  const save = async () => {
    if (!c) return;
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        office_lat: c.office_lat,
        office_lng: c.office_lng,
        geofence_radius_m: c.geofence_radius_m,
        work_start: c.work_start,
        late_after: c.late_after,
      })
      .eq("id", c.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  if (!c) {
    return (
      <MobileShell title="Settings">
        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </MobileShell>
    );
  }

  return (
    <MobileShell title="Settings" subtitle={c.name}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Office location</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" type="number" step="any" value={c.office_lat ?? ""} onChange={(e) => setC({ ...c, office_lat: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Longitude</Label>
              <Input id="lng" type="number" step="any" value={c.office_lng ?? ""} onChange={(e) => setC({ ...c, office_lng: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
          </div>
          <Button variant="outline" onClick={useCurrent} className="w-full">
            <Crosshair className="h-4 w-4 mr-2" /> Use my current location
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="r">Geofence radius (meters)</Label>
            <Input id="r" type="number" min={20} max={5000} value={c.geofence_radius_m} onChange={(e) => setC({ ...c, geofence_radius_m: Number(e.target.value) })} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
          <h2 className="font-semibold">Work hours</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ws">Start time</Label>
              <Input id="ws" type="time" value={c.work_start.slice(0,5)} onChange={(e) => setC({ ...c, work_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="la">Late after</Label>
              <Input id="la" type="time" value={c.late_after.slice(0,5)} onChange={(e) => setC({ ...c, late_after: e.target.value })} />
            </div>
          </div>
        </section>

        <Button onClick={save} disabled={saving} className="w-full h-11">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
        </Button>
      </div>
    </MobileShell>
  );
}
