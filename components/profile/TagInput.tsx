"use client";

import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ui/tag";

type TagInputProps = {
  id: string;
  label: string;
  tags: string[];
  placeholder?: string;
  optional?: boolean;
  onChange: (tags: string[]) => void;
};

export function TagInput({
  id,
  label,
  tags,
  placeholder,
  optional = false,
  onChange,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const value = draft.trim();
    if (!value) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...tags, value]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  }

  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {optional ? " (Optional)" : ""}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <Button type="button" variant="muted" onClick={addTag}>
          Add
        </Button>
      </div>
      {tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Tag
              key={tag}
              label={tag}
              onRemove={() => onChange(tags.filter((t) => t !== tag))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
