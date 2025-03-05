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
import { SpeciesSelect } from './species-select'
import { Input } from '@/components/ui/input'

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
  removeCrypticSpliceSites: z.boolean(),
  removeCrypticSpliceSitesWeight: z.number().min(0).max(1).default(0.5),
  induceOptimalSpliceSites: z.boolean().default(true),
  induceOptimalSpliceSitesWeight: z.number().min(0).max(1).default(0.5),
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
        <SpeciesSelect />
      </div>
    </div>
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
            <Slider
              value={[field.value]}
              onValueChange={(value) => field.onChange(value[0])}
              min={0}
              max={1}
              step={0.1}
              disabled={!removeCrypticSpliceSites}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function InduceOptimalSpliceSitesWeight() {
  const { control, watch } = useFormContext<FormValues>()
  const induceOptimalSpliceSites = watch('induceOptimalSpliceSites')

  return (
    <FormField
      name="induceOptimalSpliceSitesWeight"
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Adjust priority for inducing optimal splice sites
          </FormLabel>
          <FormControl>
            <Slider
              value={[field.value]}
              onValueChange={(value) => field.onChange(value[0])}
              min={0}
              max={1}
              step={0.1}
              disabled={!induceOptimalSpliceSites}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CodonOptimizationOptions() {
  const { control } = useFormContext<FormValues>()
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-4">
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
              <FormLabel>Remove cryptic splice sites</FormLabel>
            </FormItem>
          )}
        />
        <RemoveCrypticSpliceSitesWeight />
      </div>
      <div className="space-y-4">
        <Controller
          name="induceOptimalSpliceSites"
          control={control}
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  id="induceOptimalSpliceSites"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel>Induce optimal splice sites</FormLabel>
            </FormItem>
          )}
        />
        <InduceOptimalSpliceSitesWeight />
      </div>
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
      induceOptimalSpliceSites: true,
      '5PrimeStimulatoryIntron': true,
      '3PrimeStimulatoryIntron': true,
      removeCrypticSpliceSitesWeight: 0.5,
      induceOptimalSpliceSitesWeight: 0.5,
      codingSequence: defaultCodingSequence ?? '',
      name: defaultName ?? '',
      species: defaultSpecies ?? SpeciesValues.None,
      spliceJunctionPosition: defaultCodingSequence
        ? parseInt((defaultCodingSequence.length / 2).toString())
        : 0,
    },
  })

  function handleSubmitForm({ codingSequence, ...options }: FormValues) {
    console.log(codingSequence, options)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>RNA End-Joining Design Tool</CardTitle>
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            </Accordion>
            <div className="mt-8 flex justify-self-end">
              <SubmitButton />
              {methods.formState.isSubmitting && (
                <span className="ml-2 text-sm text-neutral-800 dark:text-neutral-200">
                  Submitting...
                </span>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
