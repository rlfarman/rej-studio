'use client'
import { z } from 'zod'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SpeciesValues } from '@/design-tool/types/species-options'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DNASplicer } from './dna-splicer'
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
  FormDescription,
} from '@/components/ui/form'
import { useForm, useFormContext, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { createJob } from '@/actions'
import { SpeciesOptions } from './species-options'
import { spec } from 'node:test/reporters'
import { toast } from 'sonner'

interface GeneSplitterFormProperties {
  defaultCodingSequence?: string
  defaultName?: string
  defaultSpecies?: SpeciesValues
}

const validationSchema = z.object({
  codingSequence: z
    .string()
    .nonempty('Coding sequence is required.')
    .regex(
      /^[ACGTUacgtu]+$/,
      'Invalid coding sequence. Must contain only A, C, G, T, or U.'
    )
    .refine((value) => value.length % 3 === 0, {
      message: 'Invalid coding sequence. Must be a multiple of 3.',
    }),
  name: z
    .string()
    .nonempty('A name is required.')
    .max(250, 'Must be less than 250 characters'),
  species: z.enum([
    SpeciesValues.None,
    SpeciesValues.Human,
    SpeciesValues.Mouse,
  ]),
  codonOptimizeWeight: z.number().min(0).max(1).default(0.5),
  removeCrypticSpliceSites: z.boolean(),
  removeCrypticSpliceSitesWeight: z.number().min(0).max(1).default(0.5),
  minimizeCpgs: z.boolean().default(true),
  minimizeCpgsWeight: z.number().min(0).max(1).default(0.5),
  reduceKmerComplexity: z.boolean().default(true),
  reduceKmerComplexityWeight: z.number().min(0).max(1).default(0.5),
  enforceGcContent: z.boolean().default(true),
  '5PrimeStimulatoryIntron': z.boolean().default(true),
  '3PrimeStimulatoryIntron': z.boolean().default(true),
  spliceJunctionPosition: z.number().min(1),
})

export type FormValues = z.infer<typeof validationSchema>

function NameInput() {
  const { control } = useFormContext<FormValues>()
  return (
    <FormField
      name="name"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Choose a name for your coding sequence</FormLabel>
          <FormControl>
            <Input type="text" placeholder="ABC123..." {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CodingSequenceInput() {
  const { control } = useFormContext<FormValues>()
  return (
    <FormField
      name="codingSequence"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Enter your coding sequence</FormLabel>
          <FormControl>
            <Input type="text" placeholder="ATGATTACA..." {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CustomizationOptions() {
  return (
    <div>
      <div className="grid grid-rows-2 gap-4">
        <NameInput />
        <CodingSequenceInput />
        <SpeciesOptions />
      </div>
    </div>
  )
}

function CodonOptimizeWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const species = watch('species')

  return (
    <FormField
      name="codonOptimizeWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Adjust priority for codon optimization</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={1}
              step={0.1}
              disabled={species === SpeciesValues.None}
            />
          </FormControl>
          {species === SpeciesValues.None && (
            <FormDescription>
              Please select a species to enable codon optimization.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function RemoveCrypticSpliceSitesWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const removeCrypticSpliceSites = watch('removeCrypticSpliceSites')

  return (
    <FormField
      name="removeCrypticSpliceSitesWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Adjust priority for removing cryptic splice sites
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={1}
              step={0.1}
              disabled={!removeCrypticSpliceSites}
            />
          </FormControl>
          {!removeCrypticSpliceSites && (
            <FormDescription>
              Enable "Remove cryptic splice sites" to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function MinimizeCpGsWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const minimizeCpgs = watch('minimizeCpgs')

  return (
    <FormField
      name="minimizeCpgsWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Adjust priority for minimizing CpG sites</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={1}
              step={0.1}
              disabled={!minimizeCpgs}
            />
          </FormControl>
          {!minimizeCpgs && (
            <FormDescription>
              Enable "Minimize CpG sites" to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function ReduceKmerComplexityWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const reduceKmerComplexity = watch('reduceKmerComplexity')

  return (
    <FormField
      name="reduceKmerComplexityWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Adjust priority for reducing k-mer complexity</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              min={0}
              max={1}
              step={0.1}
              disabled={!reduceKmerComplexity}
            />
          </FormControl>
          {!reduceKmerComplexity && (
            <FormDescription>
              Enable "Reduce k-mer complexity" to customize this weight.
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CodonOptimizationOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <div className="flex flex-col space-y-4">
      <Controller
        name="removeCrypticSpliceSites"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                id="removeCrypticSpliceSites"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Remove cryptic splice sites</FormLabel>
              <FormDescription>
                Remove cryptic splice sites from the sequence
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
      <Controller
        name="minimizeCpgs"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                id="minimizeCpgs"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Minimize CPG sites</FormLabel>
              <FormDescription>
                Minimize the number of CPG sites in the sequence
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
      <Controller
        name="reduceKmerComplexity"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                id="reduceKmerComplexity"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Reduce k-mer complexity</FormLabel>
              <FormDescription>
                Reduce the complexity of the sequence by minimizing repetitive
                k-mers
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
      <Controller
        name="enforceGcContent"
        control={control}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                id="enforceGcContent"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div>
              <FormLabel>Enforce GC Content</FormLabel>
              <FormDescription>
                Enforce a specific GC content in the sequence
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
    </div>
  )
}

function FiveFragmentOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <Controller
      name="5PrimeStimulatoryIntron"
      control={control}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
          <FormControl>
            <Checkbox
              id="5PrimeStimulatoryIntron"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <div>
            <FormLabel>5' Stimulatory Intron</FormLabel>
            <FormDescription>
              Add a 5' stimulatory intron to the sequence
            </FormDescription>
          </div>
        </FormItem>
      )}
    />
  )
}

function ThreeFragmentOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <Controller
      name="3PrimeStimulatoryIntron"
      control={control}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
          <FormControl>
            <Checkbox
              id="3PrimeStimulatoryIntron"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <div>
            <FormLabel>3' Stimulatory Intron</FormLabel>
            <FormDescription>
              Add a 3' stimulatory intron to the sequence
            </FormDescription>
          </div>
        </FormItem>
      )}
    />
  )
}

function SubmitButton() {
  const { formState } = useFormContext<FormValues>()
  return (
    <Button type="submit" className="inline" disabled={formState.isSubmitting}>
      Download customized sequence
    </Button>
  )
}

export function GeneSplitterForm({
  defaultCodingSequence,
  defaultName,
  defaultSpecies,
}: GeneSplitterFormProperties) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      removeCrypticSpliceSites: true,
      '5PrimeStimulatoryIntron': true,
      '3PrimeStimulatoryIntron': true,
      codonOptimizeWeight: 0.5,
      removeCrypticSpliceSitesWeight: 0.5,
      minimizeCpgs: true,
      minimizeCpgsWeight: 0.5,
      reduceKmerComplexity: true,
      reduceKmerComplexityWeight: 0.5,
      enforceGcContent: true,
      codingSequence: defaultCodingSequence ?? '',
      name: defaultName ?? '',
      species: defaultSpecies ?? SpeciesValues.None,
      spliceJunctionPosition: defaultCodingSequence
        ? parseInt((defaultCodingSequence.length / 2).toString())
        : 0,
    },
  })

  async function handleSubmitForm({
    codingSequence,
    name,
    species,
    codonOptimizeWeight,
    removeCrypticSpliceSites,
    removeCrypticSpliceSitesWeight,
    minimizeCpgs,
    minimizeCpgsWeight,
    reduceKmerComplexity,
    reduceKmerComplexityWeight,
    enforceGcContent,
    spliceJunctionPosition,
    '5PrimeStimulatoryIntron': stim5,
    '3PrimeStimulatoryIntron': stim3,
  }: FormValues) {
    const toastId = toast.loading('Submitting your request...')
    const options = {
      codon_optimize:
        species !== SpeciesValues.None ? species.toLowerCase() : null,
      codon_optimize_weight: codonOptimizeWeight,
      remove_cryptic_ss: removeCrypticSpliceSites,
      remove_cryptic_ss_weight: removeCrypticSpliceSitesWeight,
      minimize_CpGs: minimizeCpgs,
      minimize_CpGs_weight: minimizeCpgsWeight,
      reduce_kmer_complexity: reduceKmerComplexity,
      reduce_kmer_complexity_weight: reduceKmerComplexityWeight,
      enforce_gc: enforceGcContent,
      stim_5: stim5,
      stim_3: stim3,
      split_point: spliceJunctionPosition,
      ensure_wggw: true, // Always ensure WGGW motif
      wggw_threshold: 300, // Default threshold for WGGW
    }
    try {
      await createJob({
        userId: 'abcd1234',
        name,
        sequence: codingSequence,
        options,
      })
      const response = await fetch('/api/py/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          CDS: codingSequence,
          name,
          options,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to process the request.')
      }

      // Download the resulting FileResponse
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${name}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      toast.success(
        'Sequence processed successfully! Your download will start shortly.',
        { id: toastId }
      )
      console.log('Job created successfully')
    } catch (error) {
      toast.error('An error occurred while processing your request.', {
        id: toastId,
      })
      console.error('Error creating job:', error)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>REJ Studio Design Tool</CardTitle>
        <CardDescription>
          Design a custom RNA sequence for end-joining experiments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...methods}>
          <form onSubmit={methods.handleSubmit(handleSubmitForm)}>
            <CustomizationOptions />
            <Accordion type="multiple" className="mt-4">
              <AccordionItem value="codon-optimization">
                <AccordionTrigger>
                  <div>
                    <p>Customize codon optimization</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      By default, the sequence will be codon optimized for the
                      selected species.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-8 pt-4">
                  <CodonOptimizationOptions />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fragment-options">
                <AccordionTrigger>
                  <div>
                    <p>Customize fragment options</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Adjust settings for 5' and 3' stimulatory introns.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-8 pt-4">
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
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Adjust the splice junction position.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-8 pt-4">
                  <DNASplicer />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="weights">
                <AccordionTrigger>
                  <div>
                    <p>Customize parameter weights</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Fine tune the inputs to the algorithm.
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-8 pt-4">
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
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
