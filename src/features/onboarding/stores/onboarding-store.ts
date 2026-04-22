'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TourId } from '../tours'

interface OnboardingState {
  completedTours: TourId[]
  hasSeenWelcome: boolean
  activeTourId: TourId | null
  welcomeDialogOpen: boolean
  guidedStepIndex: number

  markTourCompleted: (tourId: TourId) => void
  markWelcomeSeen: () => void
  startTour: (tourId: TourId) => void
  endTour: () => void
  resetAllTours: () => void
  isTourCompleted: (tourId: TourId) => boolean
  openWelcome: () => void
  closeWelcome: () => void
  setGuidedStepIndex: (index: number) => void
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completedTours: [],
      hasSeenWelcome: false,
      activeTourId: null,
      welcomeDialogOpen: false,
      guidedStepIndex: 0,

      markTourCompleted: (tourId) =>
        set((state) => ({
          completedTours: state.completedTours.includes(tourId)
            ? state.completedTours
            : [...state.completedTours, tourId],
        })),

      markWelcomeSeen: () => set({ hasSeenWelcome: true }),

      startTour: (tourId) =>
        set({
          activeTourId: tourId,
          ...(tourId === 'guided' ? { guidedStepIndex: 0 } : {}),
        }),

      endTour: () => {
        const { activeTourId } = get()
        if (activeTourId) {
          set((state) => ({
            completedTours: state.completedTours.includes(activeTourId)
              ? state.completedTours
              : [...state.completedTours, activeTourId],
            activeTourId: null,
            guidedStepIndex: 0,
          }))
        }
      },

      resetAllTours: () =>
        set({
          completedTours: [],
          hasSeenWelcome: false,
          activeTourId: null,
          guidedStepIndex: 0,
        }),

      isTourCompleted: (tourId) => get().completedTours.includes(tourId),

      openWelcome: () => set({ welcomeDialogOpen: true }),
      closeWelcome: () => set({ welcomeDialogOpen: false }),

      setGuidedStepIndex: (index) => set({ guidedStepIndex: index }),
    }),
    {
      name: 'rej-studio:onboarding',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        completedTours: state.completedTours,
        hasSeenWelcome: state.hasSeenWelcome,
      }),
    },
  ),
)
