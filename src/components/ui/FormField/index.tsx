"use client";

import { Input } from "@heroui/react";

interface FormFieldProps {
  label: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  errorMessage?: string;
  description?: string;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  className?: string;
}

/**
 * Global FormField — a labelled HeroUI Input with consistent dark styling.
 */
export default function FormField({
  label,
  name,
  type = "text",
  placeholder,
  value,
  defaultValue,
  onChange,
  isRequired = false,
  isDisabled = false,
  isReadOnly = false,
  errorMessage,
  description,
  startContent,
  endContent,
  className = "",
}: FormFieldProps) {
  return (
    <Input
      name={name}
      type={type}
      label={label}
      labelPlacement="outside"
      placeholder={placeholder}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      isInvalid={!!errorMessage}
      errorMessage={errorMessage}
      description={description}
      startContent={startContent}
      endContent={endContent}
      className={className}
      classNames={{
        label: "text-zinc-500 dark:text-zinc-400 text-xs font-medium px-1",
        input: "text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm",
        inputWrapper:
          "bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 data-[focus=true]:border-blue-500 dark:data-[focus=true]:border-blue-400 transition-all rounded-xl shadow-sm",
        description: "text-zinc-500 text-[10px]",
        errorMessage: "text-red-500 dark:text-red-400 text-[10px] italic",
      }}
    />
  );
}
