import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { boolean, object, string } from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import Checkbox from './checkbox'

interface FormValues {
  codingSequence: string
  removeCrypticSpliceSites: boolean
  induceOptimalSpliceSites: boolean
  "5'StimulatoryIntron": boolean
  "5'PFSWithNMD": boolean
  "3'StimulatoryIntron": boolean
  "3'PFSWithNMD": boolean
}

const validationSchema = object().shape({
  codingSequence: string()
    .required('Coding sequence is required.')
    .matches(/^[ACGTacgt]+$/, 'Invalid coding sequence.'),
  removeCrypticSpliceSites: boolean(),
  induceOptimalSpliceSites: boolean(),
  "5'StimulatoryIntron": boolean(),
  "5'PFSWithNMD": boolean(),
  "3'StimulatoryIntron": boolean(),
  "3'PFSWithNMD": boolean(),
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

function CodonOptimizationOptions() {
  const { register } = useFormContext<FormValues>()
  return (
    <>
      <span>Codon Optimization</span>
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
        id="3'StimulatoryIntron"
        label="3' Stimulatory Intron"
        {...register("3'StimulatoryIntron")}
      />
      <Checkbox
        id="3'PFSWithNMD"
        label="Protein Fragment Suppression with Nonstop Mediated Decay"
        {...register("3'PFSWithNMD")}
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
        id="5'StimulatoryIntron"
        label="5' Stimulatory Intron"
        {...register("5'StimulatoryIntron")}
      />
      <Checkbox
        id="5'PFSWithNMD"
        label="Protein Fragment Suppression with Nonstop Mediated Decay"
        {...register("5'PFSWithNMD")}
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
  })

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((data) => console.log(data))}>
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
