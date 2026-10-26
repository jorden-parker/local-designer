"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  placeholder: string;
  disabled: boolean;
  onSubmit: (request: string) => void;
  suggestions?: string[];
};

export function Composer({ placeholder, disabled, onSubmit, suggestions = [] }: Props) {
  const [text, setText] = useState("");
  const request = text.trim();

  const submit = () => {
    if (!request || disabled) return;
    onSubmit(request);
    setText("");
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full px-2.5 py-0.5 text-xs text-gray-900 shadow-border hover:bg-gray-alpha-100 hover:text-gray-1000"
              onClick={() => setText(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Textarea
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={placeholder}
          className="pr-12"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={disabled || !request}
          className="absolute right-2 bottom-2"
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  );
}
