"use client";

import { Label } from "@/components/ui/label";

export function FieldWrapper({
  id,
  label,
  required,
  helpText,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5" id={`field-${id}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
