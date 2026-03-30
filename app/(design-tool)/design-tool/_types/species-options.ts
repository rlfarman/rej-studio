export enum SpeciesValues {
  None = 'none',
  Human = 'human',
  Mouse = 'mouse',
}

export enum SpeciesLabels {
  None = 'None',
  Human = 'Human',
  Mouse = 'Mouse',
}

export const SpeciesOptions = [
  {
    value: SpeciesValues.None,
    label: SpeciesLabels.None,
  },
  {
    value: SpeciesValues.Human,
    label: SpeciesLabels.Human,
  },
  {
    value: SpeciesValues.Mouse,
    label: SpeciesLabels.Mouse,
  },
] as const
