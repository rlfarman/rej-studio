'use client'
import { useCallback, useState } from 'react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { boolean, object, string } from 'yup'
import Image from 'next/image'
import { yupResolver } from '@hookform/resolvers/yup'
import downloadZip from '@/design-tool/lib/download-zip'
import Checkbox from '@/components/checkbox'
import Button from '@/components/button'
import {
  SpeciesOptions,
  SpeciesValues,
} from '@/design-tool/types/species-options'

interface GeneSplitterFormProperties {
  defaultCodingSequence?: string
  defaultName?: string
  defaultSpecies?: SpeciesValues
}

interface FormValues {
  name: string
  codingSequence: string
  species: SpeciesValues
  removeCrypticSpliceSites: boolean
  induceOptimalSpliceSites: boolean
  '5PrimeStimulatoryIntron': boolean
  '5PrimePFSWithNMD': boolean
  '3PrimeStimulatoryIntron': boolean
  '3PrimePFSWithNMD': boolean
}

const validationSchema = object().shape({
  codingSequence: string()
    .required('Coding sequence is required.')
    .matches(
      /^[ACGTUacgtu]+$/,
      'Invalid coding sequence. Must contain only A, C, G, T, or U.'
    )
    .test(
      'is-multiple-of-three',
      'Invalid coding sequence. Must be a multiple of 3.',
      (value) => value.length % 3 === 0
    ),
  name: string()
    .required('A name is required.')
    .test(
      'len',
      'Must be less than 250 characters',
      (val) => val.length <= 250
    ),
  species: string()
    .oneOf([SpeciesValues.None, SpeciesValues.Human, SpeciesValues.Mouse])
    .required()
    .default(SpeciesValues.None),
  removeCrypticSpliceSites: boolean().default(true),
  induceOptimalSpliceSites: boolean().default(true),
  '5PrimeStimulatoryIntron': boolean().default(true),
  '5PrimePFSWithNMD': boolean().default(false),
  '3PrimeStimulatoryIntron': boolean().default(true),
  '3PrimePFSWithNMD': boolean().default(false),
})

const ComingSoon = () => (
  <>
    Coming soon! Support our research by donating to{' '}
    <a
      className="text-sky-600 hover:underline dark:text-sky-500"
      href="https://www.salk.edu/scientist/samuel-pfaff/?form=MainDonate"
    >
      The Salk Institute
    </a>
  </>
)

function NameInput() {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>()
  return (
    <div>
      <label
        htmlFor="name"
        className="mb-2 block text-sm font-medium text-neutral-900 dark:text-white"
      >
        Choose a name for your coding sequence
      </label>
      <input
        type="text"
        id="name"
        aria-invalid={errors.name ? 'true' : 'false'}
        className="block w-full max-w-xl rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-neutral-900 focus:border-sky-500 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
        placeholder="ABC123..."
        {...register('name')}
      />
      {typeof errors.name?.message === 'string' && (
        <span
          role="alert"
          className="mt-2 text-sm text-red-600 dark:text-red-500"
        >
          {errors.name.message}
        </span>
      )}
    </div>
  )
}

function CodingSequenceInput() {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>()
  return (
    <div>
      <label
        htmlFor="codingSequence"
        className="mb-2 block text-sm font-medium text-neutral-900 dark:text-white"
      >
        Enter your coding sequence
      </label>
      <input
        type="text"
        id="codingSequence"
        aria-invalid={errors.codingSequence ? 'true' : 'false'}
        {...register('codingSequence')}
        className="block w-full max-w-xl rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-neutral-900 focus:border-sky-500 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
        placeholder="ATGATTACA..."
      />
      {typeof errors.codingSequence?.message === 'string' && (
        <span
          role="alert"
          className="mt-2 text-sm text-red-600 dark:text-red-500"
        >
          {errors.codingSequence.message}
        </span>
      )}
    </div>
  )
}

