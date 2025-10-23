import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STYLE_PRESETS = [
  { value: "cinematic", label: "🎬 Cinematic" },
  { value: "anime", label: "🎌 Anime" },
  { value: "realistic", label: "📸 Realistic" },
  { value: "fantasy", label: "🧙‍♂️ Fantasy" },
  { value: "cyberpunk", label: "🤖 Cyberpunk" },
  { value: "watercolor", label: "🎨 Watercolor" },
  { value: "oil-painting", label: "🖼️ Oil Painting" },
  { value: "3d-render", label: "💎 3D Render" },
];

interface GenerationFormProps {
  onGenerate: () => void;
}

const GenerationForm = ({ onGenerate }: GenerationFormProps) => {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to generate images");
        return;
      }

      // Create pending generation record
      const { data: generation, error: insertError } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          prompt: prompt.trim(),
          style,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call edge function to generate image
      const { data, error: functionError } = await supabase.functions.invoke("generate-image", {
        body: { 
          generationId: generation.id,
          prompt: prompt.trim(), 
          style 
        },
      });

      if (functionError) {
        if (functionError.message?.includes("429")) {
          toast.error("Rate limit exceeded. Please try again in a moment.");
        } else if (functionError.message?.includes("402")) {
          toast.error("AI credits depleted. Please add more credits to continue.");
        } else {
          toast.error("Failed to generate image. Please try again.");
        }
        
        // Update status to failed
        await supabase
          .from("generations")
          .update({ status: "failed" })
          .eq("id", generation.id);
        
        return;
      }

      toast.success("Image generated successfully!");
      setPrompt("");
      onGenerate();
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Create Your Vision
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Describe your image</Label>
            <Input
              id="prompt"
              placeholder="A futuristic city at sunset with flying cars..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="bg-input/50 border-border/50"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="style">Style Preset</Label>
            <Select value={style} onValueChange={setStyle} disabled={loading}>
              <SelectTrigger id="style" className="bg-input/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Image
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default GenerationForm;
