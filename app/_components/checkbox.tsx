'use client'
import { forwardRef } from 'react'

interface CheckboxProps {
  id: string
  label: string
  name: string
  helperText?: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  ref?: React.Ref<HTMLInputElement>
}

function Checkbox(
  { id, label, helperText, name, onChange, onBlur }: CheckboxProps,
  ref: React.Ref<HTMLInputElement>
) {
  return (
    <div className="flex">
      <div className="flex items-center h-5">
        <input
          id={id}
          aria-describedby={`${id}-helper-text`}
          type="checkbox"
          name={name}
          onChange={onChange}
          onBlur={onBlur}
          ref={ref}
        />
      </div>
      <div className="pl-2 text-sm">
        <label htmlFor={id}>{label}</label>
        {helperText && (
          <span id={`${id}-helper-text`} className="text-sm block">
            {helperText}
          </span>
        )}
      </div>
    </div>
  )
}

export default forwardRef<HTMLInputElement, CheckboxProps>(Checkbox)
