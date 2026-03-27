import express from 'express'
import { generarCapsulas, supabase } from './generadorCapsulas.js'
import cors from 'cors'

console.log('🚀 SERVER NUEVO CARGADO')

const app = express()

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))

app.options('*', cors())
app.use(express.json())
app.use(express.static('public'))

// TEST SIMPLE (para comprobar que funciona)
app.get('/test', (req, res) => {
  res.send('OK TEST')
})

// generar cápsulas
app.post('/generar', async (req, res) => {
  const config = req.body

  try {
    await generarCapsulas(config.cantidad || 10, config)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// regenerar cápsulas
app.post('/regenerar', async (req, res) => {
  const config = req.body

  try {
    await supabase.from('capsulas').delete().not('id', 'is', null)

    await generarCapsulas(config.cantidad || 50, config)

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

/* 🔥 ESTA ES LA PARTE IMPORTANTE PARA RENDER */
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`)
})