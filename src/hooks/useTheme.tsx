import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Tema = 'oscuro' | 'claro'
const CLAVE_STORAGE = 'nexus-booking:tema-v2'

interface ThemeContextValue {
  tema: Tema
  alternarTema: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ tema: 'claro', alternarTema: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const guardado = localStorage.getItem(CLAVE_STORAGE)
    return guardado === 'oscuro' ? 'oscuro' : 'claro'
  })

  useEffect(() => {
    const html = document.documentElement
    // Setear data-theme para selectores CSS
    html.setAttribute('data-theme', tema)
    // Agregar/quitar clase para poder usar !important cuando sea necesario
    html.classList.toggle('tema-oscuro', tema === 'oscuro')
    html.classList.toggle('tema-claro',  tema === 'claro')
    localStorage.setItem(CLAVE_STORAGE, tema)
  }, [tema])

  function alternarTema() {
    setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro'))
  }

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
