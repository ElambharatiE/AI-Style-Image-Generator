import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Generation {
  id: string;
  prompt: string;
  style: string;
  image_url: string | null;
  status: string;
  created_at: string;
}

interface GenerationGalleryProps {
  refresh: number;
}

const GenerationGallery = ({ refresh }: GenerationGalleryProps) => {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error("Error fetching generations:", error);
      toast.error("Failed to load generations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGenerations();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("generations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setGenerations(generations.filter(g => g.id !== id));
      toast.success("Generation deleted");
    } catch (error) {
      console.error("Error deleting generation:", error);
      toast.error("Failed to delete generation");
    }
  };

  const handleDownload = async (imageUrl: string, prompt: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prompt.slice(0, 30)}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Image downloaded");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No generations yet. Create your first masterpiece!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {generations.map((generation) => (
        <Card key={generation.id} className="glass border-border/50 overflow-hidden group">
          <CardContent className="p-0">
            <div className="relative aspect-square">
              {generation.status === "pending" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-card/50">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Generating...</p>
                  </div>
                </div>
              ) : generation.status === "failed" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-card/50">
                  <p className="text-sm text-destructive">Generation failed</p>
                </div>
              ) : generation.image_url ? (
                <>
                  <img
                    src={generation.image_url}
                    alt={generation.prompt}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => handleDownload(generation.image_url!, generation.prompt)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDelete(generation.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground line-clamp-2">{generation.prompt}</p>
              <p className="text-xs text-primary mt-1 capitalize">{generation.style}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default GenerationGallery;
