'use client'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { boolean, object, string } from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import Checkbox from '@/components/checkbox'

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
    .matches(/^[ACGTacgt]+$/, 'Invalid coding sequence.')
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
    <>
      <label htmlFor="codingSequence">Coding Sequence</label>
      <input
        type="text"
        id="codingSequence"
        aria-invalid={errors.codingSequence ? 'true' : 'false'}
        {...register('codingSequence')}
        className="text-black"
      />
      {typeof errors.codingSequence?.message === 'string' && (
        <span role="alert" className="block text-xs italic text-red-500">
          {errors.codingSequence.message}
        </span>
      )}
    </>
  )
}

function SpeciesSelect() {
  const { register } = useFormContext<FormValues>()
  return (
    <>
      <label htmlFor="species" className="text-sm">
        Species
      </label>
      <select id="species" {...register('species')} className="text-black">
        <option value="none">None</option>
        <option value="homoSapiens">Homo sapiens</option>
        <option value="musMusculus">Mus musculus</option>
      </select>
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
  return <button type="submit">Submit</button>
}

export default function GeneSplitterForm() {
  const methods = useForm<FormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: validationSchema.getDefault(),
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit((data) =>
          window.alert(
            `Hello and congratulations on clicking submit. Here are the options you selected:\n${JSON.stringify(
              data,
              null,
              2
            )}`
          )
        )}
      >
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