function SpeciesSelect() {
  const { register } = useFormContext<FormValues>()
  return (
    <div className="pb-2">
      <label
        htmlFor="species"
        className="mb-1 block text-sm font-medium text-neutral-900 dark:text-white"
      >
        Species
      </label>
      <select
        id="species"
        className="block rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-neutral-900 focus:border-sky-500 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
        {...register('species')}
      >
        {SpeciesOptions.map(({ label, value }) => (
          <option key={label} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}

function CustomizationOptions() {
  return (
    <div className="mt-4">
      <h3 className="pb-2 text-lg font-semibold">Customize your sequence</h3>
      <div className="flex flex-col gap-2">
        <NameInput />
        <CodingSequenceInput />
      </div>
    </div>
  )
}

function CodonOptimizationOptions() {
  const { register } = useFormContext<FormValues>()
  return (
    <div className="mt-4">
      <h3 className="pb-2 text-lg font-semibold">Codon Optimization</h3>
      <SpeciesSelect />
      <div className="mt-1 flex flex-col gap-1">
        <Checkbox
          id="removeCrypticSpliceSites"
          label="Remove cryptic splice sites"
          {...register('removeCrypticSpliceSites')}
        />
        <Checkbox
          id="induceOptimalSpliceSites"
          label="Induce optimal splice sites"
          {...register('induceOptimalSpliceSites')}
        />
      </div>
    </div>
  )
}

function FiveFragmentOptions() {
  const { register } = useFormContext<FormValues>()
  return (
    <div className="mt-4">
      <h3 className="pb-2 text-lg font-semibold">5&apos; Fragment options</h3>
      <div className="flex flex-col gap-1">
        <Checkbox
          id="5PrimeStimulatoryIntron"
          label="5' Stimulatory Intron"
          {...register('5PrimeStimulatoryIntron')}
        />
        <Checkbox
          id="5PrimePFSWithNMD"
          label="Protein Fragment Suppression with Nonstop Mediated Decay"
          helperText={<ComingSoon />}
          disabled
          {...register('5PrimePFSWithNMD')}
        />
      </div>
    </div>
  )
}

function ThreeFragmentOptions() {
  const { register } = useFormContext<FormValues>()
  return (
    <div className="mt-4">
      <h3 className="pb-2 text-lg font-semibold">3&apos; Fragment options</h3>
      <div className="flex flex-col gap-1">
        <Checkbox
          id="3PrimeStimulatoryIntron"
          label="3' Stimulatory Intron"
          {...register('3PrimeStimulatoryIntron')}
        />
        <Checkbox
          id="3PrimePFSWithNMD"
          label="Protein Fragment Suppression with Nonsense Mediated Decay"
          helperText={<ComingSoon />}
          disabled
          {...register('3PrimePFSWithNMD')}
        />
      </div>
    </div>
  )
}
function SubmitButton() {
  const {
    formState: { isSubmitting },
  } = useFormContext<FormValues>()
  return (
    <Button type="submit" className="inline" disabled={isSubmitting}>
      Download customized sequence
    </Button>
  )
}

export default function GeneSplitterForm({
  defaultCodingSequence,
  defaultName,
  defaultSpecies,
}: GeneSplitterFormProperties) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const showError = useCallback((message: string) => {
    setSubmitError(message)
    setTimeout(() => setSubmitError(null), 5000)
  }, [])
  const methods = useForm<FormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      ...validationSchema.getDefault(),
      codingSequence: defaultCodingSequence ?? '',
      name: defaultName ?? '',
      species: defaultSpecies ?? SpeciesValues.None,
    },
  })

  async function handleSubmitForm({ codingSequence, ...options }: FormValues) {
    setSubmitError(null)
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cds: codingSequence,
          options: {
            codon_optimize: options.species,
            remove_cryptic_ss: options.removeCrypticSpliceSites,
            induce_optimal_ss: options.induceOptimalSpliceSites,
            stim_5: options['5PrimeStimulatoryIntron'],
            stim_3: options['3PrimeStimulatoryIntron'],
          },
        }),
      })
      if (!res.ok) {
        showError(
          'Something went wrong generating your sequences. Please try again.'
        )
        return
      }
      await downloadZip(res)
    } catch (error) {
      console.error('Form submission failed:', error)
      showError(
        'Could not reach the server. Please check your connection and try again.'
      )
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmitForm)}>
        <CustomizationOptions />
        <div className="mt-8 rounded-lg p-2 dark:bg-neutral-200">
          <Image
            src="/images/example-diagram.png"
            alt="A diagram showing how the different options of the form affect the result of RNA end-joining"
            width={827}
            height={220}
          />
        </div>
        <CodonOptimizationOptions />
        <FiveFragmentOptions />
        <ThreeFragmentOptions />
        <div className="mt-8">
          <SubmitButton />
          {methods.formState.isSubmitting && (
            <span className="ml-2 text-sm text-neutral-800 dark:text-neutral-200">
              Submitting...
            </span>
          )}
          {submitError && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
              {submitError}
            </p>
          )}
        </div>
      </form>
    </FormProvider>
  )
}
