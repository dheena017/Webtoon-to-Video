import React, { useEffect } from "react";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";

export type NotificationType = "error" | "success" | "info";

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

interface NotificationStackProps {
  notifications: Notification[];
  removeNotification: (id: number) => void;
}

export default function NotificationStack({ notifications, removeNotification }: NotificationStackProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.map((note) => (
        <div
          key={note.id}
          className={`pointer-events-auto flex items-center gap-3 p-4 rounded-xl border shadow-lg animate-in fade-in slide-in-from-right-4 transition-all ${
            note.type === "error"
              ? "bg-red-950/80 border-red-800 text-red-100"
              : note.type === "success"
              ? "bg-emerald-950/80 border-emerald-800 text-emerald-100"
              : "bg-blue-950/80 border-blue-800 text-blue-100"
          }`}
        >
          {note.type === "error" && <AlertCircle className="h-5 w-5 shrink-0" />}
          {note.type === "success" && <CheckCircle className="h-5 w-5 shrink-0" />}
          {note.type === "info" && <Info className="h-5 w-5 shrink-0" />}
          
          <p className="text-sm font-medium">{note.message}</p>
          
          <button 
            onClick={() => removeNotification(note.id)}
            className="ml-2 hover:bg-black/20 p-1 rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
