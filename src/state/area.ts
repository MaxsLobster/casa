// Bereich der aktuellen Seiten: Casa (Familie) oder MWF (Arbeit). Die Casa-Seiten laufen ohne Provider = casa.
import { createContext, useContext } from 'react'
import type { Area } from '../lib/types'

export const AreaCtx = createContext<Area>('casa')

export function useArea(): Area {
  return useContext(AreaCtx)
}

/** Routen-Präfix des Bereichs: '' für Casa, '/mwf' für MWF */
export function areaBase(area: Area): string {
  return area === 'mwf' ? '/mwf' : ''
}
