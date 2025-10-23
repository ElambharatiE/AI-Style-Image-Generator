import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Upload, X } from "lucide-react";
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
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB.");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
      setUploadedFileName(file.name);
      toast.success("Image uploaded successfully!");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setUploadedFileName(null);
  };

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
          style,
          uploadedImage: uploadedImage || undefined
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
      setUploadedImage(null);
      setUploadedFileName(null);
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
          {/* Image Upload Section */}
          <div className="space-y-2">
            <Label>Upload Your Photo (Optional)</Label>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 glass border-border/50"
                  disabled={loading}
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadedFileName ? "Change Photo" : "Upload Photo"}
                </Button>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={loading}
                />
              </div>
              
              {uploadedImage && (
                <div className="relative glass rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-3">
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded preview" 
                      className="w-16 h-16 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedFileName}</p>
                      <p className="text-xs text-muted-foreground">1 photo uploaded</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleRemoveImage}
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

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
