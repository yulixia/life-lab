import { useState } from 'react'
import { Button } from './Button'
import { InlineError } from './InlineError'
import styles from './TagPicker.module.css'

type TagPickerProps = {
  label: string
  max?: number
  onChange: (tags: string[]) => void
  options: string[]
  value: string[]
}

export function TagPicker({ label, max = 5, onChange, options, value }: TagPickerProps) {
  const [customValue, setCustomValue] = useState('')
  const isFull = value.length >= max
  const visibleTags = [...options, ...value.filter((tag) => !options.includes(tag))]

  const toggle = (tag: string) => {
    onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag])
  }

  const addCustom = () => {
    const normalized = customValue.trim()
    if (!normalized || value.includes(normalized) || isFull) {
      return
    }
    onChange([...value, normalized])
    setCustomValue('')
  }

  return (
    <fieldset className={styles.picker}>
      <legend>{label}</legend>
      <div className={styles.tags}>
        {visibleTags.map((option) => (
          <button
            aria-pressed={value.includes(option)}
            disabled={!value.includes(option) && isFull}
            key={option}
            onClick={() => toggle(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
      <div className={styles.custom}>
        <input
          aria-label="自定义标签"
          maxLength={12}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder="自定义标签"
          value={customValue}
        />
        <Button disabled={isFull} onClick={addCustom} variant="secondary">
          添加
        </Button>
      </div>
      {isFull ? <InlineError>最多选择 {max} 个标签</InlineError> : null}
    </fieldset>
  )
}
