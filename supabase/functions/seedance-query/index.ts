import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const XSKILL_API_KEY = Deno.env.get("XSKILL_API_KEY");
    if (!XSKILL_API_KEY) {
      throw new Error("XSKILL_API_KEY is not configured");
    }

    const { taskId } = await req.json();

    if (!taskId) {
      return new Response(JSON.stringify({ error: "taskId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.xskill.ai/api/v3/tasks/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XSKILL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task_id: taskId }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("xskill query error:", response.status, data);
      return new Response(JSON.stringify({ error: data.message || "Failed to query task" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: Record<string, unknown> = {
      status: data.status,
    };

    if (data.status === "completed" && data.output?.video_url) {
      result.videoUrl = data.output.video_url;
    } else if (data.status === "completed" && data.output?.media_url) {
      result.videoUrl = data.output.media_url;
    } else if (data.status === "completed") {
      // Try to find video URL in various possible response fields
      const output = data.output || data.result || {};
      result.videoUrl = output.video_url || output.media_url || output.url || null;
    }

    if (data.status === "failed") {
      result.error = data.error || data.message || "Task failed";
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seedance-query error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
