import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useCurrentUser";

export function LogoMark({ className }: { className?: string }) {
  const { data: profile } = useProfile();
  
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-primary shadow-soft",
        className,
      )}
    >
      {profile?.logo_url ? (
        <img 
          src={profile.logo_url} 
          alt="Logo" 
          className="h-full w-full object-cover"
        />
      ) : (
        <Rocket className="h-1/2 w-1/2 text-primary-foreground" strokeWidth={2} />
      )}
    </div>
  );
}

export function LogoWord({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight", className)}>
      SPACE <span className="text-primary text-xl">TECH</span> <span className="ml-1 text-xs opacity-70">OS</span>
    </span>
  );
}
