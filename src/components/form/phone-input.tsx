"use client";

import { useState, useMemo } from "react";
import { useController, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
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
import { ChevronsUpDown } from "lucide-react";
import { countries, type Country } from "@/lib/countries";
import { FieldWrapper } from "./field-wrapper";
import type { FormQuestion } from "@/lib/form-types";

const DEFAULT_COUNTRY = countries.find((c) => c.iso2 === "ZA")!;

export function PhoneInput({
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
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState(() => {
    if (field.value && typeof field.value === "string") {
      const match = countries.find(
        (c) => field.value.startsWith(c.dialCode) && c.iso2 !== "US"
      );
      if (match) {
        setSelectedCountry(match);
        return field.value.slice(match.dialCode.length);
      }
    }
    return "";
  });

  const searchableCountries = useMemo(
    () =>
      countries.map((c) => ({
        ...c,
        searchKey: `${c.name} ${c.iso2} ${c.dialCode}`.toLowerCase(),
      })),
    []
  );

  function handleCountrySelect(country: Country) {
    setSelectedCountry(country);
    setOpen(false);
    const full = localNumber ? `${country.dialCode}${localNumber.replace(/\D/g, "")}` : "";
    field.onChange(full);
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d\s-]/g, "");
    setLocalNumber(raw);
    const digits = raw.replace(/\D/g, "");
    const full = digits ? `${selectedCountry.dialCode}${digits}` : "";
    field.onChange(full);
  }

  return (
    <FieldWrapper
      id={question.id}
      label={question.label}
      required={question.required}
      helpText={question.helpText}
      error={fieldState.error?.message}
    >
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[140px] justify-between shrink-0 px-2"
              type="button"
            >
              <span className="truncate text-sm">
                {selectedCountry.flag} {selectedCountry.dialCode}
              </span>
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search country..." />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {searchableCountries.map((c) => (
                    <CommandItem
                      key={c.iso2}
                      value={c.searchKey}
                      onSelect={() => handleCountrySelect(c)}
                    >
                      <span className="mr-2">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {c.dialCode}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          id={question.id}
          type="tel"
          inputMode="tel"
          value={localNumber}
          onChange={handleNumberChange}
          onBlur={field.onBlur}
          placeholder="Phone number"
          className="flex-1"
          aria-invalid={!!fieldState.error}
          aria-describedby={
            fieldState.error ? `${question.id}-error` : undefined
          }
        />
      </div>
    </FieldWrapper>
  );
}
