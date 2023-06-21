'use client'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { boolean, object, string } from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import Checkbox from '@/components/checkbox'
import downloadZip from '@/lib/downloadFile'
import Button from './button'

interface FormValues {
  codingSequence: string
  species: 'none' | 'homoSapiens' | 'musMusculus'
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
      /^[ACGTacgt]+$/,
      'Invalid coding sequence. Must contain only A, C, G, or T.'
    )
    .test(
      'is-multiple-of-three',
      'Invalid coding sequence. Must be a multiple of 3.',
      (value) => value.length % 3 === 0
    )
    .default(''),
  species: string().oneOf(['none', 'homoSapiens', 'musMusculus']),
  removeCrypticSpliceSites: boolean().default(true),
  induceOptimalSpliceSites: boolean().default(true),
  '5PrimeStimulatoryIntron': boolean().default(true),
  '5PrimePFSWithNMD': boolean().default(true),
  '3PrimeStimulatoryIntron': boolean().default(true),
  '3PrimePFSWithNMD': boolean().default(true),
})

function CodingSequenceInput() {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormValues>()
  return (
    <div>
      <label
        htmlFor="codingSequence"
        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
      >
        Enter your own coding sequence
      </label>
      <input
        type="text"
        id="codingSequence"
        aria-invalid={errors.codingSequence ? 'true' : 'false'}
        {...register('codingSequence')}
        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-sky-500 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
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
        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
      >
        Species
      </label>
      <select
        id="species"
        {...register('species')}
        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-sky-500 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-sky-500 dark:focus:ring-sky-500"
      >
        <option value="none">None</option>
        <option value="homoSapiens">Homo sapiens</option>
        <option value="musMusculus">Mus musculus</option>
      </select>
    </div>
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

function FiveFragmentOptions() {
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
        label="Protein Fragment Suppression with Nonstop Mediated Decay"
        {...register('3PrimePFSWithNMD')}
      />
    </>
  )
}

function ThreeFragmentOptions() {
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
  return <Button type="submit">Submit</Button>
}

export default function GeneSplitterForm() {
  const methods = useForm<FormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: validationSchema.getDefault(),
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
          <CodingSequenceInput />
          <CodonOptimizationOptions />
          <FiveFragmentOptions />
          <ThreeFragmentOptions />
          <SubmitButton />
        </div>
      </form>
    </FormProvider>
  )
}
