'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
import { validationSchema, FormValues } from './form-schema'
import { handleSubmitForm } from './form-handler'
import { CustomizationOptions } from './customization-options'
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

  return (
    <Card>
      <CardHeader>
        <h1 className="leading-none font-semibold">REJ Studio Design Tool</h1>
        <CardDescription>
          Design a custom RNA sequence for end-joining experiments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...methods}>
          <form onSubmit={methods.handleSubmit(handleSubmitForm)}>
            <div className="space-y-0">
            <CustomizationOptions />
            <Accordion type="multiple" className="mt-4">
              <AccordionItem value="codon-optimization">
                <AccordionTrigger>
                  <div>
                    <p>Customize codon optimization</p>
                    <p className="text-sm text-muted-foreground">
                      By default, the sequence will be codon optimized for the
                      selected species.
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
                    <p>Customize stimulatory introns</p>
                    <p className="text-sm text-muted-foreground">
                      Adjust settings for 5' and 3' stimulatory introns.
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
              <AccordionItem value="dna-splicer">
                <AccordionTrigger>
                  <div>
                    <p>Customize splice junction</p>
                    <p className="text-sm text-muted-foreground">
                      Set where the sequence splits into 5&apos; and 3&apos; fragments.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-8">
                  <DNASplicer />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="weights">
                <AccordionTrigger>
                  <div>
                    <p>Customize parameter weights</p>
                    <p className="text-sm text-muted-foreground">
                      Control how much each optimization factor influences the result.
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
            <div className="mt-8 flex justify-self-end">
              <SubmitButton />
            </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
