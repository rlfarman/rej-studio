interface CheckboxProps {
  id: string
  label: string
  helperText?: string
  name?: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  ref?: React.Ref<HTMLInputElement>
}

export default function Checkbox({
  id,
  label,
  helperText,
  ...props
}: CheckboxProps) {
  console.log(props)
  return (
    <div className="flex">
      <div className="flex items-center h-5">
        <input id={id} aria-describedby={`${id}-helper-text`} type="checkbox" />
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
