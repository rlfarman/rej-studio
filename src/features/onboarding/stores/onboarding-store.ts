'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TourId } from '../types'

interface OnboardingState {
  /** Tours the user has completed or dismissed */
  completedTours: TourId[]
  /** Whether the welcome dialog has been shown */
  hasSeenWelcome: boolean
  /** Currently active tour (null if none) */
  activeTourId: TourId | null
  /** Current step index within the active tour */
  activeStepIndex: number

  markTourCompleted: (tourId: TourId) => void
  markWelcomeSeen: () => void
  startTour: (tourId: TourId) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (index: number) => void
  endTour: () => void
  resetAllTours: () => void
  isTourCompleted: (tourId: TourId) => boolean
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completedTours: [],
      hasSeenWelcome: false,
      activeTourId: null,
      activeStepIndex: 0,

      markTourCompleted: (tourId) =>
        set((state) => ({
          completedTours: state.completedTours.includes(tourId)
            ? state.completedTours
            : [...state.completedTours, tourId],
          activeTourId:
            state.activeTourId === tourId ? null : state.activeTourId,
          activeStepIndex:
            state.activeTourId === tourId ? 0 : state.activeStepIndex,
        })),

      markWelcomeSeen: () => set({ hasSeenWelcome: true }),

      startTour: (tourId) => set({ activeTourId: tourId, activeStepIndex: 0 }),

      nextStep: () =>
        set((state) => ({ activeStepIndex: state.activeStepIndex + 1 })),

      prevStep: () =>
        set((state) => ({
          activeStepIndex: Math.max(0, state.activeStepIndex - 1),
        })),

      goToStep: (index) => set({ activeStepIndex: index }),

      endTour: () => {
        const { activeTourId } = get()
        if (activeTourId) {
          set((state) => ({
            completedTours: state.completedTours.includes(activeTourId)
              ? state.completedTours
              : [...state.completedTours, activeTourId],
            activeTourId: null,
            activeStepIndex: 0,
          }))
        }
      },

      resetAllTours: () =>
        set({
          completedTours: [],
          hasSeenWelcome: false,
          activeTourId: null,
          activeStepIndex: 0,
        }),

      isTourCompleted: (tourId) => get().completedTours.includes(tourId),
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
