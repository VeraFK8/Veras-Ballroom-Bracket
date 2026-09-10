import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|article|section|li|h1|h2|h3|h4|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Keep the payload manageable for the browser parser.
  if (text.length > 50000) text = text.slice(0, 50000);

  return { title, text };
}

function isAllowedUrl(raw: string): URL {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are allowed.");
  }

  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (blocked) throw new Error("That URL is not allowed.");
  return url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not signed in.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid session.");

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.is_admin !== true) {
      throw new Error("Admin access required.");
    }

    const body = await req.json();
    const url = isAllowedUrl(String(body?.url || ""));

    const response = await fetch(url.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 VeraBallroomBracket/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("That URL did not return a readable web page.");
    }

    const html = await response.text();
    const parsed = htmlToText(html);

    return new Response(
      JSON.stringify({
        ok: true,
        url: response.url,
        title: parsed.title,
        text: parsed.text,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
