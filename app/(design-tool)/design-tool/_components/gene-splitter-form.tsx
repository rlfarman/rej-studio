'use client'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DNASplicer } from './dna-splicer'
import { Form } from '@/components/ui/form'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import type { DesignToolSpecies } from '@/design-tool/types/species-options'
import type { ProcessResult } from '@/design-tool/types/process-result'
import { validationSchema, FormValues } from './form-schema'
import { submitFormJson, formatOptionsForReport } from './form-handler'
import { CustomizationOptions } from './customization-options'
import { SpeciesOptions } from './species-options'
import { CodonOptimizationOptions } from './optimization-options'
import {
  FiveFragmentOptions,
  ThreeFragmentOptions,
} from './stimulatory-intron-options'
import {
  CodonOptimizeWeight,
  RemoveCrypticSpliceSitesWeight,
  MinimizeCpGsWeight,
  ReduceKmerComplexityWeight,
} from './weight-inputs'
import { SubmitButton } from './submit-button'
import { ResultsPanel } from './results-panel'
import { SequenceDiagnostics } from './sequence-diagnostics'
import { StrategyPresets } from './strategy-presets'
import { toast } from 'sonner'

interface GeneSplitterFormProperties {
  defaultCodingSequence?: string
  defaultName?: string
  defaultSpecies?: DesignToolSpecies
}

export function GeneSplitterForm({
  defaultCodingSequence,
  defaultName,
  defaultSpecies,
}: GeneSplitterFormProperties) {
  const [result, setResult] = useState<ProcessResult | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const methods = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    mode: 'onBlur',
    defaultValues: {
      removeCrypticSpliceSites: true,
      '5PrimeStimulatoryIntron': true,
      '3PrimeStimulatoryIntron': true,
      codonOptimizeWeight: 1,
      removeCrypticSpliceSitesWeight: 1,
      minimizeCpgs: true,
      minimizeCpgsWeight: 1,
      reduceKmerComplexity: true,
      reduceKmerComplexityWeight: 1,
      enforceGcContent: true,
      codingSequence: defaultCodingSequence ?? '',
      name: defaultName ?? '',
      species: defaultSpecies ?? 'none',
      spliceJunctionPosition: defaultCodingSequence
        ? Math.floor(defaultCodingSequence.length / 2)
        : 1,
    },
  })

  const onSubmit = async (values: FormValues) => {
    setResult(null)
    try {
      const res = await submitFormJson(values)
      setResult(res)
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    } catch (error) {
      let message = 'Something went wrong. Please try again.'
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        message =
          'Unable to reach the server. Please check your connection and try again.'
      } else if (error instanceof Error) {
        message = error.message
      }
      toast.error(message)
      console.error('Error processing sequence:', error)
    }
  }

  return (
    <Form {...methods}>
      {/* eslint-disable-next-line react-hooks/refs -- onSubmit is an event handler, ref is only accessed after async await */}
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Card 1: Input ── */}
        <Card>
          <CardHeader>
            <h1 className="text-2xl leading-none font-bold tracking-tight">
              REJ Studio Design Tool
            </h1>
            <CardDescription>
              Design a custom RNA sequence for end-joining experiments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CustomizationOptions />
            <SequenceDiagnostics />
            <SpeciesOptions />
            <div className="space-y-2">
              <p className="text-sm font-medium">Splice junction</p>
              <p className="text-muted-foreground text-sm">
                Set where the sequence splits into 5&apos; and 3&apos;
                fragments.
              </p>
              <DNASplicer />
            </div>
          </CardContent>
        </Card>

        {/* ── Card 2: Strategy ── */}
        <Card>
          <CardHeader>
            <CardTitle>Optimization Strategy</CardTitle>
            <CardDescription>
              Choose a preset or fine-tune individual parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StrategyPresets />
            <Accordion type="multiple">
              <AccordionItem value="codon-optimization">
                <AccordionTrigger>
                  <div>
                    <p>Codon optimization</p>
                    <p className="text-muted-foreground text-sm">
                      Control which sequence features are optimized.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-8">
                  <CodonOptimizationOptions />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fragment-options">
                <AccordionTrigger>
                  <div>
                    <p>Stimulatory introns</p>
                    <p className="text-muted-foreground text-sm">
                      Add introns to boost fragment expression.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-8">
                  <div className="flex flex-col space-y-4">
                    <FiveFragmentOptions />
                    <ThreeFragmentOptions />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="weights">
                <AccordionTrigger>
                  <div>
                    <p>Parameter weights</p>
                    <p className="text-muted-foreground text-sm">
                      Control how much each objective influences the result.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-8">
                  <div className="flex flex-col space-y-4">
                    <CodonOptimizeWeight />
                    <RemoveCrypticSpliceSitesWeight />
                    <MinimizeCpGsWeight />
                    <ReduceKmerComplexityWeight />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* ── Card 3: Review / Submit ── */}
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; Run</CardTitle>
            <CardDescription>
              Run the optimizer to generate your split sequences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <SubmitButton />
            </div>
          </CardContent>
        </Card>

        {result && (
          <div ref={resultsRef}>
            <ResultsPanel result={result} optionsUsed={formatOptionsForReport(methods.getValues())} />
          </div>
        )}
      </form>
    </Form>
  )
}
