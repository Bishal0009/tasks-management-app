"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useWorkspace } from "../contexts/workspace-context";
import { Plus, Calendar } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";

const STATUS_CLASSES: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40",
  in_review: "bg-purple-100 text-purple-700 dark:bg-purple-900/40",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function TaskList() {
  const { activeWorkspace } = useWorkspace();
  const tasks = useQuery(
    api.tasks.list,
    activeWorkspace ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const statuses = useQuery(
    api.taskStatuses.listForWorkspace,
    activeWorkspace ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const members = useQuery(
    api.members.list,
    activeWorkspace ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tasks"> | null>(null);

  if (!activeWorkspace) return null;

  const canWrite = activeWorkspace.role !== "viewer";

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{activeWorkspace.name}</h2>
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New task
            </Button>
          )}
        </div>

        {tasks === undefined ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-lg border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : tasks === null ? (
          <p className="text-sm text-muted-foreground">
            Not a member of this workspace.
          </p>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm font-medium">No tasks yet</p>
            {canWrite && (
              <p className="mt-1 text-sm text-muted-foreground">
                Click <strong>New task</strong> to get started.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const status = statuses?.find((s) => s._id === task.statusId);
              const assignees = members?.filter((m) =>
                task.assigneeIds.includes(m.userId)
              ) || [];

              return (
                <button
                  key={task._id}
                  onClick={() => setSelectedTaskId(task._id)}
                  className="w-full text-left flex items-start gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium leading-snug truncate">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.description.replace(/<[^>]*>/g, "")}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      {status && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            STATUS_CLASSES[status.name.toLowerCase().replace(/\s+/g, "_")] ||
                            "bg-slate-100"
                          }`}
                          style={{ borderColor: status.color }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full mr-1"
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs ${PRIORITY_COLORS[task.priority]}`}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      {task.dueDate && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(task.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {assignees.length > 0 && (
                    <div className="flex -space-x-2 shrink-0">
                      {assignees.slice(0, 3).map((assignee) => (
                        <Avatar key={assignee.userId} className="h-6 w-6 border-2">
                          {assignee.imageUrl && (
                            <AvatarImage src={assignee.imageUrl} />
                          )}
                          <AvatarFallback className="text-xs">
                            {assignee.name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {assignees.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-muted border-2 flex items-center justify-center text-xs">
                          +{assignees.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={activeWorkspace._id}
      />

      <TaskDetailSheet
        open={selectedTaskId !== null}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        taskId={selectedTaskId}
      />
    </>
  );
}
