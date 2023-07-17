'use client'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { boolean, object, string } from 'yup'
import Image from 'next/image'
import { yupResolver } from '@hookform/resolvers/yup'
import downloadZip from '@/design-tool/lib/download-zip'
import Checkbox from '@/components/checkbox'
import Button from '@/components/button'
import { SpeciesOptions } from '@/design-tool/types/species-options'

interface GeneSplitterFormProperties {
  defaultCodingSequence?: string
  defaultName?: string
  defaultSpecies?: SpeciesOptions
}

interface FormValues {
  name: string
  codingSequence: string
  species: SpeciesOptions
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
  species: string().oneOf([
    SpeciesOptions.All,
    SpeciesOptions.Human,
    SpeciesOptions.Mouse,
  ]),
  removeCrypticSpliceSites: boolean().default(true),
  induceOptimalSpliceSites: boolean().default(true),
  '5PrimeStimulatoryIntron': boolean().default(true),
  '5PrimePFSWithNMD': boolean().default(true),
  '3PrimeStimulatoryIntron': boolean().default(true),
  '3PrimePFSWithNMD': boolean().default(true),
})

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
        Enter a name for your custom coding sequence
      </label>
      <input
        type="text"
        id="name"
        aria-invalid={errors.name ? 'true' : 'false'}
        {...register('name')}
        className="block w-full max-w-xl rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-sm text-neutral-900 focus:border-sky-500 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
        placeholder="ABC123..."
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
        Enter your custom coding sequence
      </label>
      <input
        type="text"
        id="codingSequence"
        aria-invalid={errors.codingSequence ? 'true' : 'false'}
        {...register('codingSequence')}
        className="block w-full max-w-xl rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-sm text-neutral-900 focus:border-sky-500 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
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
    <div>
      <label
        htmlFor="species"
        className="mb-2 block text-sm text-neutral-900 dark:text-white"
      >
        Species
      </label>
      <select
        id="species"
        {...register('species')}
        className="block rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-sm text-neutral-900 focus:border-sky-500 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
      >
        <option value={SpeciesOptions['All']}>{SpeciesOptions['All']}</option>
        <option value={SpeciesOptions['Human']}>
          {SpeciesOptions['Human']}
        </option>
        <option value={SpeciesOptions['Mouse']}>
          {SpeciesOptions['Mouse']}
        </option>
      </select>
    </div>
  )
}

function CustomizationOptions() {
  return (
    <>
      <span>Customize your sequence</span>
      <NameInput />
      <CodingSequenceInput />
    </>
  )
}

function CodonOptimizationOptions() {
  const { register } = useFormContext<FormValues>()
  return (
    <>
      <span>Codon Optimization</span>
      <SpeciesSelect />
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
    </>
  )
}

function ThreeFragmentOptions() {
  const { register } = useFormContext<FormValues>()
  return (
    <>
      <span>3&apos; Fragment options</span>
      <Checkbox
        id="3PrimeStimulatoryIntron"
        label="3' Stimulatory Intron"
        {...register('3PrimeStimulatoryIntron')}
      />
      <Checkbox
        id="3PrimePFSWithNMD"
        label="Protein Fragment Suppression with Nonsense Mediated Decay"
        {...register('3PrimePFSWithNMD')}
      />
    </>
  )
}

function FiveFragmentOptions() {
  const { register } = useFormContext<FormValues>()
  return (
    <>
      <span>5&apos; Fragment options</span>
      <Checkbox
        id="5PrimeStimulatoryIntron"
        label="5' Stimulatory Intron"
        {...register('5PrimeStimulatoryIntron')}
      />
      <Checkbox
        id="5PrimePFSWithNMD"
        label="Protein Fragment Suppression with Nonstop Mediated Decay"
        {...register('5PrimePFSWithNMD')}
      />
    </>
  )
}

function SubmitButton() {
  return (
    <Button type="submit" className="inline">
      Submit
    </Button>
  )
}

export default function GeneSplitterForm({
  defaultCodingSequence,
  defaultName,
  defaultSpecies,
}: GeneSplitterFormProperties) {
  const methods = useForm<FormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      ...validationSchema.getDefault(),
      codingSequence: defaultCodingSequence ?? '',
      name: defaultName ?? '',
      species: defaultSpecies ?? SpeciesOptions.All,
    },
  })

  function handleSubmitForm(data: FormValues) {
    fetch('/api/form', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((res) => downloadZip(res))
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmitForm)}>
        <div className="flex flex-col gap-4">
          <Image
            src="/images/example-diagram.png"
            alt="A diagram showing how the different options of the form affect the result of RNA end-joining"
            width={800}
            height={176}
          />
          <CustomizationOptions />
          <CodonOptimizationOptions />
          <FiveFragmentOptions />
          <ThreeFragmentOptions />
        </div>
        <div className="mt-4">
          <SubmitButton />
        </div>
      </form>
    </FormProvider>
  )
}
