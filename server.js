import express from 'express'
import { generarCapsulas, supabase } from './generadorCapsulas.js'

console.log('🚀 SERVER NUEVO CARGADO')

const app = express()

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

app.listen(3333, () => {
  console.log('Servidor en http://localhost:3333')
})