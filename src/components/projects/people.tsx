import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

export interface PersonView {
  id: string;
  name: string;
  image: string | null;
}

export function PersonAvatar({
  person,
  size = "sm",
  className,
}: {
  person: PersonView;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {person.image && <AvatarImage src={person.image} alt="" />}
      <AvatarFallback className="text-[10px] font-medium">{initials(person.name)}</AvatarFallback>
    </Avatar>
  );
}

/** Overlapping avatars with a "+N" for the rest. Names are listed for screen readers. */
export function AvatarStack({
  people,
  max = 4,
  className,
}: {
  people: PersonView[];
  max?: number;
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      <span className="sr-only">{people.map((p) => p.name).join(", ")}</span>
      {shown.map((person) => (
        <Tooltip key={person.id}>
          <TooltipTrigger asChild>
            <span aria-hidden>
              <PersonAvatar person={person} className="ring-2 ring-background" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{person.name}</TooltipContent>
        </Tooltip>
      ))}
      {rest > 0 && (
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
