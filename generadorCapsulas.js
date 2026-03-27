import { createClient } from '@supabase/supabase-js'

// 🔐 CONFIG
const supabaseUrl = 'https://baexjpomqsuatgwiyuiu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZXhqcG9tcXN1YXRnd2l5dWl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA5MzkwMCwiZXhwIjoyMDg3NjY5OTAwfQ.dtK70-nOZQzeG7DN68zyKQjGX-VL6WXeA72Opfnqvfc'
export const supabase = createClient(supabaseUrl, supabaseKey)

const MAX_INTENTOS = 500

const normalizar = (a, b) => {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

// -------------------- DB --------------------

async function getEjercicios() {
  const { data, error } = await supabase
    .from('ejercicios')
    .select('id, tipo')
    .order('created_at', { ascending: true })
    .eq('activo', true)

  if (error) throw error
  return data
}

async function getParejasUsadas() {
  const { data, error } = await supabase
    .from('capsulas')
    .select('ejercicio_a_id, ejercicio_b_id')

  if (error) throw error

  const set = new Set()
  data.forEach(p => {
    set.add(normalizar(p.ejercicio_a_id, p.ejercicio_b_id))
  })

  return set
}

async function getFrecuenciaEjercicios() {
  const { data, error } = await supabase
    .from('capsulas')
    .select('ejercicio_a_id, ejercicio_b_id')

  if (error) throw error

  const freq = {}

  data.forEach(p => {
    freq[p.ejercicio_a_id] = (freq[p.ejercicio_a_id] || 0) + 1
    freq[p.ejercicio_b_id] = (freq[p.ejercicio_b_id] || 0) + 1
  })

  return freq
}

// 🔑 obtener siguiente orden
async function getSiguienteOrden() {
  const { data, error } = await supabase
    .from('capsulas')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1)

  if (error) throw error

  return data.length ? data[0].orden + 1 : 1
}

async function getEjerciciosRecientes(limite = 5) {
  const { data, error } = await supabase
    .from('capsulas')
    .select('ejercicio_a_id, ejercicio_b_id, orden')
    .order('orden', { ascending: false })
    .limit(limite)

  if (error) throw error

  const recientes = new Set()

  data.forEach(p => {
    recientes.add(p.ejercicio_a_id)
    recientes.add(p.ejercicio_b_id)
  })

  return recientes
}

// -------------------- LÓGICA --------------------

function agruparPorTipo(ejercicios) {
  return {
    eess: ejercicios.filter(e => e.tipo === 'eess'),
    cv: ejercicios.filter(e => e.tipo === 'cv'),
    eeii: ejercicios.filter(e => e.tipo === 'eeii'),
    global: ejercicios.filter(e => e.tipo === 'global')
  }
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5)
}

function seleccionarEjercicios(grupos) {
  const pick = (arr, n) => shuffle(arr).slice(0, n)

  return [
    ...pick(grupos.eess, 2),
    ...pick(grupos.cv, 2),
    ...pick(grupos.eeii, 3),
    ...pick(grupos.global, 1)
  ]
}


function generarParejas(ejercicios, parejasUsadas) {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const shuffled = shuffle([...ejercicios])
    const usadas = new Set()
    const parejas = []

    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        const a = shuffled[i].id
        const b = shuffled[j].id

        const key = normalizar(a, b)

        if (!parejasUsadas.has(key) && !usadas.has(a) && !usadas.has(b)) {
          parejas.push({ a, b })
          usadas.add(a)
          usadas.add(b)

          if (parejas.length === 4) return parejas
        }
      }
    }
  }

  return null
}

function seleccionarEjerciciosProgresivo(ejercicios, orden) {
  // cuantos ejercicios activar (crece con el tiempo)
  const crecimiento = 4  // cuantos se añaden por fase
  const bloque = 8      // cada cuántas cápsulas crece

  const totalActivos = Math.min(
    ejercicios.length,
    8 + Math.floor(orden / bloque) * crecimiento
  )

  // pool activo
  const activos = ejercicios.slice(0, totalActivos)

  return activos
}

// -------------------- INSERT --------------------
async function generarUnaCapsula(ejercicios, parejasUsadas, frecuencia, recientes, orden) {
  
  const tipoPorId = {}
    ejercicios.forEach(e => {
      tipoPorId[e.id] = e.tipo
    })
  const activos = seleccionarEjerciciosProgresivo(ejercicios, orden)
  const grupos = agruparPorTipo(activos)

  const penalizar = (id) => frecuencia[id] || 0

  for (let intento = 0; intento < 200; intento++) {
    const seleccion = seleccionarEjercicios(grupos)

    const posibles = []

    for (let i = 0; i < seleccion.length; i++) {
      for (let j = i + 1; j < seleccion.length; j++) {
        const a = seleccion[i].id
        const b = seleccion[j].id

        const key = normalizar(a, b)

       const esValida =
          !parejasUsadas.has(key) &&
          tipoPorId[a] !== tipoPorId[b] &&
          !recientes.has(a) &&
          !recientes.has(b)

        // fallback suave
        const esFallback =
          !parejasUsadas.has(key) &&
          tipoPorId[a] !== tipoPorId[b]

        if (esValida) {
          const score = penalizar(a) + penalizar(b)
          posibles.push({ a, b, score })
        } else if (posibles.length === 0 && esFallback) {
          // solo si no hay nada mejor
          const score = penalizar(a) + penalizar(b) + 100
          posibles.push({ a, b, score })
        }
      }
    }

    if (posibles.length > 0) {
      // ordenar por menor uso (clave)
      posibles.sort((x, y) => x.score - y.score)

      const mejor = posibles[0]

      const { error } = await supabase.from('capsulas').insert({
        orden: orden,
        titulo: `Cápsula ${orden}`,
        duracion: 10,
        activa: true,
        ejercicio_a_id: mejor.a,
        ejercicio_b_id: mejor.b
      })

      if (error) throw error

      // actualizar memoria
      frecuencia[mejor.a] = (frecuencia[mejor.a] || 0) + 1
      frecuencia[mejor.b] = (frecuencia[mejor.b] || 0) + 1

      parejasUsadas.add(normalizar(mejor.a, mejor.b))

      console.log(`✅ Cápsula ${orden} creada`)
      return
    }
  }

  console.log('⚠️ No se pudo generar cápsula')
}


// -------------------- MAIN --------------------

export async function generarCapsulas(cantidad = 1) {
  const ejercicios = await getEjercicios()
  const parejasUsadas = await getParejasUsadas()
  const frecuencia = await getFrecuenciaEjercicios()

  let orden = await getSiguienteOrden()

  for (let i = 0; i < cantidad; i++) {
    const recientes = await getEjerciciosRecientes(5)

    await generarUnaCapsula(
      ejercicios,
      parejasUsadas,
      frecuencia,
      recientes,
      orden
    )

    orden++
  }
}