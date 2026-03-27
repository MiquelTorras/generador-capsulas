import express from 'express'
import { generarCapsulas, supabase } from './generadorCapsulas.js'
import cors from 'cors'


const app = express()

// 🔐 CORS (solo tu dominio)


app.use(cors())

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://www.homomobilis.net")
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }

  next()
})

app.use(express.json())
app.use(express.static('public'))

// TEST
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

// puerto Render
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`)
})