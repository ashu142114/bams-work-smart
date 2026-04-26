import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { distanceMeters, getPosition } from "@/lib/geo";
import { SelfieCapture } from "./SelfieCapture";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { toast } from "sonner";
import { Clock, MapPin, CheckCircle2, AlertCircle, Loader2, LogOut } from "lucide-react";

interface Company {
  id: string;
  office_lat: number | null;
  office_lng: number | null;
  geofence_radius_m: number;
  work_start: string;
  late_after: string;
}

interface AttendanceRow {
  id: string;
  punch_in_at: string;
  punch_out_at: string | null;
  status: string;
  selfie_url: string | null;
  date: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function elapsed(fromIso: string, toIso?: string | null) {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const sec = Math.max(0, Math.floor((to - from) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PunchCard() {
  const { user, profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [today, setToday] = useState<AttendanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSelfie, setShowSelfie] = useState(false);
  const [punchingIn, setPunchingIn] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [outOpen, setOutOpen] = useState(false);
  const [workUpdate, setWorkUpdate] = useState("");
  const [taskUpdate, setTaskUpdate] = useState("");
  const [punchingOut, setPunchingOut] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const load = async () => {
    if (!user || !profile?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle(),
      supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);
    setCompany(c as Company | null);
    setToday(a as AttendanceRow | null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.company_id]);

  const handlePunchIn = async (selfie: Blob) => {
    if (!user || !profile?.company_id) return;
    setShowSelfie(false);
    setPunchingIn(true);
    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;

      // Geofence check
      if (company?.office_lat && company?.office_lng) {
        const d = distanceMeters(
          { lat: latitude, lng: longitude },
          { lat: company.office_lat, lng: company.office_lng },
        );
        if (d > company.geofence_radius_m) {
          toast.error(`Outside office area (${Math.round(d)}m away, allowed ${company.geofence_radius_m}m)`);
          setPunchingIn(false);
          return;
        }
      }

      // Determine late
      const lateCutoff = company?.late_after ?? "09:45";
      const [lh, lm] = lateCutoff.split(":").map(Number);
      const nowD = new Date();
      const cutoff = new Date(nowD);
      cutoff.setHours(lh, lm, 0, 0);
      const status = nowD > cutoff ? "late" : "present";

      // Upload selfie
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("selfies").upload(fileName, selfie, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("selfies").getPublicUrl(fileName);

      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        company_id: profile.company_id,
        in_lat: latitude,
        in_lng: longitude,
        selfie_url: pub.publicUrl,
        status,
      });
      if (error) throw error;

      toast.success(status === "late" ? "Punched in (late)" : "Punched in");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Punch-in failed");
    } finally {
      setPunchingIn(false);
    }
  };

  const handlePunchOut = async () => {
    if (!today || !user) return;
    if (!workUpdate.trim() || !taskUpdate.trim()) {
      toast.error("Work update and task update are required");
      return;
    }
    setPunchingOut(true);
    try {
      // MANDATORY: must have submitted at least one work update today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count, error: cntErr } = await supabase
        .from("work_updates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfDay.toISOString());
      if (cntErr) throw cntErr;
      if (!count || count === 0) {
        toast.error("Submit at least one task work update before punch out");
        setPunchingOut(false);
        return;
      }
      const pos = await getPosition().catch(() => null);
      const { error } = await supabase
        .from("attendance")
        .update({
          punch_out_at: new Date().toISOString(),
          out_lat: pos?.coords.latitude,
          out_lng: pos?.coords.longitude,
          work_update: workUpdate.trim(),
          task_update: taskUpdate.trim(),
        })
        .eq("id", today.id);
      if (error) throw error;
      toast.success("Punched out. Have a great evening!");
      setOutOpen(false);
      setWorkUpdate("");
      setTaskUpdate("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Punch-out failed");
    } finally {
      setPunchingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const punchedIn = !!today && !today.punch_out_at;
  const finished = !!today?.punch_out_at;

  const statusBadge = today ? (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
        today.status === "late"
          ? "bg-warning/15 text-warning-foreground"
          : "bg-success/15 text-success"
      }`}
    >
      {today.status === "late" ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {today.status === "late" ? "Late" : "Present"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
      Not punched in
    </span>
  );

  return (
    <>
      <div className="rounded-3xl bg-gradient-hero text-primary-foreground p-6 shadow-elevated">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">Today</p>
            <p className="text-lg font-semibold mt-0.5">
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
          {statusBadge}
        </div>

        <div className="mt-6 flex flex-col items-center justify-center">
          {!today && (
            <button
              onClick={() => setShowSelfie(true)}
              disabled={punchingIn}
              className="h-32 w-32 rounded-full bg-white text-primary font-bold text-lg flex flex-col items-center justify-center shadow-elevated animate-pulse-ring disabled:opacity-60"
            >
              {punchingIn ? <Loader2 className="h-7 w-7 animate-spin" /> : (
                <>
                  <Clock className="h-7 w-7 mb-1" />
                  Punch In
                </>
              )}
            </button>
          )}

          {punchedIn && (
            <>
              <div className="text-center">
                <p className="text-xs opacity-80">Working time</p>
                <p className="text-4xl font-bold tabular-nums mt-1">
                  {elapsed(today!.punch_in_at, null)}
                  <span className="sr-only">{now}</span>
                </p>
                <p className="text-xs opacity-70 mt-1">In at {fmtTime(today!.punch_in_at)}</p>
              </div>
              <Button
                onClick={() => setOutOpen(true)}
                variant="secondary"
                className="mt-5 h-12 px-6 rounded-full text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Punch Out
              </Button>
            </>
          )}

          {finished && (
            <div className="text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2" />
              <p className="text-base font-semibold">Day complete</p>
              <p className="text-xs opacity-80 mt-1">
                {fmtTime(today!.punch_in_at)} → {fmtTime(today!.punch_out_at!)} ({elapsed(today!.punch_in_at, today!.punch_out_at)})
              </p>
            </div>
          )}
        </div>

        {company?.office_lat ? (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs opacity-75">
            <MapPin className="h-3 w-3" />
            Geofence: {company.geofence_radius_m}m radius
          </p>
        ) : (
          <p className="mt-6 text-center text-xs opacity-75">
            No office location set — admin can configure in Settings
          </p>
        )}
      </div>

      {showSelfie && (
        <SelfieCapture onCancel={() => setShowSelfie(false)} onCapture={handlePunchIn} />
      )}

      <Dialog open={outOpen} onOpenChange={setOutOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Wrap up your day</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="work">Work update</Label>
              <Textarea id="work" rows={3} value={workUpdate} onChange={(e) => setWorkUpdate(e.target.value)} placeholder="What did you work on today?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task">Task update</Label>
              <Textarea id="task" rows={2} value={taskUpdate} onChange={(e) => setTaskUpdate(e.target.value)} placeholder="Status of your tasks…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutOpen(false)}>Cancel</Button>
            <Button onClick={handlePunchOut} disabled={punchingOut}>
              {punchingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm punch out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
