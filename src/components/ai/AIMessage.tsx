import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/types";

export function AIMessage({ mensagem }: { mensagem: ChatMessage }) {
  const isUser = mensagem.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-secondary text-foreground",
        )}
      >
        {mensagem.content}
      </div>
    </div>
  );
}
