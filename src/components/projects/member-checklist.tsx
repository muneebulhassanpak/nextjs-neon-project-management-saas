"use client";

import { Checkbox } from "@/components/ui/checkbox";

import { PersonAvatar, type PersonView } from "./people";

export interface AssignableMember extends PersonView {
  email: string;
}

/**
 * Checkboxes for picking project members. Inside a form, checked boxes submit as `name`;
 * otherwise use `checked` and `onCheckedChange`.
 */
export function MemberChecklist({
  members,
  name,
  defaultChecked = [],
  checked,
  onCheckedChange,
  disabled,
}: {
  members: AssignableMember[];
  name?: string;
  defaultChecked?: string[];
  checked?: string[];
  onCheckedChange?: (id: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
        No members to add yet. Owners and admins see every project; invite people with the Member
        role to assign them.
      </p>
    );
  }
  return (
    <ul className="grid max-h-56 gap-0.5 overflow-y-auto rounded-lg border p-1">
      {members.map((person) => {
        const id = `member-${person.id}`;
        return (
          <li key={person.id}>
            <label
              htmlFor={id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
            >
              <Checkbox
                id={id}
                name={name}
                value={person.id}
                disabled={disabled}
                {...(checked
                  ? {
                      checked: checked.includes(person.id),
                      onCheckedChange: (value) => onCheckedChange?.(person.id, value === true),
                    }
                  : { defaultChecked: defaultChecked.includes(person.id) })}
              />
              <PersonAvatar person={person} />
              <span className="grid min-w-0 text-sm leading-tight">
                <span className="truncate font-medium">{person.name}</span>
                <span className="truncate text-xs text-muted-foreground">{person.email}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
