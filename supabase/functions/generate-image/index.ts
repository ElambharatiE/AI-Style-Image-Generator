import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { generationId, prompt, style, uploadedImage } = await req.json();
    
    if (!generationId || !prompt || !style) {
      throw new Error("Missing required parameters");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create style-enhanced prompt
    const stylePrompts: Record<string, string> = {
      cinematic: "cinematic lighting, dramatic composition, film grain, professional cinematography",
      anime: "anime art style, vibrant colors, detailed illustration, manga inspired",
      realistic: "photorealistic, high detail, professional photography, natural lighting",
      fantasy: "fantasy art, magical atmosphere, epic composition, vibrant colors",
      cyberpunk: "cyberpunk style, neon lights, futuristic cityscape, high tech aesthetic",
      watercolor: "watercolor painting, soft colors, artistic brushstrokes, flowing",
      "oil-painting": "oil painting style, rich textures, classical art, detailed brushwork",
      "3d-render": "3D rendered, volumetric lighting, high quality render, photorealistic materials",
    };

    const enhancedPrompt = `${prompt}. Style: ${stylePrompts[style] || stylePrompts.cinematic}. Ultra high resolution, masterpiece quality.`;

    console.log("Generating image with prompt:", enhancedPrompt);
    console.log("Has uploaded image:", !!uploadedImage);

    // Build messages array
    const messages: any[] = [];
    
    if (uploadedImage) {
      // Image editing mode
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: enhancedPrompt
          },
          {
            type: "image_url",
            image_url: {
              url: uploadedImage
            }
          }
        ]
      });
    } else {
      // Text-to-image generation mode
      messages.push({
        role: "user",
        content: enhancedPrompt
      });
    }

    // Call Lovable AI Gateway for image generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: messages,
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageBase64) {
      throw new Error("No image generated");
    }

    console.log("Image generated successfully");

    // Update generation record with the image
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from("generations")
      .update({
        image_url: imageBase64,
        status: "completed",
      })
      .eq("id", generationId);

    if (updateError) {
      console.error("Error updating generation:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: imageBase64,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
