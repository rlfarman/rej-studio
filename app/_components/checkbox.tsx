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
      <div className="flex h-5 items-center">
        <input
          id={id}
          aria-describedby={`${id}-helper-text`}
          type="checkbox"
          name={name}
          onChange={onChange}
          onBlur={onBlur}
          ref={ref}
          className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-sky-600 focus:ring-2 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-sky-600"
        />
      </div>
      <div className="pl-2 text-sm">
        <label
          htmlFor={id}
          className="font-medium text-gray-900 dark:text-gray-300"
        >
          {label}
        </label>
        {helperText && (
          <span
            id={`${id}-helper-text`}
            className="text-xs font-normal text-gray-500 dark:text-gray-300"
          >
            {helperText}
          </span>
        )}
      </div>
    </div>
  )
}

export default forwardRef<HTMLInputElement, CheckboxProps>(Checkbox)
