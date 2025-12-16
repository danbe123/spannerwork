import { useState } from "react";
import { toolsService } from "@/api/services";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wrench, Trash2 } from "lucide-react";
import { Tool, User } from "@/types";

interface MyToolsProps {
  tools: Tool[];
  currentUser?: User;
}

export default function MyTools({ tools, currentUser: _currentUser }: MyToolsProps) {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState<Tool | null>(null);
  const queryClient = useQueryClient();

  const deleteToolMutation = useMutation({
    mutationFn: (toolId: string) => toolsService.delete(toolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTools'] });
      setDeleteConfirm(null);
    },
  });

  const getRateDisplay = (tool: Tool): string => {
    const rates: string[] = [];
    if (tool.dailyRate) rates.push(`£${tool.dailyRate}/day`);
    if (tool.weeklyRate) rates.push(`£${tool.weeklyRate}/wk`);
    return rates.length > 0 ? rates.join(' • ') : 'Contact for pricing';
  };

  return (
    <div>
      {tools.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>You haven&apos;t listed any tools yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Card key={tool.id} className="p-4">
              {tool.photos?.[0] && (
                <img
                  src={tool.photos[0]}
                  alt={tool.name}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
              )}
              <h4 className="font-semibold text-lg mb-2">{tool.name}</h4>
              <Badge variant="outline" className="mb-2">{tool.category}</Badge>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{tool.description}</p>
              
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <Badge className="bg-green-100 text-green-800">
                  {getRateDisplay(tool)}
                </Badge>
                {tool.available ? (
                  <Badge className="bg-green-100 text-green-800">Available</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">In Use</Badge>
                )}
                <Badge variant="outline">{tool.condition}</Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/Calendar?toolId=${tool.id}`)}
                  className="flex-1"
                >
                  View Calendar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirm(tool)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <AlertDialog open onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tool?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteToolMutation.mutate(deleteConfirm.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Tool
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
