"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useWorkspace } from "../contexts/workspace-context";
import { toast } from "sonner";
import { X, Trash2, Plus, Upload, MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { RichTextEditor } from "./rich-text-editor";

interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: Id<"tasks"> | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function TaskDetailSheet({
  open,
  onOpenChange,
  taskId,
}: TaskDetailSheetProps) {
  const { activeWorkspace } = useWorkspace();
  const task = useQuery(api.tasks.get, taskId ? { taskId } : "skip");
  const statuses = useQuery(
    api.taskStatuses.listForWorkspace,
    activeWorkspace ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const labels = useQuery(
    api.labels.listForWorkspace,
    activeWorkspace ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const members = useQuery(
    api.members.list,
    activeWorkspace ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const subtasks = useQuery(
    api.subtasks.listForTask,
    taskId ? { taskId } : "skip"
  );
  const attachments = useQuery(
    api.taskAttachments.listForTask,
    taskId ? { taskId } : "skip"
  );
  const activity = useQuery(
    api.taskActivity.listForTask,
    taskId ? { taskId } : "skip"
  );

  const updateTask = useMutation(api.tasks.update);
  const addSubtask = useMutation(api.subtasks.add);
  const toggleSubtask = useMutation(api.subtasks.toggle);
  const removeSubtask = useMutation(api.subtasks.remove);
  const addComment = useMutation(api.taskActivity.addComment);
  const deleteAttachment = useMutation(api.taskAttachments.remove);
  const generateUploadUrl = useMutation(api.taskAttachments.generateUploadUrl);
  const saveAttachment = useMutation(api.taskAttachments.save);

  const [editTitle, setEditTitle] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [deleteAttachmentId, setDeleteAttachmentId] = useState<Id<"taskAttachments"> | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (task) setEditTitle(task.title);
  }, [task]);

  const handleTitleSave = async () => {
    if (!task || !activeWorkspace) return;
    if (editTitle.trim() === task.title) return;

    try {
      await updateTask({
        taskId: task._id,
        workspaceId: activeWorkspace._id,
        title: editTitle,
      });
    } catch (err: any) {
      toast.error("Failed to update title");
      setEditTitle(task.title);
    }
  };

  const handleDescriptionChange = (html: string) => {
    if (!task || !activeWorkspace) return;
    clearTimeout(descriptionTimeoutRef.current);
    descriptionTimeoutRef.current = setTimeout(async () => {
      try {
        await updateTask({
          taskId: task._id,
          workspaceId: activeWorkspace._id,
          description: html || undefined,
        });
      } catch (err: any) {
        toast.error("Failed to update description");
      }
    }, 800);
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !subtaskInput.trim()) return;
    try {
      await addSubtask({ taskId: task._id, title: subtaskInput });
      setSubtaskInput("");
    } catch (err: any) {
      toast.error("Failed to add sub-task");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !commentInput.trim()) return;
    try {
      await addComment({ taskId: task._id, content: commentInput });
      setCommentInput("");
    } catch (err: any) {
      toast.error("Failed to add comment");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !activeWorkspace || !e.target.files?.[0]) return;
    const file = e.target.files[0];

    try {
      const uploadUrl = await generateUploadUrl({
        workspaceId: activeWorkspace._id,
      });
      const result = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();

      await saveAttachment({
        taskId: task._id,
        storageId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      toast.success("File uploaded");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast.error("Failed to upload file");
    }
  };

  const handleDeleteAttachment = async () => {
    if (!deleteAttachmentId || !activeWorkspace) return;
    try {
      await deleteAttachment({
        attachmentId: deleteAttachmentId,
        workspaceId: activeWorkspace._id,
      });
      setDeleteAttachmentId(null);
      toast.success("File deleted");
    } catch (err: any) {
      toast.error("Failed to delete file");
    }
  };

  if (!task || !taskId || !activeWorkspace) return null;

  const statusColor = statuses?.find((s) => s._id === task.statusId)?.color || "#94a3b8";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b flex flex-row items-start justify-between">
            <div className="flex-1">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                className="text-lg font-semibold w-full bg-transparent border-none p-0 focus:outline-none focus:ring-2 focus:ring-primary rounded"
              />
              <SheetDescription className="mt-1">
                Created by {members?.find((m) => m.userId === task.createdBy)?.name || "Unknown"}
              </SheetDescription>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-6 p-6">
              {/* Left column */}
              <div className="col-span-2 space-y-6">
                {/* Description */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Description</h3>
                  <RichTextEditor
                    value={task.description}
                    onChange={handleDescriptionChange}
                  />
                </div>

                {/* Sub-tasks */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Sub-tasks</h3>
                  <div className="space-y-2">
                    {subtasks?.map((st) => (
                      <div key={st._id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => toggleSubtask({ subtaskId: st._id })}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span
                          className={`flex-1 text-sm ${
                            st.completed
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {st.title}
                        </span>
                        <button
                          onClick={() => removeSubtask({ subtaskId: st._id })}
                          className="p-1 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleAddSubtask} className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add sub-task..."
                      value={subtaskInput}
                      onChange={(e) => setSubtaskInput(e.target.value)}
                      className="text-sm"
                    />
                    <Button type="submit" size="sm" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </form>
                </div>

                {/* Attachments */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Attachments</h3>
                  <div className="space-y-1">
                    {attachments?.map((att) => (
                      <div key={att._id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{att.fileName}</span>
                        <button
                          onClick={() => setDeleteAttachmentId(att._id)}
                          className="p-1 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload file
                    </Button>
                  </div>
                </div>

                {/* Activity & Comments */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Activity
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {activity?.map((entry) => (
                      <div key={entry._id} className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          {entry.userImageUrl && (
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={entry.userImageUrl} />
                              <AvatarFallback>
                                {entry.userName?.[0]?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="font-medium text-xs">
                            {entry.userName}
                          </span>
                        </div>
                        <div
                          className={`pl-8 ${
                            entry.type === "activity"
                              ? "text-muted-foreground"
                              : "prose prose-sm max-w-none"
                          }`}
                        >
                          {entry.type === "activity" ? (
                            <p>{entry.content}</p>
                          ) : (
                            <div
                              className="text-xs"
                              dangerouslySetInnerHTML={{ __html: entry.content }}
                            />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground pl-8">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleAddComment} className="space-y-2 mt-3">
                    <textarea
                      placeholder="Add a comment..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      className="w-full text-sm border rounded p-2 min-h-12 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!commentInput.trim()}
                    >
                      Comment
                    </Button>
                  </form>
                </div>
              </div>

              {/* Right column - Metadata */}
              <div className="col-span-1 space-y-4">
                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Status</label>
                  <Select
                    value={task.statusId}
                    onValueChange={(statusId) =>
                      updateTask({
                        taskId: task._id,
                        workspaceId: activeWorkspace._id,
                        statusId: statusId as Id<"taskStatuses">,
                      }).catch(() => toast.error("Failed to update status"))
                    }
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses?.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Priority</label>
                  <Select
                    value={task.priority}
                    onValueChange={(priority) =>
                      updateTask({
                        taskId: task._id,
                        workspaceId: activeWorkspace._id,
                        priority: priority as any,
                      }).catch(() => toast.error("Failed to update priority"))
                    }
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Start date</label>
                  <Input
                    type="date"
                    value={
                      task.startDate
                        ? new Date(task.startDate).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      updateTask({
                        taskId: task._id,
                        workspaceId: activeWorkspace._id,
                        startDate: e.target.value
                          ? new Date(e.target.value).getTime()
                          : null,
                      }).catch(() => toast.error("Failed to update start date"))
                    }
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Due date</label>
                  <Input
                    type="date"
                    value={
                      task.dueDate
                        ? new Date(task.dueDate).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      updateTask({
                        taskId: task._id,
                        workspaceId: activeWorkspace._id,
                        dueDate: e.target.value
                          ? new Date(e.target.value).getTime()
                          : null,
                      }).catch(() => toast.error("Failed to update due date"))
                    }
                    className="h-8 text-xs"
                  />
                </div>

                {/* Labels */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Labels</label>
                  <div className="flex flex-wrap gap-1">
                    {task.labelIds.map((labelId) => {
                      const label = labels?.find((l) => l._id === labelId);
                      return (
                        <Badge
                          key={labelId}
                          className="text-xs"
                          style={{ backgroundColor: label?.color || "#94a3b8" }}
                        >
                          {label?.name}
                          <button
                            onClick={() =>
                              updateTask({
                                taskId: task._id,
                                workspaceId: activeWorkspace._id,
                                labelIds: task.labelIds.filter((id) => id !== labelId),
                              }).catch(() => toast.error("Failed to update labels"))
                            }
                            className="ml-1 hover:opacity-70"
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteAttachmentId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteAttachmentId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteAttachment}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
