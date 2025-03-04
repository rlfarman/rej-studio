'use client'

import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Scissors } from 'lucide-react'

interface DNASplicerProps {
  dnaLength: number
  defaultPosition?: number
  onChange?: (position: number) => void
}

export default function DNASplicer({
  dnaLength = 4600,
  defaultPosition = Math.floor(dnaLength / 2),
  onChange,
}: DNASplicerProps) {
  const [position, setPosition] = useState(defaultPosition)

  const handleSliderChange = (value: number[]) => {
    const newPosition = Math.floor(value[0])
    setPosition(newPosition)
    if (onChange) {
      onChange(newPosition)
    }
  }

  const handlePositionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = Math.min(
      Math.max(Number(event.target.value), 1),
      dnaLength - 1
    )
    setPosition(newPosition)
    if (onChange) {
      onChange(newPosition)
    }
  }

  const handlePercentageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newPercentage = Math.min(Math.max(Number(event.target.value), 0), 100)
    const newPosition = Math.floor((newPercentage / 100) * dnaLength)
    setPosition(newPosition)
    if (onChange) {
      onChange(newPosition)
    }
  }

  const percentage = ((position / dnaLength) * 100).toFixed(1)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm font-medium">Position</p>
          <input
            type="number"
            value={position}
            onChange={handlePositionChange}
            className="text-2xl font-bold"
            style={{ width: `${String(position).length + 1.5}ch` }}
            min={1}
            max={dnaLength - 1}
          />
          <span className="text-muted-foreground text-sm font-normal">
            base pairs
          </span>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-muted-foreground text-sm font-medium">
            Percentage
          </p>
          <input
            type="number"
            value={percentage}
            onChange={handlePercentageChange}
            className="text-2xl font-bold"
            style={{ width: `${String(percentage).length + 1.5}ch` }}
            min={0}
            max={100}
          />
          <span className="text-muted-foreground text-sm font-normal">%</span>
        </div>
      </div>
      <div className="space-y-4">
        <Slider
          defaultValue={[position]}
          max={dnaLength}
          step={1}
          onValueChange={handleSliderChange}
          className="my-4"
          min={1}
        />

        <div className="bg-secondary relative h-8 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary absolute inset-y-0 left-0"
            style={{ width: `${percentage}%` }}
          />
          <div
            className="absolute inset-y-0 flex items-center justify-center"
            style={{ left: `${percentage}%` }}
          ></div>

          <div className="relative h-full w-full">
            <div className="absolute inset-0 flex items-center">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex flex-1 justify-center">
                  <div className="bg-muted-foreground/30 h-2 w-0.5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative w-full">
          <div className="absolute inset-0 flex">
            {Array.from({ length: 51 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full flex-1 items-center justify-center"
              >
                {i % 10 === 0 && (
                  <span className="text-muted-foreground absolute text-[8px]">
                    {Math.floor((i / 50) * dnaLength)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
