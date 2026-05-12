"use client";

import { useState, useMemo } from "react";
import { useController, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { countries } from "@/lib/countries";
import { cn } from "@/lib/utils/cn";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion } from "@/lib/form-types";

export function CountrySelect({
  question,
  control,
}: {
  question: FormQuestion;
  control: Control<any>;
}) {
  const { field, fieldState } = useController({
    name: question.id,
    control,
  });

  const [open, setOpen] = useState(false);

  const searchableCountries = useMemo(
    () =>
      countries.map((c) => ({
        ...c,
        searchKey: `${c.name} ${c.iso2}`.toLowerCase(),
      })),
    []
  );

  const selected = countries.find((c) => c.iso2 === field.value);

  return (
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={question.id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            type="button"
            onBlur={field.onBlur}
          >
            {selected ? (
              <span>
                {selected.flag} {selected.name}
              </span>
            ) : (
              <span className="text-muted-foreground">Select country...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {searchableCountries.map((c) => (
                  <CommandItem
                    key={c.iso2}
                    value={c.searchKey}
                    onSelect={() => {
                      field.onChange(c.iso2);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        field.value === c.iso2 ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="mr-2">{c.flag}</span>
                    <span>{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
}
