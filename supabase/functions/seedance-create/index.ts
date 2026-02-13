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

    const { prompt, mediaFiles, aspectRatio, duration, mode } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modelMap: Record<string, string> = {
      "Fast": "seedance_2.0_fast",
      "Standard": "seedance_2.0",
    };

    const params: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspectRatio || "16:9",
      duration: String(duration || 5),
      model: modelMap[mode] || "seedance_2.0_fast",
    };

    if (mediaFiles && mediaFiles.length > 0) {
      params.media_files = mediaFiles;
    }

    const response = await fetch("https://api.xskill.ai/api/v3/tasks/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XSKILL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "st-ai/super-seed2",
        params,
      }),
    });

    const data = await response.json();
    console.log("xskill API full response:", JSON.stringify(data));

    if (!response.ok) {
      console.error("xskill API error:", response.status, data);
      return new Response(JSON.stringify({ error: data.message || data.error || "Failed to create task", details: data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try multiple possible field names for task ID
    const taskId = data.task_id || data.taskId || data.id || data.data?.task_id || data.data?.id;
    console.log("Extracted taskId:", taskId);

    if (!taskId) {
      console.error("No task_id found in response:", data);
      return new Response(JSON.stringify({ error: "No task_id in API response", details: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      taskId,
      price: data.price,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seedance-create error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
