"use client";

import {
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  TextField,
} from "@heroui/react";

const inputVisualClass =
  "text-white placeholder:text-zinc-600 text-sm bg-zinc-800/60 border border-zinc-700 hover:border-zinc-600 data-[focus-within=true]:border-blue-500 transition-colors";

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
 * Global FormField — HeroUI TextField composition with consistent dark styling.
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
  const hasAdornment = startContent != null || endContent != null;

  return (
    <TextField
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      isInvalid={!!errorMessage}
      className={className}
    >
      <Label className="text-zinc-400 text-xs font-medium">{label}</Label>
      {hasAdornment ? (
        <InputGroup className={inputVisualClass}>
          {startContent != null ? (
            <InputGroup.Prefix className="text-zinc-400">{startContent}</InputGroup.Prefix>
          ) : null}
          <InputGroup.Input
            type={type}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent shadow-none outline-none"
          />
          {endContent != null ? (
            <InputGroup.Suffix className="text-zinc-400">{endContent}</InputGroup.Suffix>
          ) : null}
        </InputGroup>
      ) : (
        <Input
          type={type}
          placeholder={placeholder}
          className={inputVisualClass}
        />
      )}
      {description ? (
        <Description className="text-zinc-500 text-xs">{description}</Description>
      ) : null}
      {errorMessage ? (
        <FieldError className="text-red-400 text-xs">{errorMessage}</FieldError>
      ) : null}
    </TextField>
  );
}
